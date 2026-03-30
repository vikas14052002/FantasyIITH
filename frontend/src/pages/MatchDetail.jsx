import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getTeamLogo } from '../lib/teamLogos';

function PlayerRow({ p, match, dimmed }) {
  return (
    <div className="player-row" style={{ opacity: dimmed ? 0.4 : 1 }}>
      {p.image_url ? (
        <img src={p.image_url} alt={p.name}
          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }} />
      ) : (
        <div className="avatar" style={{ background: p.team === match.team1_short ? 'var(--blue)' : 'var(--coral)', width: 36, height: 36, fontSize: 11 }}>
          {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
      )}
      <div className="player-info">
        <div className="player-name">{p.name}</div>
        <div className="player-meta">
          <span>{p.team}</span>
          <span>•</span>
          <span>{p.role}</span>
          {p.runs > 0 && <span>• {p.runs}({p.balls})</span>}
          {p.fours > 0 && <span>• {p.fours}×4</span>}
          {p.sixes > 0 && <span>• {p.sixes}×6</span>}
          {p.wickets > 0 && <span>• {p.wickets}W</span>}
          {p.catches > 0 && <span>• {p.catches}C</span>}
        </div>
      </div>
      <div style={{
        fontWeight: 700, fontSize: 16, minWidth: 40, textAlign: 'right',
        color: p.fantasy_points > 0 ? 'var(--green)' : p.fantasy_points < 0 ? 'var(--coral)' : 'var(--text-secondary)',
      }}>
        {p.is_playing ? p.fantasy_points : '-'}
      </div>
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMatch(); }, [id]);

  async function loadMatch() {
    const [matchRes, playersRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_players').select('*').eq('match_id', id),
    ]);
    setMatch(matchRes.data);
    const all = playersRes.data || [];
    const playing = all.filter(p => p.is_playing).sort((a, b) => b.fantasy_points - a.fantasy_points);
    const bench = all.filter(p => !p.is_playing).sort((a, b) => a.name.localeCompare(b.name));
    setPlayers([...playing, ...bench]);
    setLoading(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!match) return <div className="page"><p>Match not found</p></div>;

  const playing = players.filter(p => p.is_playing);
  const bench = players.filter(p => !p.is_playing);

  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Match {match.match_number} • {match.venue}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {getTeamLogo(match.team1_short) && <img src={getTeamLogo(match.team1_short)} alt={match.team1_short} style={{ width: 40, height: 30, objectFit: 'contain' }} />}
            <span style={{ fontSize: 16, fontWeight: 700 }}>{match.team1_short}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>VS</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {getTeamLogo(match.team2_short) && <img src={getTeamLogo(match.team2_short)} alt={match.team2_short} style={{ width: 40, height: 30, objectFit: 'contain' }} />}
            <span style={{ fontSize: 16, fontWeight: 700 }}>{match.team2_short}</span>
          </div>
        </div>
        <span className={`badge badge-${match.status}`} style={{ marginTop: 8 }}>
          {match.status.toUpperCase()}
        </span>
      </div>

      {playing.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏏</div>
          <p className="empty-text">No scores available yet</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Points will appear after the match</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Playing XI</h2>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{playing.length} players</span>
          </div>
          {playing.map(p => <PlayerRow key={p.player_id} p={p} match={match} />)}

          {bench.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Squad</h2>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bench.length} players</span>
              </div>
              {bench.map(p => <PlayerRow key={p.player_id} p={p} match={match} dimmed />)}
            </>
          )}
        </>
      )}
    </div>
  );
}
