import { useState } from 'react';

export default function Auth({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegistering ? '/api/register' : '/api/login';

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput, password: passwordInput }),
      });
      const data = await res.json();

      if (res.ok) {
        if (isRegistering) {
          alert('Registration successful! Please log in.');
          setIsRegistering(false);
        } else {
          onLoginSuccess({ userId: data.userId, name: data.name, role: data.role });
        }
        setNameInput('');
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Library System - {isRegistering ? 'Register' : 'Login'}</h2>
        {authError && <div className="error-banner">{authError}</div>}
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label>Name:</label>
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password:</label>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
          </div>
          <button type="submit" className="btn primary">
            {isRegistering ? 'Register Account' : 'Login'}
          </button>
        </form>
        <p className="switch-auth">
          {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
          <span className="auth-link" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Login' : 'Register'}
          </span>
        </p>
      </div>
    </div>
  );
}