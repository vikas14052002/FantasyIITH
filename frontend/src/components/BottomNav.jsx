import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';

const tabs = [
  {
    to: '/leagues', label: 'Leagues',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
    iconFilled: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  },
  {
    to: '/feedback', label: 'Feedback',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    iconFilled: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      <div className="nav-glass" />
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`nav-tab ${isActive ? 'active' : ''}`}
          >
            {isActive && <span className="nav-glow" />}
            <span className={`nav-icon ${isActive ? 'nav-icon-active' : ''}`}>
              {isActive ? tab.iconFilled : tab.icon}
            </span>
            <span className="nav-label">{tab.label}</span>
            {isActive && <span className="nav-dot" />}
          </NavLink>
        );
      })}
    </nav>
  );
}
