import { useNavigate } from 'react-router-dom';

export default function AppFooter() {
  const navigate = useNavigate();
  return (
    <div className="app-footer">
      <div className="app-footer-links">
        <a onClick={() => navigate('/about')}>About</a>
        <span>•</span>
        <a onClick={() => navigate('/guide')}>Guide</a>
        <span>•</span>
        <a onClick={() => navigate('/points')}>Points</a>
        <span>•</span>
        <a onClick={() => navigate('/privacy')}>Privacy</a>
        <span>•</span>
        <a onClick={() => navigate('/terms')}>Terms</a>
        <span>•</span>
        <a onClick={() => navigate('/feedback')}>Feedback</a>
      </div>
      <p className="app-footer-copy">© 2026 PlayXI • Not affiliated with IPL or BCCI</p>
    </div>
  );
}
