import { useState, useEffect } from 'react';
import BookCatalogTable from './BookCatalogTable';
import AccountHeader from './AccountHeader';

const API_BASE = 'http://localhost:3000/api';

interface ModularDashboardProps {
  user: { userId: number; name: string; role: string };
  books: any[];
  borrowedBooks?: any[];
  activeBorrowsCount?: number;
  onBorrow?: (bookId: number, title: string) => void;
  onReturn?: (recordId: number, title: string) => void;
  onRefresh: () => void;
  onLogout?: () => void;
}

export default function ModularDashboard({
  user,
  books,
  borrowedBooks = [],
  activeBorrowsCount = 0,
  onBorrow,
  onReturn,
  onRefresh,
  onLogout
}: ModularDashboardProps) {
  const role = user.role;
  const [activeTab, setActiveTab] = useState<string>('inventory');
  
  // Circulation logs state
  const [borrowRecords, setBorrowRecords] = useState<any[]>([]);
  const [recordsSearch, setRecordsSearch] = useState('');

  // Backup state (Admin only)
  const [backups, setBackups] = useState<any[]>([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    const saved = localStorage.getItem('autoBackupEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [backupSortField, setBackupSortField] = useState<'createdAt' | 'backupName'>('createdAt');
  const [backupSortDirection, setBackupSortDirection] = useState<'asc' | 'desc'>('desc');

  // Stock management state (Staff & Admin)
  const [activeStockAction, setActiveStockAction] = useState<{ bookId: number; type: 'add' | 'remove' } | null>(null);
  const [stockQty, setStockQty] = useState<string>('5');
  
  // Add Book Form State (Admin only)
  const [categories, setCategories] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync auto backup preference to localStorage
  useEffect(() => {
    localStorage.setItem('autoBackupEnabled', JSON.stringify(autoBackupEnabled));
  }, [autoBackupEnabled]);

  // Tab switching fetch hooks
  useEffect(() => {
    if (activeTab === 'records' && (role === 'Staff' || role === 'Admin')) {
      fetchRecords();
    }
    if (activeTab === 'backups' && role === 'Admin') {
      fetchBackups();
    }
    if (role === 'Admin') {
      fetchCategories();
    }
  }, [activeTab, role]);

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/staff/records`);
      const data = await res.json();
      if (data.success) setBorrowRecords(data.data);
    } catch (err) {
      console.error('Failed to fetch records', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/backups`);
      const data = await res.json();
      if (data.success) setBackups(data.data);
    } catch (err) {
      console.error('Failed to fetch backups', err);
    }
  };

  // Stock update handler
  const handleStockSubmit = async (bookId: number) => {
    if (!activeStockAction) return;
    const qty = parseInt(stockQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/staff/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, quantity: qty, action: activeStockAction.type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ text: 'Stock updated successfully!', type: 'success' });
        setActiveStockAction(null);
        onRefresh();
      } else {
        setStatusMessage({ text: data.error || 'Failed stock update', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Admin: Toggle restriction
  const handleToggleRestriction = async (bookId: number, currentStatus: boolean, title: string) => {
    if (!window.confirm(`Confirm restriction toggle for "${title}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}/restrict`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRestricted: !currentStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  // Admin: Delete book
  const handleDeleteBook = async (bookId: number, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        onRefresh();
      } else {
        alert(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Admin: Backup & Sync
  const handleManualBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'Manual' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Manual backup created!');
        fetchBackups();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: number, backupName: string) => {
    if (!window.confirm(`Revert to "${backupName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backups/${backupId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        onRefresh();
        fetchBackups();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backups/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchBackups();
      }
    } finally {
      setLoading(false);
    }
  };

  // Backup sorting
  const handleSortBackups = (field: 'createdAt' | 'backupName') => {
    if (backupSortField === field) {
      setBackupSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setBackupSortField(field);
      setBackupSortDirection('asc');
    }
  };

  const sortedBackups = [...backups].sort((a, b) => {
    let aVal = backupSortField === 'createdAt' ? new Date(a.createdAt).getTime() : a.backupName.toLowerCase();
    let bVal = backupSortField === 'createdAt' ? new Date(b.createdAt).getTime() : b.backupName.toLowerCase();
    if (aVal < bVal) return backupSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return backupSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredRecords = borrowRecords.filter((r) =>
    r.userName.toLowerCase().includes(recordsSearch.toLowerCase()) ||
    r.bookTitle.toLowerCase().includes(recordsSearch.toLowerCase()) ||
    r.status.toLowerCase().includes(recordsSearch.toLowerCase())
  );

  // Dynamic Row Action Renderer based on user role
  const renderBookActions = (b: any) => {
    if (role === 'Member') {
      return (
        <button
          className="btn primary sm"
          disabled={b.IsRestricted || b.AvailableCopies <= 0 || activeBorrowsCount >= 3 || loading}
          onClick={() => onBorrow && onBorrow(b.bookId, b.title)}
        >
          {b.IsRestricted ? 'Restricted' : 'Borrow'}
        </button>
      );
    }

    if (activeStockAction && activeStockAction.bookId === b.bookId) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '180px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn secondary sm" onClick={() => setStockQty(Math.max(1, parseInt(stockQty) - 1).toString())}>-</button>
            <input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} style={{ width: '40px', textAlign: 'center' }} />
            <button className="btn secondary sm" onClick={() => setStockQty((parseInt(stockQty) + 1).toString())}>+</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn primary sm" onClick={() => handleStockSubmit(b.bookId)}>Confirm</button>
            <button className="btn secondary sm" onClick={() => setActiveStockAction(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button className="btn secondary sm stock-btn" onClick={() => { setActiveStockAction({ bookId: b.bookId, type: 'add' }); setStockQty('5'); }}>
          Add stock
        </button>
        <button className="btn secondary sm stock-btn" style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }} onClick={() => { setActiveStockAction({ bookId: b.bookId, type: 'remove' }); setStockQty('1'); }}>
          Remove stock
        </button>

        {/* Both Staff and Admin can restrict/unrestrict books */}
        {(role === 'Admin' || role === 'Staff') && (
          <button className="btn secondary sm stock-btn" style={{ backgroundColor: b.IsRestricted ? '#065f46' : '#9a3412', color: '#fed7aa' }} onClick={() => handleToggleRestriction(b.bookId, b.IsRestricted, b.title)}>
            {b.IsRestricted ? 'Unrestrict' : 'Restrict'}
          </button>
        )}

        {/* Only Admin can permanently delete books */}
        {role === 'Admin' && (
          <button className="btn secondary sm stock-btn" style={{ backgroundColor: '#450a0a', color: '#f87171' }} onClick={() => handleDeleteBook(b.bookId, b.title)}>
            Delete Book
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Render the Account Header Component here */}
      <AccountHeader 
        user={user} 
        activeBorrowsCount={activeBorrowsCount} 
        onLogout={onLogout} 
      />
      {/* Dynamic Tab Navigation */}
      <nav className="nav-tabs">
        <button className={activeTab === 'inventory' ? 'tab active' : 'tab'} onClick={() => setActiveTab('inventory')}>
          {role === 'Member' ? 'View Catalog & Borrow' : 'Inventory Management'}
        </button>

        {role === 'Member' && (
          <button className={activeTab === 'myBorrows' ? 'tab active' : 'tab'} onClick={() => setActiveTab('myBorrows')}>
            My Borrowed Books ({borrowedBooks.length})
          </button>
        )}

        {(role === 'Staff' || role === 'Admin') && (
          <button className={activeTab === 'records' ? 'tab active' : 'tab'} onClick={() => setActiveTab('records')}>
            Circulation Logs
          </button>
        )}

        {role === 'Admin' && (
          <button className={activeTab === 'backups' ? 'tab active' : 'tab'} onClick={() => setActiveTab('backups')}>
            System Backups & States
          </button>
        )}
      </nav>

      <main className="tab-content">
        {/* Inventory / Catalog Tab */}
        {activeTab === 'inventory' && (
          <div className="section">
            <BookCatalogTable books={books} renderActions={renderBookActions} showId={role !== 'Member'} />
          </div>
        )}

        {/* Member Borrowed Books Tab */}
        {activeTab === 'myBorrows' && role === 'Member' && (
          <div className="section">
            <h3>My Active Borrowed Books</h3>
            {borrowedBooks.length === 0 ? (
              <p>You currently have no active borrowed books.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th>Due Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowedBooks.map((b: any) => (
                    <tr key={b.recordId}>
                      <td>{b.title}</td>
                      <td>{b.category}</td>
                      <td>{b.author}</td>
                      <td>{new Date(b.dueDate).toLocaleDateString()}</td>
                      <td>
                        <button className="btn warning sm" disabled={loading} onClick={() => onReturn && onReturn(b.recordId, b.title)}>
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Circulation Logs Tab (Staff & Admin) */}
        {activeTab === 'records' && (role === 'Staff' || role === 'Admin') && (
          <div className="section">
            <div className="header-flex" style={{ marginBottom: '1rem' }}>
              <h3>System Circulation Logs</h3>
              <input type="text" placeholder="Search logs..." value={recordsSearch} onChange={(e) => setRecordsSearch(e.target.value)} className="search-input" />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>RecID</th>
                  <th>Borrower</th>
                  <th>Book Title</th>
                  <th>Borrow Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r: any) => (
                  <tr key={r.recordId}>
                    <td>{r.recordId}</td>
                    <td>{r.userName}</td>
                    <td>{r.bookTitle}</td>
                    <td>{new Date(r.borrowDate).toLocaleDateString()}</td>
                    <td>{new Date(r.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${r.status === 'Returned' ? 'success' : 'danger'}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Backups Tab (Admin only) */}
        {activeTab === 'backups' && role === 'Admin' && (
          <div className="section">
            <div className="header-flex">
              <h3>Automated & Manual Backup States</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn secondary sm" onClick={handleSyncBackups} disabled={loading}>Sync with Disk</button>
                <button className="btn primary sm" onClick={handleManualBackup} disabled={loading}>Create Manual Backup</button>
              </div>
            </div>
            <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', margin: '1rem 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoBackupEnabled} onChange={(e) => setAutoBackupEnabled(e.target.checked)} />
              Enable Automated Daily Backup
            </label>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th onClick={() => handleSortBackups('backupName')} style={{ cursor: 'pointer' }}>Filename {backupSortField === 'backupName' ? (backupSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}</th>
                  <th>Trigger</th>
                  <th onClick={() => handleSortBackups('createdAt')} style={{ cursor: 'pointer' }}>Timestamp {backupSortField === 'createdAt' ? (backupSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedBackups.map((b: any) => (
                  <tr key={b.backupId}>
                    <td>{b.backupId}</td>
                    <td>{b.backupName}</td>
                    <td><span className={`badge ${b.triggerType === 'Automated' ? 'success' : 'secondary'}`}>{b.triggerType}</span></td>
                    <td>{new Date(b.createdAt).toLocaleString()}</td>
                    <td><span className="badge success">{b.status}</span></td>
                    <td>
                      <button className="btn warning sm" disabled={loading} onClick={() => handleRestoreBackup(b.backupId, b.backupName)}>
                        Revert to State
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}