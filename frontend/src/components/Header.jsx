import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../lib/auth';
import './Header.css';

export default function Header() {
  const user = getUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setConfirmLogout(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-logo">
        <span className="logo-icon">🏏</span>
        <span className="logo-text">Fantasy<span className="logo-accent">IITH</span></span>
      </div>
      {user && (
        <div className="header-right" ref={menuRef}>
          <button className="header-refresh" onClick={() => window.location.reload()} title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <div
            className="header-avatar"
            style={{ background: user.avatar_color }}
            onClick={() => { setOpen(!open); setConfirmLogout(false); }}
          >
            {user.name[0].toUpperCase()}
          </div>

          {open && (
            <div className="profile-menu fade-in">
              <div className="profile-menu-header">
                <div className="profile-menu-avatar" style={{ background: user.avatar_color }}>
                  {user.name[0].toUpperCase()}
                </div>
                <div className="profile-menu-details">
                  <span className="profile-menu-name">{user.name}</span>
                  <span className="profile-menu-role">Player</span>
                </div>
              </div>

              <div className="profile-menu-divider" />

              <button className="profile-menu-item" onClick={() => { navigate('/my-teams'); setOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                My Teams
              </button>

              <button className="profile-menu-item" onClick={() => { navigate('/leagues'); setOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                My Leagues
              </button>

              <div className="profile-menu-divider" />

              <button className={`profile-menu-item profile-logout ${confirmLogout ? 'confirm' : ''}`} onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {confirmLogout ? 'Tap again to confirm' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
