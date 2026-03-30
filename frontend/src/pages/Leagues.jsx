import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';

export default function Leagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadLeagues(); }, []);

  async function loadLeagues() {
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(*)')
      .eq('user_id', user.id);
    setLeagues((data || []).map(lm => lm.leagues));
    setLoading(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

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
    </div>
  );
}
