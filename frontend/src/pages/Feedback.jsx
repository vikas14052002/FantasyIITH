import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../lib/auth';
import './Feedback.css';

const MAX_CHARS = 500;

export default function Feedback() {
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  async function handlePost() {
    if (!message.trim() || posting) return;
    setPosting(true);
    setError('');

    try {
      await fetch('https://script.google.com/macros/s/AKfycbxphUWQWK7D-4d-jTLr_3zvZzaUAV6XwGmVmJN_gI9doVgCPk7S_ql58Ry4_EpE9nel/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.name, email: '', message: message.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError('Failed to submit. Try again.');
    }
    setPosting(false);
  }

  return (
    <div className="fb-page">
      <div className="fb-header">
        <button className="fb-back" onClick={() => navigate(-1)}>←</button>
        <span className="fb-title">Feedback</span>
        <div style={{ width: 32 }} />
      </div>

      <div className="fb-content">
        {sent ? (
          <div className="fb-success fade-in">
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Thanks!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
              Your feedback has been submitted.
            </p>
            <button className="btn btn-outline" style={{ width: 200 }} onClick={() => { setSent(false); setMessage(''); }}>
              Send Another
            </button>
            <button className="btn btn-primary" style={{ width: 200, marginTop: 8 }} onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        ) : (
          <div className="fb-form fade-in">
            <p className="fb-subtitle">
              Share bugs, suggestions, or feature requests. Your feedback helps us improve!
            </p>
            <textarea
              className="fb-textarea"
              placeholder="Type your feedback here..."
              value={message}
              onChange={e => { setMessage(e.target.value.slice(0, MAX_CHARS)); setError(''); }}
              rows={5}
              autoFocus
            />
            <div className="fb-post-footer">
              <span className={`fb-char-count ${message.length > MAX_CHARS - 50 ? 'warn' : ''}`}>
                {message.length}/{MAX_CHARS}
              </span>
              {error && <span className="fb-error">{error}</span>}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12 }}
              disabled={!message.trim() || posting}
              onClick={handlePost}>
              {posting ? 'Submitting...' : 'SUBMIT FEEDBACK'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
