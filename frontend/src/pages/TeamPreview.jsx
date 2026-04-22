import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import ShareSheet from '../components/ShareSheet';
import { MatchDetailSkeleton } from '../components/Skeleton';
import PlayerBreakdown from '../components/PlayerBreakdown';
import './TeamPreview.css';

const ROLE_ORDER = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
const ROLE_LABELS = { WK: 'WICKET-KEEPERS', BAT: 'BATTERS', AR: 'ALL-ROUNDERS', BOWL: 'BOWLERS' };

export default function TeamPreview() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matchPlayersMap, setMatchPlayersMap] = useState(new Map());
  const [dreamIds, setDreamIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showBench, setShowBench] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  async function loadTeam() {
    // Fetch team metadata (always allowed)
    const { data: teamData } = await supabase
      .from('teams')
      .select('*, matches(*)')
      .eq('id', teamId)
      .single();

    setTeam(teamData);

    if (!teamData) { setLoading(false); return; }

    // Use secure DB function to fetch players — returns empty if not allowed
    const { data: securedPlayers } = await supabase.rpc('get_team_preview', {
      p_team_id: teamId,
      p_requesting_user_id: user?.id,
    });

    let resolvedPlayers = securedPlayers || [];

    // If team_players empty (encrypted, not yet revealed) and this is our own team, decrypt via edge function
    if (resolvedPlayers.length === 0 && teamData.user_id === user?.id && teamData.picks_encrypted) {
      const { data: picksData } = await supabase.functions.invoke('get-my-picks', {
        body: { userId: user.id, teamId },
      });
      if (picksData?.picks) {
        const allPicks = [
          ...(picksData.picks.starters || []).map(p => ({ ...p, is_backup: false, backup_order: null })),
          ...(picksData.picks.backups || []).map(p => ({ ...p, is_backup: true, is_captain: false, is_vice_captain: false })),
        ];
        // Fetch image_url from match_players
        const playerIds = allPicks.map(p => p.player_id);
        const { data: playerRows } = await supabase
          .from('match_players')
          .select('player_id, image_url')
          .eq('match_id', teamData.match_id)
          .in('player_id', playerIds);
        const imgMap = new Map((playerRows || []).map(r => [r.player_id, r.image_url]));
        resolvedPlayers = allPicks.map(p => ({
          ...p,
          image_url: imgMap.get(p.player_id) || null,
          fantasy_points: 0,
        }));
      }
    }

    setPlayers(resolvedPlayers);

    // Fetch match_players stats for the breakdown panel
    if (teamData.match_id) {
      const { data: mpData } = await supabase
        .from('match_players')
        .select('*')
        .eq('match_id', teamData.match_id);
      if (mpData) {
        setMatchPlayersMap(new Map(mpData.map(mp => [mp.player_id, mp])));
      }
    }

    // Compute dream team (top 11 by fantasy_points) for completed matches
    if (teamData.matches?.status === 'completed' && teamData.match_id) {
      const { data: allMp } = await supabase
        .from('match_players')
        .select('player_id, fantasy_points')
        .eq('match_id', teamData.match_id)
        .or('is_playing.eq.true,is_impact_sub.eq.true')
        .order('fantasy_points', { ascending: false })
        .limit(11);
      if (allMp) {
        setDreamIds(new Set(allMp.map(p => p.player_id)));
      }
    }

    setLoading(false);
  }

  useEffect(() => { loadTeam(); }, [teamId]);

  function goBackFromPreview() {
    const from = location.state?.from;
    if (from) {
      navigate(from);
      return;
    }
    if (team?.match_id) {
      navigate(`/match/${team.match_id}`);
      return;
    }
    navigate(-1);
  }

  function getImage(playerId) {
    const p = players.find(pl => pl.player_id === playerId);
    return p?.image_url;
  }

  function getPoints(playerId) {
    const p = players.find(pl => pl.player_id === playerId);
    return p?.fantasy_points || 0;
  }

  if (loading) return <MatchDetailSkeleton />;
  if (!team) return <div className="page"><p>Team not found</p></div>;

  const isMyTeam = team.user_id === user?.id;
  const matchStarted = hasMatchStarted(team.matches);

  // Block viewing others' teams before match starts
  if (!isMyTeam && !matchStarted) {
    return (
      <div className="preview-page">
        <div className="preview-header">
          <div className="preview-header-center">
            <span className="preview-match-title">Team Locked</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <p className="empty-text">Teams will be visible after the match starts</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              You can only view other players' teams once the deadline passes
            </p>
          </div>
        </div>
      </div>
    );
  }

  const starters = players.filter(p => !p.is_backup);
  const backups = players.filter(p => p.is_backup).sort((a, b) => (a.backup_order || 99) - (b.backup_order || 99));

  const grouped = {};
  starters.forEach(p => {
    if (!grouped[p.role]) grouped[p.role] = [];
    grouped[p.role].push(p);
  });

  const sortedRoles = Object.keys(grouped).sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
  const match = team.matches;
  const team1 = match?.team1_short;
  const team2 = match?.team2_short;
  const team1Count = starters.filter(p => p.team === team1).length;
  const team2Count = starters.filter(p => p.team === team2).length;

  return (
    <div className="preview-page">
      {/* Top header bar */}
      <div className="preview-header">
        <button type="button" className="preview-back" onClick={goBackFromPreview} aria-label="Back">
          ←
        </button>
        <div className="preview-header-center">
          <span className="preview-match-title">{team1} vs {team2}</span>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {team.total_points > 0 ? `${team.total_points} pts` : 'Match ' + (match?.match_number || '')}
          </div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Team composition bar */}
      <div className="preview-comp-bar">
        <div className="preview-comp-team">
          <div className="preview-comp-dot" style={{ background: '#fff' }} />
          <span>{team1}</span>
          <span className="preview-comp-count">{team1Count}</span>
        </div>
        <div className="preview-comp-team">
          <div className="preview-comp-dot" style={{ background: '#000' }} />
          <span>{team2}</span>
          <span className="preview-comp-count">{team2Count}</span>
        </div>
        <div className="preview-comp-credits">
          Total: <strong>{team.total_points} pts</strong>
        </div>
      </div>

      {/* Scrollable cricket field */}
      <div className="preview-field-wrapper">
        <div className="preview-field">
          {/* Field markings */}
          <div className="field-pitch" />
          <div className="field-circle" />
          <div className="field-inner-circle" />
          <div className="field-crease field-crease-top" />
          <div className="field-crease field-crease-bottom" />
          <div className="field-boundary" />

          {/* Watermark behind players */}
          <div className="field-watermark">PlayXI</div>

          {/* Player rows by role */}
          <div className="field-content">
            {sortedRoles.map(role => (
              <div key={role} className="preview-role-row">
                <div className="preview-role-tag">{ROLE_LABELS[role]}</div>
                <div className="preview-players-row">
                  {grouped[role].map(p => {
                    const img = getImage(p.player_id);
                    const pts = getPoints(p.player_id);
                    const multiplier = p.is_captain ? 2 : p.is_vice_captain ? 1.5 : 1;
                    const displayPts = pts * multiplier;
                    const isDream = dreamIds.has(p.player_id);

                    return (
                      <div key={p.player_id} className="preview-player" onClick={() => setSelectedPlayer({ ...matchPlayersMap.get(p.player_id), ...p, fantasy_points: pts })} style={{ cursor: 'pointer' }}>
                        {/* Player photo */}
                        <div className="preview-avatar-wrap">
                          {img ? (
                            <img className={`preview-avatar-img ${isDream ? 'preview-dream-glow' : ''}`} src={img} alt={p.name}
                              style={{ borderColor: isDream ? 'var(--gold)' : p.team === team1 ? '#fff' : 'var(--gold)' }} />
                          ) : (
                            <div className={`preview-avatar-fallback ${isDream ? 'preview-dream-glow' : ''}`}
                              style={{ background: p.team === team1 ? '#fff' : '#1a1a2e', color: p.team === team1 ? '#1a1a2e' : '#fff' }}>
                              {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          {p.is_captain && <div className="preview-badge preview-badge-c">C</div>}
                          {p.is_vice_captain && <div className="preview-badge preview-badge-vc">VC</div>}
                          {isDream && <div className="preview-badge preview-badge-dream">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </div>}
                        </div>
                        {/* Name pill */}
                        <div className={`preview-name-pill ${isDream ? 'pill-dream' : p.team === team1 ? 'pill-team1' : 'pill-team2'}`}>
                          {p.name.split(' ').pop()}
                        </div>
                        {/* Points */}
                        <div className="preview-pts">
                          {displayPts > 0 ? `${displayPts} pts` : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bench toggle button */}
      {backups.length > 0 && (
        <div className="preview-bench-toggle" onClick={() => setShowBench(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Bench ({backups.length})
        </div>
      )}

      {/* Bench slider overlay */}
      {showBench && (
        <>
          <div className="preview-bench-overlay" onClick={() => setShowBench(false)} />
          <div className="preview-bench-slider">
            <div className="preview-bench-slider-header">
              <span className="preview-bench-slider-title">Bench Players</span>
              <button className="preview-bench-close" onClick={() => setShowBench(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="preview-bench-slider-list">
              {backups.map((p, i) => {
                const img = getImage(p.player_id);
                const pts = getPoints(p.player_id);
                return (
                  <div key={p.player_id} className="preview-bench-player">
                    <span className="preview-bench-num">{i + 1}</span>
                    {img ? (
                      <img className="preview-bench-img" src={img} alt={p.name} />
                    ) : (
                      <div className="preview-bench-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.team} • {p.role}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: pts > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                      {pts > 0 ? `${pts}` : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Share sheet */}
      {showShare && (
        <ShareSheet
          title="Share Team"
          text={`Check out my PlayXI team for ${team1} vs ${team2}! ${team.total_points > 0 ? `Score: ${team.total_points} pts` : ''}`}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Player breakdown */}
      {selectedPlayer && <PlayerBreakdown player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      {/* Fixed bottom actions */}
      <div className="preview-bottom">
        {isMyTeam && !matchStarted && (
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate(`/create-team/${team.match_id}/${team.league_id}`)}>
            EDIT TEAM
          </button>
        )}
        <button className="btn btn-outline" style={{ flex: 0, minWidth: 48, padding: '12px' }} onClick={() => setShowShare(true)} title="Share Team">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => {
            if (matchStarted) goBackFromPreview();
            else if (team.league_id) navigate(`/leagues/${team.league_id}`);
            else goBackFromPreview();
          }}
        >
          {matchStarted ? 'BACK' : 'CONTINUE'}
        </button>
      </div>
    </div>
  );
}
