interface AccountHeaderProps {
  user: { name: string; role: string };
  activeBorrowsCount?: number;
  onLogout?: () => void;
}

export default function AccountHeader({ user, activeBorrowsCount = 0, onLogout }: AccountHeaderProps) {
  const isAdmin = user.role === 'Admin';

  return (
    <>
      {/* Additional admin banner placed at the top if role is Admin */}
      {isAdmin && (
        <div className="admin-banner">
          <span>🔒 Library Management System — Admin Privilege Mode Active ({user.name})</span>
        </div>
      )}

      {/* Existing header structure retained */}
      <header className="dashboard-header">
        <div className="dashboard-header-info">
          <h2>Library Portal (User: {user.name} | Role: {user.role})</h2>
          {user.role === 'Member' && (
            <span className={`badge ${activeBorrowsCount >= 3 ? 'danger' : 'success'}`}>
              Borrowing Limit: {activeBorrowsCount}/3
            </span>
          )}
        </div>
        {onLogout && (
          <button className="btn danger sm" onClick={onLogout}>
            Logout
          </button>
        )}
      </header>
    </>
  );
}