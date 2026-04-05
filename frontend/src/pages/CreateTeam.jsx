import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import { TEAM_COLORS, getTeamLogo } from '../lib/teamLogos';
import { MatchDetailSkeleton } from '../components/Skeleton';
import { isFantasyRosterActive } from '../lib/matchPlayers';
import './CreateTeam.css';

const ROLES = ['WK', 'BAT', 'AR', 'BOWL'];
const ROLE_LABELS = { WK: 'Wicket-Keeper', BAT: 'Batsman', AR: 'All-Rounder', BOWL: 'Bowler' };
const ROLE_LIMITS = { WK: { min: 1, max: 11 }, BAT: { min: 1, max: 11 }, AR: { min: 1, max: 11 }, BOWL: { min: 1, max: 11 } };
const MAX_CREDITS = 100;
const MAX_PER_TEAM = 10;

// Sort: Playing XI → others. Within each group, by selection % then credits/points
function sortPlayers(players, sortKey, sortDir, pctMap) {
  const sorted = [...players];
  const dir = sortDir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    // Announced squad (Playing XI + impact subs) first
    const aPlaying = isFantasyRosterActive(a) ? 1 : 0;
    const bPlaying = isFantasyRosterActive(b) ? 1 : 0;
    if (aPlaying !== bPlaying) return bPlaying - aPlaying;
    // Then by sort key
    if (sortKey === 'selection') {
      return (pctMap[b.player_id] || 0) - (pctMap[a.player_id] || 0);
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
  const [showPreview, setShowPreview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [flashType, setFlashType] = useState(null);
  const [selectionPct, setSelectionPct] = useState({});
  const [viewMode, setViewMode] = useState('roles'); // 'roles' | 'lineup'
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

    // Fetch selection percentages
    const { data: pctData } = await supabase.rpc('get_player_selection_pct', { p_match_id: matchId });
    if (pctData) {
      const pctMap = {};
      pctData.forEach(p => { pctMap[p.player_id] = p.pct; });
      setSelectionPct(pctMap);
    }

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
      } else if (import.meta.env.VITE_PAYMENTS_ENABLED === 'true') {
        // New team — first match is free, season pass required after that
        const { count } = await supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (count > 0) {
          const { data: userData } = await supabase
            .from('users')
            .select('has_paid')
            .eq('id', user.id)
            .single();
          if (!userData?.has_paid) {
            setShowPayment(true);
            setLoading(false);
            return;
          }
        }
      }
    }

    setLoading(false);
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePayment() {
    setPaymentLoading(true);
    try {
      const { data: orderData, error: orderErr } = await supabase.functions.invoke('payment-handler', {
        body: { action: 'create-order' },
      });
      if (orderErr || !orderData?.order_id) {
        const detail = orderErr?.message || orderData?.error || JSON.stringify(orderData);
        throw new Error(`Could not initiate payment: ${detail}`);
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment SDK. Check your connection.');

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: 7500,
        currency: 'INR',
        name: 'FantasyIITH',
        description: 'Season Pass — unlimited entries',
        order_id: orderData.order_id,
        handler: async (response) => {
          const { data: vData, error: vErr } = await supabase.functions.invoke('payment-handler', {
            body: {
              action: 'verify-payment',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              user_id: user.id,
            },
          });
          if (vErr || !vData?.success) {
            alert('Payment could not be verified. Please contact support with your payment ID: ' + response.razorpay_payment_id);
            return;
          }
          // Update cached user in localStorage
          const updatedUser = { ...user, has_paid: true };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setShowPayment(false);
        },
        prefill: { name: user.name },
        theme: { color: '#D91E36' },
        modal: { ondismiss: () => setPaymentLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.message || 'Payment failed. Please try again.');
      setPaymentLoading(false);
    }
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
      setFlashId(player.player_id);
      setFlashType('deselect');
    } else if (canSelect(player)) {
      setSelected([...selected, player]);
      setFlashId(player.player_id);
      setFlashType('select');
    }
    setTimeout(() => { setFlashId(null); setFlashType(null); }, 400);
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
    return sortPlayers(list, sortKey, sortDir, selectionPct);
  }, [players, activeRole, search, sortKey, sortDir, selectionPct]);


  // Detect squad announcement from actual player data, not lineups_synced flag
  const hasPlayingXI = useMemo(() => players.some(isFantasyRosterActive), [players]);
  const playingXI = hasPlayingXI ? filteredPlayers.filter(p => p.is_playing && !p.is_impact_sub) : [];
  const impactSubs = hasPlayingXI ? filteredPlayers.filter(p => p.is_impact_sub) : [];
  const others = hasPlayingXI ? filteredPlayers.filter(p => !p.is_playing && !p.is_impact_sub) : filteredPlayers;

  function renderPlayerRow(player) {
    const isSelected = selected.find(p => p.player_id === player.player_id);
    const disabled = !isSelected && !canSelect(player);
    const disabledReason = !isSelected && disabled ? getDisabledReason(player) : null;
    const tag = player.is_impact_sub ? 'Impact Sub' : player.is_playing ? 'Playing XI' : null;
    const pct = selectionPct[player.player_id];
    const pctColor = pct >= 70 ? 'ct-pct-high' : pct >= 40 ? 'ct-pct-mid' : 'ct-pct-low';
    return (
      <div key={player.player_id}
        className={`ct-player-row ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isFantasyRosterActive(player) ? 'playing' : ''} ${player.is_impact_sub ? 'impact-sub' : ''}`}
        onClick={() => !disabled || isSelected ? togglePlayer(player) : null}
        title={disabledReason || ''}>
        <div className="ct-player-left">
          {player.image_url ? (
            <img className="ct-player-img" src={player.image_url} alt={player.name}
              style={{ borderColor: isSelected ? 'var(--green)' : player.is_impact_sub ? '#9C27B0' : player.is_playing ? 'var(--green)' : 'var(--border)' }} />
          ) : (
            <div className={`ct-player-avatar ${player.is_playing ? 'playing-xi' : ''} ${player.is_impact_sub ? 'impact-sub-avatar' : ''}`}
              style={{ background: isSelected ? 'var(--green)' : 'var(--bg-elevated)' }}>
              {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
          <div className="player-info">
            <div className="player-name">{player.name}</div>
            <div className="player-meta">
              <span className="team-tag">{player.team}</span>
              {tag && <span className={`ct-playing-tag ${player.is_impact_sub ? 'ct-impact-tag' : ''}`}>{tag}</span>}
            </div>
          </div>
        </div>
        <div className="ct-player-right">
          <div className="ct-pct-slot">
            {pct != null ? <span className={`ct-pct-badge ${pctColor}`}>{pct}%</span> : null}
          </div>
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
  }

  function renderLineupView() {
    const team1 = match?.team1_short;
    const team2 = match?.team2_short;

    // All players from both teams, split by team, sorted by batting_order (0 = bench → last)
    function teamPlayers(teamShort) {
      return [...players.filter(p => p.team === teamShort)].sort((a, b) => {
        const ao = a.batting_order || 0;
        const bo = b.batting_order || 0;
        if (ao === 0 && bo === 0) return 0;
        if (ao === 0) return 1;
        if (bo === 0) return -1;
        return ao - bo;
      });
    }

    function renderLineupPlayer(player) {
      const isSelected = !!selected.find(p => p.player_id === player.player_id);
      const disabled = !isSelected && !canSelect(player);
      const order = player.batting_order || 0;
      return (
        <div
          key={player.player_id}
          className={`ct-lu-player ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${player.is_impact_sub ? 'impact-sub' : ''}`}
          onClick={() => !disabled || isSelected ? togglePlayer(player) : null}
        >
          <span className="ct-lu-order">{order > 0 ? order : '·'}</span>
          <div className="ct-lu-info">
            <span className="ct-lu-name">{player.name.split(' ').slice(-1)[0]}</span>
            <span className="ct-lu-role">{player.role}{player.is_impact_sub ? ' ★' : ''}</span>
          </div>
          <div className={`ct-select-btn ${isSelected ? 'active' : ''}`}
            style={{ width: 24, height: 24, minWidth: 24 }}>
            {isSelected ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            )}
          </div>
        </div>
      );
    }

    const t1Players = teamPlayers(team1);
    const t2Players = teamPlayers(team2);

    return (
      <div className="ct-lineup-view">
        <div className="ct-lineup-col">
          <div className="ct-lineup-col-header">
            {getTeamLogo(team1) && <img src={getTeamLogo(team1)} alt="" className="ct-lineup-logo" />}
            <span>{team1}</span>
          </div>
          {t1Players.map(renderLineupPlayer)}
        </div>
        <div className="ct-lineup-divider" />
        <div className="ct-lineup-col">
          <div className="ct-lineup-col-header">
            {getTeamLogo(team2) && <img src={getTeamLogo(team2)} alt="" className="ct-lineup-logo" />}
            <span>{team2}</span>
          </div>
          {t2Players.map(renderLineupPlayer)}
        </div>
      </div>
    );
  }

  // Check which roles are valid (met minimum)
  const allRolesValid = ROLES.every(r => roleCounts[r] >= ROLE_LIMITS[r].min);

  if (loading) return <MatchDetailSkeleton />;

  if (showPayment) {
    return (
      <div className="create-team-page" style={{ justifyContent: 'center', alignItems: 'center', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 340, width: '100%' }}>

          {/* Progress nudge */}
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed22, #a855f722)',
            border: '1px solid #7c3aed44',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 24,
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 600,
          }}>
            Your team is ready — one last step
          </div>

          {/* Hero */}
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>
            Unlock the Full Season
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.6, fontSize: 14 }}>
            You've played your free match. Serious players go all season — don't let your rivals pull ahead.
          </p>

          {/* Price card */}
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 16,
            border: '2px solid var(--accent)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '3px 14px', borderRadius: 20, letterSpacing: 0.5,
            }}>BEST VALUE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 17, color: '#e53935', textDecoration: 'line-through', fontWeight: 600, opacity: 0.85 }}>₹150</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>₹75</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 10px', borderRadius: 20, letterSpacing: 0.5 }}>FIRSTSEASON applied</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>one-time payment · valid till 20 Apr 2026</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                'Unlimited team entries all season',
                'Compete across multiple leagues',
                'Full leaderboard & rankings',
                'Private leagues with friends',
              ].map(item => (
                <div key={item} style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>·</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* Social proof */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Your first match was free — ₹75 unlocks the full season
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 10, height: 52, fontSize: 16, fontWeight: 700, borderRadius: 14 }}
            disabled={paymentLoading}
            onClick={handlePayment}
          >
            {paymentLoading ? 'Opening payment...' : 'Pay ₹75 & Join Season'}
          </button>
          <button
            className="btn"
            style={{ width: '100%', color: 'var(--text-muted)', height: 44, fontSize: 13 }}
            onClick={() => navigate(-1)}
          >
            Maybe later
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, opacity: 0.7 }}>
            Secured payment via Razorpay · UPI, Cards, NetBanking accepted
          </p>
        </div>
      </div>
    );
  }

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
          <button className="btn btn-primary" style={{ marginTop: 20, width: 200, alignSelf: 'center' }} onClick={() => navigate(-1)}>
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
          <span className="ct-match-label">{isEditing ? 'Edit Team' : 'Create Team'}</span>
        </div>
        <button className="header-icon-btn" onClick={() => navigate('/points')} title="Points">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
      </div>

      {/* Dream11-style team comp bar */}
      <div className="d11-comp">
        <div className="d11-comp-col">
          <span className="d11-comp-label">Players</span>
          <span className="d11-comp-value">{selected.length}<span className="d11-comp-dim">/11</span></span>
        </div>
        <div className="d11-comp-team">
          {getTeamLogo(match?.team1_short) && <img className="d11-team-logo" src={getTeamLogo(match?.team1_short)} alt="" />}
          <div>
            <span className="d11-comp-label">{match?.team1_short}</span>
            <span className="d11-comp-value">{teamCounts[match?.team1_short] || 0}</span>
          </div>
        </div>
        <div className="d11-comp-team">
          {getTeamLogo(match?.team2_short) && <img className="d11-team-logo" src={getTeamLogo(match?.team2_short)} alt="" />}
          <div>
            <span className="d11-comp-label">{match?.team2_short}</span>
            <span className="d11-comp-value">{teamCounts[match?.team2_short] || 0}</span>
          </div>
        </div>
        <div className="d11-comp-col">
          <span className="d11-comp-label">Credits Left</span>
          <span className={`d11-comp-value ${remainingCredits < 10 ? 'ct-stat-warn' : ''}`}>{remainingCredits.toFixed(1)}</span>
        </div>
      </div>

      {/* Player slot boxes */}
      <div className="d11-slots">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className={`d11-slot ${i < selected.length ? 'd11-slot-filled' : ''}`}>
            {i === selected.length - 1
              ? <span className="d11-slot-num">{selected.length}</span>
              : null}
          </div>
        ))}
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

      {/* Role validation bar - removed, rules simplified */}

      {/* View toggle — only show when lineup is announced */}
      {hasPlayingXI && (
        <div className="ct-view-toggle">
          <button
            className={`ct-view-btn ${viewMode === 'roles' ? 'active' : ''}`}
            onClick={() => setViewMode('roles')}>
            By Role
          </button>
          <button
            className={`ct-view-btn ${viewMode === 'lineup' ? 'active' : ''}`}
            onClick={() => setViewMode('lineup')}>
            Lineup
          </button>
        </div>
      )}

      {/* Role tabs — hidden in lineup mode */}
      {viewMode === 'roles' && (
      <div className="tabs ct-tabs">
        {ROLES.map(role => (
          <button key={role} className={`tab ${activeRole === role ? 'active' : ''}`}
            onClick={() => setActiveRole(role)}>
            {role}
            <span className="tab-count">({roleCounts[role]})</span>
          </button>
        ))}
      </div>
      )}

      {/* Search — hidden in lineup mode */}
      {viewMode === 'roles' && (
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
      )}

      {/* Lineup view — shown when lineup mode is active and XI is announced */}
      {viewMode === 'lineup' && hasPlayingXI && renderLineupView()}

      {/* Player list — hidden in lineup mode */}
      {viewMode === 'roles' && (
      <div className="ct-player-list" ref={listRef}>
        <div className="ct-list-header">
          <span>Player</span>
          <div className="ct-list-header-right">
            <button type="button" className={`ct-col-sort ct-col-sel ${sortKey === 'selection' ? 'active' : ''}`} onClick={() => { setSortKey('selection'); setSortDir('desc'); }}>
              Sel%
            </button>
            <button type="button" className={`ct-col-sort ct-col-cr ${sortKey === 'credits' ? 'active' : ''}`} onClick={() => toggleSort('credits')}>
              Cr
              <svg className={`ct-sort-arrow ${sortKey === 'credits' ? (sortDir === 'asc' ? 'asc' : 'desc') : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>
            <span className="ct-list-btn-spacer" aria-hidden />
          </div>
        </div>
        {filteredPlayers.length === 0 && (
          <div className="ct-empty">
            <span className="ct-empty-text">{search ? 'No players match your search' : 'No players available'}</span>
          </div>
        )}
        {hasPlayingXI ? (
          <>
            {playingXI.length > 0 && (
              <>
                <div className="ct-section-header">
                  <span>Playing XI</span><span className="ct-section-count">{playingXI.length}</span>
                </div>
                {playingXI.map(player => renderPlayerRow(player))}
              </>
            )}
            {impactSubs.length > 0 && (
              <>
                <div className="ct-section-header ct-section-impact">
                  <span>Impact Subs</span><span className="ct-section-count">{impactSubs.length}</span>
                </div>
                {impactSubs.map(player => renderPlayerRow(player))}
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="ct-section-header ct-section-others">
                  <span>Not in Squad</span><span className="ct-section-count">{others.length}</span>
                </div>
                {others.map(player => renderPlayerRow(player))}
              </>
            )}
          </>
        ) : (
          filteredPlayers.map(player => renderPlayerRow(player))
        )}
      </div>
      )}

      {/* Bottom bar */}
      <div className="ct-bottom-bar">
        <button className="btn btn-outline" style={{ flex: 1 }}
          disabled={selected.length === 0}
          onClick={() => setShowPreview(true)}>
          PREVIEW ({selected.length})
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }}
          disabled={selected.length !== 11 || !allRolesValid}
          onClick={() => {
            sessionStorage.setItem('selectedPlayers', JSON.stringify(selected));
            sessionStorage.setItem('allPlayers', JSON.stringify(players));
            if (existingCaptainId) sessionStorage.setItem('existingCaptainId', existingCaptainId);
            if (existingVcId) sessionStorage.setItem('existingVcId', existingVcId);
            navigate(`/captain-select/${matchId}/${leagueId}`);
          }}>
          NEXT →
        </button>
      </div>

      {/* Full-screen Field Preview */}
      {showPreview && (
        <div className="ct-field-overlay">
          <div className="ct-field-header">
            <button className="ct-field-close" onClick={() => setShowPreview(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <span className="ct-field-title">{selected.length}/11 Players</span>
            <span className="ct-field-credits">{remainingCredits.toFixed(1)} Cr left</span>
          </div>
          <div className="ct-field-scroll">
            <div className="ct-field-pitch">
              <div className="ct-field-circle" />
              <div className="ct-field-inner" />
              <div className="ct-field-boundary" />
              <div className="ct-field-content">
                {ROLES.map(role => {
                  const rolePlayers = selected.filter(p => p.role === role);
                  return (
                    <div key={role} className="ct-field-role">
                      <div className="ct-field-role-tag">{ROLE_LABELS[role]}</div>
                      <div className="ct-field-players">
                        {rolePlayers.length === 0 ? (
                          <div className="ct-field-empty-slot">
                            <div className="ct-field-empty-dot">?</div>
                            <span className="ct-field-empty-label">Pick 1+</span>
                          </div>
                        ) : rolePlayers.map(p => (
                          <div key={p.player_id} className="ct-field-player">
                            <div className="ct-field-avatar-wrap">
                              {p.image_url ? (
                                <img className="ct-field-avatar" src={p.image_url} alt={p.name} />
                              ) : (
                                <div className="ct-field-avatar-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                              )}
                            </div>
                            <div className="ct-field-name-pill">{p.name.split(' ').pop()}</div>
                            <div className="ct-field-cr">{p.credits}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
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
