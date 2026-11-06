import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import sql from 'mssql';

import fs from 'fs/promises';
import path from 'path';

const SQL_PORT = 1433;
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig: sql.config = {
  server: 'localhost',
  port: SQL_PORT,
  database: 'LibraryDB',
  user: 'db_admin',
  password: '01062007',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function testDatabaseConnection() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log(`Connected to SQL Server (LibraryDB) successfully on port ${SQL_PORT}.`);
    await pool.close();
  } catch (err: any) {
    console.error('Database connection failed:', err.message);
  }
}

async function syncBackupsFolder(pool: sql.ConnectionPool) {
  const backupDir = 'D:\\LibraryDB_Backups';
  try {
    await fs.access(backupDir);
    const files = await fs.readdir(backupDir);
    const bakFiles = files.filter(f => f.toLowerCase().endsWith('.bak'));

    const existingRecords = await pool.request().query('SELECT FilePath FROM SystemBackups');
    const existingPaths = new Set(existingRecords.recordset.map(r => r.FilePath));

    for (const file of bakFiles) {
      const filePath = path.join(backupDir, file);
      if (!existingPaths.has(filePath)) {
        const triggerType = file.includes('Automated') ? 'Automated' : 'Manual';
        const stats = await fs.stat(filePath);
        
        await pool.request()
          .input('BackupName', sql.VarChar, path.parse(file).name)
          .input('FilePath', sql.VarChar, filePath)
          .input('TriggerType', sql.VarChar, triggerType)
          .input('CreatedAt', sql.DateTime, stats.birthtime)
          .query("INSERT INTO SystemBackups (BackupName, FilePath, TriggerType, CreatedAt, Status) VALUES (@BackupName, @FilePath, @TriggerType, @CreatedAt, 'Completed')");
      }
    }
  } catch (err) {
    console.error('Automatic background sync after restore failed:', err);
  }
}


// --- API ROUTES ---

// 1. Register User Route (Case-Insensitive Uniqueness Check)
app.post('/api/register', async (req: Request, res: Response) => {
  const { name, password } = req.body;
  const trimmedName = name.trim();
  const defaultEmail = `${trimmedName.toLowerCase().replace(/\s+/g, '')}@library.com`;

  try {
    const pool = await sql.connect(dbConfig);
    
    const existingUser = await pool.request()
      .input('Name', sql.VarChar, trimmedName)
      .query('SELECT UserId FROM UserAccounts WHERE LOWER(Name) = LOWER(@Name)');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username is already taken. Please choose another name.' 
      });
    }

    const result = await pool.request()
      .input('Name', sql.VarChar, trimmedName)
      .input('Email', sql.VarChar, defaultEmail)
      .input('Password', sql.VarChar, password)
      .query("INSERT INTO UserAccounts (Name, Email, Password, Role) VALUES (@Name, @Email, @Password, 'Member'); SELECT SCOPE_IDENTITY() AS UserId;");

    const newUserId = result.recordset[0].UserId;

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      userId: newUserId
    });
  } catch (err: any) {
    console.error('Registration failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Login Route
app.post('/api/login', async (req: Request, res: Response) => {
  const { name, password } = req.body;
  const trimmedName = name ? name.trim() : '';

  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('Name', sql.VarChar, trimmedName)
      .input('Password', sql.VarChar, password)
      .query('SELECT UserId AS userId, Name AS name, Role AS role FROM UserAccounts WHERE Name = @Name AND Password = @Password');

    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    const user = result.recordset[0];
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      userId: user.userId,
      name: user.name,
      role: user.role
    });
  } catch (err: any) {
    console.error('Login failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 3. View Books Route (Joined with Categories and Authors)
app.get('/api/books', async (req: Request, res: Response) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT b.BookId AS bookId, b.Title AS title, c.CategoryName AS category, a.AuthorName AS author, b.AvailableCopies, b.IsRestricted 
      FROM Books b
      JOIN Categories c ON b.CategoryId = c.CategoryId
      JOIN Authors a ON b.AuthorId = a.AuthorId
    `);

    return res.status(200).json({
      success: true,
      data: result.recordset
    });
  } catch (err: any) {
    console.error('Failed to fetch books:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. View User's Borrowed Books Route
app.get('/api/user/:userId/borrowed', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('UserID', sql.Int, userId)
      .query(`
        SELECT br.RecordId AS recordId, b.BookId AS bookId, b.Title AS title, c.CategoryName AS category, a.AuthorName AS author, br.BorrowDate AS borrowDate, br.DueDate AS dueDate, br.Status AS status
        FROM BorrowRecords br
        JOIN Books b ON br.BookId = b.BookId
        JOIN Categories c ON b.CategoryId = c.CategoryId
        JOIN Authors a ON b.AuthorId = a.AuthorId
        WHERE br.UserId = @UserID AND br.Status IN ('Borrowed', 'Overdue')
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset
    });
  } catch (err: any) {
    console.error('Failed to fetch user borrows:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get User Stats (Active Borrow Count) Route
app.get('/api/user/:userId/stats', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('UserID', sql.Int, userId)
      .query("SELECT COUNT(*) AS activeBorrows FROM BorrowRecords WHERE UserId = @UserID AND Status IN ('Borrowed', 'Overdue')");

    return res.status(200).json({
      success: true,
      activeBorrows: result.recordset[0].activeBorrows
    });
  } catch (err: any) {
    console.error('Failed to fetch user stats:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Borrow Book Route (With Transaction & Rollback)
app.post('/api/borrow', async (req: Request, res: Response) => {
  const { bookId, userId } = req.body;

  try {
    const pool = await sql.connect(dbConfig);

    // Check if user is a Member
    const userCheck = await pool.request()
      .input('UserID', sql.Int, userId)
      .query('SELECT Role FROM UserAccounts WHERE UserId = @UserID');

    if (userCheck.recordset[0].Role !== 'Member') {
      return res.status(403).json({ success: false, error: 'Staff and Admin accounts cannot borrow books.' });
    }

    // Check stock availability
    const bookCheck = await pool.request()
      .input('BookID', sql.Int, bookId)
      .query('SELECT AvailableCopies, IsRestricted FROM Books WHERE BookId = @BookID');

    if (bookCheck.recordset.length === 0) {
      return res.status(400).json({ success: false, error: 'Book does not exist.' });
    }

    if (bookCheck.recordset[0].IsRestricted === 1 || bookCheck.recordset[0].IsRestricted === true) {
      return res.status(403).json({ success: false, error: 'This book is currently restricted and cannot be borrowed.' });
    }

    if (bookCheck.recordset[0].AvailableCopies <= 0) {
      return res.status(400).json({ success: false, error: 'No available copies left for this book.' });
    }

    // Check active borrow limit (Max 3)
    const statsCheck = await pool.request()
      .input('UserID', sql.Int, userId)
      .query("SELECT COUNT(*) AS activeBorrows FROM BorrowRecords WHERE UserId = @UserID AND Status IN ('Borrowed', 'Overdue')");

    if (statsCheck.recordset[0].activeBorrows >= 3) {
      return res.status(400).json({ success: false, error: 'Borrow limit reached. Maximum 3 books allowed.' });
    }

    // Execute Transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('BookID', sql.Int, bookId)
        .query('UPDATE Books SET AvailableCopies = AvailableCopies - 1 WHERE BookId = @BookID');

      await new sql.Request(transaction)
        .input('BookID', sql.Int, bookId)
        .input('UserID', sql.Int, userId)
        .query("INSERT INTO BorrowRecords (BookId, UserId, BorrowDate, DueDate, Status) VALUES (@BookID, @UserID, GETDATE(), DATEADD(day, 7, GETDATE()), 'Borrowed')");

      await transaction.commit();
      return res.status(200).json({ success: true, message: 'Book borrowed successfully' });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err: any) {
    console.error('Borrow operation failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Return Book Route (With Transaction & Rollback)
app.post('/api/return', async (req: Request, res: Response) => {
  const { recordId, userId } = req.body;

  try {
    const pool = await sql.connect(dbConfig);
    
    const recordCheck = await pool.request()
      .input('RecordID', sql.Int, recordId)
      .input('UserID', sql.Int, userId)
      .query("SELECT BookId FROM BorrowRecords WHERE RecordId = @RecordID AND UserId = @UserID AND Status IN ('Borrowed', 'Overdue')");

    if (recordCheck.recordset.length === 0) {
      return res.status(400).json({ success: false, error: 'Active borrow record not found.' });
    }

    const bookId = recordCheck.recordset[0].BookId;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('RecordID', sql.Int, recordId)
        .query("UPDATE BorrowRecords SET Status = 'Returned', ReturnDate = GETDATE() WHERE RecordId = @RecordID");

      await new sql.Request(transaction)
        .input('BookID', sql.Int, bookId)
        .query('UPDATE Books SET AvailableCopies = AvailableCopies + 1 WHERE BookId = @BookID');

      await transaction.commit();
      return res.status(200).json({ success: true, message: 'Book returned successfully' });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err: any) {
    console.error('Return operation failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 8. Staff: Get All Circulation/Borrow Records Route
app.get('/api/staff/records', async (req: Request, res: Response) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT br.RecordId AS recordId, u.UserId AS userId, u.Name AS userName, 
             b.BookId AS bookId, b.Title AS bookTitle, 
             br.BorrowDate AS borrowDate, br.DueDate AS dueDate, br.Status AS status
      FROM BorrowRecords br
      JOIN UserAccounts u ON br.UserId = u.UserId
      JOIN Books b ON br.BookId = b.BookId
      ORDER BY br.BorrowDate DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.recordset
    });
  } catch (err: any) {
    console.error('Failed to fetch circulation records:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Staff: Restock/Update Book Copies Route
app.post('/api/staff/restock', async (req: Request, res: Response) => {
  const { bookId, quantity, action } = req.body; // action: 'add' or 'remove'
  try {
    const pool = await sql.connect(dbConfig);
    
    if (action === 'remove') {
      const bookCheck = await pool.request()
        .input('BookID', sql.Int, bookId)
        .query('SELECT AvailableCopies FROM Books WHERE BookId = @BookID');
        
      if (bookCheck.recordset.length === 0) {
        return res.status(400).json({ success: false, error: 'Book does not exist.' });
      }
      
      if (bookCheck.recordset[0].AvailableCopies - quantity < 0) {
        return res.status(400).json({ success: false, error: 'Cannot remove more copies than currently available stock.' });
      }
    }

    const qtyChange = action === 'remove' ? -Math.abs(quantity) : Math.abs(quantity);

    await pool.request()
      .input('BookID', sql.Int, bookId)
      .input('Qty', sql.Int, qtyChange)
      .query('UPDATE Books SET AvailableCopies = AvailableCopies + @Qty WHERE BookId = @BookID');

    return res.status(200).json({ success: true, message: 'Inventory updated successfully' });
  } catch (err: any) {
    console.error('Stock update failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 10. Admin: Add New Book Route (With Auto-Author Lookup/Creation)
app.post('/api/admin/books/add', async (req: Request, res: Response) => {
  const { title, categoryId, authorName, availableCopies } = req.body;
  
  if (!title || !categoryId || !authorName) {
    return res.status(400).json({ success: false, error: 'Missing required book fields.' });
  }

  try {
    const pool = await sql.connect(dbConfig);
    
    // 1. Check if author already exists (case-insensitive)
    const authorCheck = await pool.request()
      .input('AuthorName', sql.VarChar, authorName.trim())
      .query('SELECT AuthorId FROM Authors WHERE LOWER(AuthorName) = LOWER(@AuthorName)');

    let authorId: number;

    if (authorCheck.recordset.length > 0) {
      // Author exists, use their existing ID
      authorId = authorCheck.recordset[0].AuthorId;
    } else {
      // Author does not exist, create a new record and get the new ID
      const newAuthorResult = await pool.request()
        .input('AuthorName', sql.VarChar, authorName.trim())
        .query("INSERT INTO Authors (AuthorName, Country) VALUES (@AuthorName, 'Unknown'); SELECT SCOPE_IDENTITY() AS AuthorId;");
      
      authorId = newAuthorResult.recordset[0].AuthorId;
    }

    // 2. Insert the new book using the resolved authorId
    await pool.request()
      .input('Title', sql.VarChar, title.trim())
      .input('CatID', sql.Int, categoryId)
      .input('AuthID', sql.Int, authorId)
      .input('Copies', sql.Int, availableCopies || 1)
      .query('INSERT INTO Books (Title, CategoryId, AuthorId, AvailableCopies, IsRestricted) VALUES (@Title, @CatID, @AuthID, @Copies, 0)');

    return res.status(200).json({ success: true, message: 'Book added successfully' });
  } catch (err: any) {
    console.error('Failed to add book:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 11. Admin: Remove Book Route
app.delete('/api/admin/books/:bookId', async (req: Request, res: Response) => {
  const { bookId } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    
    // Check if book has active borrow logs preventing deletion
    const borrowCheck = await pool.request()
      .input('BookID', sql.Int, bookId)
      .query("SELECT RecordId FROM BorrowRecords WHERE BookId = @BookID AND Status IN ('Borrowed', 'Overdue')");

    if (borrowCheck.recordset.length > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete book with active borrow records.' });
    }

    await pool.request()
      .input('BookID', sql.Int, bookId)
      .query('DELETE FROM Books WHERE BookId = @BookID');

    return res.status(200).json({ success: true, message: 'Book deleted successfully' });
  } catch (err: any) {
    console.error('Failed to delete book:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 12. Admin: Toggle Book Restriction Route
app.patch('/api/admin/books/:bookId/restrict', async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const { isRestricted } = req.body; // boolean
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('BookID', sql.Int, bookId)
      .input('Restricted', sql.Bit, isRestricted ? 1 : 0)
      .query('UPDATE Books SET IsRestricted = @Restricted WHERE BookId = @BookID');

    return res.status(200).json({ success: true, message: 'Book restriction status updated' });
  } catch (err: any) {
    console.error('Failed to update restriction:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 13. Get Categories List (For Admin Dropdown)
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT CategoryId AS categoryId, CategoryName AS categoryName FROM Categories');
    return res.status(200).json({ success: true, data: result.recordset });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Admin: Add New Book (Accepts Category ID and Author Name)
app.post('/api/admin/books/add', async (req: Request, res: Response) => {
  const { title, categoryId, authorName, availableCopies } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    
    // Check if author exists, if not, create them automatically
    let authorRes = await pool.request()
      .input('AuthorName', sql.VarChar, authorName.trim())
      .query('SELECT AuthorId FROM Authors WHERE LOWER(AuthorName) = LOWER(@AuthorName)');

    let authorId: number;
    if (authorRes.recordset.length > 0) {
      authorId = authorRes.recordset[0].AuthorId;
    } else {
      const newAuthor = await pool.request()
        .input('AuthorName', sql.VarChar, authorName.trim())
        .query('INSERT INTO Authors (AuthorName, Country) VALUES (@AuthorName, \'Unknown\'); SELECT SCOPE_IDENTITY() AS AuthorId;');
      authorId = newAuthor.recordset[0].AuthorId;
    }

    // Insert Book
    await pool.request()
      .input('Title', sql.VarChar, title)
      .input('CatID', sql.Int, categoryId)
      .input('AuthID', sql.Int, authorId)
      .input('Copies', sql.Int, availableCopies)
      .query('INSERT INTO Books (Title, CategoryId, AuthorId, AvailableCopies, IsRestricted) VALUES (@Title, @CatID, @AuthID, @Copies, 0)');

    return res.status(200).json({ success: true, message: 'Book added successfully' });
  } catch (err: any) {
    console.error('Failed to add book:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 15. Admin: Get All System Backups
app.get('/api/admin/backups', async (req: Request, res: Response) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT BackupId AS backupId, BackupName AS backupName, FilePath AS filePath, 
             TriggerType AS triggerType, CreatedAt AS createdAt, Status AS status 
      FROM SystemBackups 
      ORDER BY CreatedAt DESC
    `);
    return res.status(200).json({ success: true, data: result.recordset });
  } catch (err: any) {
    console.error('Failed to fetch backups:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Admin: Trigger Manual or Automated Backup
app.post('/api/admin/backups/create', async (req: Request, res: Response) => {
  const { triggerType = 'Manual' } = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `LibraryDB_${triggerType}_${timestamp}`;
  
  // Change this path to your desired backup directory
  const backupPath = `D:\\LibraryDB_Backups\\${backupName}.bak`;

  try {
    const pool = await sql.connect(dbConfig);
    
    // Increase command timeout for this specific request if needed
    const backupQuery = `
      BACKUP DATABASE LibraryDB
      TO DISK = '${backupPath}'
      WITH FORMAT, INIT, NAME = '${backupName}';
    `;
    await pool.request().query(backupQuery);

    await pool.request()
      .input('BackupName', sql.VarChar, backupName)
      .input('FilePath', sql.VarChar, backupPath)
      .input('TriggerType', sql.VarChar, triggerType)
      .query("INSERT INTO SystemBackups (BackupName, FilePath, TriggerType, Status) VALUES (@BackupName, @FilePath, @TriggerType, 'Completed')");

    return res.status(200).json({ success: true, message: 'Backup created successfully', backupName });
  } catch (err: any) {
    console.error('Backup creation failed:', err.message);
    return res.status(400).json({ success: false, error: `Backup Failed: ${err.message}` });
  }
});

// 17. Admin: Revert / Restore Database to a Previous State
app.post('/api/admin/backups/:backupId/restore', async (req: Request, res: Response) => {
  const { backupId } = req.params;
  let currentPool: sql.ConnectionPool | null = null;
  let masterPool: sql.ConnectionPool | null = null;

  try {
    // 1. Connect and fetch backup metadata (Aliased both properties properly)
    currentPool = await sql.connect(dbConfig);

    const backupRecord = await currentPool.request()
      .input('BackupID', sql.Int, backupId)
      .query('SELECT BackupName AS backupName, FilePath AS filePath FROM SystemBackups WHERE BackupId = @BackupID');

    if (backupRecord.recordset.length === 0) {
      await currentPool.close();
      return res.status(404).json({ success: false, error: 'Backup record not found in database.' });
    }

    const { backupName, filePath } = backupRecord.recordset[0];
    
    console.log(`Attempting to restore backup "${backupName}" from path: "${filePath}"`);

    if (!filePath || filePath.trim() === '') {
      await currentPool.close();
      return res.status(400).json({ success: false, error: 'Restore Failed: FilePath is empty or undefined.' });
    }

    const safeFilePath = filePath.replace(/'/g, "''");

    // 2. Close current pool
    await currentPool.close();
    currentPool = null;

    // 3. Connect to master database
    const masterConfig: sql.config = {
      ...dbConfig,
      database: 'master',
      requestTimeout: 120000 
    };
    
    masterPool = await sql.connect(masterConfig);

    // 4. Execute Restore Queries Sequentially
    await masterPool.request().query(
      "ALTER DATABASE LibraryDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;"
    );

    await masterPool.request().query(
      `RESTORE DATABASE LibraryDB FROM DISK = N'${safeFilePath}' WITH REPLACE;`
    );

    await masterPool.request().query(
      "ALTER DATABASE LibraryDB SET MULTI_USER;"
    );

    await masterPool.close();
    masterPool = null;

    // 5. Automatically Resync Disk Files to the Restored SystemBackups Table
    try {
      const restoredPool = await sql.connect(dbConfig);
      await syncBackupsFolder(restoredPool);
      await restoredPool.close();
      console.log('Automatic backup disk sync completed successfully post-restore.');
    } catch (syncErr) {
      console.error('Post-restore auto-sync warning:', syncErr);
    }

    return res.status(200).json({
      success: true,
      message: `System successfully restored to state: ${backupName}`
    });

  } catch (err: any) {
    console.error('--- SQL RESTORE ERROR DIAGNOSTICS ---');
    console.error('Error Message:', err.message);
    console.error('SQL Error Number:', err.number);
    console.error('-------------------------------------');

    try {
      if (currentPool) await currentPool.close();
      if (masterPool) await masterPool.close();

      const emergencyPool = await sql.connect({ ...dbConfig, database: 'master' });
      await emergencyPool.request().query('ALTER DATABASE LibraryDB SET MULTI_USER;');
      await emergencyPool.close();
    } catch (cleanupErr) {
      console.error('Emergency cleanup failed:', cleanupErr);
    }

    const sqlErrorNum = err.number ? `[SQL Error ${err.number}] ` : '';
    return res.status(400).json({
      success: false,
      error: `Restore Failed: ${sqlErrorNum}${err.message}`
    });
  }
});

// 18. Admin: Sync SystemBackups table with physical directory files
app.post('/api/admin/backups/sync', async (req: Request, res: Response) => {
  const backupDir = 'D:\\LibraryDB_Backups';

  try {
    // 1. Read all files in the backup directory
    try {
      await fs.access(backupDir);
    } catch {
      return res.status(400).json({ success: false, error: 'Backup directory does not exist on disk.' });
    }

    const files = await fs.readdir(backupDir);
    const bakFiles = files.filter(f => f.toLowerCase().endsWith('.bak'));

    const pool = await sql.connect(dbConfig);

    // 2. Fetch existing backup file paths from database
    const existingRecords = await pool.request().query('SELECT FilePath FROM SystemBackups');
    const existingPaths = new Set(existingRecords.recordset.map(r => r.FilePath));

    let addedCount = 0;

    // 3. Loop through physical files and insert missing ones into DB
    for (const file of bakFiles) {
      const filePath = path.join(backupDir, file);
      
      if (!existingPaths.has(filePath)) {
        // Extract basic info from filename (e.g. LibraryDB_Manual_2026-11-06T...)
        const triggerType = file.includes('Automated') ? 'Automated' : 'Manual';
        
        // Get file creation time from stats
        const stats = await fs.stat(filePath);
        
        await pool.request()
          .input('BackupName', sql.VarChar, path.parse(file).name)
          .input('FilePath', sql.VarChar, filePath)
          .input('TriggerType', sql.VarChar, triggerType)
          .input('CreatedAt', sql.DateTime, stats.birthtime)
          .query("INSERT INTO SystemBackups (BackupName, FilePath, TriggerType, CreatedAt, Status) VALUES (@BackupName, @FilePath, @TriggerType, @CreatedAt, 'Completed')");
        
        addedCount++;
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Sync complete. Added ${addedCount} missing backup records from disk.` 
    });

  } catch (err: any) {
    console.error('Backup sync failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express Server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await testDatabaseConnection();
});