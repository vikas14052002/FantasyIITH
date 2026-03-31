import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import './Leaderboard.css';
import './TeamCompare.css';

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

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [members, setMembers] = useState([]);
  const [compareMatch, setCompareMatch] = useState('');
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [activeCompareUser, setActiveCompareUser] = useState(null);

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

  async function loadMembers(leagueId) {
    const { data } = await supabase
      .from('league_members')
      .select('user_id, users(*)')
      .eq('league_id', leagueId);
    setMembers((data || []).map(m => m.users));
  }

  function toggleCompareMode() {
    if (!compareMode && selectedLeague) loadMembers(selectedLeague);
    setCompareMode(c => !c);
    setComparison(null);
    setCompareMatch('');
    setActiveCompareUser(null);
  }

  async function doCompare(otherUserId) {
    if (!compareMatch) return;
    setActiveCompareUser(otherUserId);
    const matchData = matches.find(m => m.id === compareMatch);
    if (matchData && !hasMatchStarted(matchData)) {
      setComparison({ error: true, locked: true });
      return;
    }
    setComparing(true);
    setComparison(null);
    const [team1Res, team2Res] = await Promise.all([
      supabase.from('teams').select('*').eq('user_id', user.id).eq('match_id', compareMatch).eq('league_id', selectedLeague).single(),
      supabase.from('teams').select('*').eq('user_id', otherUserId).eq('match_id', compareMatch).eq('league_id', selectedLeague).single(),
    ]);
    const t1 = team1Res.data;
    const t2 = team2Res.data;
    if (!t1 || !t2) { setComparison({ error: true }); setComparing(false); return; }
    const [t1PlayersRes, t2PlayersRes] = await Promise.all([
      supabase.rpc('get_team_preview', { p_team_id: t1.id, p_requesting_user_id: user.id }),
      supabase.rpc('get_team_preview', { p_team_id: t2.id, p_requesting_user_id: user.id }),
    ]);
    const t1Raw = t1PlayersRes.data || [];
    const t2Raw = t2PlayersRes.data || [];
    if (t1Raw.length === 0 || t2Raw.length === 0) {
      setComparison({ error: true, locked: true });
      setComparing(false);
      return;
    }
    function enrich(tp) {
      const base = tp.fantasy_points || 0;
      const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
      return { ...tp, base_points: base, multiplier: mult, total_points: base * mult };
    }
    const t1Players = t1Raw.map(enrich);
    const t2Players = t2Raw.map(enrich);
    const t1Map = new Map(t1Players.map(p => [p.player_id, p]));
    const t2Map = new Map(t2Players.map(p => [p.player_id, p]));
    const captain1 = t1Players.find(p => p.is_captain);
    const captain2 = t2Players.find(p => p.is_captain);
    const vc1 = t1Players.find(p => p.is_vice_captain);
    const vc2 = t2Players.find(p => p.is_vice_captain);
    // A player goes in the C&VC section ONLY if both teams have them AND their role differs
    const cvSharedIds = new Set();
    t1Players.forEach(p1 => {
      if (!t2Map.has(p1.player_id)) return;
      const p2 = t2Map.get(p1.player_id);
      const isCvEither = p1.is_captain || p1.is_vice_captain || p2.is_captain || p2.is_vice_captain;
      if (!isCvEither) return;
      const sameRole = p1.is_captain === p2.is_captain && p1.is_vice_captain === p2.is_vice_captain;
      if (!sameRole) cvSharedIds.add(p1.player_id);
    });
    const onlyT1 = t1Players.filter(p => !t2Map.has(p.player_id));
    const onlyT2 = t2Players.filter(p => !t1Map.has(p.player_id));
    const common = t1Players
      .filter(p => t2Map.has(p.player_id) && !cvSharedIds.has(p.player_id))
      .map(p1 => ({ t1: p1, t2: t2Map.get(p1.player_id) }));
    const otherUser = members.find(m => m.id === otherUserId);
    const myScoreEntry = scores.find(s => s.user_id === user.id);
    setComparison({
      error: false,
      user1: myScoreEntry?.users || { name: 'You', avatar_color: 'var(--bg-elevated)' },
      user2: otherUser,
      team1: t1, team2: t2,
      t1Map, t2Map,
      captain1, captain2, vc1, vc2,
      cvSharedIds,
      common, onlyT1, onlyT2,
    });
    setComparing(false);
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
      <select className="input" value={selectedLeague}
        onChange={e => { setSelectedLeague(e.target.value); setCompareMode(false); setComparison(null); setCompareMatch(''); setActiveCompareUser(null); }}
        style={{ marginBottom: 12 }}>
        {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      {/* Always-visible tabs + compare toggle */}
      {!compareMode && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${selectedView === 'overall' ? 'active' : ''}`}
            onClick={() => setSelectedView('overall')}>Overall</button>
          <button className={`tab ${selectedView === 'matchwise' ? 'active' : ''}`}
            onClick={() => setSelectedView('matchwise')}>Match-wise</button>
        </div>
      )}

      <div className="lb-compare-toggle-row">
        {compareMode && <span className="lb-compare-mode-label">Compare Mode</span>}
        <button
          className={`lb-compare-btn ${compareMode ? 'active' : ''}`}
          onClick={toggleCompareMode}
          title={compareMode ? 'Exit compare mode' : 'Compare teams'}
          style={{ marginLeft: 'auto' }}
        >
          {compareMode ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
          )}
        </button>
      </div>

      {compareMode ? (
        /* ── Compare Mode ── */
        <div className="lb-compare-panel fade-in">
          <select
            className="input"
            value={compareMatch}
            onChange={e => { setCompareMatch(e.target.value); setComparison(null); setActiveCompareUser(null); }}
            style={{ marginBottom: 12 }}
          >
            <option value="">Select a match to compare</option>
            {matches.filter(m => m.status === 'completed').map(m => (
              <option key={m.id} value={m.id}>M{m.match_number}: {m.team1_short} vs {m.team2_short}</option>
            ))}
          </select>

          {compareMatch ? (
            <>
              <p className="lb-compare-hint">Tap a teammate to compare your team with theirs:</p>
              <div className="lb-compare-users">
                {members.filter(m => m.id !== user.id).map(m => (
                  <div
                    key={m.id}
                    className={`lb-compare-user-row ${activeCompareUser === m.id ? 'active' : ''}`}
                    onClick={() => doCompare(m.id)}
                  >
                    <div className="avatar" style={{ background: m.avatar_color || 'var(--bg-elevated)', width: 34, height: 34, fontSize: 13 }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="lb-compare-user-name">{m.name}</span>
                    {comparing && activeCompareUser === m.id
                      ? <div className="spinner" style={{ width: 16, height: 16, marginLeft: 'auto' }} />
                      : activeCompareUser === m.id
                        ? <svg style={{ marginLeft: 'auto', color: 'var(--red-primary)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : null
                    }
                  </div>
                ))}
              </div>

              {comparison?.error && (
                <div className="empty" style={{ marginTop: 12 }}>
                  <div className="empty-icon">{comparison.locked ? '🔒' : '👥'}</div>
                  <p className="empty-text">
                    {comparison.locked
                      ? 'Teams can only be compared after the match starts'
                      : "One or both users haven't created a team for this match"}
                  </p>
                </div>
              )}

              {comparison && !comparison.error && (() => {
                const c = comparison;
                const t1Total = c.team1.total_points || 0;
                const t2Total = c.team2.total_points || 0;
                const diff = t1Total - t2Total;
                return (
                  <div className="cmp-result fade-in" style={{ marginTop: 16 }}>
                    {/* Score strip */}
                    <div className="cmp-score-strip card">
                      <div className={`cmp-score-side ${t1Total >= t2Total ? 'cmp-winner' : ''}`}>
                        <div className="avatar" style={{ background: c.user1.avatar_color || 'var(--bg-elevated)', width: 36, height: 36, fontSize: 14 }}>
                          {c.user1.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="cmp-score-name">{c.user1.name} (You)</div>
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
                          <div className="cmp-score-name">{c.user2?.name}</div>
                          <div className="cmp-score-pts">{t2Total}</div>
                        </div>
                        <div className="avatar" style={{ background: c.user2?.avatar_color || 'var(--bg-elevated)', width: 36, height: 36, fontSize: 14 }}>
                          {c.user2?.name?.[0]?.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* 1. Different Players */}
                    {(c.onlyT1.length > 0 || c.onlyT2.length > 0) && (
                      <>
                        <LbCategoryHeader title="Different Players"
                          pts1={c.onlyT1.reduce((s, p) => s + p.total_points, 0)}
                          pts2={c.onlyT2.reduce((s, p) => s + p.total_points, 0)} />
                        <div className="cmp-cat-body">
                          {Array.from({ length: Math.max(c.onlyT1.length, c.onlyT2.length) }).map((_, i) => (
                            <LbDiffRow key={i} p1={c.onlyT1[i]} p2={c.onlyT2[i]} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* 2. Common Players · Different Roles (C/VC) */}
                    {c.cvSharedIds.size > 0 && (
                      <>
                        <LbCategoryHeader title="Common Players · Different Roles"
                          pts1={[...c.cvSharedIds].reduce((s, id) => s + c.t1Map.get(id).total_points, 0)}
                          pts2={[...c.cvSharedIds].reduce((s, id) => s + c.t2Map.get(id).total_points, 0)} />
                        <div className="cmp-cat-body">
                          {[...c.cvSharedIds].map(id => {
                            const left = c.t1Map.get(id);
                            const right = c.t2Map.get(id);
                            return (
                              <div key={id} className="cmp-diff-row">
                                <span className="cmp-diff-pts">{left.total_points}</span>
                                <div className="cmp-diff-side left"><LbPlayerChip p={left} label={getLabelFn(left)} /></div>
                                <div className="cmp-diff-vs">vs</div>
                                <div className="cmp-diff-side right"><LbPlayerChip p={right} label={getLabelFn(right)} /></div>
                                <span className="cmp-diff-pts">{right.total_points}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* 3. Common Players */}
                    {c.common.length > 0 && (
                      <>
                        <LbCategoryHeader title="Common Players"
                          pts1={c.common.reduce((s, x) => s + x.t1.total_points, 0)}
                          pts2={c.common.reduce((s, x) => s + x.t2.total_points, 0)} />
                        <div className="cmp-cat-body">
                          {c.common.map(({ t1, t2 }) => (
                            <div key={t1.player_id} className="cmp-common-row">
                              <span className="cmp-pts">{t1.total_points}</span>
                              <div className="cmp-diff-side left"><LbPlayerChip p={t1} label={getLabelFn(t1)} /></div>
                              <div className="cmp-diff-vs"></div>
                              <div className="cmp-diff-side right"><LbPlayerChip p={t2} label={getLabelFn(t2)} /></div>
                              <span className="cmp-pts">{t2.total_points}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="empty-text" style={{ fontSize: 13, textAlign: 'center', marginTop: 8 }}>
              Select a completed match above to start comparing
            </p>
          )}
        </div>
      ) : (
        /* ── Normal Leaderboard Views ── */
        <>
          {selectedView === 'overall' ? (
            overallScores.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📊</div>
                <p className="empty-text">No scores yet</p>
              </div>
            ) : (
              <>
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
              </>
            )
          ) : (
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
        </>
      )}
    </div>
  );
}

function getLabelFn(p) {
  if (!p) return null;
  if (p.is_captain) return 'C';
  if (p.is_vice_captain) return 'VC';
  return null;
}

function LbCategoryHeader({ title, pts1, pts2 }) {
  const diff = pts1 - pts2;
  return (
    <div className="cmp-cat-header">
      <div className="cmp-cat-title">
        <span>{title}</span>
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

function LbCVRow({ p1, label1, p2, label2, p2Right, p1Left, isUser1Row }) {
  if (isUser1Row && p1) {
    return (
      <div className="cmp-cv-row">
        <span className="cmp-cv-pts">{p1.total_points}</span>
        <div className="cmp-cv-side left"><LbPlayerChip p={p1} label={label1} /></div>
        <div className="cmp-cv-vs">vs</div>
        <div className="cmp-cv-side right">
          {p2Right ? <LbPlayerChip p={p2Right} label={p2Right.is_captain ? 'C' : p2Right.is_vice_captain ? 'VC' : null} /> : <span className="cmp-cv-empty">—</span>}
        </div>
        <span className="cmp-cv-pts">{p2Right ? p2Right.total_points : ''}</span>
      </div>
    );
  }
  if (p2) {
    return (
      <div className="cmp-cv-row">
        <span className="cmp-cv-pts">{p1Left ? p1Left.total_points : ''}</span>
        <div className="cmp-cv-side left">
          {p1Left ? <LbPlayerChip p={p1Left} label={p1Left.is_captain ? 'C' : p1Left.is_vice_captain ? 'VC' : null} /> : <span className="cmp-cv-empty">—</span>}
        </div>
        <div className="cmp-cv-vs">vs</div>
        <div className="cmp-cv-side right"><LbPlayerChip p={p2} label={label2} /></div>
        <span className="cmp-cv-pts">{p2.total_points}</span>
      </div>
    );
  }
  return null;
}

function LbDiffRow({ p1, p2 }) {
  return (
    <div className="cmp-diff-row">
      <span className="cmp-diff-pts">{p1 ? p1.total_points : ''}</span>
      <div className="cmp-diff-side left">
        {p1 ? <LbPlayerChip p={p1} label={getLabelFn(p1)} /> : null}
      </div>
      <div className="cmp-diff-vs">vs</div>
      <div className="cmp-diff-side right">
        {p2 ? <LbPlayerChip p={p2} label={getLabelFn(p2)} /> : null}
      </div>
      <span className="cmp-diff-pts">{p2 ? p2.total_points : ''}</span>
    </div>
  );
}

function LbPlayerChip({ p, label }) {
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
