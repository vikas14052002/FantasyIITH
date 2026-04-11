import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import MatchCard from '../components/MatchCard';
import ShareSheet from '../components/ShareSheet';
import { LeagueDetailSkeleton, SkeletonRow } from '../components/Skeleton';
import './LeagueDetail.css';

export default function LeagueDetail() {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');
  const [matchSubTab, setMatchSubTab] = useState('upcoming');
  const [scores, setScores] = useState([]);
  const [scoresLoaded, setScoresLoaded] = useState(false);
  const [h2hOpponent, setH2hOpponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const user = getUser();
  const swipeStartX = useRef(null);
  const MAIN_TABS = ['matches', 'leaderboard', 'h2h'];
  const MATCH_SUBTABS = ['live', 'upcoming', 'completed'];

  function onMainTouchStart(e) { swipeStartX.current = e.changedTouches[0].clientX; }
  function onMainTouchEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = MAIN_TABS.indexOf(activeTab);
    if (dx < 0 && idx < MAIN_TABS.length - 1) { setActiveTab(MAIN_TABS[idx + 1]); }
    else if (dx > 0 && idx > 0) { setActiveTab(MAIN_TABS[idx - 1]); }
  }
  function onSubTouchStart(e) { swipeStartX.current = e.changedTouches[0].clientX; }
  function onSubTouchEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = MATCH_SUBTABS.indexOf(matchSubTab);
    if (dx < 0 && idx < MATCH_SUBTABS.length - 1) { setMatchSubTab(MATCH_SUBTABS[idx + 1]); }
    else if (dx > 0 && idx > 0) { setMatchSubTab(MATCH_SUBTABS[idx - 1]); }
  }

  useEffect(() => { loadLeague(); }, [id]);

  useEffect(() => {
    if ((activeTab === 'leaderboard' || activeTab === 'h2h') && !scoresLoaded) loadScores();
  }, [activeTab, scoresLoaded]);

  async function loadLeague() {
    const [leagueRes, membersRes, matchesRes, teamsRes] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id).single(),
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', id),
      supabase.from('matches').select('*').order('match_number', { ascending: false }),
      supabase.from('teams').select('id, user_id, match_id, total_points').eq('league_id', id),
    ]);
    setLeague(leagueRes.data);
    setMembers((membersRes.data || []).map(m => m.users));
    const matchesData = matchesRes.data || [];
    setMatches(matchesData);
    setTeams(teamsRes.data || []);

    if (matchesData.some(m => m.status === 'live')) setMatchSubTab('live');
    else if (matchesData.some(m => m.status === 'upcoming')) setMatchSubTab('upcoming');
    else setMatchSubTab('completed');

    setLoading(false);
  }

  async function confirmLeave() {
    setLeaving(true);
    await supabase.from('league_members').delete().eq('league_id', id).eq('user_id', user.id);
    navigate('/leagues');
  }

  async function loadScores() {
    const { data } = await supabase
      .from('scores')
      .select('*, users(*)')
      .eq('league_id', id);
    setScores(data || []);
    setScoresLoaded(true);
  }

  const matchTabCounts = useMemo(() => ({
    live: matches.filter(m => m.status === 'live').length,
    upcoming: matches.filter(m => m.status === 'upcoming').length,
    completed: matches.filter(m => m.status === 'completed').length,
  }), [matches]);

  const filteredMatches = useMemo(() => {
    return matches
      .filter(m => m.status === matchSubTab)
      .sort((a, b) => {
        if (matchSubTab === 'upcoming') return new Date(a.start_time) - new Date(b.start_time);
        return new Date(b.start_time) - new Date(a.start_time);
      });
  }, [matches, matchSubTab]);

  const overallScores = useMemo(() => {
    const pointsMap = {};
    scores.forEach(s => {
      if (!pointsMap[s.user_id]) pointsMap[s.user_id] = 0;
      pointsMap[s.user_id] += s.total_points;
    });
    return members
      .map(m => ({ ...m, total_points: pointsMap[m.id] || 0 }))
      .sort((a, b) => b.total_points - a.total_points);
  }, [members, scores]);

  // H2H: for each opponent, compute W/L/D and per-match breakdown against current user
  const h2hRecords = useMemo(() => {
    if (!user || scores.length === 0) return [];
    const completedMatchIds = new Set(matches.filter(m => m.status === 'completed').map(m => m.id));
    const myScores = {};
    scores.filter(s => s.user_id === user.id && completedMatchIds.has(s.match_id))
      .forEach(s => { myScores[s.match_id] = s.total_points; });

    return members
      .filter(m => m.id !== user.id)
      .map(opponent => {
        const matchups = [];
        scores
          .filter(s => s.user_id === opponent.id && completedMatchIds.has(s.match_id) && s.match_id in myScores)
          .forEach(s => {
            const match = matches.find(m => m.id === s.match_id);
            const myPts = myScores[s.match_id];
            const theirPts = s.total_points;
            matchups.push({
              match,
              myPts,
              theirPts,
              result: myPts > theirPts ? 'W' : myPts < theirPts ? 'L' : 'D',
            });
          });
        matchups.sort((a, b) => new Date(b.match?.start_time) - new Date(a.match?.start_time));
        const W = matchups.filter(m => m.result === 'W').length;
        const L = matchups.filter(m => m.result === 'L').length;
        const D = matchups.filter(m => m.result === 'D').length;
        const ptsDiff = matchups.reduce((acc, m) => acc + m.myPts - m.theirPts, 0);
        return { opponent, W, L, D, played: matchups.length, ptsDiff, matchups };
      })
      .sort((a, b) => (b.W - b.L) - (a.W - a.L) || b.ptsDiff - a.ptsDiff);
  }, [members, scores, matches, user]);

  if (loading) return <LeagueDetailSkeleton />;
  if (!league) return <div className="page"><p>League not found</p></div>;

  return (
    <div className="page fade-in">
      {showShare && (
        <ShareSheet
          title="Join my Fantasy League!"
          text={`Join "${league.name}" on PlayXI!`}
          url={`${window.location.origin}/leagues/join?code=${league.invite_code}`}
          onClose={() => setShowShare(false)}
        />
      )}

      {showLeaveConfirm && (
        <>
          <div className="leave-overlay" onClick={() => !leaving && setShowLeaveConfirm(false)} />
          <div className="leave-sheet">
            <div className="leave-sheet-handle" />
            <div className="leave-sheet-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--red-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div className="leave-sheet-title">Leave {league.name}?</div>
            <div className="leave-sheet-body">
              You'll lose access to this league and all its match history. You can rejoin later with the invite code.
            </div>
            <div className="leave-sheet-actions">
              <button className="leave-sheet-btn-danger" onClick={confirmLeave} disabled={leaving}>
                {leaving ? 'Leaving…' : 'Yes, leave league'}
              </button>
              <button className="leave-sheet-btn-cancel" onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <button onClick={() => navigate('/leagues')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0, fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        <span>&larr;</span> <span>Leagues</span>
      </button>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{league.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ background: 'var(--bg-elevated)', padding: '6px 16px', borderRadius: 8, fontWeight: 700, letterSpacing: 2 }}>
            {league.invite_code}
          </span>
          <button className="btn btn-outline" style={{ width: 'auto', minHeight: 36, padding: '6px 16px', fontSize: 12 }} onClick={async () => {
            const url = `${window.location.origin}/leagues/join?code=${league.invite_code}`;
            if (navigator.share) {
              try {
                await navigator.share({ title: 'Join my Fantasy League!', text: `Join "${league.name}" on PlayXI!`, url });
                return;
              } catch {}
            }
            setShowShare(true);
          }}>
            Share
          </button>
          <button className="btn btn-outline" style={{ width: 'auto', minHeight: 36, padding: '6px 16px', fontSize: 12, color: 'var(--red-primary)', borderColor: 'var(--red-primary)' }} onClick={() => setShowLeaveConfirm(true)}>
            Leave
          </button>
        </div>
      </div>

      <div onTouchStart={onMainTouchStart} onTouchEnd={onMainTouchEnd}>
      <div className="tabs">
        <button className={`tab ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
        <button className={`tab ${activeTab === 'h2h' ? 'active' : ''}`} onClick={() => { setActiveTab('h2h'); if (!scoresLoaded) loadScores(); }}>H2H</button>
      </div>

      {activeTab === 'matches' ? (
        <>
          <div className="tabs ld-subtabs" onTouchStart={onSubTouchStart} onTouchEnd={onSubTouchEnd}>
            {['live', 'upcoming', 'completed'].map(tab => (
              <button
                key={tab}
                className={`tab ${matchSubTab === tab ? 'active' : ''}`}
                onClick={() => setMatchSubTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {matchTabCounts[tab] > 0 && <span className="tab-badge">{matchTabCounts[tab]}</span>}
              </button>
            ))}
          </div>
          {filteredMatches.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏏</div>
              <p className="empty-text">No {matchSubTab} matches</p>
            </div>
          ) : (
            filteredMatches.map(m => (
              <MatchCard key={m.id} match={m} leagueId={id}
                hasTeam={teams.some(t => t.user_id === user?.id && t.match_id === m.id)} />
            ))
          )}
        </>
      ) : activeTab === 'leaderboard' ? (
        <>
          {!scoresLoaded ? (
            <div role="status" aria-live="polite" aria-label="Loading leaderboard">
              <span className="sr-only">Loading leaderboard...</span>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : (
            <>
              <div className="ld-members-header">
                <span>Member</span>
                <span>Points</span>
              </div>
              {overallScores.map((member, idx) => {
                const isMe = member.id === user?.id;
                const matchesPlayed = scores.filter(s => s.user_id === member.id).length;
                return (
                  <div
                    key={member.id}
                    className={`ld-member-row clickable ${isMe ? 'is-me' : ''}`}
                    onClick={() => navigate(`/leagues/${id}/breakdown/${member.id}`, { state: { userName: member.name } })}
                  >
                    <div className="ld-member-left">
                      <div className="ld-member-rank">{idx + 1}</div>
                      <div className="avatar" style={{ background: member.avatar_color }}>
                        {member.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="ld-member-info">
                        <div className="ld-member-name">
                          {member.name}
                          {isMe && <span className="ld-you-tag">You</span>}
                        </div>
                        <div className="ld-member-status">
                          <span style={{ color: 'var(--text-muted)' }}>
                            {matchesPlayed} match{matchesPlayed !== 1 ? 'es' : ''} played
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ld-member-right">
                      <span className="ld-member-points">{member.total_points}</span>
                      <svg className="ld-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      ) : null}

      {activeTab === 'h2h' && (
        <>
          {!scoresLoaded ? (
            <div role="status" aria-live="polite"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
          ) : h2hRecords.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⚔️</div>
              <p className="empty-text">No completed matches yet</p>
            </div>
          ) : (
            <>
              <div className="ld-members-header">
                <span>Opponent</span>
                <span>Record</span>
              </div>
              {h2hRecords.map(({ opponent, W, L, D, played, ptsDiff, matchups }) => (
                <div key={opponent.id}>
                  <div
                    className="ld-member-row clickable"
                    onClick={() => setH2hOpponent(h2hOpponent?.opponent?.id === opponent.id ? null : { opponent, W, L, D, played, ptsDiff, matchups })}
                  >
                    <div className="ld-member-left">
                      <div className="avatar" style={{ background: opponent.avatar_color }}>{opponent.name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="ld-member-info">
                        <div className="ld-member-name">{opponent.name}</div>
                        <div className="ld-member-status" style={{ color: 'var(--text-muted)' }}>{played} match{played !== 1 ? 'es' : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="h2h-record">
                        <span className="h2h-w">{W}W</span>
                        <span className="h2h-sep">·</span>
                        <span className="h2h-l">{L}L</span>
                        {D > 0 && <><span className="h2h-sep">·</span><span className="h2h-d">{D}D</span></>}
                      </div>
                      <span className={`h2h-diff ${ptsDiff > 0 ? 'pos' : ptsDiff < 0 ? 'neg' : ''}`}>
                        {ptsDiff > 0 ? '+' : ''}{ptsDiff}
                      </span>
                      <svg className="ld-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: h2hOpponent?.opponent?.id === opponent.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </div>

                  {h2hOpponent?.opponent?.id === opponent.id && (
                    <div className="h2h-breakdown fade-in">
                      {matchups.map(({ match, myPts, theirPts, result }) => (
                        <div key={match?.id} className="h2h-match-row">
                          <div className="h2h-match-label">
                            <span className="h2h-match-num">M{match?.match_number}</span>
                            <span className="h2h-match-teams">{match?.team1_short} vs {match?.team2_short}</span>
                          </div>
                          <div className="h2h-match-scores">
                            <span className={`h2h-score ${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`}>{myPts}</span>
                            <span className="h2h-vs">vs</span>
                            <span className="h2h-score opp">{theirPts}</span>
                            <span className={`h2h-result-badge ${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`}>{result}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
      </div>{/* end swipe wrapper */}
    </div>
  );
}
