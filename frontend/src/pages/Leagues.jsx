import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { LeaguesSkeleton } from '../components/Skeleton';
import AdBanner from '../components/AdBanner';

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
      <AdBanner />
    </div>
  );
}
