import { useState } from 'react';

export default function MemberDashboard({ books, borrowedBooks, activeBorrowsCount, onBorrow, onReturn, loading }: any) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'borrowed'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting states
  const [bookSortField, setBookSortField] = useState<'title' | 'author' | 'AvailableCopies' | null>(null);
  const [bookSortDirection, setBookSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSortBooks = (field: 'title' | 'author' | 'AvailableCopies') => {
    if (bookSortField === field) {
      setBookSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBookSortField(field);
      setBookSortDirection('asc');
    }
  };

  const filteredBooks = books.filter((b: any) => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedAndFilteredBooks = [...filteredBooks].sort((a: any, b: any) => {
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

  return (
    <div>
      <nav className="nav-tabs">
        <button className={activeTab === 'catalog' ? 'tab active' : 'tab'} onClick={() => setActiveTab('catalog')}>
          View Catalog & Borrow
        </button>
        <button className={activeTab === 'borrowed' ? 'tab active' : 'tab'} onClick={() => setActiveTab('borrowed')}>
          My Borrowed Books ({borrowedBooks.length})
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'catalog' && (
          <div className="section">
            <div className="header-flex">
              <h3>Available Books Catalog</h3>
              <input 
                type="text" 
                placeholder="Search catalog..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ width: '220px' }}
              />
            </div>
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
                    Available Copies {bookSortField === 'AvailableCopies' ? (bookSortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
                  </th>
                  <th>Status</th>
                  <th>Action</th>
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
                      <button 
                        className="btn primary sm"
                        disabled={b.IsRestricted || b.AvailableCopies <= 0 || activeBorrowsCount >= 3 || loading}
                        onClick={() => onBorrow(b.bookId, b.title)}
                      >
                        {b.IsRestricted ? 'Restricted' : 'Borrow'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'borrowed' && (
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
                        <button 
                          className="btn warning sm"
                          disabled={loading}
                          onClick={() => onReturn(b.recordId, b.title)}
                        >
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
      </main>
    </div>
  );
}