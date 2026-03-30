import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { getTeamLogo } from '../lib/teamLogos';

export default function MyTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    const { data } = await supabase
      .from('teams')
      .select('*, matches(*), leagues(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTeams(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <h1 className="page-title">My Teams</h1>
      {teams.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <p className="empty-text">No teams created yet</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Go to Home → pick a match → create your team
          </p>
        </div>
      ) : (
        teams.map(t => (
          <div key={t.id} className="card" style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => navigate(`/team-preview/${t.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {getTeamLogo(t.matches?.team1_short) && <img src={getTeamLogo(t.matches?.team1_short)} alt="" style={{ width: 24, height: 18, objectFit: 'contain' }} />}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.matches?.team1_short} vs {t.matches?.team2_short}</span>
                {getTeamLogo(t.matches?.team2_short) && <img src={getTeamLogo(t.matches?.team2_short)} alt="" style={{ width: 24, height: 18, objectFit: 'contain' }} />}
              </div>
              <span className={`badge badge-${t.matches?.status}`}>
                {t.matches?.status?.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>{t.leagues?.name}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                {t.total_points} pts
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
