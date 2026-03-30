import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './BackupSelect.css';

export default function BackupSelect() {
  const { matchId, leagueId } = useParams();
  const navigate = useNavigate();

  const storedSelected = sessionStorage.getItem('selectedPlayers');
  const storedAll = sessionStorage.getItem('allPlayers');
  const selectedPlayers = storedSelected ? JSON.parse(storedSelected) : [];
  const allPlayers = storedAll ? JSON.parse(storedAll) : [];

  const selectedIds = new Set(selectedPlayers.map(p => p.player_id));
  const available = allPlayers.filter(p => !selectedIds.has(p.player_id));

  const [backups, setBackups] = useState([]);

  function addBackup(player) {
    if (backups.length >= 4) return;
    if (backups.find(b => b.player_id === player.player_id)) return;
    setBackups([...backups, player]);
  }

  function removeBackup(playerId) {
    setBackups(backups.filter(b => b.player_id !== playerId));
  }

  function handleNext() {
    sessionStorage.setItem('backupPlayers', JSON.stringify(backups));
    navigate(`/captain-select/${matchId}/${leagueId}`);
  }

  function handleSkip() {
    sessionStorage.setItem('backupPlayers', JSON.stringify([]));
    navigate(`/captain-select/${matchId}/${leagueId}`);
  }

  if (selectedPlayers.length === 0) {
    navigate(-1);
    return null;
  }

  return (
    <div className="backup-page">
      <div className="ct-header">
        <button className="ct-back" onClick={() => navigate(-1)}>←</button>
        <div className="ct-header-info">
          <span className="ct-match-label">Select Backups</span>
          <span className="ct-match-sub">Pick up to 4 bench players in order</span>
        </div>
        <div className="ct-header-stats">
          <div className="ct-stat">
            <span className="ct-stat-value">{backups.length}/4</span>
            <span className="ct-stat-label">Bench</span>
          </div>
        </div>
      </div>

      {/* Selected backups in order */}
      {backups.length > 0 && (
        <div className="backup-order">
          <div className="backup-order-title">Backup Order (Priority)</div>
          {backups.map((p, i) => (
            <div key={p.player_id} className="backup-order-row">
              <span className="backup-order-num">{i + 1}</span>
              {p.image_url ? (
                <img className="backup-order-img" src={p.image_url} alt={p.name} />
              ) : (
                <div className="backup-order-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              )}
              <div className="backup-order-info">
                <div className="backup-order-name">{p.name}</div>
                <div className="backup-order-meta">{p.team} • {p.role} • {p.credits} Cr</div>
              </div>
              <button className="backup-order-remove" onClick={() => removeBackup(p.player_id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Available players */}
      <div className="backup-available">
        <div className="backup-available-title">Available Players</div>
        {available.map(player => {
          const isAdded = backups.find(b => b.player_id === player.player_id);
          const disabled = backups.length >= 4 && !isAdded;
          return (
            <div key={player.player_id}
              className={`backup-player-row ${isAdded ? 'added' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => isAdded ? removeBackup(player.player_id) : addBackup(player)}>
              {player.image_url ? (
                <img className="backup-player-img" src={player.image_url} alt={player.name} />
              ) : (
                <div className="backup-player-fb">{player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              )}
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-meta">
                  <span className="team-tag">{player.team}</span>
                  <span>{player.role}</span>
                  <span>{player.credits} Cr</span>
                </div>
              </div>
              <div className={`ct-select-btn ${isAdded ? 'active' : ''}`}>
                {isAdded ? '−' : '+'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="backup-bottom">
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleSkip}>
          SKIP
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleNext}>
          NEXT ({backups.length}/4) →
        </button>
      </div>
    </div>
  );
}
