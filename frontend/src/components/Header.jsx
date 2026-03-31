import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout, updateProfile } from '../lib/auth';
import { getTheme, toggleTheme } from '../lib/theme';
import './Header.css';

export default function Header() {
  const [user, setUser] = useState(getUser());
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setConfirmLogout(false);
        setEditing(false);
        setSaveMsg('');
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

  const startEdit = () => {
    setEditing(true);
    setEditName(user.name);
    setEditPassword('');
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await updateProfile(user.id, editName.trim(), editPassword || null);
      setUser(updated);
      setSaveMsg('Saved!');
      setTimeout(() => {
        setEditing(false);
        setSaveMsg('');
      }, 1000);
    } catch (err) {
      setSaveMsg(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <header className="app-header">
      <div className="header-logo">
        <img src="/logo.svg" className="logo-icon" alt="PlayXI" />
        <span className="logo-text">Play<span className="logo-accent">XI</span></span>
      </div>
      {user && (
        <div className="header-right" ref={menuRef}>
          <button className="header-icon-btn" onClick={() => navigate('/points')} title="Points System">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          <button className="header-icon-btn" onClick={() => window.location.reload()} title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <div
            className="header-avatar"
            style={{ background: user.avatar_color }}
            onClick={() => { setOpen(!open); setConfirmLogout(false); setEditing(false); setSaveMsg(''); }}
          >
            {user.name[0].toUpperCase()}
          </div>

          {open && (
            <div className="profile-menu fade-in">
              {!editing ? (
                <>
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

                  <button className="profile-menu-item" onClick={startEdit}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit Profile
                  </button>

                  <button className="profile-menu-item" onClick={() => { const next = toggleTheme(); setThemeState(next); }}>
                    {theme === 'dark' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    )}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>

                  <div className="profile-menu-divider" />

                  <button className={`profile-menu-item profile-logout ${confirmLogout ? 'confirm' : ''}`} onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    {confirmLogout ? 'Tap again to confirm' : 'Logout'}
                  </button>
                </>
              ) : (
                /* ── Edit Profile Mode ── */
                <div className="profile-edit">
                  <div className="profile-edit-title">Edit Profile</div>
                  <div className="profile-edit-field">
                    <label className="profile-edit-label">Name</label>
                    <input
                      className="input profile-edit-input"
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="profile-edit-field">
                    <label className="profile-edit-label">New Password</label>
                    <input
                      className="input profile-edit-input"
                      type="password"
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                  {saveMsg && (
                    <div className={`profile-edit-msg ${saveMsg === 'Saved!' ? 'success' : 'error'}`}>
                      {saveMsg}
                    </div>
                  )}
                  <div className="profile-edit-actions">
                    <button className="btn btn-outline profile-edit-btn" onClick={() => { setEditing(false); setSaveMsg(''); }}>
                      Cancel
                    </button>
                    <button className="btn btn-primary profile-edit-btn" onClick={handleSave} disabled={saving || !editName.trim()}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
