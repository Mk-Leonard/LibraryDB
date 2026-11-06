import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3000/api';

export default function StaffDashboard({ books, onRefresh }: { books: any[]; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'records'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [borrowRecords, setBorrowRecords] = useState<any[]>([]);
  
  // Track active book, operation type ('add' | 'remove'), and quantity
  const [activeStockAction, setActiveStockAction] = useState<{ bookId: number; type: 'add' | 'remove' } | null>(null);
  const [stockQty, setStockQty] = useState<string>('5');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Sorting states
  const [bookSortField, setBookSortField] = useState<'title' | 'author' | 'AvailableCopies' | null>(null);
  const [bookSortDirection, setBookSortDirection] = useState<'asc' | 'desc'>('asc');

  
  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/staff/records`);
      const data = await res.json();
      if (data.success) setBorrowRecords(data.data);
    } catch (err) {
      console.error('Failed to fetch circulation records', err);
    }
  };

  const handleDecrement = () => {
    const current = parseInt(stockQty, 10) || 1;
    if (current > 1) {
      setStockQty((current - 1).toString());
    }
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
          text: activeStockAction.type === 'add' ? 'Successfully added stock to book copies!' : 'Successfully removed stock from book copies!', 
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

  const handleSortBooks = (field: 'title' | 'author' | 'AvailableCopies') => {
    if (bookSortField === field) {
      setBookSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBookSortField(field);
      setBookSortDirection('asc');
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

  const filteredRecords = borrowRecords.filter(r =>
    r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <nav className="nav-tabs">
        <button className={activeTab === 'inventory' ? 'tab active' : 'tab'} onClick={() => setActiveTab('inventory')}>
          Inventory Management
        </button>
        <button className={activeTab === 'records' ? 'tab active' : 'tab'} onClick={() => setActiveTab('records')}>
          Circulation & Borrow Status Logs
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'inventory' && (
          <div className="section">
            <div className="header-flex">
              <h3>Book Inventory Controls</h3>
              <input 
                type="text" 
                placeholder="Search by title, author, category..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

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
                    <td>{b.title}</td>
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
                            <button 
                              className="btn secondary sm" 
                              onClick={handleDecrement}
                              style={{ padding: '2px 8px', fontWeight: 'bold' }}
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              value={stockQty} 
                              onChange={(e) => setStockQty(e.target.value)} 
                              style={{ width: '45px', textAlign: 'center', padding: '4px', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }}
                              min="1"
                            />
                            <button 
                              className="btn secondary sm" 
                              onClick={handleIncrement}
                              style={{ padding: '2px 8px', fontWeight: 'bold' }}
                            >
                              +
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              className="btn primary sm" 
                              disabled={loading}
                              onClick={() => handleStockSubmit(b.bookId)}
                            >
                              {loading ? '...' : 'Confirm'}
                            </button>
                            <button 
                              className="btn secondary sm" 
                              onClick={() => setActiveStockAction(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button 
                            className="btn secondary sm stock-btn" 
                            onClick={() => {
                              setActiveStockAction({ bookId: b.bookId, type: 'add' });
                              setStockQty('5');
                              setStatusMessage(null);
                            }}
                          >
                            Add to stock
                          </button>
                          <button 
                            className="btn secondary sm stock-btn" 
                            style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                            onClick={() => {
                              setActiveStockAction({ bookId: b.bookId, type: 'remove' });
                              setStockQty('1');
                              setStatusMessage(null);
                            }}
                          >
                            Remove from stock
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
              <h3>System Circulation & Borrow Logs</h3>
              <input 
                type="text" 
                placeholder="Search by user or book title..." 
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
      </main>
    </div>
  );
}