import { useState, useMemo } from 'react';

interface BookCatalogTableProps {
  books: any[];
  renderActions: (book: any) => React.ReactNode;
  showId?: boolean;
}

type SearchScope = 'all' | 'title' | 'author' | 'category' | 'status';
type SortField = 'bookId' | 'title' | 'author' | 'AvailableCopies' | 'IsRestricted';

export default function BookCatalogTable({ books, renderActions, showId = false }: BookCatalogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Category filter state (Popup + Selected Genres)
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Extract all unique categories dynamically
  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(books.map((b) => b.category).filter(Boolean)));
    return cats.sort();
  }, [books]);

  // Handle Sort for ID, Title, Author, Copies, and Status
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Category Include/Exclude Checkbox Toggle
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // 1. Filtering Logic (Search Scope + Category Inclusions/Exclusions)
  const filteredBooks = books.filter((b) => {
    // Category Popup Filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(b.category)) {
      return false;
    }

    // Targeted Field Search
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const statusText = b.IsRestricted ? 'restricted' : 'available';

    if (searchScope === 'title') {
      return b.title.toLowerCase().includes(query);
    }
    if (searchScope === 'author') {
      return b.author.toLowerCase().includes(query);
    }
    if (searchScope === 'category') {
      return b.category.toLowerCase().includes(query);
    }
    if (searchScope === 'status') {
      return statusText.includes(query);
    }
    
    // Default 'all' fields search
    return (
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query) ||
      statusText.includes(query)
    );
  });

  // 2. Sorting Logic (Supports ID, Title, Author, Available Copies, and Status)
  const sortedAndFilteredBooks = [...filteredBooks].sort((a, b) => {
    if (!sortField) return 0;
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Header Flex with Targeted Search Controls */}
      <div className="header-flex" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
        <h3>Book Inventory & Catalog</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          <input
            type="text"
            placeholder={`Search ${searchScope === 'all' ? 'catalog' : searchScope}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: '280px' }}
          />

          {/* Search Field Scope Selector Buttons */}
          <div style={{ display: 'flex', gap: '4px', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>Search in:</span>
            {(['all', 'title', 'author', 'category', 'status'] as SearchScope[]).map((scope) => (
              <button
                key={scope}
                className={`btn sm ${searchScope === scope ? 'primary' : 'secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem', textTransform: 'capitalize' }}
                onClick={() => setSearchScope(scope)}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <table className="data-table">
        <thead>
          <tr>
            {showId && (
              <th onClick={() => handleSort('bookId')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                ID {sortField === 'bookId' ? (sortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
              </th>
            )}

            <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              Title {sortField === 'title' ? (sortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
            </th>

            {/* Category Header with Include/Exclude Popup Trigger */}
            <th style={{ position: 'relative', userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Category</span>
                <button
                  className="btn secondary sm"
                  style={{ padding: '1px 6px', fontSize: '0.75rem', background: selectedCategories.length > 0 ? '#3b82f6' : '#334155' }}
                  onClick={() => setShowCategoryPopup(!showCategoryPopup)}
                  title="Filter genres"
                >
                  ⚙️ {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ''}
                </button>
              </div>

              {/* Category Filter Inclusion/Exclusion Popup */}
              {showCategoryPopup && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 20,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    minWidth: '180px',
                    color: '#fff',
                    marginTop: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                    <strong style={{ fontSize: '0.8rem' }}>Filter Genres</strong>
                    {selectedCategories.length > 0 && (
                      <button
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                        onClick={() => setSelectedCategories([])}
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {availableCategories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <label key={cat} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategory(cat)}
                          />
                          <span style={{ color: isSelected ? '#34d399' : 'inherit' }}>{cat}</span>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    className="btn primary sm"
                    style={{ width: '100%', marginTop: '8px', padding: '4px' }}
                    onClick={() => setShowCategoryPopup(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </th>

            <th onClick={() => handleSort('author')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              Author {sortField === 'author' ? (sortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
            </th>

            <th onClick={() => handleSort('AvailableCopies')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              Available Copies {sortField === 'AvailableCopies' ? (sortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
            </th>

            {/* Clickable Sort for Status */}
            <th onClick={() => handleSort('IsRestricted')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              Status {sortField === 'IsRestricted' ? (sortDirection === 'asc' ? '🔼' : '🔽') : '↕️'}
            </th>

            <th>Management Options</th>
          </tr>
        </thead>

        <tbody>
          {sortedAndFilteredBooks.length === 0 ? (
            <tr>
              <td colSpan={showId ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                No matching books found.
              </td>
            </tr>
          ) : (
            sortedAndFilteredBooks.map((b) => (
              <tr key={b.bookId}>
                {showId && <td>{b.bookId}</td>}
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
                <td>{renderActions(b)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}