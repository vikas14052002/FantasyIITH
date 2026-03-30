import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import './CreateTeam.css';

const ROLES = ['WK', 'BAT', 'AR', 'BOWL'];
const ROLE_LABELS = { WK: 'Wicket-Keeper', BAT: 'Batsman', AR: 'All-Rounder', BOWL: 'Bowler' };
const ROLE_LIMITS = { WK: { min: 1, max: 4 }, BAT: { min: 3, max: 6 }, AR: { min: 1, max: 4 }, BOWL: { min: 3, max: 6 } };
const MAX_CREDITS = 100;
const MAX_PER_TEAM = 7;

// sortKey: 'points' | 'credits', sortDir: 'asc' | 'desc'
// Playing XI always float to top
function sortPlayers(players, sortKey, sortDir) {
  const sorted = [...players];
  const dir = sortDir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    // Playing XI first
    const aPlaying = a.is_playing ? 1 : 0;
    const bPlaying = b.is_playing ? 1 : 0;
    if (aPlaying !== bPlaying) return bPlaying - aPlaying;
    // Then by sort key
    if (sortKey === 'points') {
      return dir * ((a.fantasy_points || 0) - (b.fantasy_points || 0));
    }
    return dir * (a.credits - b.credits);
  });
  return sorted;
}

export default function CreateTeam() {
  const { matchId, leagueId } = useParams();
  const [players, setPlayers] = useState([]);
  const [match, setMatch] = useState(null);
  const [selected, setSelected] = useState([]);
  const [activeRole, setActiveRole] = useState('WK');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [existingCaptainId, setExistingCaptainId] = useState(null);
  const [existingVcId, setExistingVcId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('credits');
  const [sortDir, setSortDir] = useState('desc');
  const [showSelectedStrip, setShowSelectedStrip] = useState(false);
  const navigate = useNavigate();
  const listRef = useRef(null);
  const user = getUser();

  useEffect(() => { loadPlayers(); }, [matchId]);

  async function loadPlayers() {
    const [matchRes, playersRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('match_players').select('*').eq('match_id', matchId).order('credits', { ascending: false }),
    ]);
    setMatch(matchRes.data);
    const allPlayers = playersRes.data || [];
    setPlayers(allPlayers);

    // Check if user already has a team for this match+league — pre-fill selection
    if (user) {
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .eq('match_id', matchId)
        .eq('league_id', leagueId)
        .maybeSingle();

      if (existingTeam) {
        setIsEditing(true);
        const { data: teamPlayers } = await supabase
          .from('team_players')
          .select('player_id, is_captain, is_vice_captain')
          .eq('team_id', existingTeam.id);

        if (teamPlayers) {
          const selectedIds = new Set(teamPlayers.map(tp => tp.player_id));
          setSelected(allPlayers.filter(p => selectedIds.has(p.player_id)));
          const cap = teamPlayers.find(tp => tp.is_captain);
          const vc = teamPlayers.find(tp => tp.is_vice_captain);
          if (cap) setExistingCaptainId(cap.player_id);
          if (vc) setExistingVcId(vc.player_id);
        }
      }
    }

    setLoading(false);
  }

  const usedCredits = useMemo(() => selected.reduce((s, p) => s + p.credits, 0), [selected]);
  const remainingCredits = MAX_CREDITS - usedCredits;
  const creditPercent = (usedCredits / MAX_CREDITS) * 100;

  const roleCounts = useMemo(() => {
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    selected.forEach(p => counts[p.role]++);
    return counts;
  }, [selected]);

  const teamCounts = useMemo(() => {
    const counts = {};
    selected.forEach(p => { counts[p.team] = (counts[p.team] || 0) + 1; });
    return counts;
  }, [selected]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function canSelect(player) {
    if (selected.length >= 11) return false;
    if (selected.find(p => p.player_id === player.player_id)) return false;
    if (player.credits > remainingCredits) return false;
    if (roleCounts[player.role] >= ROLE_LIMITS[player.role].max) return false;
    if ((teamCounts[player.team] || 0) >= MAX_PER_TEAM) return false;
    return true;
  }

  function togglePlayer(player) {
    const isSelected = selected.find(p => p.player_id === player.player_id);
    if (isSelected) {
      setSelected(selected.filter(p => p.player_id !== player.player_id));
    } else if (canSelect(player)) {
      setSelected([...selected, player]);
    }
  }

  function removePlayer(player) {
    setSelected(selected.filter(p => p.player_id !== player.player_id));
  }

  function clearAll() {
    setSelected([]);
  }

  const filteredPlayers = useMemo(() => {
    let list = players.filter(p => p.role === activeRole);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return sortPlayers(list, sortKey, sortDir);
  }, [players, activeRole, search, sortKey, sortDir]);

  // Check which roles are valid (met minimum)
  const allRolesValid = ROLES.every(r => roleCounts[r] >= ROLE_LIMITS[r].min);

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  // Block team creation/editing after match starts
  if (match && hasMatchStarted(match)) {
    return (
      <div className="create-team-page" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <div className="empty">
          <div className="empty-icon">🔒</div>
          <p className="empty-text">Deadline has passed</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            You cannot create or edit teams after the match has started
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20, width: 200 }} onClick={() => navigate(-1)}>
            GO BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-team-page">
      {/* Header */}
      <div className="ct-header">
        <button className="ct-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="ct-header-info">
          <span className="ct-match-label">{match?.team1_short} vs {match?.team2_short}</span>
          <span className="ct-match-sub">{isEditing ? 'Edit Your Team' : 'Create Your Team'}</span>
        </div>
        <div className="ct-header-stats">
          <div className="ct-stat">
            <span className="ct-stat-value">{selected.length}<span className="ct-stat-dim">/11</span></span>
            <span className="ct-stat-label">Players</span>
          </div>
          <div className="ct-stat-divider" />
          <div className="ct-stat">
            <span className={`ct-stat-value ${remainingCredits < 10 ? 'ct-stat-warn' : ''}`}>{remainingCredits.toFixed(1)}</span>
            <span className="ct-stat-label">Credits Left</span>
          </div>
        </div>
      </div>

      {/* Credit progress bar */}
      <div className="ct-credit-bar">
        <div className="ct-credit-track">
          <div className="ct-credit-fill" style={{ width: `${creditPercent}%` }} />
        </div>
      </div>

      {/* Selected players strip */}
      {selected.length > 0 && (
        <div className="ct-selected-strip">
          <div className="ct-strip-header" onClick={() => setShowSelectedStrip(!showSelectedStrip)}>
            <span className="ct-strip-title">
              Selected ({selected.length}/11)
              <svg className={`ct-strip-chevron ${showSelectedStrip ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </span>
            {selected.length > 0 && (
              <button className="ct-strip-clear" onClick={(e) => { e.stopPropagation(); clearAll(); }}>Clear All</button>
            )}
          </div>
          {showSelectedStrip && (
            <div className="ct-strip-players fade-in">
              {selected.map(p => (
                <div key={p.player_id} className="ct-strip-chip">
                  <span className="ct-strip-chip-name">{p.name.split(' ').pop()}</span>
                  <button className="ct-strip-chip-x" onClick={() => removePlayer(p)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role validation bar */}
      <div className="ct-role-bar">
        {ROLES.map(role => (
          <div key={role} className={`ct-role-chip ${roleCounts[role] >= ROLE_LIMITS[role].min ? 'valid' : ''} ${roleCounts[role] >= ROLE_LIMITS[role].max ? 'maxed' : ''}`}>
            <span className="ct-role-chip-icon">
              {roleCounts[role] >= ROLE_LIMITS[role].min ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              ) : null}
            </span>
            {role} {roleCounts[role]}/{ROLE_LIMITS[role].min}-{ROLE_LIMITS[role].max}
          </div>
        ))}
      </div>

      {/* Role tabs */}
      <div className="tabs ct-tabs">
        {ROLES.map(role => (
          <button key={role} className={`tab ${activeRole === role ? 'active' : ''}`}
            onClick={() => setActiveRole(role)}>
            {role}
            <span className="tab-count">({roleCounts[role]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="ct-toolbar">
        <div className="ct-search">
          <svg className="ct-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            className="ct-search-input"
            placeholder={`Search ${ROLE_LABELS[activeRole]}s...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="ct-search-clear" onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Player list */}
      <div className="ct-player-list" ref={listRef}>
        <div className="ct-list-header">
          <span>Player</span>
          <div className="ct-list-header-right">
            <button className={`ct-col-sort ${sortKey === 'points' ? 'active' : ''}`} onClick={() => toggleSort('points')}>
              Points
              <svg className={`ct-sort-arrow ${sortKey === 'points' ? (sortDir === 'asc' ? 'asc' : 'desc') : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>
            <button className={`ct-col-sort ${sortKey === 'credits' ? 'active' : ''}`} onClick={() => toggleSort('credits')}>
              Credits
              <svg className={`ct-sort-arrow ${sortKey === 'credits' ? (sortDir === 'asc' ? 'asc' : 'desc') : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>
            <span style={{ width: 28 }}></span>
          </div>
        </div>
        {filteredPlayers.length === 0 && (
          <div className="ct-empty">
            <span className="ct-empty-text">{search ? 'No players match your search' : 'No players available'}</span>
          </div>
        )}
        {filteredPlayers.map(player => {
          const isSelected = selected.find(p => p.player_id === player.player_id);
          const disabled = !isSelected && !canSelect(player);
          const disabledReason = !isSelected && disabled ? getDisabledReason(player) : null;
          return (
            <div key={player.player_id}
              className={`ct-player-row ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${player.is_playing ? 'playing' : ''}`}
              onClick={() => !disabled || isSelected ? togglePlayer(player) : null}
              title={disabledReason || ''}>
              <div className="ct-player-left">
                {player.image_url ? (
                  <img className="ct-player-img" src={player.image_url} alt={player.name}
                    style={{ borderColor: isSelected ? 'var(--green)' : player.is_playing ? 'var(--green)' : 'var(--border)' }} />
                ) : (
                  <div className={`ct-player-avatar ${player.is_playing ? 'playing-xi' : ''}`}
                    style={{ background: isSelected ? 'var(--green)' : 'var(--bg-elevated)' }}>
                    {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className="player-info">
                  <div className="player-name">{player.name}</div>
                  <div className="player-meta">
                    <span className="team-tag">{player.team}</span>
                    {player.is_playing && <span className="ct-playing-tag">Playing XI</span>}
                  </div>
                </div>
              </div>
              <div className="ct-player-right">
                <span className="ct-player-points">{player.fantasy_points || '-'}</span>
                <span className="player-credits">{player.credits}</span>
                <div className={`ct-select-btn ${isSelected ? 'active' : ''}`}>
                  {isSelected ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="ct-bottom-bar">
        <div className="ct-bottom-info">
          {selected.length < 11 && !allRolesValid && (
            <span className="ct-bottom-hint">
              {ROLES.filter(r => roleCounts[r] < ROLE_LIMITS[r].min).map(r =>
                `${ROLE_LIMITS[r].min - roleCounts[r]} more ${r}`
              ).join(', ')} needed
            </span>
          )}
          {selected.length === 11 && !allRolesValid && (
            <span className="ct-bottom-hint ct-bottom-warn">Role requirements not met</span>
          )}
          {selected.length === 11 && allRolesValid && (
            <span className="ct-bottom-hint ct-bottom-ready">Team ready!</span>
          )}
        </div>
        <button className="btn btn-primary ct-next-btn"
          disabled={selected.length !== 11 || !allRolesValid}
          onClick={() => {
            sessionStorage.setItem('selectedPlayers', JSON.stringify(selected));
            if (existingCaptainId) sessionStorage.setItem('existingCaptainId', existingCaptainId);
            if (existingVcId) sessionStorage.setItem('existingVcId', existingVcId);
            navigate(`/captain-select/${matchId}/${leagueId}`);
          }}>
          CONTINUE
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );

  function getDisabledReason(player) {
    if (selected.length >= 11) return 'Team is full (11/11)';
    if (player.credits > remainingCredits) return `Not enough credits (need ${player.credits}, have ${remainingCredits.toFixed(1)})`;
    if (roleCounts[player.role] >= ROLE_LIMITS[player.role].max) return `Max ${ROLE_LABELS[player.role]}s reached`;
    if ((teamCounts[player.team] || 0) >= MAX_PER_TEAM) return `Max ${MAX_PER_TEAM} from ${player.team}`;
    return null;
  }
}
