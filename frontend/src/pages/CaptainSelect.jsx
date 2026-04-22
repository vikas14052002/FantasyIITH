import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import './CaptainSelect.css';

export default function CaptainSelect() {
  const { matchId, leagueId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const stored = sessionStorage.getItem('selectedPlayers');
  const players = stored ? JSON.parse(stored) : [];
  const storedBackups = sessionStorage.getItem('backupPlayers');
  const backupPlayers = storedBackups ? JSON.parse(storedBackups) : [];

  const storedCaptain = sessionStorage.getItem('existingCaptainId');
  const storedVc = sessionStorage.getItem('existingVcId');

  // Pre-select captain/VC if they're in the current player list
  const playerIds = new Set(players.map(p => p.player_id));
  const initialCaptain = storedCaptain && playerIds.has(storedCaptain) ? storedCaptain : null;
  const initialVc = storedVc && playerIds.has(storedVc) ? storedVc : null;

  const [captainId, setCaptainId] = useState(initialCaptain);
  const [vcId, setVcId] = useState(initialVc);
  const [saving, setSaving] = useState(false);

  // Derive team1/team2 for B&W coloring (sorted alphabetically for consistency)
  const teamNames = [...new Set(players.map(p => p.team))].sort();
  const [team1Name, team2Name] = teamNames;

  const handleCaptain = (playerId) => {
    if (vcId === playerId) setVcId(null);
    setCaptainId(captainId === playerId ? null : playerId);
  };

  const handleVc = (playerId) => {
    if (captainId === playerId) setCaptainId(null);
    setVcId(vcId === playerId ? null : playerId);
  };

  const handleSave = async () => {
    if (!captainId || !vcId) return;
    setSaving(true);

    // Re-check payment gate server-side before saving
    if (import.meta.env.VITE_PAYMENTS_ENABLED === 'true') {
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
          alert('Season pass required. Please complete payment before submitting your team.');
          setSaving(false);
          navigate(`/create-team/${matchId}/${leagueId}`);
          return;
        }
      }
    }

    const totalCredits = players.reduce((s, p) => s + p.credits, 0);
    const allPlayers = [
      ...players.map(p => ({ ...p, is_backup: false, backup_order: null })),
      ...backupPlayers.map((p, i) => ({ ...p, is_backup: true, backup_order: i + 1 })),
    ];

    const { data, error } = await supabase.functions.invoke('save-team', {
      body: { userId: user.id, players: allPlayers, matchId, leagueId, captainId, vcId, totalCredits },
    });

    if (error || !data?.teamId) {
      alert(data?.error || error?.message || 'Failed to save team');
      setSaving(false);
      return;
    }

    sessionStorage.removeItem('selectedPlayers');
    sessionStorage.removeItem('backupPlayers');
    sessionStorage.removeItem('allPlayers');
    sessionStorage.removeItem('existingCaptainId');
    sessionStorage.removeItem('existingVcId');
    navigate(`/team-preview/${data.teamId}`);
  };

  if (players.length === 0) {
    navigate(-1);
    return null;
  }

  return (
    <div className="captain-page">
      <div className="ct-header">
        <button className="ct-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="ct-header-info">
          <span className="ct-match-label">Choose Captain & Vice Captain</span>
        </div>
      </div>

      {/* Stepper */}
      <div className="ct-stepper">
        <div className="ct-step done">
          <div className="ct-step-dot done">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span className="ct-step-label">Pick Players</span>
        </div>
        <div className="ct-step-line done" />
        <div className="ct-step active">
          <div className="ct-step-dot active">2</div>
          <span className="ct-step-label">Roles</span>
        </div>
        <div className="ct-step-line" />
        <div className="ct-step">
          <div className="ct-step-dot">3</div>
          <span className="ct-step-label">Done</span>
        </div>
      </div>

      <div className="captain-hint">
        <span className="badge-captain">C</span> gets 2x points
        <span style={{ margin: '0 8px' }}>•</span>
        <span className="badge-vc">VC</span> gets 1.5x points
      </div>

      <div className="captain-list">
        {players.map(p => (
          <div key={p.player_id} className="captain-row">
            {p.image_url ? (
              <img className="captain-player-img" src={p.image_url} alt={p.name} />
            ) : (
              <div className="ct-player-avatar" style={{ background: 'var(--bg-elevated)' }}>
                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )}
            <div className="player-info">
              <div className="player-name">{p.name}</div>
              <div className="player-meta">
                <span className={`team-tag ${p.team === team1Name ? 'team-tag-t1' : 'team-tag-t2'}`}>{p.team}</span>
                <span>{p.role}</span>
              </div>
            </div>
            <div className="captain-actions">
              <button
                className={`captain-btn ${captainId === p.player_id ? 'captain-active' : ''}`}
                onClick={() => handleCaptain(p.player_id)}>
                C
              </button>
              <button
                className={`captain-btn vc ${vcId === p.player_id ? 'vc-active' : ''}`}
                onClick={() => handleVc(p.player_id)}>
                VC
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="ct-bottom-bar">
        <button className="btn btn-primary"
          disabled={!captainId || !vcId || saving}
          onClick={handleSave}>
          {saving ? 'SAVING...' : 'SAVE TEAM'}
        </button>
      </div>
    </div>
  );
}
