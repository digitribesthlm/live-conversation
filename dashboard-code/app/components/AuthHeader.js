'use client';

import { useAuth } from '../context/AuthContext';

export default function AuthHeader() {
  const { user, logout } = useAuth();
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="auth-header">
      <div className="user-info">
        <span className="user-email">{user.email}</span>
        {user.domain && <span className="user-domain">{user.domain}</span>}
      </div>
      
      <button 
        onClick={logout}
        className="logout-button"
      >
        Sign Out
      </button>
    </div>
  );
} 