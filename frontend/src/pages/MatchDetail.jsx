import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { getTeamLogo } from '../lib/teamLogos';
import { hasMatchStarted } from '../lib/matchLock';
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
  const [loading, setLoading] = useState(true);
  const [cmpUser1, setCmpUser1] = useState('');
  const [cmpUser2, setCmpUser2] = useState('');
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);

  useEffect(() => { loadMatch(); }, [id]);
  useEffect(() => { if (selectedLeague) loadLeagueData(); }, [selectedLeague]);

  async function loadMatch() {
    const [matchRes, playersRes, leagueRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_players').select('*').eq('match_id', id),
      supabase.from('league_members').select('league_id, leagues(*)').eq('user_id', user.id),
    ]);
    setMatch(matchRes.data);
    setPlayers(playersRes.data || []);
    const l = (leagueRes.data || []).map(lm => lm.leagues);
    setLeagues(l);
    if (l.length > 0) setSelectedLeague(l[0].id);
    setLoading(false);
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

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          Leaderboard
        </button>
        <button className={`tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>
          Player Stats
        </button>
        {matchStarted && (
          <button className={`tab ${activeTab === 'compare' ? 'active' : ''}`} onClick={() => setActiveTab('compare')}>
            Compare
          </button>
        )}
      </div>

      {activeTab === 'leaderboard' ? (
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
                return (
                  <div key={m.id}
                    className={`md-lb-row ${isMe ? 'md-lb-me' : ''} ${canView ? 'md-lb-clickable' : ''}`}
                    onClick={() => handleUserClick(m)}>
                    <div className={`lb-rank ${rank <= 3 ? `lb-rank-${rank}` : ''}`}>{rank}</div>
                    <div className="avatar" style={{ background: m.avatar_color, width: 30, height: 30, fontSize: 12 }}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <div className="player-info" style={{ flex: 1 }}>
                      <div className="player-name">
                        {m.name}
                        {isMe && <span className="md-you-tag">You</span>}
                      </div>
                    </div>
                    <div className="md-lb-pts">{m.team.total_points || 0}</div>
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
                <FantasyRow key={p.player_id} p={p} match={match} />
              ))}
              {bench.length > 0 && (
                <>
                  <div className="md-bench-divider">
                    <span>Squad ({bench.length})</span>
                  </div>
                  {bench.map(p => <FantasyRow key={p.player_id} p={p} match={match} dimmed />)}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FantasyRow({ p, match, dimmed }) {
  return (
    <div className="md-player-row" style={{ opacity: dimmed ? 0.35 : 1 }}>
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
        {p.is_playing ? (p.fantasy_points || 0) : '-'}
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
