import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const tabs = [
  { to: '/home', icon: '🏠', label: 'Home' },
  { to: '/my-teams', icon: '👥', label: 'My Team' },
  { to: '/leagues', icon: '🏆', label: 'Leagues' },
  { to: '/leaderboard', icon: '📊', label: 'Board' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
