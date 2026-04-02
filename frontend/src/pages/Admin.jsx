import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';

const FUNCTIONS_URL = 'https://ywqmhwgkctmetzsdburj.supabase.co/functions/v1';

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cW1od2drY3RtZXR6c2RidXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTg5MTIsImV4cCI6MjA5MDM3NDkxMn0.THJI80WqrDVZ-sC9Gtm9_TUvVN-oXENLc1y9hGLnQl8';

export default function Admin() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [newMatch, setNewMatch] = useState({
    team1_name: '', team1_short: '',
    team2_name: '', team2_short: '',
    match_number: '', start_time: '',
    external_id: '', series_id: '9241',
  });
  const [createStatus, setCreateStatus] = useState(null);
  const user = getUser();

  useEffect(() => { loadMatches(); }, []);

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_number');
    setMatches(data || []);
  }

  async function syncSchedule() {
    setLoading(p => ({ ...p, schedule: true }));
    try {
      const res = await fetch(`${FUNCTIONS_URL}/sync-schedule`, { method: 'POST' });
      const data = await res.json();
      setResults(p => ({ ...p, schedule: data }));
      loadMatches();
    } catch (err) {
      setResults(p => ({ ...p, schedule: { error: err.message } }));
    }
    setLoading(p => ({ ...p, schedule: false }));
  }

  async function syncSquad(externalId) {
    setLoading(p => ({ ...p, [`squad_${externalId}`]: true }));
    try {
      const res = await fetch(`${FUNCTIONS_URL}/sync-squads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_external_id: externalId }),
      });
      const data = await res.json();
      setResults(p => ({ ...p, [`squad_${externalId}`]: data }));
    } catch (err) {
      setResults(p => ({ ...p, [`squad_${externalId}`]: { error: err.message } }));
    }
    setLoading(p => ({ ...p, [`squad_${externalId}`]: false }));
  }

  async function syncScorecard(externalId) {
    setLoading(p => ({ ...p, [`score_${externalId}`]: true }));
    try {
      const res = await fetch(`${FUNCTIONS_URL}/sync-scorecard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_external_id: externalId }),
      });
      const data = await res.json();
      setResults(p => ({ ...p, [`score_${externalId}`]: data }));
      loadMatches();
    } catch (err) {
      setResults(p => ({ ...p, [`score_${externalId}`]: { error: err.message } }));
    }
    setLoading(p => ({ ...p, [`score_${externalId}`]: false }));
  }

  async function createMatch(e) {
    e.preventDefault();
    setCreateStatus('creating');
    try {
      const startIST = new Date(newMatch.start_time).toISOString();
      const { data, error } = await supabase.from('matches').insert({
        team1_name: newMatch.team1_name,
        team1_short: newMatch.team1_short.toUpperCase(),
        team2_name: newMatch.team2_name,
        team2_short: newMatch.team2_short.toUpperCase(),
        match_number: parseInt(newMatch.match_number),
        start_time: startIST,
        external_id: newMatch.external_id,
        series_id: newMatch.series_id,
        status: 'upcoming',
      }).select().single();
      if (error) throw new Error(error.message);
      setCreateStatus('Match created! Use the Sync Squad button below to sync players.');
      setNewMatch({ team1_name: '', team1_short: '', team2_name: '', team2_short: '', match_number: '', start_time: '', external_id: '', series_id: '9241' });
      loadMatches();
    } catch (err) {
      setCreateStatus(`Error: ${err.message}`);
    }
  }

  async function syncAllSquads() {
    setLoading(p => ({ ...p, allSquads: true }));
    for (const match of matches) {
      if (match.external_id) {
        await syncSquad(match.external_id);
      }
    }
    setLoading(p => ({ ...p, allSquads: false }));
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title">Admin Panel</h1>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Sync cricket data from Cricbuzz
      </p>

      {/* Create Match */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Create Match</h3>
        <form onSubmit={createMatch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input className="input" placeholder="Team 1 Full Name (e.g. Lucknow Super Giants)" value={newMatch.team1_name} onChange={e => setNewMatch(p => ({ ...p, team1_name: e.target.value }))} required />
            <input className="input" placeholder="Team 1 Short (e.g. LSG)" value={newMatch.team1_short} onChange={e => setNewMatch(p => ({ ...p, team1_short: e.target.value }))} required maxLength={5} />
            <input className="input" placeholder="Team 2 Full Name (e.g. Delhi Capitals)" value={newMatch.team2_name} onChange={e => setNewMatch(p => ({ ...p, team2_name: e.target.value }))} required />
            <input className="input" placeholder="Team 2 Short (e.g. DC)" value={newMatch.team2_short} onChange={e => setNewMatch(p => ({ ...p, team2_short: e.target.value }))} required maxLength={5} />
            <input className="input" placeholder="Match Number (e.g. 6)" type="number" value={newMatch.match_number} onChange={e => setNewMatch(p => ({ ...p, match_number: e.target.value }))} required />
            <input className="input" placeholder="External ID (e.g. 149673)" value={newMatch.external_id} onChange={e => setNewMatch(p => ({ ...p, external_id: e.target.value }))} required />
            <input className="input" type="datetime-local" value={newMatch.start_time} onChange={e => setNewMatch(p => ({ ...p, start_time: e.target.value }))} required style={{ gridColumn: 'span 1' }} />
            <input className="input" placeholder="Series ID (default: 9241)" value={newMatch.series_id} onChange={e => setNewMatch(p => ({ ...p, series_id: e.target.value }))} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={createStatus === 'creating' || createStatus === 'syncing squads'}>
            {createStatus === 'creating' ? 'Creating...' : createStatus === 'syncing squads' ? 'Syncing Squads...' : 'Create Match'}
          </button>
          {createStatus && createStatus !== 'creating' && createStatus !== 'syncing squads' && (
            <p style={{ fontSize: 11, marginTop: 8, color: createStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>{createStatus}</p>
          )}
        </form>
      </div>

      {/* Schedule Sync */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Match Schedule</h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Fetches IPL 2026 match list from Cricbuzz
        </p>
        <button className="btn btn-primary" onClick={syncSchedule} disabled={loading.schedule}>
          {loading.schedule ? 'Syncing...' : 'SYNC SCHEDULE'}
        </button>
        {results.schedule && (
          <pre style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8, overflow: 'auto', maxHeight: 100 }}>
            {JSON.stringify(results.schedule, null, 2)}
          </pre>
        )}
      </div>

      {/* Sync All Squads */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Sync All Squads</h3>
        <button className="btn btn-outline" onClick={syncAllSquads} disabled={loading.allSquads}>
          {loading.allSquads ? 'Syncing all...' : 'SYNC ALL SQUADS'}
        </button>
      </div>

      {/* Per-match controls */}
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Matches ({matches.length})</h3>
      {matches.map(m => (
        <div key={m.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                M{m.match_number}: {m.team1_short} vs {m.team2_short}
              </span>
              <span className={`badge badge-${m.status}`} style={{ marginLeft: 8 }}>
                {m.status}
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>#{m.external_id}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minHeight: 36, fontSize: 11, padding: '6px 8px' }}
              onClick={() => syncSquad(m.external_id)}
              disabled={loading[`squad_${m.external_id}`]}
            >
              {loading[`squad_${m.external_id}`] ? 'Syncing...' : 'Sync Squad'}
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, minHeight: 36, fontSize: 11, padding: '6px 8px' }}
              onClick={() => syncScorecard(m.external_id)}
              disabled={loading[`score_${m.external_id}`] || m.status === 'upcoming'}
            >
              {loading[`score_${m.external_id}`] ? 'Syncing...' : 'Sync Scores'}
            </button>
          </div>
          {(results[`squad_${m.external_id}`] || results[`score_${m.external_id}`]) && (
            <pre style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 6, overflow: 'auto', maxHeight: 80 }}>
              {JSON.stringify(results[`squad_${m.external_id}`] || results[`score_${m.external_id}`], null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
