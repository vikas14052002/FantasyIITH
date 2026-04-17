import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import { TEAM_COLORS, getTeamLogo } from '../lib/teamLogos';
import CountdownTimer from '../components/CountdownTimer';
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
  const [sortKey, setSortKey] = useState('credits');
  const [sortDir, setSortDir] = useState('desc');
  const [showPreview, setShowPreview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('none'); // 'none' | 'pending' | 'rejected'
  const [adminNote, setAdminNote] = useState('');
  const [utrInput, setUtrInput] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [upiCopied, setUpiCopied] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

    // Fetch selection percentages from aggregate counts table (no individual attribution)
    const { data: countData } = await supabase
      .from('team_pick_counts')
      .select('player_id, count')
      .eq('match_id', matchId);
    if (countData && countData.length > 0) {
      const { count: teamCount } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', matchId);
      const divisor = teamCount || 1;
      const pctMap = {};
      countData.forEach(r => { pctMap[r.player_id] = Math.round((r.count / divisor) * 100); });
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
        const { data: picksData, error: picksErr } = await supabase.functions.invoke('get-my-picks', {
          body: { userId: user.id, teamId: existingTeam.id },
        });

        if (!picksErr && picksData?.picks) {
          const starters = picksData.picks.starters || [];
          const selectedIds = new Set(starters.map(tp => tp.player_id));
          setSelected(allPlayers.filter(p => selectedIds.has(p.player_id)));
          const cap = starters.find(tp => tp.is_captain);
          const vc = starters.find(tp => tp.is_vice_captain);
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
            // Check for an existing payment request
            const { data: reqData } = await supabase
              .from('payment_requests')
              .select('status, admin_note')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (reqData?.status === 'pending') {
              setPaymentStatus('pending');
            } else if (reqData?.status === 'rejected') {
              setPaymentStatus('rejected');
              setAdminNote(reqData.admin_note || '');
            } else {
              setPaymentStatus('none');
            }
            setShowPayment(true);
            setLoading(false);
            return;
          }
        }
      }
    }

    setLoading(false);
  }

  async function handleUpiSubmit() {
    if (!utrInput.trim()) return;
    setSubmitLoading(true);
    setSubmitMsg('');
    const { data: existing } = await supabase
      .from('payment_requests')
      .select('id')
      .eq('upi_transaction_id', utrInput.trim())
      .maybeSingle();
    if (existing) {
      setSubmitMsg('This transaction ID has already been submitted.');
      setSubmitLoading(false);
      return;
    }
    const { error } = await supabase.from('payment_requests').insert({
      user_id: user.id,
      upi_transaction_id: utrInput.trim(),
    });
    if (error) {
      setSubmitMsg('Error: ' + error.message);
    } else {
      setPaymentStatus('pending');
    }
    setSubmitLoading(false);
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

  const filteredPlayers = useMemo(() => {
    const list = players.filter(p => p.role === activeRole);
    return sortPlayers(list, sortKey, sortDir, selectionPct);
  }, [players, activeRole, sortKey, sortDir, selectionPct]);


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

    function sortByOrder(arr) {
      return [...arr].sort((a, b) => {
        const ao = a.batting_order || 0;
        const bo = b.batting_order || 0;
        if (ao === 0 && bo === 0) return 0;
        if (ao === 0) return 1;
        if (bo === 0) return -1;
        return ao - bo;
      });
    }

    // All players from both teams, split by team, segmented by status
    function teamSections(teamShort) {
      const all = players.filter(p => p.team === teamShort);
      return {
        xi:     sortByOrder(all.filter(p => p.is_playing && !p.is_impact_sub)),
        impact: all.filter(p => p.is_impact_sub),
        others: all.filter(p => !p.is_playing && !p.is_impact_sub),
      };
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="ct-lu-name">{player.name}</span>
              {existingCaptainId === player.player_id && <span className="ct-lu-cv-badge ct-lu-c-badge">C</span>}
              {existingVcId === player.player_id && <span className="ct-lu-cv-badge ct-lu-vc-badge">VC</span>}
            </div>
            <span className="ct-lu-role">{player.role}</span>
          </div>
          {selectionPct[player.player_id] !== undefined && (
            <span className="ct-lu-sel">{selectionPct[player.player_id]}%</span>
          )}
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

    const s1 = teamSections(team1);
    const s2 = teamSections(team2);

    function renderTeamCol(teamShort, sections) {
      const teamSelected = teamCounts[teamShort] || 0;
      return (
        <div className="ct-lineup-col">
          <div className="ct-lineup-col-header">
            {getTeamLogo(teamShort) && <img src={getTeamLogo(teamShort)} alt="" className="ct-lineup-logo" />}
            <span>{teamShort}</span>
            <span className="ct-lineup-col-count">{teamSelected > 0 ? teamSelected : ''}</span>
          </div>
          {sections.xi.length > 0 && (
            <>
              <div className="ct-lu-section-label">Playing XI</div>
              {sections.xi.map(renderLineupPlayer)}
            </>
          )}
          {sections.impact.length > 0 && (
            <>
              <div className="ct-lu-section-label ct-lu-section-impact">Impact Sub</div>
              {sections.impact.map(renderLineupPlayer)}
            </>
          )}
          {sections.others.length > 0 && (
            <>
              <div className="ct-lu-section-label ct-lu-section-others">Others</div>
              {sections.others.map(renderLineupPlayer)}
            </>
          )}
        </div>
      );
    }

    return (
      <div className="ct-lineup-view">
        {renderTeamCol(team1, s1)}
        <div className="ct-lineup-divider" />
        {renderTeamCol(team2, s2)}
      </div>
    );
  }

  // Check which roles are valid (met minimum)
  const allRolesValid = ROLES.every(r => roleCounts[r] >= ROLE_LIMITS[r].min);

  if (loading) return <MatchDetailSkeleton />;

  if (showPayment) {
    const UPI_ID = 'sanvesh@ptyes';

    // Pending state
    if (paymentStatus === 'pending') {
      return (
        <div className="create-team-page" style={{ justifyContent: 'center', alignItems: 'center', padding: '24px 20px' }}>
          <div style={{ textAlign: 'center', maxWidth: 340, width: '100%' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: 'var(--text-primary)', margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>
              Payment Under Review
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              We've received your transaction ID and will verify it shortly. You'll be unlocked within a few minutes.
            </p>
            <button className="btn" style={{ width: '100%', color: 'var(--text-muted)', height: 44, fontSize: 13 }} onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

    // Pay + submit UTR form (covers 'none' and 'rejected' states)
    return (
      <div className="create-team-page" style={{ justifyContent: 'center', alignItems: 'center', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 340, width: '100%' }}>

          {/* Rejection notice */}
          {paymentStatus === 'rejected' && (
            <div style={{
              background: 'rgba(217,30,54,0.08)', border: '1px solid rgba(217,30,54,0.25)',
              borderRadius: 12, padding: '10px 16px', marginBottom: 20,
              fontSize: 13, color: 'var(--red-primary)',
            }}>
              Previous submission was rejected{adminNote ? `: ${adminNote}` : ''}. Please try again.
            </div>
          )}

          {/* Progress nudge */}
          {paymentStatus === 'none' && (
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed22, #a855f722)',
              border: '1px solid #7c3aed44',
              borderRadius: 12, padding: '10px 16px', marginBottom: 24,
              fontSize: 13, color: 'var(--accent)', fontWeight: 600,
            }}>
              Your team is ready — one last step
            </div>
          )}

          <h2 style={{ color: 'var(--text-primary)', margin: '20px 0 6px', fontSize: 22, fontWeight: 700 }}>
            Unlock the Full Season
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.6, fontSize: 14 }}>
            You've played your free match. Serious players go all season — don't let your rivals pull ahead.
          </p>

          {/* Price card */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 16, padding: '20px 24px',
            marginBottom: 20, border: '2px solid var(--accent)', position: 'relative',
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>one-time platform fee · valid for IPL 2026</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                'Unlimited team entries all season',
                'Compete across multiple leagues',
                'Access to all features — season leaderboard, H2H, compare & more',
                'Private leagues with friends',
              ].map(item => (
                <div key={item} style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>·</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1 — Copy UPI ID */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8, textAlign: 'left' }}>
            Step 1 — Pay ₹75
          </div>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '12px 16px', marginBottom: 16, textAlign: 'left',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Copy UPI ID and pay from any app</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>{UPI_ID}</span>
              <button
                onClick={() => {
                  const doCopy = () => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(UPI_ID).catch(() => {
                        const el = document.createElement('textarea');
                        el.value = UPI_ID;
                        document.body.appendChild(el);
                        el.select();
                        document.execCommand('copy');
                        document.body.removeChild(el);
                      });
                    } else {
                      const el = document.createElement('textarea');
                      el.value = UPI_ID;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand('copy');
                      document.body.removeChild(el);
                    }
                    setUpiCopied(true);
                    setTimeout(() => setUpiCopied(false), 3000);
                  };
                  doCopy();
                }}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: `1px solid ${upiCopied ? 'rgba(76,175,80,0.4)' : 'var(--border)'}`,
                  background: upiCopied ? 'rgba(76,175,80,0.12)' : 'transparent',
                  color: upiCopied ? 'var(--green)' : 'var(--text-primary)',
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {upiCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Amount: <strong style={{ color: 'var(--text-primary)' }}>₹75</strong></div>
          </div>

          {/* Step 2 — Enter UTR */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8, textAlign: 'left' }}>
            Step 2 — Enter Transaction ID
          </div>
          <input
            className="input"
            placeholder="UPI Transaction / UTR ID"
            value={utrInput}
            onChange={e => setUtrInput(e.target.value)}
            style={{ marginBottom: 12, textAlign: 'center', letterSpacing: '0.5px' }}
          />

          {/* Terms & Conditions */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(v => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  Terms & Conditions
                </button>
              </span>
            </label>

            {showTerms && (
              <div style={{
                marginTop: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px', maxHeight: 220, overflowY: 'auto', overscrollBehavior: 'contain',
                fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'left',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 12 }}>Terms & Conditions — PlayXI</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>1. Platform Access Fee</div>
                <p style={{ margin: '0 0 10px' }}>The ₹75 payment is a one-time platform access fee for the IPL 2026 season. It is a subscription charge for using PlayXI and is not a wager, gambling stake, or entry fee for any prize contest.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>2. No Prizes or Winnings</div>
                <p style={{ margin: '0 0 10px' }}>PlayXI does not offer monetary prizes, rewards, or payouts of any kind. Leaderboard rankings and performance statistics are for entertainment and competitive tracking purposes only among community participants.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>3. Eligibility</div>
                <p style={{ margin: '0 0 10px' }}>You must be 18 years of age or older to use this platform. By completing payment, you confirm that you meet this requirement.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>4. Refund Policy</div>
                <p style={{ margin: '0 0 10px' }}>The platform access fee is non-refundable once the IPL 2026 season has commenced. Refund requests before the season begins may be considered at the platform's discretion.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>5. Platform Availability</div>
                <p style={{ margin: '0 0 10px' }}>PlayXI is a private community platform. We do not guarantee uninterrupted availability and reserve the right to modify or discontinue features at any time without prior notice.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>6. Data & Privacy</div>
                <p style={{ margin: '0 0 10px' }}>By using PlayXI, you consent to the collection and use of your data solely for platform functionality. We do not sell or share your personal data with third parties.</p>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>7. Governing Law</div>
                <p style={{ margin: '0' }}>These terms are governed by the laws of India. Any disputes shall be resolved through mutual discussion between the user and the platform administrators.</p>
              </div>
            )}
          </div>

          {submitMsg && (
            <div style={{ fontSize: 12, color: 'var(--red-primary)', marginBottom: 10, textAlign: 'left' }}>{submitMsg}</div>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 10, height: 48, fontSize: 15, fontWeight: 700, borderRadius: 14 }}
            disabled={submitLoading || !utrInput.trim() || !agreedToTerms}
            onClick={handleUpiSubmit}
          >
            {submitLoading ? 'Submitting…' : 'Submit for Verification'}
          </button>

          <button className="btn" style={{ width: '100%', color: 'var(--text-muted)', height: 44, fontSize: 13 }} onClick={() => navigate(-1)}>
            Maybe later
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, opacity: 0.7 }}>
            We verify manually — you'll be unlocked within a few minutes
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
          {match?.start_time && <CountdownTimer targetDate={match.start_time} />}
        </div>
        <button className="header-icon-btn" onClick={() => navigate('/points')} title="Points">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
      </div>

      {/* Toss result banner */}
      {match?.result && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '5px 14px', margin: '0 12px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
          {match.result}
        </div>
      )}

      {/* Pitch info banner */}
      {(match?.pitch_type || match?.pitch_supports || match?.avg_score) && (
        <div className="ct-pitch-banner">
          {match.pitch_type && (
            <span className="ct-pitch-item">
              <span className="ct-pitch-label">Pitch:</span>
              <span className="ct-pitch-val">{match.pitch_type}</span>
            </span>
          )}
          {match.pitch_type && (match.pitch_supports || match.avg_score) && <span className="ct-pitch-sep">·</span>}
          {match.pitch_supports && (
            <span className="ct-pitch-item">
              <span className="ct-pitch-label">Supports:</span>
              <span className="ct-pitch-val">{match.pitch_supports}</span>
            </span>
          )}
          {match.pitch_supports && match.avg_score && <span className="ct-pitch-sep">·</span>}
          {match.avg_score && (
            <span className="ct-pitch-item">
              <span className="ct-pitch-label">Avg Score:</span>
              <span className="ct-pitch-val">{match.avg_score}</span>
            </span>
          )}
        </div>
      )}

      {/* Slot bar row: team1 | slots | team2 | credits */}
      <div className="d11-slots-row">
        <div className="d11-slots-team">
          {getTeamLogo(match?.team1_short) && <img className="d11-team-logo" src={getTeamLogo(match?.team1_short)} alt="" />}
          <span className="d11-slots-team-count">{teamCounts[match?.team1_short] || 0}</span>
        </div>
        <div className="d11-slots">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className={`d11-slot ${i < selected.length ? 'd11-slot-filled' : ''}`}>
              {i === selected.length - 1
                ? <span className="d11-slot-num">{selected.length}</span>
                : null}
            </div>
          ))}
        </div>
        <div className="d11-slots-team">
          <span className="d11-slots-team-count">{teamCounts[match?.team2_short] || 0}</span>
          {getTeamLogo(match?.team2_short) && <img className="d11-team-logo" src={getTeamLogo(match?.team2_short)} alt="" />}
        </div>
        <div className="d11-slots-credits">
          <span className={`d11-slots-credits-val ${remainingCredits < 10 ? 'ct-stat-warn' : ''}`}>{remainingCredits.toFixed(1)}</span>
          <span className="d11-slots-credits-label">Cr left</span>
        </div>
      </div>


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
            <span className="ct-empty-text">No players available</span>
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
