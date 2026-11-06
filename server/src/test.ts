import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });
const API_BASE = 'http://localhost:3000/api';

let currentUserId: number | null = null;
let currentUserName: string | null = null;

async function apiCall(endpoint: string, method: 'GET' | 'POST', body?: object): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${API_BASE}${endpoint}`;
  console.log(`\n[API Request] ${method} ${url}`);
  if (body) {
    console.log(`[Payload]`, JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    console.log(`[API Response Status] ${response.status} ${response.statusText}`);
    console.log(`[API Response Body]`, JSON.stringify(data, null, 2));
    
    return { ok: response.ok, status: response.status, data };
  } catch (err: any) {
    console.error(`[API Network Error]`, err.message);
    return { ok: false, status: 500, data: { error: err.message } };
  }
}

async function showAuthMenu() {
  while (currentUserId === null) {
    console.log('\n==============================');
    console.log('     LIBRARY SYSTEM - AUTH    ');
    console.log('==============================');
    console.log('1. Login');
    console.log('2. Register Account');
    console.log('3. Exit');

    const choice = await rl.question('\nSelect an option (1-3): ');

    switch (choice.trim()) {
      case '1':
        await handleLogin();
        break;
      case '2':
        await handleRegister();
        break;
      case '3':
        console.log('Exiting...');
        rl.close();
        process.exit(0);
      default:
        console.log('Invalid option. Please choose 1, 2, or 3.');
    }
  }

  await showMainMenu();
}

async function handleLogin() {
  console.log('\n--- Login ---');
  const name = await rl.question('Enter Name: ');
  const password = await rl.question('Enter Password: ');

  const res = await apiCall('/login', 'POST', { name, password });
  
  if (res.ok && res.data.success) {
    currentUserId = res.data.userId;
    currentUserName = res.data.name;
    console.log(`\nSuccessfully logged in as ${currentUserName} (ID: ${currentUserId})`);
  } else {
    console.log('\n❌ Login failed:', res.data.error || 'Invalid credentials');
  }
}

async function handleRegister() {
  console.log('\n--- Register Account ---');
  const name = await rl.question('Enter Name: ');
  const password = await rl.question('Enter Password: ');

  const res = await apiCall('/register', 'POST', { name, password });
  if (res.ok) {
    console.log('Account registered successfully! You can now log in.');
  } else {
    console.log('Registration failed:', res.data.error || 'Unknown error');
  }
}

// --- MAIN MENU ---
async function showMainMenu() {
  while (currentUserId !== null) {
    // Fetch live borrow count for the limit display
    const statsRes = await apiCall(`/user/${currentUserId}/stats`, 'GET');
    const activeBorrows = statsRes.ok ? statsRes.data.activeBorrows : 0;

    console.log('\n==============================');
    console.log(`   MAIN MENU (User: ${currentUserName})`);
    console.log(`   Borrowing Limit: ${activeBorrows}/3`);
    console.log('==============================');
    console.log('1. View Catalog & Borrow Books');
    console.log('2. View My Borrowed Books & Return');
    console.log('3. Logout');

    const choice = await rl.question('\nSelect an option (1-3): ');

    switch (choice.trim()) {
      case '1':
        await browseAndBorrowBooks();
        break;
      case '2':
        await manageBorrowedBooks();
        break;
      case '3':
        console.log(`Logging out ${currentUserName}...`);
        currentUserId = null;
        currentUserName = null;
        break;
      default:
        console.log('Invalid option. Please choose between 1 and 3.');
    }
  }

  await showAuthMenu();
}

// Option 1: Interactive Catalog view with inline borrow option
async function browseAndBorrowBooks() {
  const res = await apiCall('/books', 'GET');
  if (!res.ok || !res.data.data) {
    console.log('Failed to load books.');
    return;
  }

  const books = res.data.data;
  console.log('\n--- AVAILABLE BOOKS CATALOG ---');
  console.log('ID  | Title                     | Genre       | Available Copies');
  console.log('--------------------------------------------------------------');
  books.forEach((b: any) => {
    console.log(
      `${String(b.bookId).padEnd(3)} | ` +
      `${String(b.title).padEnd(25)} | ` +
      `${String(b.genre).padEnd(11)} | ` +
      `${b.AvailableCopies}`
    );
  });
  console.log('--------------------------------------------------------------');

  const bookIdInput = await rl.question('\nEnter Book ID to borrow (or type 0 to go back): ');
  const bookId = parseInt(bookIdInput.trim(), 10);

  if (isNaN(bookId) || bookId === 0) return;

  const selectedBook = books.find((b: any) => b.bookId === bookId);
  if (!selectedBook) {
    console.log('❌ Invalid Book ID selected.');
    return;
  }

  const confirm = await rl.question(`Confirm borrow for "${selectedBook.title}"? (y/n): `);
  if (confirm.trim().toLowerCase() === 'y') {
    await apiCall('/borrow', 'POST', { bookId, userId: currentUserId });
  } else {
    console.log('Borrow action cancelled.');
  }
}

// Option 2: View active user borrows using unique recordId for returns
async function manageBorrowedBooks() {
  const res = await apiCall(`/user/${currentUserId}/borrowed`, 'GET');
  if (!res.ok || !res.data.data) {
    console.log('Failed to fetch your borrowed books.');
    return;
  }

  const borrows = res.data.data;
  console.log('\n--- MY ACTIVE BORROWED BOOKS ---');
  if (borrows.length === 0) {
    console.log('You currently have no active borrowed books.');
    return;
  }

  console.log('RecID | BookID | Title                     | Borrowed   | Due Date');
  console.log('---------------------------------------------------------------------');
  borrows.forEach((b: any) => {
    const borrowedDate = new Date(b.borrowDate).toLocaleDateString();
    const dueDate = new Date(b.dueDate).toLocaleDateString();
    console.log(
      `${String(b.recordId).padEnd(5)} | ` +
      `${String(b.bookId).padEnd(6)} | ` +
      `${String(b.title).padEnd(25)} | ` +
      `${borrowedDate.padEnd(10)} | ` +
      `${dueDate}`
    );
  });
  console.log('---------------------------------------------------------------------');

  const recordIdInput = await rl.question('\nEnter Record ID (RecID) to return (or type 0 to go back): ');
  const recordId = parseInt(recordIdInput.trim(), 10);

  if (isNaN(recordId) || recordId === 0) return;

  const targetRecord = borrows.find((b: any) => b.recordId === recordId);
  if (!targetRecord) {
    console.log('❌ You do not have an active borrow record with that Record ID.');
    return;
  }

  const confirm = await rl.question(`Confirm return for "${targetRecord.title}" (Record ID: ${recordId})? (y/n): `);
  if (confirm.trim().toLowerCase() === 'y') {
    await apiCall('/return', 'POST', { recordId, userId: currentUserId });
  } else {
    console.log('Return action cancelled.');
  }
}

// Start the CLI application
console.clear();
console.log('Starting Library CLI Test Client...');
showAuthMenu().catch((err) => {
  console.error('Fatal CLI Error:', err);
  rl.close();
});