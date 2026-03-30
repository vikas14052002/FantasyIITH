import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import './TeamPreview.css';

const ROLE_ORDER = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
const ROLE_LABELS = { WK: 'WICKET-KEEPERS', BAT: 'BATTERS', AR: 'ALL-ROUNDERS', BOWL: 'BOWLERS' };

export default function TeamPreview() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [dreamIds, setDreamIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadTeam(); }, [teamId]);

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

    setPlayers(securedPlayers || []);

    // Compute dream team (top 11 by fantasy_points) for completed matches
    if (teamData.matches?.status === 'completed' && teamData.match_id) {
      const { data: allMp } = await supabase
        .from('match_players')
        .select('player_id, fantasy_points')
        .eq('match_id', teamData.match_id)
        .eq('is_playing', true)
        .order('fantasy_points', { ascending: false })
        .limit(11);
      if (allMp) {
        setDreamIds(new Set(allMp.map(p => p.player_id)));
      }
    }

    setLoading(false);
  }

  function getImage(playerId) {
    const p = players.find(pl => pl.player_id === playerId);
    return p?.image_url;
  }

  function getPoints(playerId) {
    const p = players.find(pl => pl.player_id === playerId);
    return p?.fantasy_points || 0;
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!team) return <div className="page"><p>Team not found</p></div>;

  const isMyTeam = team.user_id === user?.id;
  const matchStarted = hasMatchStarted(team.matches);

  // Block viewing others' teams before match starts
  if (!isMyTeam && !matchStarted) {
    return (
      <div className="preview-page">
        <div className="preview-header">
          <button className="preview-back" onClick={() => navigate(-1)}>←</button>
          <div className="preview-header-center">
            <span className="preview-match-title">Team Locked</span>
          </div>
          <div style={{ width: 32 }} />
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

  const grouped = {};
  players.forEach(p => {
    if (!grouped[p.role]) grouped[p.role] = [];
    grouped[p.role].push(p);
  });

  const sortedRoles = Object.keys(grouped).sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
  const match = team.matches;
  const team1 = match?.team1_short;
  const team2 = match?.team2_short;
  const team1Count = players.filter(p => p.team === team1).length;
  const team2Count = players.filter(p => p.team === team2).length;

  return (
    <div className="preview-page">
      {/* Top header bar */}
      <div className="preview-header">
        <button className="preview-back" onClick={() => navigate(`/leagues/${team.league_id}`)}>←</button>
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
                      <div key={p.player_id} className="preview-player">
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

      {/* Fixed bottom actions */}
      <div className="preview-bottom">
        {isMyTeam && !matchStarted && (
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate(`/create-team/${team.match_id}/${team.league_id}`)}>
            EDIT TEAM
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/leagues/${team.league_id}`)}>
          {matchStarted ? 'BACK' : 'CONTINUE'}
        </button>
      </div>
    </div>
  );
}
