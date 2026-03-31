import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './UserBreakdown.css';

export default function UserBreakdown() {
  const { leagueId, userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const userName = location.state?.userName || 'Player';

  const [rows, setRows] = useState([]);
  const [totalPts, setTotalPts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBreakdown(); }, [leagueId, userId]);

  async function loadBreakdown() {
    const [scoresRes, matchesRes] = await Promise.all([
      supabase.from('scores').select('*').eq('league_id', leagueId),
      supabase.from('matches').select('id, match_number, team1_short, team2_short').eq('status', 'completed'),
    ]);

    const allScores = scoresRes.data || [];
    const matches = matchesRes.data || [];

    const userScores = allScores.filter(s => s.user_id === userId);

    const breakdown = userScores.map(s => {
      const match = matches.find(m => m.id === s.match_id);
      const matchScores = allScores
        .filter(ms => ms.match_id === s.match_id)
        .sort((a, b) => b.total_points - a.total_points);
      const rank = matchScores.findIndex(ms => ms.user_id === userId) + 1;
      return { match, pts: s.total_points, rank, total: matchScores.length };
    })
      .filter(r => r.match)
      .sort((a, b) => b.match.match_number - a.match.match_number);

    const total = userScores.reduce((sum, s) => sum + s.total_points, 0);

    setRows(breakdown);
    setTotalPts(total);
    setLoading(false);
  }

  return (
    <div className="ub-page">
      <div className="ub-header">
        <button className="ub-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="ub-header-info">
          <div className="ub-name">{userName}</div>
          <div className="ub-subtitle">Match breakdown</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty" style={{ marginTop: 48 }}>
          <div className="empty-icon">🏏</div>
          <p className="empty-text">No matches played yet</p>
        </div>
      ) : (
        <div className="ub-body">
          {rows.map(item => (
            <div key={item.match.id} className="ub-row">
              <div className="ub-row-left">
                <div className="ub-match-label">Match {item.match.match_number}</div>
                <div className="ub-match-teams">{item.match.team1_short} vs {item.match.team2_short}</div>
              </div>
              <div className="ub-row-right">
                <span className="ub-rank">#{item.rank}/{item.total}</span>
                <span className="ub-pts">{item.pts} pts</span>
              </div>
            </div>
          ))}
          <div className="ub-total-row">
            <span>Total</span>
            <span>{totalPts} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}
