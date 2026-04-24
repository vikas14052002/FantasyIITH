import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { LeaguesSkeleton } from '../components/Skeleton';
// import AdBanner from '../components/AdBanner';
import AppFooter from '../components/AppFooter';

const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';
const APPROVED_SEEN_KEY = 'payment_approved_seen_v3';

function PaymentBanner({ userId }) {
  const [banner, setBanner] = useState(null); // 'pending' | 'approved' | 'rejected'
  const [adminNote, setAdminNote] = useState('');
  const pollRef = useRef(null);

  async function checkStatus() {
    const { data: req } = await supabase
      .from('payment_requests')
      .select('status, admin_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!req) return;

    if (req.status === 'pending') {
      setBanner('pending');
    } else if (req.status === 'approved') {
      if (!localStorage.getItem(APPROVED_SEEN_KEY)) {
        setBanner('approved');
      }
      clearInterval(pollRef.current);
    } else if (req.status === 'rejected') {
      setBanner('rejected');
      setAdminNote(req.admin_note || '');
      clearInterval(pollRef.current);
    }
  }

  useEffect(() => {
    if (!PAYMENTS_ENABLED) return;
    checkStatus();
    pollRef.current = setInterval(checkStatus, 20000);
    return () => clearInterval(pollRef.current);
  }, [userId]);

  if (!banner) return null;

  const styles = {
    pending:  { borderColor: 'var(--gold)',        iconColor: 'var(--gold)',        icon: '⏳' },
    approved: { borderColor: 'var(--green)',        iconColor: 'var(--green)',       icon: '✓'  },
    rejected: { borderColor: 'var(--red-primary)',  iconColor: 'var(--red-primary)', icon: '✕'  },
  }[banner];

  return (
    <div style={{
      borderLeft: `3px solid ${styles.borderColor}`,
      background: 'var(--bg-surface)',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 16,
      fontSize: 13,
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ color: styles.iconColor, fontSize: 15, marginTop: 1, flexShrink: 0 }}>{styles.icon}</span>
      {banner === 'pending' && (
        <span style={{ color: 'var(--text-secondary)' }}>Your payment is under review — we'll update you here once approved.</span>
      )}
      {banner === 'approved' && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>Payment approved! You're all set for the season.</span>
          <button
            onClick={() => { localStorage.setItem(APPROVED_SEEN_KEY, '1'); setBanner(null); }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          >Got it</button>
        </div>
      )}
      {banner === 'rejected' && (
        <div>
          <div>Payment rejected{adminNote ? `: ${adminNote}` : '.'}</div>
          <div style={{ fontSize: 12, marginTop: 3, color: 'var(--text-secondary)' }}>Go to any match to resubmit your transaction ID.</div>
        </div>
      )}
    </div>
  );
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes
let leaguesCache = null;
let leaguesCacheTs = 0;

function readCache(userId) {
  if (leaguesCache) {
    if (Date.now() - leaguesCacheTs < TTL_MS) return leaguesCache;
    leaguesCache = null;
    leaguesCacheTs = 0;
  }
  try {
    const raw = localStorage.getItem(`leagues_cache_${userId}`);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < TTL_MS) return data;
      localStorage.removeItem(`leagues_cache_${userId}`);
    }
  } catch {}
  return null;
}

function writeCache(userId, data) {
  leaguesCache = data;
  leaguesCacheTs = Date.now();
  try { localStorage.setItem(`leagues_cache_${userId}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function clearLeaguesCache(userId) {
  leaguesCache = null;
  leaguesCacheTs = 0;
  try { localStorage.removeItem(`leagues_cache_${userId}`); } catch {}
}

export default function Leagues() {
  const user = getUser();
  const cached = readCache(user.id);
  const [leagues, setLeagues] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const navigate = useNavigate();

  useEffect(() => {
    // Always fetch — cache just controls whether we show a spinner while waiting
    supabase
      .from('league_members')
      .select('league_id, leagues(*)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return;
        const result = data.map(lm => lm.leagues);
        writeCache(user.id, result);
        setLeagues(result);
        setLoading(false);
      });
  }, []);

  if (loading) return <LeaguesSkeleton />;

  return (
    <div className="page fade-in">
      <h1 className="page-title">My Leagues</h1>

      <PaymentBanner userId={user.id} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/leagues/create')}>
          Create League
        </button>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/leagues/join')}>
          Join League
        </button>
      </div>

      {leagues.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <p className="empty-text">You haven't joined any leagues yet</p>
        </div>
      ) : (
        leagues.map(l => (
          <div key={l.id} className="card" style={{ marginBottom: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => navigate(`/leagues/${l.id}`)}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Code: {l.invite_code}</div>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>→</span>
          </div>
        ))
      )}
      {/* <AdBanner /> */}
      <AppFooter />
    </div>
  );
}
