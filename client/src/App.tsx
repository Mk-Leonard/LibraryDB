import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import ModularDashboard from './components/ModularDashboard';
import './App.css';

const API_BASE = 'http://localhost:3000/api';

export default function App() {
  const [user, setUser] = useState<{ userId: number; name: string; role: string } | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [borrowedBooks, setBorrowedBooks] = useState<any[]>([]);
  const [activeBorrowsCount, setActiveBorrowsCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBooks();
      if (user.role === 'Member') fetchUserData();
    }
  }, [user]);

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/books`);
      const data = await res.json();
      if (data.success) setBooks(data.data);
    } catch (err) {
      console.error('Failed to fetch books', err);
    }
  };

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const resBorrowed = await fetch(`${API_BASE}/user/${user.userId}/borrowed`);
      const dataBorrowed = await resBorrowed.json();
      if (dataBorrowed.success) setBorrowedBooks(dataBorrowed.data);

      const resStats = await fetch(`${API_BASE}/user/${user.userId}/stats`);
      const dataStats = await resStats.json();
      if (dataStats.success) setActiveBorrowsCount(dataStats.activeBorrows);
    } catch (err) {
      console.error('Failed to fetch user data', err);
    }
  };

  const handleBorrow = async (bookId: number, title: string) => {
    if (!window.confirm(`Confirm borrow for "${title}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/borrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, userId: user?.userId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Book borrowed successfully!');
        fetchBooks();
        fetchUserData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (recordId: number, title: string) => {
    if (!window.confirm(`Confirm return for "${title}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, userId: user?.userId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Book returned successfully!');
        fetchBooks();
        fetchUserData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <ModularDashboard
      user={user}
      books={books}
      borrowedBooks={borrowedBooks}
      activeBorrowsCount={activeBorrowsCount}
      onBorrow={handleBorrow}
      onReturn={handleReturn}
      onRefresh={fetchBooks}
      onLogout={() => setUser(null)} // Clears user session back to Auth screen
    />
  );
}