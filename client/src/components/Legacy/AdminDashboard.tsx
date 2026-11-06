import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3000/api';

export default function AdminDashboard({ books, onRefresh }: { books: any[]; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'records' | 'backups'>('inventory');
  const [backups, setBackups] = useState<any[]>([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    const saved = localStorage.getItem('autoBackupEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [borrowRecords, setBorrowRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Stock action state
  const [activeStockAction, setActiveStockAction] = useState<{ bookId: number; type: 'add' | 'remove' } | null>(null);
  const [stockQty, setStockQty] = useState<string>('5');
  
  // Add Book Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [categoryIdInput, setCategoryIdInput] = useState('');
  const [authorNameInput, setAuthorNameInput] = useState('');
  const [copiesInput, setCopiesInput] = useState('3');

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Sorting states
  const [bookSortField, setBookSortField] = useState<'title' | 'author' | 'AvailableCopies' | null>(null);
  const [bookSortDirection, setBookSortDirection] = useState<'asc' | 'desc'>('asc');

  const [backupSortField, setBackupSortField] = useState<'createdAt' | 'backupName' | null>(null);
  const [backupSortDirection, setBackupSortDirection] = useState<'asc' | 'desc'>('desc'); // Default newest first for backups

  useEffect(() => {
    fetchCategories();
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab]);

  // Fetch backups list when tab becomes active
  useEffect(() => {
    if (activeTab === 'backups') {
      fetchBackups();
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('autoBackupEnabled', JSON.stringify(autoBackupEnabled));
  }, [autoBackupEnabled]);

  // Automated Backup Timer Hook (Triggers daily backup simulation if enabled)
  useEffect(() => {
    let interval: any;
    if (autoBackupEnabled) {
      interval = setInterval(async () => {
        try {
          await fetch(`${API_BASE}/admin/backups/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triggerType: 'Automated' })
          });
          if (activeTab === 'backups') fetchBackups();
        } catch (err) {
          console.error('Automated backup background task failed', err);
        }
      }, 86400000); // 24 hours interval (or test with shorter interval)
    }
    return () => clearInterval(interval);
  }, [autoBackupEnabled, activeTab]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
        if (data.data.length > 0) setCategoryIdInput(data.data[0].categoryId.toString());
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/staff/records`);
      const data = await res.json();
      if (data.success) setBorrowRecords(data.data);
    } catch (err) {
      console.error('Failed to fetch circulation records', err);
    }
  };

  const fetchBackups = async () => {
  try {
    const res = await fetch(`${API_BASE}/admin/backups`);
    const data = await res.json();
    if (data.success) setBackups(data.data);
  } catch (err) {
    console.error('Failed to fetch system backups', err);
  }
};

  const handleManualBackup = async () => {
    if (!window.confirm('Confirm manual backup creation? This will snapshot the current database state.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'Manual' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Manual backup created successfully!');
        fetchBackups();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: number, backupName: string) => {
    if (!window.confirm(`⚠️ WARNING: Reverting to "${backupName}" will overwrite current library inventory and active circulation records. Do you want to confirm restoration?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backups/${backupId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        onRefresh(); // Refresh books catalog in App.tsx
        fetchBackups();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
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
        fetchBackups(); // Refresh the table list
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrement = () => {
    const current = parseInt(stockQty, 10) || 1;
    if (current > 1) setStockQty((current - 1).toString());
  };

  const handleIncrement = () => {
    const current = parseInt(stockQty, 10) || 0;
    setStockQty((current + 1).toString());
  };

  const handleStockSubmit = async (bookId: number) => {
    if (!activeStockAction) return;
    const qty = parseInt(stockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setStatusMessage({ text: 'Please enter a valid positive number for copies.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/staff/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, quantity: qty, action: activeStockAction.type }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatusMessage({ 
          text: activeStockAction.type === 'add' ? 'Successfully added stock!' : 'Successfully removed stock!', 
          type: 'success' 
        });
        setActiveStockAction(null); 
        onRefresh(); 
      } else {
        setStatusMessage({ text: data.error || 'Failed to update inventory stock.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/admin/books/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput,
          categoryId: parseInt(categoryIdInput, 10),
          authorName: authorNameInput,
          availableCopies: parseInt(copiesInput, 10),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({ text: 'New book added to catalog successfully!', type: 'success' });
        setTitleInput('');
        setAuthorNameInput('');
        setShowAddForm(false);
        onRefresh();
      } else {
        setStatusMessage({ text: data.error || 'Failed to add book.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: number, title: string) => {
    if (!window.confirm(`Are you sure you want to completely delete "${title}"?`)) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({ text: 'Book deleted successfully.', type: 'success' });
        onRefresh();
      } else {
        setStatusMessage({ text: data.error || 'Failed to delete book.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRestriction = async (bookId: number, currentStatus: boolean, title: string) => {
    const actionText = currentStatus ? 'unrestrict' : 'restrict';
    if (!window.confirm(`Confirm to ${actionText} "${title}"?`)) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}/restrict`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRestricted: !currentStatus }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({ text: `Successfully updated restriction status. Button toggled.`, type: 'success' });
        onRefresh();
      } else {
        setStatusMessage({ text: data.error || 'Failed to update restriction.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSortBooks = (field: 'title' | 'author' | 'AvailableCopies') => {
    if (bookSortField === field) {
      setBookSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBookSortField(field);
      setBookSortDirection('asc');
    }
  };

  const handleSortBackups = (field: 'createdAt' | 'backupName') => {
    if (backupSortField === field) {
      setBackupSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBackupSortField(field);
      setBackupSortDirection('asc');
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting to books
  const sortedAndFilteredBooks = [...filteredBooks].sort((a, b) => {
    if (!bookSortField) return 0;
    let aVal = a[bookSortField];
    let bVal = b[bookSortField];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return bookSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return bookSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply sorting to backups
  const sortedBackups = [...backups].sort((a, b) => {
    if (!backupSortField) return 0;
    let aVal = backupSortField === 'createdAt' ? new Date(a.createdAt).getTime() : a.backupName.toLowerCase();
    let bVal = backupSortField === 'createdAt' ? new Date(b.createdAt).getTime() : b.backupName.toLowerCase();

    if (aVal < bVal) return backupSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return backupSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredRecords = borrowRecords.filter(r =>
    r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="admin-banner">
        <span>🔒 Admin Privilege Mode Active</span>
      </div>

      {/* Admin Navigation Tabs */}
      <nav className="nav-tabs">
        <button className={activeTab === 'inventory' ? 'tab active' : 'tab'} onClick={() => setActiveTab('inventory')}>Inventory Management</button>
        <button className={activeTab === 'records' ? 'tab active' : 'tab'} onClick={() => setActiveTab('records')}>Circulation Logs</button>
        <button className={activeTab === 'backups' ? 'tab active' : 'tab'} onClick={() => setActiveTab('backups')}>System Backups & States</button>
      </nav>

      <main className="tab-content">
        {activeTab === 'inventory' && (
          <div className="section">
            <div className="header-flex">
              <h3>Book Inventory Controls</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn primary sm" onClick={() => setShowAddForm(!showAddForm)}>
                  {showAddForm ? 'Cancel Form' : '+ Add New Book'}
                </button>
                <input 
                  type="text" 
                  placeholder="Search catalog..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  style={{ width: '220px' }}
                />
              </div>
            </div>

            {/* Add Book Form with Category Dropdown & Author Name */}
            {showAddForm && (
              <div className="auth-card" style={{ maxWidth: '100%', marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Add New Book to Catalog</h4>
                <form onSubmit={handleAddBookSubmit} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 0.8fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Book Title</label>
                    <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Category</label>
                    <select 
                      value={categoryIdInput} 
                      onChange={(e) => setCategoryIdInput(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Author Name</label>
                    <input type="text" value={authorNameInput} onChange={(e) => setAuthorNameInput(e.target.value)} placeholder="e.g. Stephen King" required />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Initial Copies</label>
                    <input type="number" value={copiesInput} onChange={(e) => setCopiesInput(e.target.value)} required min="1" />
                  </div>
                  <button type="submit" className="btn primary sm" disabled={loading} style={{ height: '41px' }}>
                    {loading ? 'Adding...' : 'Save Book'}
                  </button>
                </form>
              </div>
            )}

            {statusMessage && (
              <div className="error-banner" style={{
                backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: statusMessage.type === 'success' ? '#10b981' : '#ef4444',
                color: statusMessage.type === 'success' ? '#34d399' : '#fca5a5'
              }}>
                {statusMessage.text}
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th onClick={() => handleSortBooks('title')} style={{ cursor: 'pointer' }}>
                    Title {bookSortField === 'title' ? (bookSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
                  </th>
                  <th>Category</th>
                  <th onClick={() => handleSortBooks('author')} style={{ cursor: 'pointer' }}>
                    Author {bookSortField === 'author' ? (bookSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
                  </th>
                  <th onClick={() => handleSortBooks('AvailableCopies')} style={{ cursor: 'pointer' }}>
                    Copies {bookSortField === 'AvailableCopies' ? (bookSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
                  </th>
                  <th>Status</th>
                  <th>Management Options</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredBooks.map((b: any) => (
                  <tr key={b.bookId}>
                    <td>{b.bookId}</td>
                    <td>
                      <span style={{ textDecoration: b.IsRestricted ? 'line-through' : 'none', color: b.IsRestricted ? '#94a3b8' : 'inherit' }}>
                        {b.title}
                      </span>
                      {b.IsRestricted && (
                        <span className="badge danger" style={{ marginLeft: '8px' }}>Restricted</span>
                      )}
                    </td>
                    <td>{b.category}</td>
                    <td>{b.author}</td>
                    <td>{b.AvailableCopies}</td>
                    <td>
                      <span className={`badge ${b.IsRestricted ? 'danger' : 'success'}`}>
                        {b.IsRestricted ? 'Restricted' : 'Available'}
                      </span>
                    </td>
                    <td>
                      {activeStockAction && activeStockAction.bookId === b.bookId ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '200px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {activeStockAction.type === 'add' ? 'Add to stock:' : 'Remove from stock:'}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button className="btn secondary sm" onClick={handleDecrement} style={{ padding: '2px 8px', fontWeight: 'bold' }}>-</button>
                            <input 
                              type="number" 
                              value={stockQty} 
                              onChange={(e) => setStockQty(e.target.value)} 
                              style={{ width: '45px', textAlign: 'center', padding: '4px', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }}
                              min="1"
                            />
                            <button className="btn secondary sm" onClick={handleIncrement} style={{ padding: '2px 8px', fontWeight: 'bold' }}>+</button>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn primary sm" disabled={loading} onClick={() => handleStockSubmit(b.bookId)}>
                              {loading ? '...' : 'Confirm'}
                            </button>
                            <button className="btn secondary sm" onClick={() => setActiveStockAction(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button 
                            className="btn secondary sm stock-btn" 
                            onClick={() => { setActiveStockAction({ bookId: b.bookId, type: 'add' }); setStockQty('5'); setStatusMessage(null); }}
                          >
                            Add to stock
                          </button>
                          <button 
                            className="btn secondary sm stock-btn" 
                            style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                            onClick={() => { setActiveStockAction({ bookId: b.bookId, type: 'remove' }); setStockQty('1'); setStatusMessage(null); }}
                          >
                            Remove from stock
                          </button>
                          <button 
                            className="btn secondary sm stock-btn"
                            style={{ backgroundColor: b.IsRestricted ? '#065f46' : '#9a3412', color: '#fed7aa' }}
                            onClick={() => handleToggleRestriction(b.bookId, b.IsRestricted, b.title)}
                          >
                            {b.IsRestricted ? 'Unrestrict book' : 'Restrict book'}
                          </button>
                          <button 
                            className="btn secondary sm stock-btn" 
                            style={{ backgroundColor: '#450a0a', color: '#f87171' }}
                            onClick={() => handleDeleteBook(b.bookId, b.title)}
                          >
                            Delete Book
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="section">
            <div className="header-flex">
              <h3>System Circulation Logs</h3>
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>RecID</th>
                  <th>Borrower Name</th>
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
                      <span className={`badge ${r.status === 'Returned' ? 'success' : 'danger'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="section">
            <div className="header-flex">
              <h3>Automated & Manual Backup States</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Add the Sync Button here */}
                <button className="btn secondary sm" onClick={handleSyncBackups} disabled={loading}>
                  {loading ? 'Syncing...' : 'Sync with Disk'}
                </button>
                <button className="btn primary sm" onClick={handleManualBackup} disabled={loading}>
                  {loading ? 'Processing...' : 'Create Manual Backup'}
                </button>
              </div>
            </div>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoBackupEnabled} 
                onChange={(e) => setAutoBackupEnabled(e.target.checked)} 
              />
              Enable Automated Daily Backup
            </label>


            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Backup Filename / Tag</th>
                  <th>Trigger Type</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No backup records found. Create one above.</td>
                  </tr>
                ) : (
                  backups.map((b: any) => (
                    <tr key={b.backupId}>
                      <td>{b.backupId}</td>
                      <td>{b.backupName}</td>
                      <td>
                        <span className={`badge ${b.triggerType === 'Automated' ? 'success' : 'secondary'}`}>
                          {b.triggerType}
                        </span>
                      </td>
                      <td>{new Date(b.createdAt).toLocaleString()}</td>
                      <td>
                        <span className="badge success">{b.status}</span>
                      </td>
                      <td>
                        <button 
                          className="btn warning sm"
                          disabled={loading}
                          onClick={() => handleRestoreBackup(b.backupId, b.backupName)}
                        >
                          Revert to State
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}