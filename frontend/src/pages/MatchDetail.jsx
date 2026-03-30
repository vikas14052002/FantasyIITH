import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { getTeamLogo } from '../lib/teamLogos';
import { hasMatchStarted } from '../lib/matchLock';
import AnimatedNumber from '../components/AnimatedNumber';
import './MatchDetail.css';
import './TeamCompare.css';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [leagueMembers, setLeagueMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [inningsTab, setInningsTab] = useState('team1');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cmpUser1, setCmpUser1] = useState('');
  const [cmpUser2, setCmpUser2] = useState('');
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);

  useEffect(() => { loadMatch(); }, [id]);
  useEffect(() => { if (selectedLeague) loadLeagueData(); }, [selectedLeague]);

  // Auto-refresh every 30s for live matches
  useEffect(() => {
    if (!match || match.status !== 'live') return;
    const interval = setInterval(() => { refreshData(); }, 30000);
    return () => clearInterval(interval);
  }, [match?.status, id]);

  async function loadMatch() {
    const [matchRes, playersRes, leagueRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_players').select('*').eq('match_id', id),
      supabase.from('league_members').select('league_id, leagues(*)').eq('user_id', user.id),
    ]);
    setMatch(matchRes.data);
    setPlayers(playersRes.data || []);
    setLastUpdated(new Date());
    const l = (leagueRes.data || []).map(lm => lm.leagues);
    setLeagues(l);
    if (l.length > 0 && !selectedLeague) setSelectedLeague(l[0].id);
    setLoading(false);
  }

  async function refreshData() {
    const [matchRes, playersRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_players').select('*').eq('match_id', id),
    ]);
    if (matchRes.data) setMatch(matchRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
    setLastUpdated(new Date());
    if (selectedLeague) loadLeagueData();
  }

  async function loadLeagueData() {
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from('teams').select('id, user_id, total_points').eq('match_id', id).eq('league_id', selectedLeague),
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', selectedLeague),
    ]);
    setLeagueTeams(teamsRes.data || []);
    setLeagueMembers((membersRes.data || []).map(m => m.users));
  }

  // Leaderboard: members sorted by points
  const leaderboard = useMemo(() => {
    return leagueMembers.map(m => {
      const team = leagueTeams.find(t => t.user_id === m.id);
      return { ...m, team };
    })
    .filter(m => m.team)
    .sort((a, b) => (b.team.total_points || 0) - (a.team.total_points || 0));
  }, [leagueMembers, leagueTeams]);

  // Fantasy ranked players + dream team
  const fantasyRanked = useMemo(() => {
    const playing = players.filter(p => p.is_playing);
    const sorted = [...playing].sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
    // Dream team: top 11 (only if match completed)
    const dreamIds = new Set();
    if (match?.status === 'completed') {
      sorted.slice(0, 11).forEach(p => dreamIds.add(p.player_id));
    }
    return sorted.map(p => ({ ...p, isDream: dreamIds.has(p.player_id) }));
  }, [players, match]);

  const bench = useMemo(() => players.filter(p => !p.is_playing), [players]);

  const matchStarted = match && hasMatchStarted(match);

  function handleUserClick(member) {
    if (!member.team || !matchStarted) return;
    navigate(`/team-preview/${member.team.id}`);
  }

  async function runCompare() {
    if (!cmpUser1 || !cmpUser2 || cmpUser1 === cmpUser2 || !matchStarted) return;
    setComparing(true);
    setComparison(null);

    const t1 = leagueTeams.find(t => t.user_id === cmpUser1);
    const t2 = leagueTeams.find(t => t.user_id === cmpUser2);

    if (!t1 || !t2) { setComparison({ error: true }); setComparing(false); return; }

    const [p1Res, p2Res] = await Promise.all([
      supabase.rpc('get_team_preview', { p_team_id: t1.id, p_requesting_user_id: user?.id }),
      supabase.rpc('get_team_preview', { p_team_id: t2.id, p_requesting_user_id: user?.id }),
    ]);

    const t1Players = (p1Res.data || []).map(enrich);
    const t2Players = (p2Res.data || []).map(enrich);

    if (t1Players.length === 0 || t2Players.length === 0) { setComparison({ error: true }); setComparing(false); return; }

    const t1Map = new Map(t1Players.map(p => [p.player_id, p]));
    const t2Map = new Map(t2Players.map(p => [p.player_id, p]));

    const captain1 = t1Players.find(p => p.is_captain);
    const captain2 = t2Players.find(p => p.is_captain);
    const vc1 = t1Players.find(p => p.is_vice_captain);
    const vc2 = t2Players.find(p => p.is_vice_captain);

    const cvSharedIds = new Set();
    [captain1, captain2, vc1, vc2].forEach(p => {
      if (p && t1Map.has(p.player_id) && t2Map.has(p.player_id)) cvSharedIds.add(p.player_id);
    });

    const onlyT1 = t1Players.filter(p => !t2Map.has(p.player_id));
    const onlyT2 = t2Players.filter(p => !t1Map.has(p.player_id));
    const common = t1Players
      .filter(p => t2Map.has(p.player_id) && !cvSharedIds.has(p.player_id))
      .map(p1 => ({ t1: p1, t2: t2Map.get(p1.player_id) }));

    setComparison({
      error: false,
      user1: leagueMembers.find(m => m.id === cmpUser1),
      user2: leagueMembers.find(m => m.id === cmpUser2),
      team1: t1, team2: t2,
      t1Map, t2Map,
      captain1, captain2, vc1, vc2,
      cvSharedIds,
      common, onlyT1, onlyT2,
    });
    setComparing(false);
  }

  function enrich(tp) {
    const base = tp.fantasy_points || 0;
    const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
    return { ...tp, total_points: base * mult };
  }

  function getLabel(p) {
    if (!p) return null;
    if (p.is_captain) return 'C';
    if (p.is_vice_captain) return 'VC';
    return null;
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!match) return <div className="page"><p>Match not found</p></div>;

  return (
    <div className="page fade-in">
      {/* Match header */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Match {match.match_number} • {match.venue || 'IPL 2026'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            {getTeamLogo(match.team1_short) && <img src={getTeamLogo(match.team1_short)} alt="" style={{ width: 36, height: 27, objectFit: 'contain' }} />}
            <span style={{ fontSize: 14, fontWeight: 700 }}>{match.team1_short}</span>
            {match.team1_score && <span style={{ fontSize: 18, fontWeight: 700 }}>{match.team1_score}</span>}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>VS</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            {getTeamLogo(match.team2_short) && <img src={getTeamLogo(match.team2_short)} alt="" style={{ width: 36, height: 27, objectFit: 'contain' }} />}
            <span style={{ fontSize: 14, fontWeight: 700 }}>{match.team2_short}</span>
            {match.team2_score && <span style={{ fontSize: 18, fontWeight: 700 }}>{match.team2_score}</span>}
          </div>
        </div>
        {match.result && (
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginTop: 8 }}>{match.result}</div>
        )}
        {!match.result && (
          <span className={`badge badge-${match.status}`} style={{ marginTop: 8 }}>{match.status.toUpperCase()}</span>
        )}
      </div>

      {/* Last updated bar for live matches */}
      {match.status === 'live' && lastUpdated && (() => {
        // Extract current over from the latest score string like "127/10 (19.4 Ov)"
        const latestScore = match.team2_score || match.team1_score || '';
        const overMatch = latestScore.match(/\(([\d.]+)\s*Ov\)/);
        const currentOver = overMatch ? overMatch[1] : null;
        const timeStr = lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return (
          <div className="md-last-updated">
            <span>Updated {timeStr}</span>
            {currentOver && <span className="md-over-badge">Ov {currentOver}</span>}
            <button className="md-refresh-btn" onClick={refreshData}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          Leaderboard
        </button>
        {matchStarted && (
          <button className={`tab ${activeTab === 'scorecard' ? 'active' : ''}`} onClick={() => setActiveTab('scorecard')}>
            Scorecard
          </button>
        )}
        <button className={`tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>
          Fantasy
        </button>
        {matchStarted && (
          <button className={`tab ${activeTab === 'compare' ? 'active' : ''}`} onClick={() => setActiveTab('compare')}>
            Compare
          </button>
        )}
      </div>

      {activeTab === 'scorecard' ? (
        /* ── Scorecard Tab ── */
        (() => {
          const playing = players.filter(p => p.is_playing);
          const team1Players = playing.filter(p => p.team === match.team1_short);
          const team2Players = playing.filter(p => p.team === match.team2_short);
          return (
            <div>
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={`tab ${inningsTab === 'team1' ? 'active' : ''}`}
                  onClick={() => setInningsTab('team1')}>
                  {match.team1_short} {match.team1_score ? `• ${match.team1_score}` : ''}
                </button>
                <button className={`tab ${inningsTab === 'team2' ? 'active' : ''}`}
                  onClick={() => setInningsTab('team2')}>
                  {match.team2_short} {match.team2_score ? `• ${match.team2_score}` : ''}
                </button>
              </div>
              {inningsTab === 'team1' ? (
                <ScorecardSection
                  batsmen={team1Players.filter(p => p.runs > 0 || p.balls > 0).sort((a, b) => b.runs - a.runs)}
                  bowlers={team2Players.filter(p => p.overs_bowled > 0).sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded)}
                  score={match.team1_score}
                  teamName={match.team1_short}
                  onPlayerClick={setSelectedPlayer}
                />
              ) : (
                <ScorecardSection
                  batsmen={team2Players.filter(p => p.runs > 0 || p.balls > 0).sort((a, b) => b.runs - a.runs)}
                  bowlers={team1Players.filter(p => p.overs_bowled > 0).sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded)}
                  score={match.team2_score}
                  teamName={match.team2_short}
                  onPlayerClick={setSelectedPlayer}
                />
              )}
            </div>
          );
        })()
      ) : activeTab === 'leaderboard' ? (
        /* ── Leaderboard Tab ── */
        <div>
          {leagues.length > 1 && (
            <select className="input" value={selectedLeague} onChange={e => setSelectedLeague(e.target.value)}
              style={{ marginBottom: 12 }}>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}

          {leaderboard.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📊</div>
              <p className="empty-text">No teams created for this match yet</p>
            </div>
          ) : (
            <div className="md-lb">
              {/* Column header */}
              <div className="md-lb-header">
                <span>#</span>
                <span style={{ flex: 1 }}>Player</span>
                <span>Points</span>
              </div>
              {leaderboard.map((m, i) => {
                const rank = i + 1;
                const isMe = m.id === user?.id;
                const canView = matchStarted && m.team;
                const isCompleted = match.status === 'completed';
                const medal = isCompleted && rank === 1 ? 'gold' : isCompleted && rank === 2 ? 'silver' : isCompleted && rank === 3 ? 'bronze' : null;
                return (
                  <div key={m.id}
                    className={`md-lb-row ${isMe ? 'md-lb-me' : ''} ${canView ? 'md-lb-clickable' : ''} ${medal ? `md-lb-${medal}` : ''}`}
                    onClick={() => handleUserClick(m)}>
                    <div className="md-lb-rank-col">
                      <span className="md-lb-rank-num">#{rank}</span>
                      {medal && <span className={`md-lb-medal ${medal}`}>{medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : '🥉'}</span>}
                    </div>
                    <div className="md-lb-name-col">
                      <span className="md-lb-name">{m.name}</span>
                      {isMe && <span className="md-you-tag">You</span>}
                    </div>
                    <AnimatedNumber value={m.team.total_points || 0} className="md-lb-pts" />
                    {canView && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    )}
                  </div>
                );
              })}
              {!matchStarted && (
                <div className="md-lb-lock-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Teams visible after match starts
                </div>
              )}
            </div>
          )}

        </div>
      ) : activeTab === 'compare' ? (
        /* ── Compare Tab ── */
        <div>
          <div className="cmp-selectors">
            <div className="cmp-user-row">
              <select className="input" value={cmpUser1}
                onChange={e => { setCmpUser1(e.target.value); setComparison(null); }}>
                <option value="">User 1</option>
                {leaderboard.map(m => (
                  <option key={m.id} value={m.id} disabled={m.id === cmpUser2}>{m.name}</option>
                ))}
              </select>
              <span className="cmp-vs-label">VS</span>
              <select className="input" value={cmpUser2}
                onChange={e => { setCmpUser2(e.target.value); setComparison(null); }}>
                <option value="">User 2</option>
                {leaderboard.map(m => (
                  <option key={m.id} value={m.id} disabled={m.id === cmpUser1}>{m.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={runCompare}
              disabled={!cmpUser1 || !cmpUser2 || cmpUser1 === cmpUser2 || comparing}>
              {comparing ? 'COMPARING...' : 'COMPARE'}
            </button>
          </div>

          {comparison?.error && (
            <div className="empty">
              <div className="empty-icon">👥</div>
              <p className="empty-text">Could not load teams</p>
            </div>
          )}

          {comparison && !comparison.error && (() => {
            const c = comparison;
            const t1Total = c.team1.total_points || 0;
            const t2Total = c.team2.total_points || 0;
            const diff = t1Total - t2Total;

            return (
              <div className="cmp-result fade-in">
                {/* Score strip */}
                <div className="cmp-score-strip card">
                  <div className={`cmp-score-side ${t1Total >= t2Total ? 'cmp-winner' : ''}`}>
                    <div className="avatar" style={{ background: c.user1.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                      {c.user1.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="cmp-score-name">{c.user1.name}</div>
                      <div className="cmp-score-pts">{t1Total}</div>
                    </div>
                  </div>
                  <div className="cmp-score-center">
                    <div className={`cmp-total-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
                      {diff > 0 ? '+' : ''}{diff}
                    </div>
                    <div className="cmp-score-diff-label">DIFF</div>
                  </div>
                  <div className={`cmp-score-side cmp-score-right ${t2Total >= t1Total ? 'cmp-winner' : ''}`}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="cmp-score-name">{c.user2.name}</div>
                      <div className="cmp-score-pts">{t2Total}</div>
                    </div>
                    <div className="avatar" style={{ background: c.user2.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                      {c.user2.name[0].toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Different Players */}
                {(c.onlyT1.length > 0 || c.onlyT2.length > 0) && (
                  <>
                    <CatHeader title="Different Players" count={c.onlyT1.length + c.onlyT2.length}
                      pts1={c.onlyT1.reduce((s, p) => s + p.total_points, 0)}
                      pts2={c.onlyT2.reduce((s, p) => s + p.total_points, 0)} />
                    <div className="cmp-cat-body">
                      {Array.from({ length: Math.max(c.onlyT1.length, c.onlyT2.length) }).map((_, i) => (
                        <div key={i} className="cmp-diff-row">
                          <span className="cmp-diff-pts">{c.onlyT1[i] ? c.onlyT1[i].total_points : ''}</span>
                          <div className="cmp-diff-side left">{c.onlyT1[i] && <CmpChip p={c.onlyT1[i]} label={getLabel(c.onlyT1[i])} />}</div>
                          <div className="cmp-diff-vs">vs</div>
                          <div className="cmp-diff-side right">{c.onlyT2[i] && <CmpChip p={c.onlyT2[i]} label={getLabel(c.onlyT2[i])} />}</div>
                          <span className="cmp-diff-pts">{c.onlyT2[i] ? c.onlyT2[i].total_points : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Captain & Vice Captain */}
                {c.cvSharedIds.size > 0 && (
                  <>
                    <CatHeader title="Captain & Vice Captain"
                      pts1={[c.captain1, c.vc1].filter(p => p && c.cvSharedIds.has(p.player_id)).reduce((s, p) => s + p.total_points, 0)}
                      pts2={[c.captain2, c.vc2].filter(p => p && c.cvSharedIds.has(p.player_id)).reduce((s, p) => s + p.total_points, 0)} />
                    <div className="cmp-cat-body">
                      {c.captain1 && c.cvSharedIds.has(c.captain1.player_id) && (() => { const r = c.t2Map.get(c.captain1.player_id); return (
                        <div className="cmp-diff-row">
                          <span className="cmp-diff-pts">{c.captain1.total_points}</span>
                          <div className="cmp-diff-side left"><CmpChip p={c.captain1} label="C" /></div>
                          <div className="cmp-diff-vs">vs</div>
                          <div className="cmp-diff-side right">{r && <CmpChip p={r} label={getLabel(r)} />}</div>
                          <span className="cmp-diff-pts">{r?.total_points || ''}</span>
                        </div>
                      );})()}
                      {c.captain2 && c.captain2.player_id !== c.captain1?.player_id && c.cvSharedIds.has(c.captain2.player_id) && (() => { const l = c.t1Map.get(c.captain2.player_id); return (
                        <div className="cmp-diff-row">
                          <span className="cmp-diff-pts">{l?.total_points || ''}</span>
                          <div className="cmp-diff-side left">{l && <CmpChip p={l} label={getLabel(l)} />}</div>
                          <div className="cmp-diff-vs">vs</div>
                          <div className="cmp-diff-side right"><CmpChip p={c.captain2} label="C" /></div>
                          <span className="cmp-diff-pts">{c.captain2.total_points}</span>
                        </div>
                      );})()}
                      {c.vc1 && c.cvSharedIds.has(c.vc1.player_id) && (() => { const r = c.t2Map.get(c.vc1.player_id); return (
                        <div className="cmp-diff-row">
                          <span className="cmp-diff-pts">{c.vc1.total_points}</span>
                          <div className="cmp-diff-side left"><CmpChip p={c.vc1} label="VC" /></div>
                          <div className="cmp-diff-vs">vs</div>
                          <div className="cmp-diff-side right">{r && <CmpChip p={r} label={getLabel(r)} />}</div>
                          <span className="cmp-diff-pts">{r?.total_points || ''}</span>
                        </div>
                      );})()}
                      {c.vc2 && c.vc2.player_id !== c.vc1?.player_id && c.cvSharedIds.has(c.vc2.player_id) && (() => { const l = c.t1Map.get(c.vc2.player_id); return (
                        <div className="cmp-diff-row">
                          <span className="cmp-diff-pts">{l?.total_points || ''}</span>
                          <div className="cmp-diff-side left">{l && <CmpChip p={l} label={getLabel(l)} />}</div>
                          <div className="cmp-diff-vs">vs</div>
                          <div className="cmp-diff-side right"><CmpChip p={c.vc2} label="VC" /></div>
                          <span className="cmp-diff-pts">{c.vc2.total_points}</span>
                        </div>
                      );})()}
                    </div>
                  </>
                )}

                {/* Common Players */}
                {c.common.length > 0 && (
                  <>
                    <CatHeader title="Common Players" count={c.common.length}
                      pts1={c.common.reduce((s, x) => s + x.t1.total_points, 0)}
                      pts2={c.common.reduce((s, x) => s + x.t2.total_points, 0)} />
                    <div className="cmp-cat-body">
                      {c.common.map(({ t1, t2 }) => (
                        <div key={t1.player_id} className="cmp-common-row">
                          <span className="cmp-pts">{t1.total_points}</span>
                          <div className="cmp-diff-side left"><CmpChip p={t1} label={getLabel(t1)} /></div>
                          <div className="cmp-diff-vs"></div>
                          <div className="cmp-diff-side right"><CmpChip p={t2} label={getLabel(t2)} /></div>
                          <span className="cmp-pts">{t2.total_points}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* ── Player Stats Tab ── */
        <div>
          {/* Dream Team banner */}
          {match.status === 'completed' && fantasyRanked.length > 0 && (
            <div className="md-dream-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Top 11 players are marked as <strong>Dream Team</strong>
            </div>
          )}

          {fantasyRanked.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏏</div>
              <p className="empty-text">No scores available yet</p>
            </div>
          ) : (
            <>
              <div className="md-stats-header">
                <span>Player</span>
                <span>Pts</span>
              </div>
              {fantasyRanked.map(p => (
                <FantasyRow key={p.player_id} p={p} match={match} onClick={() => p.is_playing && setSelectedPlayer(p)} />
              ))}
              {bench.length > 0 && (
                <>
                  <div className="md-bench-divider">
                    <span>Squad ({bench.length})</span>
                  </div>
                  {bench.map(p => <FantasyRow key={p.player_id} p={p} match={match} dimmed onClick={() => {}} />)}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Player Points Breakdown Slider */}
      {selectedPlayer && <PlayerBreakdown player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}

function PlayerBreakdown({ player, onClose }) {
  const p = player;
  const c = {
    run: 1, four: 4, six: 6, halfCentury: 8, century: 16, duck: -2,
    wicket: 30, maiden: 12, catch: 8, stumping: 12, runOut: 12,
    inPlayingXI: 4, dotBall: 1, lbwBowledBonus: 8,
    threeWicketBonus: 4, fourWicketBonus: 8, fiveWicketBonus: 12,
    twentyFiveBonus: 4, seventyFiveBonus: 12, threeCatchBonus: 4,
  };

  const lines = [];
  let total = 0;

  function add(label, value, pts) {
    if (pts === 0) return;
    lines.push({ label, value, pts });
    total += pts;
  }

  // Playing XI
  if (p.is_playing) add('Playing XI', '', c.inPlayingXI);

  // Batting
  if (p.runs > 0 || p.balls > 0) {
    add('Runs', `${p.runs}`, (p.runs || 0) * c.run);
    add('Fours Bonus', `${p.fours || 0} x ${c.four}`, (p.fours || 0) * c.four);
    add('Sixes Bonus', `${p.sixes || 0} x ${c.six}`, (p.sixes || 0) * c.six);
    if (p.runs >= 100) add('Century Bonus', '', c.century);
    else if (p.runs >= 75) add('75 Runs Bonus', '', c.seventyFiveBonus);
    else if (p.runs >= 50) add('Half Century Bonus', '', c.halfCentury);
    else if (p.runs >= 25) add('25 Runs Bonus', '', c.twentyFiveBonus);
    if (p.runs === 0 && p.balls > 0 && ['BAT', 'WK', 'AR'].includes(p.role)) add('Duck', '', c.duck);
  }

  // Bowling
  if (p.wickets > 0 || p.overs_bowled > 0) {
    add('Wickets', `${p.wickets || 0} x ${c.wicket}`, (p.wickets || 0) * c.wicket);
    if (p.lbw_bowled_wickets > 0) add('LBW/Bowled Bonus', `${p.lbw_bowled_wickets} x ${c.lbwBowledBonus}`, p.lbw_bowled_wickets * c.lbwBowledBonus);
    add('Maidens', `${p.maidens || 0} x ${c.maiden}`, (p.maidens || 0) * c.maiden);
    add('Dot Balls', `${p.dots_bowled || 0} x ${c.dotBall}`, (p.dots_bowled || 0) * c.dotBall);
    if (p.wickets >= 5) add('5 Wicket Bonus', '', c.fiveWicketBonus);
    else if (p.wickets >= 4) add('4 Wicket Bonus', '', c.fourWicketBonus);
    else if (p.wickets >= 3) add('3 Wicket Bonus', '', c.threeWicketBonus);
  }

  // Fielding
  if (p.catches > 0) {
    add('Catches', `${p.catches} x ${c.catch}`, p.catches * c.catch);
    if (p.catches >= 3) add('3 Catch Bonus', '', c.threeCatchBonus);
  }
  if (p.stumpings > 0) add('Stumpings', `${p.stumpings} x ${c.stumping}`, p.stumpings * c.stumping);
  if (p.run_outs > 0) add('Run Outs', `${p.run_outs} x ${c.runOut}`, p.run_outs * c.runOut);

  return (
    <>
      <div className="pb-overlay" onClick={onClose} />
      <div className="pb-slider">
        <div className="pb-header">
          <div className="pb-player-info">
            {p.image_url ? (
              <img className="pb-img" src={p.image_url} alt={p.name} />
            ) : (
              <div className="pb-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
            )}
            <div>
              <div className="pb-name">{p.name}</div>
              <div className="pb-meta">{p.team} • {p.role}</div>
            </div>
          </div>
          <button className="pb-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Stats summary */}
        <div className="pb-stats-row">
          {p.runs > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.runs}</span><span className="pb-stat-label">Runs</span></div>}
          {p.balls > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.balls}</span><span className="pb-stat-label">Balls</span></div>}
          {p.fours > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.fours}</span><span className="pb-stat-label">4s</span></div>}
          {p.sixes > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.sixes}</span><span className="pb-stat-label">6s</span></div>}
          {p.wickets > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.wickets}</span><span className="pb-stat-label">Wkts</span></div>}
          {p.overs_bowled > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.overs_bowled}</span><span className="pb-stat-label">Overs</span></div>}
          {p.catches > 0 && <div className="pb-stat"><span className="pb-stat-val">{p.catches}</span><span className="pb-stat-label">Catches</span></div>}
        </div>

        {/* Points breakdown */}
        <div className="pb-breakdown">
          <div className="pb-breakdown-title">Points Breakdown</div>
          {lines.map((l, i) => (
            <div key={i} className={`pb-line ${l.pts < 0 ? 'negative' : ''}`}>
              <span className="pb-line-label">{l.label}</span>
              {l.value && <span className="pb-line-value">{l.value}</span>}
              <span className={`pb-line-pts ${l.pts > 0 ? 'pos' : l.pts < 0 ? 'neg' : ''}`}>
                {l.pts > 0 ? '+' : ''}{l.pts}
              </span>
            </div>
          ))}
          <div className="pb-total">
            <span>Total Fantasy Points</span>
            <span className="pb-total-pts">{total}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function FantasyRow({ p, match, dimmed, onClick }) {
  return (
    <div className="md-player-row" style={{ opacity: dimmed ? 0.35 : 1, cursor: p.is_playing ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="md-player-left">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name}
            className={`md-player-img ${p.isDream ? 'md-dream-border' : ''}`} />
        ) : (
          <div className={`avatar md-player-avatar ${p.isDream ? 'md-dream-border' : ''}`}
            style={{ background: p.team === match.team1_short ? 'var(--blue)' : 'var(--coral)' }}>
            {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
        {p.isDream && (
          <div className="md-dream-badge" title="Dream Team">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
        )}
      </div>
      <div className="player-info" style={{ flex: 1 }}>
        <div className="player-name">
          {p.name}
          {p.isDream && <span className="md-dream-tag">Dream XI</span>}
        </div>
        <div className="player-meta">
          <span>{p.team}</span>
          <span>•</span>
          <span>{p.role}</span>
          {p.runs > 0 && <span>• {p.runs}({p.balls})</span>}
          {p.wickets > 0 && <span>• {p.wickets}W</span>}
          {p.catches > 0 && <span>• {p.catches}C</span>}
        </div>
      </div>
      <div className={`md-player-pts ${(p.fantasy_points || 0) > 50 ? 'high' : (p.fantasy_points || 0) < 0 ? 'neg' : ''}`}>
        {p.is_playing ? <AnimatedNumber value={p.fantasy_points || 0} /> : '-'}
      </div>
    </div>
  );
}

function CatHeader({ title, count, pts1, pts2 }) {
  const diff = pts1 - pts2;
  return (
    <div className="cmp-cat-header">
      <div className="cmp-cat-title">
        <span>{title}</span>
        {count != null && <span className="cmp-cat-count">{count}</span>}
      </div>
      <div className="cmp-cat-summary">
        <span className="cmp-cat-pts">{pts1}</span>
        <span className={`cmp-cat-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
          {diff > 0 ? '+' : ''}{diff}
        </span>
        <span className="cmp-cat-pts">{pts2}</span>
      </div>
    </div>
  );
}

function ScorecardSection({ batsmen, bowlers, score, teamName, onPlayerClick }) {
  return (
    <div>
      {/* Batting */}
      <div className="md-sc-header">
        <span>{teamName} Batting</span>
        {score && <span className="md-sc-score">{score}</span>}
      </div>
      <div className="md-sc-cols">
        <span style={{ flex: 1 }}>Batter</span>
        <span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span>
      </div>
      {batsmen.length === 0 ? (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Yet to bat</div>
      ) : batsmen.map(p => (
        <div key={p.player_id} className="md-sc-row" style={{ cursor: 'pointer' }} onClick={() => onPlayerClick && onPlayerClick(p)}>
          <div className="md-sc-player">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="md-sc-img" />
            ) : (
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 9, background: 'var(--bg-elevated)' }}>
                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )}
            <span className="md-sc-name">{p.name.split(' ').pop()}</span>
          </div>
          <span className="md-sc-val bold">{p.runs}</span>
          <span className="md-sc-val">{p.balls}</span>
          <span className="md-sc-val">{p.fours}</span>
          <span className="md-sc-val">{p.sixes}</span>
          <span className="md-sc-val">{p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '-'}</span>
        </div>
      ))}

      {/* Bowling */}
      {bowlers.length > 0 && (
        <>
          <div className="md-sc-cols" style={{ marginTop: 16 }}>
            <span style={{ flex: 1 }}>Bowler</span>
            <span>O</span><span>M</span><span>R</span><span>W</span><span>Econ</span>
          </div>
          {bowlers.map(p => (
            <div key={p.player_id} className="md-sc-row" style={{ cursor: 'pointer' }} onClick={() => onPlayerClick && onPlayerClick(p)}>
              <div className="md-sc-player">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="md-sc-img" />
                ) : (
                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 9, background: 'var(--bg-elevated)' }}>
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <span className="md-sc-name">{p.name.split(' ').pop()}</span>
              </div>
              <span className="md-sc-val">{p.overs_bowled}</span>
              <span className="md-sc-val">{p.maidens}</span>
              <span className="md-sc-val">{p.runs_conceded}</span>
              <span className={`md-sc-val ${p.wickets > 0 ? 'bold green' : ''}`}>{p.wickets}</span>
              <span className="md-sc-val">{p.overs_bowled > 0 ? (p.runs_conceded / p.overs_bowled).toFixed(1) : '-'}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CmpChip({ p, label }) {
  if (!p) return null;
  return (
    <div className="cmp-chip">
      {p.image_url ? (
        <img className="cmp-chip-img" src={p.image_url} alt={p.name} />
      ) : (
        <div className="cmp-chip-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
      )}
      <div className="cmp-chip-info">
        <div className="cmp-chip-name">
          {p.name.split(' ').pop()}
          {label && <span className={`cmp-chip-label ${label === 'C' ? 'cmp-badge-c' : label === 'VC' ? 'cmp-badge-vc' : ''}`}>{label}</span>}
        </div>
        <div className="cmp-chip-role">{p.role}</div>
      </div>
    </div>
  );
}
