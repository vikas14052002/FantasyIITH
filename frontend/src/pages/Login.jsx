import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithName } from '../lib/auth';
import './Login.css';

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginWithName(name, password);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-content fade-in">
        <div className="login-logo">
          <span className="login-emoji">🏏</span>
          <h1 className="login-title">Fantasy<span className="login-accent">IITH</span></h1>
          <p className="login-subtitle">IPL Fantasy Cricket League</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="input"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <div className="login-password-wrap">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-toggle-pw"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={!name.trim() || !password || loading}>
            {loading ? 'Entering...' : 'ENTER'}
          </button>
        </form>

        <p className="login-hint">New here? Just pick a name and password to sign up.</p>
      </div>
    </div>
  );
}
