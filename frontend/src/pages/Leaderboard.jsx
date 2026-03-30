import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import './Leaderboard.css';

export default function Leaderboard() {
  const [searchParams] = useSearchParams();
  const preselectedLeague = searchParams.get('league');

  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(preselectedLeague || '');
  const [matches, setMatches] = useState([]);
  const [selectedView, setSelectedView] = useState('overall');
  const [scores, setScores] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();
  const navigate = useNavigate();

  useEffect(() => { loadLeagues(); }, []);
  useEffect(() => { if (selectedLeague) loadData(); }, [selectedLeague]);

  async function loadLeagues() {
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(*)')
      .eq('user_id', user.id);
    const l = (data || []).map(lm => lm.leagues);
    setLeagues(l);
    if (!selectedLeague && l.length > 0) setSelectedLeague(l[0].id);

    const { data: matchData } = await supabase.from('matches').select('*').order('match_number');
    setMatches(matchData || []);
    setLoading(false);
  }

  async function loadData() {
    if (!selectedLeague) return;

    const [scoresRes, teamsRes] = await Promise.all([
      supabase
        .from('scores')
        .select('*, users(*)')
        .eq('league_id', selectedLeague)
        .order('total_points', { ascending: false }),
      supabase
        .from('teams')
        .select('id, user_id, match_id, total_points')
        .eq('league_id', selectedLeague),
    ]);

    setScores(scoresRes.data || []);
    setTeams(teamsRes.data || []);
  }

  // Overall aggregated scores
  const overallScores = useMemo(() => {
    const userMap = {};
    scores.forEach(s => {
      if (!userMap[s.user_id]) {
        userMap[s.user_id] = { ...s, total_points: 0 };
      }
      userMap[s.user_id].total_points += s.total_points;
    });
    return Object.values(userMap).sort((a, b) => b.total_points - a.total_points);
  }, [scores]);

  // Completed matches with top 2 scores each
  const completedMatches = useMemo(() => {
    return matches
      .filter(m => m.status === 'completed')
      .map(m => {
        const matchScores = scores
          .filter(s => s.match_id === m.id)
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 2);
        return { ...m, topScores: matchScores };
      })
      .sort((a, b) => b.match_number - a.match_number);
  }, [matches, scores]);

  function getTeamId(userId, matchId) {
    const team = teams.find(t => t.user_id === userId && t.match_id === matchId);
    return team?.id;
  }

  function handleUserClick(userId, matchId) {
    const teamId = getTeamId(userId, matchId);
    if (teamId) navigate(`/team-preview/${teamId}`);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  if (leagues.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Leaderboard</h1>
        <div className="empty">
          <div className="empty-icon">📊</div>
          <p className="empty-text">Join a league to see the leaderboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title">Leaderboard</h1>

      {/* League selector */}
      <select className="input" value={selectedLeague} onChange={e => setSelectedLeague(e.target.value)}
        style={{ marginBottom: 12 }}>
        {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      {/* View toggle */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${selectedView === 'overall' ? 'active' : ''}`}
          onClick={() => setSelectedView('overall')}>Overall</button>
        <button className={`tab ${selectedView === 'matchwise' ? 'active' : ''}`}
          onClick={() => setSelectedView('matchwise')}>Match-wise</button>
      </div>

      {selectedView === 'overall' ? (
        /* ── Overall View ── */
        overallScores.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <p className="empty-text">No scores yet</p>
          </div>
        ) : (
          <div className="lb-list">
            {overallScores.map((s, i) => {
              const rank = i + 1;
              const isMe = s.user_id === user.id;
              return (
                <div key={s.user_id} className={`lb-row ${isMe ? 'lb-me' : ''}`}>
                  <div className={`lb-rank ${rank <= 3 ? `lb-rank-${rank}` : ''}`}>{rank}</div>
                  <div className="avatar" style={{ background: s.users?.avatar_color || 'var(--bg-elevated)', width: 32, height: 32, fontSize: 12 }}>
                    {s.users?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="player-info">
                    <div className="player-name">{s.users?.name}{isMe && ' (You)'}</div>
                  </div>
                  <div className="lb-points">{s.total_points}</div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Match-wise View ── */
        completedMatches.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏏</div>
            <p className="empty-text">No completed matches yet</p>
          </div>
        ) : (
          <div className="lb-matches">
            {completedMatches.map(m => (
              <div key={m.id} className="lb-match-card card">
                <div className="lb-match-header">
                  <span className="lb-match-title">{m.team1_short} vs {m.team2_short}</span>
                  <span className="lb-match-num">Match {m.match_number}</span>
                </div>

                {m.topScores.length === 0 ? (
                  <div className="lb-match-empty">No teams created</div>
                ) : (
                  <div className="lb-match-top">
                    {m.topScores.map((s, i) => {
                      const rank = i + 1;
                      const isMe = s.user_id === user.id;
                      const teamId = getTeamId(s.user_id, m.id);
                      return (
                        <div
                          key={s.user_id}
                          className={`lb-match-row ${isMe ? 'lb-me' : ''} ${teamId ? 'lb-clickable' : ''}`}
                          onClick={() => handleUserClick(s.user_id, m.id)}
                        >
                          <div className={`lb-rank ${rank <= 2 ? `lb-rank-${rank}` : ''}`}>{rank}</div>
                          <div className="avatar" style={{ background: s.users?.avatar_color || 'var(--bg-elevated)', width: 28, height: 28, fontSize: 11 }}>
                            {s.users?.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="player-info">
                            <div className="player-name">
                              {s.users?.name}
                              {isMe && <span className="lb-you-tag">You</span>}
                            </div>
                          </div>
                          <div className="lb-match-pts">{s.total_points}</div>
                          {teamId && (
                            <svg className="lb-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
