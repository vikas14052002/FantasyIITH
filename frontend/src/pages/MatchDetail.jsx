import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { getTeamLogo } from '../lib/teamLogos';
import AdBanner from '../components/AdBanner';
import { isFantasyRosterActive } from '../lib/matchPlayers';
import { hasMatchStarted } from '../lib/matchLock';
import AnimatedNumber from '../components/AnimatedNumber';
import { MatchDetailSkeleton } from '../components/Skeleton';
import PlayerBreakdown from '../components/PlayerBreakdown';
import './MatchDetail.css';
import './TeamCompare.css';

export default function MatchDetail() {
  const { id } = useParams();
  const location = useLocation();
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
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [selectionMap, setSelectionMap] = useState(new Map());
  const [showLeagueStatsTooltip, setShowLeagueStatsTooltip] = useState(false);
  const [userTeamPlayerIds, setUserTeamPlayerIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('pts');
  const [sortDir, setSortDir] = useState('desc');
  const [captainMap, setCaptainMap] = useState(new Map());
  const [vcMap, setVcMap] = useState(new Map());
  const [isM11League, setIsM11League] = useState(false);
  const swipeStartX = useRef(null);

  useEffect(() => { loadMatch(); }, [id]);
  useEffect(() => { if (selectedLeague) loadLeagueData(); }, [selectedLeague]);

  // Handle phone back button closing comparison overlay instead of navigating away
  useEffect(() => {
    if (comparison && !comparison.error) {
      window.history.pushState({ comparison: true }, '');
      const onPop = () => { setComparison(null); setCompareWith(null); };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }
  }, [comparison]);

  // Inject SportsEvent JSON-LD
  useEffect(() => {
    if (!match) return;
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${match.team1_short} vs ${match.team2_short} - IPL 2026`,
      startDate: match.start_time,
      location: { '@type': 'Place', name: match.venue || 'TBD' },
      competitor: [
        { '@type': 'SportsTeam', name: match.team1_name || match.team1_short },
        { '@type': 'SportsTeam', name: match.team2_name || match.team2_short },
      ],
      description: `Fantasy cricket for Match ${match.match_number} on PlayXI`,
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(ld);
    script.id = 'match-jsonld';
    document.head.querySelector('#match-jsonld')?.remove();
    document.head.appendChild(script);
    // Update page title
    document.title = `${match.team1_short} vs ${match.team2_short} - PlayXI`;
    return () => document.head.querySelector('#match-jsonld')?.remove();
  }, [match]);

  useEffect(() => {
    if (!match || match.status !== 'live') return;
    const interval = setInterval(() => { refreshData(); }, 30000);
    return () => clearInterval(interval);
  }, [match?.status, id, selectedLeague]);

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
    if (l.length > 0 && !selectedLeague) {
      const fromNav = location.state?.leagueId;
      const saved = localStorage.getItem(`md_league_${id}`);
      const initial = (fromNav && l.some(x => x.id === fromNav)) ? fromNav
        : (saved && l.some(x => x.id === saved)) ? saved : l[0].id;
      setSelectedLeague(initial);
    }
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
    const [teamsRes, membersRes, m11Res] = await Promise.all([
      supabase.from('teams').select('id, user_id, total_points').eq('match_id', id).eq('league_id', selectedLeague),
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', selectedLeague),
      supabase.from('m11_sync_config').select('synced_at').eq('league_id', selectedLeague).eq('match_id', id).maybeSingle(),
    ]);
    setIsM11League(!!(m11Res.data?.synced_at));
    const teams = teamsRes.data || [];
    setLeagueTeams(teams);
    setLeagueMembers((membersRes.data || []).map(m => m.users));
    // Never expose other users' selections before match starts
    const started = match && hasMatchStarted(match);
    if (teams.length > 0 && started) {
      const teamIds = teams.map(t => t.id);
      const { data: tpData } = await supabase.from('team_players').select('team_id, player_id, is_captain, is_vice_captain').in('team_id', teamIds);
      const countMap = new Map();
      const capCount = new Map();
      const vcCount = new Map();
      (tpData || []).forEach(tp => {
        countMap.set(tp.player_id, (countMap.get(tp.player_id) || 0) + 1);
        if (tp.is_captain) capCount.set(tp.player_id, (capCount.get(tp.player_id) || 0) + 1);
        if (tp.is_vice_captain) vcCount.set(tp.player_id, (vcCount.get(tp.player_id) || 0) + 1);
      });
      const pctMap = new Map();
      countMap.forEach((count, pid) => pctMap.set(pid, Math.round((count / teams.length) * 100)));
      const capPctMap = new Map();
      capCount.forEach((count, pid) => capPctMap.set(pid, Math.round((count / teams.length) * 100)));
      const vcPctMap = new Map();
      vcCount.forEach((count, pid) => vcPctMap.set(pid, Math.round((count / teams.length) * 100)));
      setSelectionMap(pctMap);
      setCaptainMap(capPctMap);
      setVcMap(vcPctMap);
      // Extract user's own team players
      const myTeam = teams.find(t => t.user_id === user?.id);
      if (myTeam) {
        const myPlayers = (tpData || []).filter(tp => tp.team_id === myTeam.id);
        setUserTeamPlayerIds(new Set(myPlayers.map(tp => tp.player_id)));
      } else {
        setUserTeamPlayerIds(new Set());
      }
    } else {
      setSelectionMap(new Map());
      setCaptainMap(new Map());
      setVcMap(new Map());
      setUserTeamPlayerIds(new Set());
    }
  }

  const matchStarted = match && hasMatchStarted(match);

  const leaderboard = useMemo(() => {
    const withTeam = leagueMembers.map(m => ({ ...m, team: leagueTeams.find(t => t.user_id === m.id) || null }));
    if (matchStarted) {
      return withTeam.filter(m => m.team).sort((a, b) => (b.team.total_points || 0) - (a.team.total_points || 0));
    }
    // Pre-match: current user always first, then those with teams
    return withTeam.sort((a, b) => {
      const aIsMe = a.id === user?.id, bIsMe = b.id === user?.id;
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      return (b.team ? 1 : 0) - (a.team ? 1 : 0);
    });
  }, [leagueMembers, leagueTeams, matchStarted]);

  const fantasyRanked = useMemo(() => {
    const active = players.filter(isFantasyRosterActive);
    const sorted = [...active].sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
    const dreamIds = new Set();
    if (match?.status === 'completed') sorted.slice(0, 11).forEach(p => dreamIds.add(p.player_id));
    const activeWithDream = sorted.map(p => ({ ...p, isDream: dreamIds.has(p.player_id) }));
    const bench = players.filter(p => !isFantasyRosterActive(p)).map(p => ({ ...p, isDream: false }));
    return [...activeWithDream, ...bench];
  }, [players, match]);

  const sortedFantasyRanked = useMemo(() => {
    return [...fantasyRanked].sort((a, b) => {
      const aAct = isFantasyRosterActive(a);
      const bAct = isFantasyRosterActive(b);
      if (aAct !== bAct) return aAct ? -1 : 1;
      let aVal, bVal;
      if (sortBy === 'pts') {
        aVal = a.fantasy_points || 0;
        bVal = b.fantasy_points || 0;
      } else if (sortBy === 'cap') {
        aVal = captainMap.get(a.player_id) ?? -1;
        bVal = captainMap.get(b.player_id) ?? -1;
      } else if (sortBy === 'vc') {
        aVal = vcMap.get(a.player_id) ?? -1;
        bVal = vcMap.get(b.player_id) ?? -1;
      } else {
        aVal = selectionMap.get(a.player_id) ?? -1;
        bVal = selectionMap.get(b.player_id) ?? -1;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [fantasyRanked, sortBy, sortDir, selectionMap, captainMap, vcMap]);

  const MAIN_TABS = matchStarted ? ['leaderboard', 'scorecard', 'players'] : ['leaderboard', 'players'];
  function onSwipeStart(e) { swipeStartX.current = e.changedTouches[0].clientX; }
  function onSwipeEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = MAIN_TABS.indexOf(activeTab);
    if (dx < 0 && idx < MAIN_TABS.length - 1) setActiveTab(MAIN_TABS[idx + 1]);
    else if (dx > 0 && idx > 0) setActiveTab(MAIN_TABS[idx - 1]);
  }
  function onInningsSwipeStart(e) { swipeStartX.current = e.changedTouches[0].clientX; }
  function onInningsSwipeEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) setInningsTab('team2');
    else setInningsTab('team1');
  }

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  function handleUserClick(member) {
    if (!member.team || !matchStarted) return;
    if (compareMode) { if (member.id !== user?.id) doCompare(member.id); }
    else navigate(`/team-preview/${member.team.id}`, { state: { from: `/match/${id}` } });
  }

  function toggleCompareMode() { setCompareMode(m => !m); setCompareWith(null); setComparison(null); }

  async function doCompare(otherId) {
    if (!matchStarted) return;
    setCompareWith(otherId); setComparing(true); setComparison(null);
    const t1 = leagueTeams.find(t => t.user_id === user.id);
    const t2 = leagueTeams.find(t => t.user_id === otherId);
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

    setComparison({
      error: false, user1: leagueMembers.find(m => m.id === user.id), user2: leagueMembers.find(m => m.id === otherId),
      team1: t1, team2: t2, t1Map, t2Map, captain1, captain2, vc1, vc2, cvSharedIds,
      onlyT1: t1Players.filter(p => !t2Map.has(p.player_id)).sort((a, b) => b.total_points - a.total_points),
      onlyT2: t2Players.filter(p => !t1Map.has(p.player_id)).sort((a, b) => b.total_points - a.total_points),
      common: t1Players.filter(p => t2Map.has(p.player_id) && !cvSharedIds.has(p.player_id)).map(p1 => ({ t1: p1, t2: t2Map.get(p1.player_id) })),
    });
    setComparing(false);
  }

  function enrich(tp) { const base = tp.fantasy_points || 0; const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1; return { ...tp, base_points: base, total_points: base * mult }; }
  function getLabel(p) { if (!p) return null; return p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : null; }

  if (loading) return <MatchDetailSkeleton />;
  if (!match) return <div className="page"><p>Match not found</p></div>;

  return (
    <div className="page fade-in">
      <button
        type="button"
        onClick={() => {
          if (selectedLeague) navigate(`/leagues/${selectedLeague}`);
          else navigate(-1);
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0, fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}
      >
        <span>&larr;</span> <span>{match.team1_short} vs {match.team2_short}</span>
      </button>
      <div className="card" style={{ textAlign: 'center', marginBottom: 8, padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Match {match.match_number} • {match.venue || 'PlayXI'}</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
            {getTeamLogo(match.team1_short) && <img src={getTeamLogo(match.team1_short)} alt="" style={{ width: 28, height: 21, objectFit: 'contain' }} />}
            <span style={{ fontSize: 12, fontWeight: 700 }}>{match.team1_short}</span>
            {match.team1_score && <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{match.team1_score}</span>}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>VS</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
            {getTeamLogo(match.team2_short) && <img src={getTeamLogo(match.team2_short)} alt="" style={{ width: 28, height: 21, objectFit: 'contain' }} />}
            <span style={{ fontSize: 12, fontWeight: 700 }}>{match.team2_short}</span>
            {match.team2_score && <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{match.team2_score}</span>}
          </div>
        </div>
        {match.result ? <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, marginTop: 4 }}>{match.result}</div> : <span className={`badge badge-${match.status}`} style={{ marginTop: 4 }}>{match.status.toUpperCase()}</span>}
      </div>

      {match.status === 'live' && lastUpdated && (() => {
        const latestScore = match.team2_score || match.team1_score || '';
        const overMatch = latestScore.match(/\(([\d.]+)\s*Ov\)/);
        return (<div className="md-last-updated"><span>Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>{overMatch && <span className="md-over-badge">Ov {overMatch[1]}</span>}<button className="md-refresh-btn" onClick={refreshData}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button></div>);
      })()}

      <div onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
      <div className="tabs">
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
        {matchStarted && <button className={`tab ${activeTab === 'scorecard' ? 'active' : ''}`} onClick={() => setActiveTab('scorecard')}>Scorecard</button>}
        <button className={`tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Fantasy</button>
      </div>

      {activeTab === 'scorecard' ? (() => {
        const playing = players.filter(isFantasyRosterActive);
        const t1P = playing.filter(p => p.team === match.team1_short), t2P = playing.filter(p => p.team === match.team2_short);
        return (<div>
          <div className="tabs" style={{ marginBottom: 12 }} onTouchStart={onInningsSwipeStart} onTouchEnd={onInningsSwipeEnd}>
            <button className={`tab ${inningsTab === 'team1' ? 'active' : ''}`} onClick={() => setInningsTab('team1')}>{match.team1_short} {match.team1_score ? `• ${match.team1_score}` : ''}</button>
            <button className={`tab ${inningsTab === 'team2' ? 'active' : ''}`} onClick={() => setInningsTab('team2')}>{match.team2_short} {match.team2_score ? `• ${match.team2_score}` : ''}</button>
          </div>
          {inningsTab === 'team1'
            ? <ScorecardSection batsmen={t1P.filter(p => p.runs > 0 || p.balls > 0).sort((a, b) => b.runs - a.runs)} bowlers={t2P.filter(p => p.overs_bowled > 0).sort((a, b) => b.wickets - a.wickets)} score={match.team1_score} teamName={match.team1_short} onPlayerClick={setSelectedPlayer} />
            : <ScorecardSection batsmen={t2P.filter(p => p.runs > 0 || p.balls > 0).sort((a, b) => b.runs - a.runs)} bowlers={t1P.filter(p => p.overs_bowled > 0).sort((a, b) => b.wickets - a.wickets)} score={match.team2_score} teamName={match.team2_short} onPlayerClick={setSelectedPlayer} />}
        </div>);
      })() : activeTab === 'leaderboard' ? (
        <div>
          {leagues.length > 1 && <select className="input" value={selectedLeague} onChange={e => { setSelectedLeague(e.target.value); localStorage.setItem(`md_league_${id}`, e.target.value); setCompareMode(false); setComparison(null); setCompareWith(null); }} style={{ marginBottom: 12 }}>{leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
          {isM11League && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 10, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
              <span>⚡</span> Teams fetched from My11Circle
            </div>
          )}
          {leaderboard.length === 0 ? <div className="empty"><div className="empty-icon">📊</div><p className="empty-text">No one has joined yet</p></div> : (
            <div className="md-lb">
              <div className="md-lb-header">
                {matchStarted && <span style={{ minWidth: 32 }}>#</span>}
                <span style={{ flex: 1 }}>Player</span>
                {matchStarted && <button className={`md-compare-icon-btn ${compareMode ? 'active' : ''}`} onClick={toggleCompareMode}>{compareMode ? 'Cancel' : 'Compare'}</button>}
                <span>{matchStarted ? 'Points' : 'Status'}</span>
              </div>
              {compareMode && <div className="md-compare-hint">Tap any player to compare their team with yours</div>}
              {leaderboard.map((m, i) => {
                const rank = i + 1, isMe = m.id === user?.id, canView = matchStarted && m.team;
                const isCompleted = match.status === 'completed';
                const medal = isCompleted && rank <= 3 ? ['gold','silver','bronze'][rank-1] : null;
                return (
                  <div key={m.id} className={`md-lb-row ${isMe ? 'md-lb-me' : ''} ${canView && !(compareMode && isMe) ? 'md-lb-clickable' : ''} ${compareMode && isMe ? 'md-lb-greyed' : ''} ${compareWith === m.id ? 'md-lb-selected' : ''} ${medal ? `md-lb-${medal}` : ''} ${!matchStarted && !m.team && !isMe ? 'md-lb-no-team' : ''}`} onClick={() => handleUserClick(m)}>
                    {matchStarted && <div className="md-lb-rank-col"><span className="md-lb-rank-num">#{rank}</span>{medal && <span className="md-lb-medal">{['🥇','🥈','🥉'][rank-1]}</span>}</div>}
                    <div className="md-lb-name-col"><span className="md-lb-name">{m.name}</span>{isMe && <span className="md-you-tag">You</span>}</div>
                    {matchStarted
                      ? <AnimatedNumber value={m.team?.total_points || 0} className="md-lb-pts" />
                      : isMe
                        ? <button className="md-lb-create-btn" onClick={e => { e.stopPropagation(); navigate(`/create-team/${id}/${selectedLeague}`); }}>{m.team ? 'Edit' : 'Create'}</button>
                        : m.team
                          ? <span className="md-lb-joined">Joined</span>
                          : <span className="md-lb-no-team-label">No team</span>
                    }
                    {matchStarted && (compareMode && !isMe ? (comparing && compareWith === m.id ? <div className="spinner" style={{ width: 14, height: 14 }} /> : compareWith === m.id ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red-primary)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>) : canView && !compareMode ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg> : null)}
                  </div>);
              })}
              {comparison?.error && <div className="empty" style={{ marginTop: 12 }}><div className="empty-icon">👥</div><p className="empty-text">Could not load teams</p></div>}
              {comparison && !comparison.error && (() => {
                const c = comparison;
                const t1Total = c.team1.total_points || 0;
                const t2Total = c.team2.total_points || 0;
                const diff = t1Total - t2Total;
                const handleCmpClick = (p) => setSelectedPlayer({ ...players.find(mp => mp.player_id === p.player_id), ...p, fantasy_points: p.base_points });
                return (
                  <div className="md-cmp-overlay fade-in">
                    <div className="md-cmp-overlay-header">
                      <button className="md-cmp-back-btn" onClick={() => window.history.back()}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
                        Back
                      </button>
                      <span className="md-cmp-overlay-title">Comparison</span>
                      <div style={{ width: 60 }} />
                    </div>

                    <div className="md-cmp-overlay-body">
                      <div className="cmp-score-strip card">
                        <div className={`cmp-score-side ${t1Total >= t2Total ? 'cmp-winner' : ''}`}>
                          <div className="avatar" style={{ background: c.user1?.avatar_color || 'var(--bg-elevated)', width: 36, height: 36, fontSize: 14 }}>
                            {c.user1?.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="cmp-score-name">{c.user1?.name} (You)</div>
                            <div className="cmp-score-pts">{t1Total}</div>
                          </div>
                        </div>
                        <div className="cmp-score-center">
                          <div className={`cmp-total-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>{diff > 0 ? '+' : ''}{diff}</div>
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

                      {(c.onlyT1.length > 0 || c.onlyT2.length > 0) && (
                        <>
                          <CatHeader title="Different Players"
                            pts1={c.onlyT1.reduce((s, p) => s + p.total_points, 0)}
                            pts2={c.onlyT2.reduce((s, p) => s + p.total_points, 0)} />
                          <div className="cmp-cat-body">
                            {Array.from({ length: Math.max(c.onlyT1.length, c.onlyT2.length) }).map((_, i) => (
                              <div key={i} className="cmp-diff-row">
                                <span className="cmp-diff-pts">{c.onlyT1[i] ? c.onlyT1[i].total_points : ''}</span>
                                <div className="cmp-diff-side left">{c.onlyT1[i] && <CmpChip p={c.onlyT1[i]} label={getLabel(c.onlyT1[i])} onClick={() => handleCmpClick(c.onlyT1[i])} />}</div>
                                <div className="cmp-diff-vs">vs</div>
                                <div className="cmp-diff-side right">{c.onlyT2[i] && <CmpChip p={c.onlyT2[i]} label={getLabel(c.onlyT2[i])} onClick={() => handleCmpClick(c.onlyT2[i])} />}</div>
                                <span className="cmp-diff-pts">{c.onlyT2[i] ? c.onlyT2[i].total_points : ''}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {c.cvSharedIds.size > 0 && (
                        <>
                          <CatHeader title="Common Players · Different Roles"
                            pts1={[...c.cvSharedIds].reduce((s, id) => s + c.t1Map.get(id).total_points, 0)}
                            pts2={[...c.cvSharedIds].reduce((s, id) => s + c.t2Map.get(id).total_points, 0)} />
                          <div className="cmp-cat-body">
                            {[...c.cvSharedIds].map(id => {
                              const left = c.t1Map.get(id);
                              const right = c.t2Map.get(id);
                              return (
                                <div key={id} className="cmp-diff-row">
                                  <span className="cmp-diff-pts">{left.total_points}</span>
                                  <div className="cmp-diff-side left"><CmpChip p={left} label={getLabel(left)} onClick={() => handleCmpClick(left)} /></div>
                                  <div className="cmp-diff-vs">vs</div>
                                  <div className="cmp-diff-side right"><CmpChip p={right} label={getLabel(right)} onClick={() => handleCmpClick(right)} /></div>
                                  <span className="cmp-diff-pts">{right.total_points}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {c.common.length > 0 && (
                        <>
                          <CatHeader title="Common Players"
                            pts1={c.common.reduce((s, x) => s + x.t1.total_points, 0)}
                            pts2={c.common.reduce((s, x) => s + x.t2.total_points, 0)} />
                          <div className="cmp-cat-body">
                            {c.common.map(({ t1, t2 }) => (
                              <div key={t1.player_id} className="cmp-common-row">
                                <span className="cmp-pts">{t1.total_points}</span>
                                <div className="cmp-diff-side left"><CmpChip p={t1} label={getLabel(t1)} onClick={() => handleCmpClick(t1)} /></div>
                                <div className="cmp-diff-vs"></div>
                                <div className="cmp-diff-side right"><CmpChip p={t2} label={getLabel(t2)} onClick={() => handleCmpClick(t2)} /></div>
                                <span className="cmp-pts">{t2.total_points}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : !matchStarted ? (
        <div className="empty" style={{ paddingTop: 48 }}>
          <div className="empty-icon">🔒</div>
          <p className="empty-text" style={{ fontWeight: 600 }}>Stats locked until match starts</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            Player stats, Sel%, C% &amp; VC% will be revealed once the match begins
          </p>
        </div>
      ) : (
        <div>
          {match.status === 'completed' && fantasyRanked.length > 0 && <div className="md-dream-banner"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Top 11 = <strong>Dream Team</strong></div>}
          {fantasyRanked.length === 0 ? <div className="empty"><div className="empty-icon">🏏</div><p className="empty-text">No scores yet</p></div> : <>
            <div className="md-stats-header">
              <span style={{flex:1}}>Player</span>
              {(captainMap.size > 0 || vcMap.size > 0 || selectionMap.size > 0) && (
                <div className="md-league-stats-info">
                  <button type="button" className="md-sel-info-btn" onClick={e => { e.stopPropagation(); setShowLeagueStatsTooltip(t => !t); }}>i</button>
                  {showLeagueStatsTooltip && (<><div className="md-sel-tooltip-backdrop" onClick={() => setShowLeagueStatsTooltip(false)} /><div className="md-sel-tooltip md-league-stats-tooltip" role="tooltip"><span className="md-sel-tooltip-line">C%, VC% &amp; Sel% are based on</span><span className="md-sel-tooltip-line">teams created in this league</span></div></>)}
                </div>
              )}
              {captainMap.size > 0 && (
                <button type="button" className={`md-sort-col-btn md-pct-hdr ${sortBy==='cap'?'active':''}`} onClick={() => handleSort('cap')}>
                  C%<SortIcon active={sortBy==='cap'} dir={sortDir} />
                </button>
              )}
              {vcMap.size > 0 && (
                <button type="button" className={`md-sort-col-btn md-pct-hdr ${sortBy==='vc'?'active':''}`} onClick={() => handleSort('vc')}>
                  VC%<SortIcon active={sortBy==='vc'} dir={sortDir} />
                </button>
              )}
              {selectionMap.size > 0 && (
                <button type="button" className={`md-sort-col-btn md-pct-hdr ${sortBy==='sel'?'active':''}`} onClick={() => handleSort('sel')}>
                  Sel%<SortIcon active={sortBy==='sel'} dir={sortDir} />
                </button>
              )}
              <button className={`md-sort-col-btn md-stats-pts-header ${sortBy==='pts'?'active':''}`} onClick={() => handleSort('pts')}>
                Pts
                <SortIcon active={sortBy==='pts'} dir={sortDir} />
              </button>
            </div>
            {sortedFantasyRanked.map(p => (
                <FantasyRow
                  key={p.player_id}
                  p={p}
                  match={match}
                  dimmed={!isFantasyRosterActive(p)}
                  selectionPct={selectionMap.get(p.player_id)}
                  captainPct={captainMap.get(p.player_id)}
                  vcPct={vcMap.get(p.player_id)}
                  showCapCol={captainMap.size > 0}
                  showVcCol={vcMap.size > 0}
                  showSelCol={selectionMap.size > 0}
                  inUserTeam={userTeamPlayerIds.has(p.player_id)}
                  onClick={() => isFantasyRosterActive(p) && setSelectedPlayer(p)}
                />
              ))}
          </>}
        </div>
      )}

      </div>{/* end swipe wrapper */}
      {selectedPlayer && <PlayerBreakdown player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      <AdBanner slot="" format="fluid" />
    </div>
  );
}



function SortIcon({ active, dir }) {
  if (!active) return null;
  return <span style={{fontSize:9, lineHeight:1, marginLeft:1, fontWeight:700}}>{dir === 'desc' ? '↓' : '↑'}</span>;
}

function FantasyRow({ p, match, dimmed, selectionPct, captainPct, vcPct, showCapCol, showVcCol, showSelCol, inUserTeam, onClick }) {
  return (<div className={`md-player-row ${inUserTeam ? 'md-player-row-mine' : ''}`} style={{ opacity: dimmed ? 0.35 : 1, cursor: isFantasyRosterActive(p) ? 'pointer' : 'default' }} onClick={onClick}>
    <div className="md-player-left">{p.image_url ? <img src={p.image_url} alt={p.name} className={`md-player-img ${p.isDream?'md-dream-border':''}`} /> : <div className={`avatar md-player-avatar ${p.isDream?'md-dream-border':''}`} style={{ background: p.team===match.team1_short?'var(--blue)':'var(--coral)' }}>{p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}{p.isDream&&<div className="md-dream-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>}</div>
    <div className="player-info" style={{ flex: 1 }}>
      <div className="player-name" style={{ fontSize: 9.5 }}>{p.name}</div>
      <div className="player-meta" style={{ fontSize: 8.5 }}>
        <span>{p.team}</span><span>•</span><span>{p.role}</span>{p.runs>0&&<span>• {p.runs}({p.balls})</span>}{p.wickets>0&&<span>• {p.wickets}W</span>}{p.catches>0&&<span>• {p.catches}C</span>}
      </div>
    </div>
    {showCapCol && <div className="md-pct-col">{captainPct > 0 ? `${captainPct}%` : ''}</div>}
    {showVcCol && <div className="md-pct-col">{vcPct > 0 ? `${vcPct}%` : ''}</div>}
    {showSelCol && <div className="md-pct-col">{selectionPct !== undefined ? `${selectionPct}%` : ''}</div>}
    <div className={`md-player-pts ${(p.fantasy_points||0)>50?'high':(p.fantasy_points||0)<0?'neg':''}`}>{isFantasyRosterActive(p) ? <AnimatedNumber value={p.fantasy_points||0} /> : '-'}</div>
  </div>);
}

function ScorecardSection({ batsmen, bowlers, score, teamName, onPlayerClick }) {
  return (<div>
    <div className="md-sc-header"><span>{teamName} Batting</span>{score&&<span className="md-sc-score">{score}</span>}</div>
    <div className="md-sc-cols"><span style={{flex:1}}>Batter</span><span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span></div>
    {batsmen.length===0?<div style={{padding:12,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Yet to bat</div>:batsmen.map(p=>{
      const isNotOut = !p.dismissal || p.dismissal === 'not out' || p.dismissal === 'batting' || p.dismissal === '';
      return (<div key={p.player_id} className="md-sc-row md-sc-bat-row" style={{cursor:'pointer'}} onClick={()=>onPlayerClick&&onPlayerClick(p)}>
        <div className="md-sc-player">
          {p.image_url?<img src={p.image_url} alt="" className="md-sc-img"/>:<div className="avatar" style={{width:26,height:26,fontSize:9,background:'var(--bg-elevated)'}}>{p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}
          <div className="md-sc-bat-info">
            <span className="md-sc-name">{p.name.split(' ').pop()}{isNotOut && <span className="md-sc-notout">*</span>}</span>
            <span className="md-sc-dismissal">{isNotOut ? 'not out' : p.dismissal}</span>
          </div>
        </div>
        <span className="md-sc-val bold">{p.runs}{isNotOut && <span className="md-sc-notout">*</span>}</span>
        <span className="md-sc-val">{p.balls}</span><span className="md-sc-val">{p.fours}</span><span className="md-sc-val">{p.sixes}</span>
        <span className="md-sc-val">{p.balls>0?((p.runs/p.balls)*100).toFixed(1):'-'}</span>
      </div>);
    })}
    {bowlers.length>0&&<><div className="md-sc-cols" style={{marginTop:16}}><span style={{flex:1}}>Bowler</span><span>O</span><span>M</span><span>R</span><span>W</span><span>Econ</span></div>{bowlers.map(p=><div key={p.player_id} className="md-sc-row" style={{cursor:'pointer'}} onClick={()=>onPlayerClick&&onPlayerClick(p)}><div className="md-sc-player">{p.image_url?<img src={p.image_url} alt="" className="md-sc-img"/>:<div className="avatar" style={{width:26,height:26,fontSize:9,background:'var(--bg-elevated)'}}>{p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}<span className="md-sc-name">{p.name.split(' ').pop()}</span></div><span className="md-sc-val">{p.overs_bowled}</span><span className="md-sc-val">{p.maidens}</span><span className="md-sc-val">{p.runs_conceded}</span><span className={`md-sc-val ${p.wickets>0?'bold green':''}`}>{p.wickets}</span><span className="md-sc-val">{p.overs_bowled>0?(p.runs_conceded/p.overs_bowled).toFixed(1):'-'}</span></div>)}</>}
  </div>);
}

function CatHeader({ title, pts1, pts2 }) { const d=pts1-pts2; return <div className="cmp-cat-header"><div className="cmp-cat-title"><span>{title}</span></div><div className="cmp-cat-summary"><span className="cmp-cat-pts">{pts1}</span><span className={`cmp-cat-diff ${d>0?'pos':d<0?'neg':''}`}>{d>0?'+':''}{d}</span><span className="cmp-cat-pts">{pts2}</span></div></div>; }
function CmpChip({ p, label, onClick }) { if(!p)return null; return <div className="cmp-chip" onClick={onClick} style={{cursor:onClick?'pointer':'default'}}>{p.image_url?<img className="cmp-chip-img" src={p.image_url} alt={p.name}/>:<div className="cmp-chip-fb">{p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}<div className="cmp-chip-info"><div className="cmp-chip-name"><span className="cmp-chip-name-text">{p.name}</span>{label&&<span className={`cmp-chip-label ${label==='C'?'cmp-badge-c':'cmp-badge-vc'}`}>{label}</span>}</div><div className="cmp-chip-role">{p.team&&<span className="cmp-chip-team">{p.team} · </span>}{p.role}</div></div></div>; }
