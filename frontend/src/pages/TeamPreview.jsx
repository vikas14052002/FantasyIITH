import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './TeamPreview.css';

const ROLE_ORDER = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
const ROLE_LABELS = { WK: 'WICKET-KEEPERS', BAT: 'BATTERS', AR: 'ALL-ROUNDERS', BOWL: 'BOWLERS' };

export default function TeamPreview() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadTeam(); }, [teamId]);

  async function loadTeam() {
    const [teamRes, playersRes] = await Promise.all([
      supabase.from('teams').select('*, matches(*)').eq('id', teamId).single(),
      supabase.from('team_players').select('*').eq('team_id', teamId),
    ]);
    setTeam(teamRes.data);
    setPlayers(playersRes.data || []);

    // Fetch match_players for images and points
    if (teamRes.data?.match_id) {
      const { data: mp } = await supabase
        .from('match_players')
        .select('player_id, image_url, fantasy_points')
        .eq('match_id', teamRes.data.match_id);
      setMatchPlayers(mp || []);
    }
    setLoading(false);
  }

  function getImage(playerId) {
    return matchPlayers.find(mp => mp.player_id === playerId)?.image_url;
  }

  function getPoints(playerId) {
    return matchPlayers.find(mp => mp.player_id === playerId)?.fantasy_points || 0;
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!team) return <div className="page"><p>Team not found</p></div>;

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
        <button className="preview-back" onClick={() => navigate('/home')}>←</button>
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

                    return (
                      <div key={p.player_id} className="preview-player">
                        {/* Player photo */}
                        <div className="preview-avatar-wrap">
                          {img ? (
                            <img className="preview-avatar-img" src={img} alt={p.name}
                              style={{ borderColor: p.team === team1 ? '#fff' : 'var(--gold)' }} />
                          ) : (
                            <div className="preview-avatar-fallback"
                              style={{ background: p.team === team1 ? '#fff' : '#1a1a2e', color: p.team === team1 ? '#1a1a2e' : '#fff' }}>
                              {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          {p.is_captain && <div className="preview-badge preview-badge-c">C</div>}
                          {p.is_vice_captain && <div className="preview-badge preview-badge-vc">VC</div>}
                        </div>
                        {/* Name pill */}
                        <div className={`preview-name-pill ${p.team === team1 ? 'pill-team1' : 'pill-team2'}`}>
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
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate(`/create-team/${team.match_id}/${team.league_id}`)}>
          EDIT TEAM
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/home')}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
