import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = 'https://ywqmhwgkctmetzsdburj.supabase.co/functions/v1';

const ROLES = ['BAT', 'BOWL', 'AR', 'WK'];

const STAT_FIELDS = [
  { key: 'runs', label: 'Runs' },
  { key: 'balls', label: 'Balls' },
  { key: 'fours', label: '4s' },
  { key: 'sixes', label: '6s' },
  { key: 'wickets', label: 'Wickets' },
  { key: 'overs_bowled', label: 'Overs' },
  { key: 'runs_conceded', label: 'Runs Given' },
  { key: 'maidens', label: 'Maidens' },
  { key: 'dots_bowled', label: 'Dots' },
  { key: 'lbw_bowled_wickets', label: 'LBW/Bowled' },
  { key: 'catches', label: 'Catches' },
  { key: 'stumpings', label: 'Stumpings' },
  { key: 'run_outs', label: 'Run Outs' },
  { key: 'direct_run_outs', label: 'Direct Run Outs' },
];

// ─── Shared ───────────────────────────────────────────────────────────────────

function MatchSelect({ matches, value, onChange }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ marginBottom: 16 }}>
      <option value="">Select match…</option>
      {matches.map(m => (
        <option key={m.id} value={m.id}>
          M{m.match_number}: {m.team1_short} vs {m.team2_short} — {m.status}
        </option>
      ))}
    </select>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isErr = msg.toLowerCase().startsWith('error');
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 12,
      background: isErr ? 'rgba(217,30,54,0.12)' : 'rgba(76,175,80,0.12)',
      color: isErr ? 'var(--red-primary)' : 'var(--green)',
      border: `1px solid ${isErr ? 'rgba(217,30,54,0.25)' : 'rgba(76,175,80,0.25)'}`,
    }}>
      {msg}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function SmallBtn({ onClick, disabled, loading, loadingLabel, label, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '8px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none',
        cursor: disabled || loading ? 'default' : 'pointer',
        background: danger ? 'rgba(217,30,54,0.12)' : 'var(--bg-elevated)',
        color: danger ? 'var(--red-primary)' : 'var(--text-primary)',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

// ─── Sync Tab ─────────────────────────────────────────────────────────────────

function SyncTab({ matches, onMatchesChange }) {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [newMatch, setNewMatch] = useState({
    team1_name: '', team1_short: '', team2_name: '', team2_short: '',
    match_number: '', start_time: '', external_id: '', series_id: '9241',
  });
  const [createStatus, setCreateStatus] = useState('');

  async function callFn(key, url, body) {
    setLoading(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      setResults(p => ({ ...p, [key]: data }));
      return data;
    } catch (err) {
      setResults(p => ({ ...p, [key]: { error: err.message } }));
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  }

  async function createMatch(e) {
    e.preventDefault();
    setCreateStatus('creating');
    try {
      const { error } = await supabase.from('matches').insert({
        team1_name: newMatch.team1_name,
        team1_short: newMatch.team1_short.toUpperCase(),
        team2_name: newMatch.team2_name,
        team2_short: newMatch.team2_short.toUpperCase(),
        match_number: parseInt(newMatch.match_number),
        start_time: new Date(newMatch.start_time).toISOString(),
        external_id: newMatch.external_id,
        series_id: newMatch.series_id,
        status: 'upcoming',
      });
      if (error) throw new Error(error.message);
      setCreateStatus('Match created!');
      setNewMatch({ team1_name: '', team1_short: '', team2_name: '', team2_short: '', match_number: '', start_time: '', external_id: '', series_id: '9241' });
      onMatchesChange();
    } catch (err) {
      setCreateStatus('Error: ' + err.message);
    }
  }

  async function syncAllSquads() {
    setLoading(p => ({ ...p, allSquads: true }));
    for (const m of matches) {
      if (m.external_id) await callFn(`squad_${m.external_id}`, `${FUNCTIONS_URL}/sync-squads`, { match_external_id: m.external_id });
    }
    setLoading(p => ({ ...p, allSquads: false }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Create Match */}
      <div className="card">
        <SectionTitle>Create Match</SectionTitle>
        <form onSubmit={createMatch} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <input className="input" placeholder="Team 1 Full Name" value={newMatch.team1_name} onChange={e => setNewMatch(p => ({ ...p, team1_name: e.target.value }))} required />
            <input className="input" placeholder="T1 Short" value={newMatch.team1_short} onChange={e => setNewMatch(p => ({ ...p, team1_short: e.target.value }))} required maxLength={5} style={{ width: 90 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <input className="input" placeholder="Team 2 Full Name" value={newMatch.team2_name} onChange={e => setNewMatch(p => ({ ...p, team2_name: e.target.value }))} required />
            <input className="input" placeholder="T2 Short" value={newMatch.team2_short} onChange={e => setNewMatch(p => ({ ...p, team2_short: e.target.value }))} required maxLength={5} style={{ width: 90 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input" placeholder="Match No." type="number" value={newMatch.match_number} onChange={e => setNewMatch(p => ({ ...p, match_number: e.target.value }))} required />
            <input className="input" placeholder="External ID" value={newMatch.external_id} onChange={e => setNewMatch(p => ({ ...p, external_id: e.target.value }))} required />
          </div>
          <input className="input" type="datetime-local" value={newMatch.start_time} onChange={e => setNewMatch(p => ({ ...p, start_time: e.target.value }))} required />
          <input className="input" placeholder="Series ID (9241)" value={newMatch.series_id} onChange={e => setNewMatch(p => ({ ...p, series_id: e.target.value }))} required />
          <button className="btn btn-primary" type="submit" disabled={createStatus === 'creating'} style={{ minHeight: 44 }}>
            {createStatus === 'creating' ? 'Creating…' : 'Create Match'}
          </button>
          <StatusMsg msg={createStatus === 'creating' ? '' : createStatus} />
        </form>
      </div>

      {/* Global actions */}
      <div className="card">
        <SectionTitle>Global Sync</SectionTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => callFn('schedule', `${FUNCTIONS_URL}/sync-schedule`).then(onMatchesChange)}
            disabled={loading.schedule} style={{ minHeight: 44, fontSize: 13 }}>
            {loading.schedule ? 'Syncing…' : 'Sync Schedule'}
          </button>
          <button className="btn btn-outline" onClick={syncAllSquads}
            disabled={loading.allSquads} style={{ minHeight: 44, fontSize: 13 }}>
            {loading.allSquads ? 'Syncing…' : 'Sync All Squads'}
          </button>
        </div>
        {results.schedule && (
          <pre style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 10, overflow: 'auto', maxHeight: 80, borderRadius: 6, padding: 8, background: 'var(--bg-elevated)' }}>
            {JSON.stringify(results.schedule, null, 2)}
          </pre>
        )}
      </div>

      {/* Per-match */}
      <div>
        <SectionTitle>Matches ({matches.length})</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(m => {
            const key = m.external_id;
            return (
              <div key={m.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>M{m.match_number}: {m.team1_short} vs {m.team2_short}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>#{m.external_id}</span>
                  </div>
                  <span className={`badge badge-${m.status}`}>{m.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <SmallBtn
                    label="Sync Squad" loadingLabel="Syncing…"
                    loading={loading[`squad_${key}`]}
                    onClick={() => callFn(`squad_${key}`, `${FUNCTIONS_URL}/sync-squads`, { match_external_id: key })}
                  />
                  <SmallBtn
                    label="Sync Lineup" loadingLabel="Syncing…"
                    loading={loading[`lineup_${key}`]}
                    onClick={() => callFn(`lineup_${key}`, `${FUNCTIONS_URL}/sync-lineups`, { match_external_id: key })}
                  />
                  <SmallBtn
                    label="Sync Scores" loadingLabel="Syncing…"
                    loading={loading[`score_${key}`]}
                    disabled={m.status === 'upcoming'}
                    onClick={() => callFn(`score_${key}`, `${FUNCTIONS_URL}/sync-scorecard`, { match_external_id: key }).then(onMatchesChange)}
                  />
                </div>
                {(results[`squad_${key}`] || results[`score_${key}`] || results[`lineup_${key}`]) && (
                  <pre style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 10, overflow: 'auto', maxHeight: 60, borderRadius: 6, padding: 8, background: 'var(--bg-elevated)' }}>
                    {JSON.stringify(results[`squad_${key}`] || results[`lineup_${key}`] || results[`score_${key}`], null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Lineup Tab ───────────────────────────────────────────────────────────────

// Per-team draggable XI + squad picker
function TeamLineup({ team, players, xi, onXiChange }) {
  const dragRef = useRef(null);
  const [search, setSearch] = useState('');

  const squad = players.filter(p => !xi.find(x => x.id === p.id));
  const filteredSquad = search.trim()
    ? squad.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : squad;

  function startDrag(e, idx) {
    dragRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e, idx) {
    e.preventDefault();
    const from = dragRef.current;
    if (from === null || from === idx) return;
    const next = [...xi];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    dragRef.current = idx;
    onXiChange(next);
  }

  function addToXI(p) {
    if (xi.length >= 16) return;
    onXiChange([...xi, { ...p, is_impact_sub: false }]);
  }

  function removeFromXI(id) {
    onXiChange(xi.filter(x => x.id !== id));
  }

  function toggleImpact(id) {
    onXiChange(xi.map(x => x.id === id ? { ...x, is_impact_sub: !x.is_impact_sub } : x));
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Team label */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
        {team} — {xi.length}/16
      </div>

      {/* Draggable XI list */}
      {xi.length > 0 && (
        <div style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {xi.map((p, idx) => (
            <div
              key={p.id}
              draggable
              onDragStart={e => startDrag(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragEnd={() => { dragRef.current = null; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderBottom: idx < xi.length - 1 ? '1px solid var(--border)' : 'none',
                background: p.is_impact_sub ? 'rgba(156,39,176,0.06)' : 'var(--bg-elevated)',
                cursor: 'grab', userSelect: 'none',
              }}
            >
              {/* Drag handle */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
              </svg>
              {/* Order badge */}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 16, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
              {/* Name + role */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.role}</div>
              </div>
              {/* Impact toggle */}
              <button
                onClick={() => toggleImpact(p.id)}
                style={{
                  fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: p.is_impact_sub ? 'rgba(156,39,176,0.2)' : 'var(--bg-elevated)',
                  color: p.is_impact_sub ? '#9C27B0' : 'var(--text-muted)',
                  border: `1px solid ${p.is_impact_sub ? 'rgba(156,39,176,0.4)' : 'var(--border)'}`,
                }}
              >
                IMPACT
              </button>
              {/* Remove */}
              <button onClick={() => removeFromXI(p.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Squad — tap to add */}
      {squad.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Squad</div>
          <input
            className="input"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 8, fontSize: 13 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredSquad.map(p => (
              <div key={p.id}
                onClick={() => addToXI(p)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  cursor: xi.length >= 16 ? 'not-allowed' : 'pointer',
                  opacity: xi.length >= 16 ? 0.4 : 0.7,
                  background: 'transparent',
                }}
              >
                <div>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{p.role}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--green)' }}><path d="M12 5v14M5 12h14"/></svg>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LineupTab({ matches }) {
  const [matchId, setMatchId] = useState('');
  const [players, setPlayers] = useState([]);
  // xi: { [team]: [{id, name, role, is_impact_sub, ...}] }
  const [xi, setXi] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tossTeam, setTossTeam] = useState('');
  const [tossChoice, setTossChoice] = useState('bat');
  const [tossSaving, setTossSaving] = useState(false);
  const [tossMsg, setTossMsg] = useState('');
  const [pitchType, setPitchType] = useState('');
  const [pitchSupports, setPitchSupports] = useState('');
  const [avgScore, setAvgScore] = useState('');
  const [pitchSaving, setPitchSaving] = useState(false);
  const [pitchMsg, setPitchMsg] = useState('');

  const selectedMatch = matches.find(m => m.id === matchId);
  const teamOptions = selectedMatch ? [selectedMatch.team1_short, selectedMatch.team2_short] : [];
  const teams = [...new Set(players.map(p => p.team))];
  const totalXI = Object.values(xi).reduce((s, arr) => s + arr.length, 0);

  async function loadPlayers(mid) {
    setMatchId(mid);
    setMsg('');
    setTossMsg('');
    if (!mid) { setPlayers([]); setXi({}); setTossTeam(''); return; }
    const [{ data }, { data: matchData }] = await Promise.all([
      supabase.from('match_players').select('id, name, team, role, is_playing, is_impact_sub, batting_order').eq('match_id', mid),
      supabase.from('matches').select('result, team1_short, team2_short, pitch_type, pitch_supports, avg_score').eq('id', mid).single(),
    ]);
    const list = data || [];
    setPlayers(list);

    // Seed toss from current result if it exists
    if (matchData?.result) {
      const t1 = matchData.team1_short, t2 = matchData.team2_short;
      if (matchData.result.startsWith(t1)) { setTossTeam(t1); }
      else if (matchData.result.startsWith(t2)) { setTossTeam(t2); }
      setTossChoice(matchData.result.includes('field') ? 'field' : 'bat');
    } else {
      setTossTeam(matchData?.team1_short || '');
    }

    // Seed pitch info
    setPitchType(matchData?.pitch_type || '');
    setPitchSupports(matchData?.pitch_supports || '');
    setAvgScore(matchData?.avg_score != null ? String(matchData.avg_score) : '');

    // Seed XI from current DB state — ordered by batting_order
    const initXi = {};
    for (const team of [...new Set(list.map(p => p.team))]) {
      initXi[team] = list
        .filter(p => p.team === team && p.is_playing)
        .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99))
        .map(p => ({ ...p }));
    }
    setXi(initXi);
  }

  async function saveToss() {
    if (!matchId || !tossTeam) return;
    setTossSaving(true);
    setTossMsg('');
    try {
      const result = `${tossTeam} elected to ${tossChoice}`;
      const { error } = await supabase.from('matches').update({ result }).eq('id', matchId);
      if (error) throw error;
      setTossMsg(`Saved: "${result}"`);
    } catch (err) {
      setTossMsg('Error: ' + err.message);
    }
    setTossSaving(false);
  }

  async function savePitchInfo() {
    if (!matchId) return;
    setPitchSaving(true);
    setPitchMsg('');
    try {
      const updates = {
        pitch_type: pitchType || null,
        pitch_supports: pitchSupports || null,
        avg_score: avgScore !== '' ? parseInt(avgScore, 10) : null,
      };
      const { error } = await supabase.from('matches').update(updates).eq('id', matchId);
      if (error) throw error;
      setPitchMsg('Pitch info saved!');
    } catch (err) {
      setPitchMsg('Error: ' + err.message);
    }
    setPitchSaving(false);
  }

  async function saveLineup() {
    setSaving(true);
    setMsg('');
    try {
      // Build a map of all updates
      const updates = {};
      for (const p of players) {
        updates[p.id] = { is_playing: false, is_impact_sub: false, batting_order: 0 };
      }
      for (const arr of Object.values(xi)) {
        arr.forEach((p, idx) => {
          updates[p.id] = { is_playing: true, is_impact_sub: p.is_impact_sub ?? false, batting_order: idx + 1 };
        });
      }

      for (const [id, vals] of Object.entries(updates)) {
        const { error } = await supabase.from('match_players').update(vals).eq('id', id);
        if (error) throw new Error(error.message);
      }

      // Mark lineups_synced on the match
      await supabase.from('matches').update({ lineups_synced: totalXI > 0 }).eq('id', matchId);

      setMsg('Lineup saved!');
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Toss */}
      <div className="card">
        <SectionTitle>Toss Result</SectionTitle>
        <MatchSelect matches={matches} value={matchId} onChange={loadPlayers} />
        {matchId && teamOptions.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select className="input" value={tossTeam} onChange={e => setTossTeam(e.target.value)}>
                {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input" value={tossChoice} onChange={e => setTossChoice(e.target.value)}>
                <option value="bat">elected to bat</option>
                <option value="field">elected to field</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              Preview: <strong style={{ color: 'var(--text-primary)' }}>{tossTeam} elected to {tossChoice}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={saveToss} disabled={tossSaving} style={{ minHeight: 44, flex: 1 }}>
                {tossSaving ? 'Saving…' : 'Save Toss'}
              </button>
              <SmallBtn label="Remove Toss" danger onClick={async () => {
                setTossSaving(true); setTossMsg('');
                const { error } = await supabase.from('matches').update({ result: null }).eq('id', matchId);
                setTossMsg(error ? 'Error: ' + error.message : 'Toss removed');
                setTossSaving(false);
              }} disabled={tossSaving} />
            </div>
            <StatusMsg msg={tossMsg} />
          </>
        )}
      </div>

      {/* Pitch Info */}
      <div className="card">
        <SectionTitle>Pitch Info</SectionTitle>
        {matchId ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select className="input" value={pitchType} onChange={e => setPitchType(e.target.value)}>
                <option value="">Pitch type…</option>
                <option value="batting">Batting</option>
                <option value="bowling">Bowling</option>
                <option value="balanced">Balanced</option>
              </select>
              <select className="input" value={pitchSupports} onChange={e => setPitchSupports(e.target.value)}>
                <option value="">Supports…</option>
                <option value="pacers">Pacers</option>
                <option value="spinners">Spinners</option>
              </select>
              <input
                className="input"
                type="number"
                placeholder="Avg Score"
                value={avgScore}
                onChange={e => setAvgScore(e.target.value)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={savePitchInfo} disabled={pitchSaving} style={{ minHeight: 44, flex: 1 }}>
                {pitchSaving ? 'Saving…' : 'Save Pitch Info'}
              </button>
              <SmallBtn label="Clear" danger onClick={async () => {
                setPitchSaving(true); setPitchMsg('');
                const { error } = await supabase.from('matches').update({ pitch_type: null, pitch_supports: null, avg_score: null }).eq('id', matchId);
                if (!error) { setPitchType(''); setPitchSupports(''); setAvgScore(''); }
                setPitchMsg(error ? 'Error: ' + error.message : 'Cleared');
                setPitchSaving(false);
              }} disabled={pitchSaving} />
            </div>
            <StatusMsg msg={pitchMsg} />
          </>
        ) : (
          <MatchSelect matches={matches} value={matchId} onChange={loadPlayers} />
        )}
      </div>

      {/* Lineup */}
      <div className="card">
        <SectionTitle>Manual Lineup</SectionTitle>

        {players.length > 0 && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
              padding: '8px 12px', borderRadius: 10, background: 'var(--bg-elevated)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total selected</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {totalXI}
              </span>
            </div>

            {teams.map(team => (
              <TeamLineup
                key={team}
                team={team}
                players={players.filter(p => p.team === team)}
                xi={xi[team] || []}
                onXiChange={arr => setXi(x => ({ ...x, [team]: arr }))}
              />
            ))}

            <button className="btn btn-primary" onClick={saveLineup} disabled={saving} style={{ minHeight: 48 }}>
              {saving ? 'Saving…' : 'Save Lineup'}
            </button>
            <StatusMsg msg={msg} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Players Tab ──────────────────────────────────────────────────────────────

function PlayersTab({ matches }) {
  const [matchId, setMatchId] = useState('');
  const [form, setForm] = useState({ external_player_id: '', name: '', role: 'BAT', team: '', credits: '7.0' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const selectedMatch = matches.find(m => m.id === matchId);
  const teamOptions = selectedMatch ? [selectedMatch.team1_short, selectedMatch.team2_short] : [];

  function handleMatchChange(mid) {
    setMatchId(mid);
    const m = matches.find(x => x.id === mid);
    if (m) setForm(f => ({ ...f, team: m.team1_short }));
  }

  async function addPlayer(e) {
    e.preventDefault();
    if (!matchId) { setMsg('Error: Select a match first'); return; }
    if (!form.external_player_id.trim()) { setMsg('Error: External Player ID is required'); return; }
    setSaving(true);
    setMsg('');
    try {
      const extId = form.external_player_id.trim();
      const { error } = await supabase.from('match_players').insert({
        match_id: matchId,
        player_id: `cb_${extId}`,
        external_player_id: extId,
        name: form.name.trim(),
        role: form.role,
        team: form.team,
        credits: parseFloat(form.credits) || 7.0,
        is_playing: false,
        is_impact_sub: false,
        image_url: null,
      });
      if (error) throw error;
      setMsg(`${form.name} added successfully!`);
      setForm(f => ({ ...f, external_player_id: '', name: '', credits: '7.0' }));
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <SectionTitle>Add Player to Squad</SectionTitle>
        <MatchSelect matches={matches} value={matchId} onChange={handleMatchChange} />
        <form onSubmit={addPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder="Cricbuzz Player ID (e.g. 12345)" value={form.external_player_id}
            onChange={e => setForm(f => ({ ...f, external_player_id: e.target.value.trim() }))} required />
          {form.external_player_id && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4, marginBottom: 2 }}>
              player_id will be: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>cb_{form.external_player_id}</span>
            </div>
          )}
          <input className="input" placeholder="Player Name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="input" value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
              {teamOptions.length === 0
                ? <option value="">— select match first —</option>
                : teamOptions.map(t => <option key={t} value={t}>{t}</option>)
              }
            </select>
          </div>
          <input className="input" placeholder="Credits (e.g. 8.5)" type="number" step="0.5" min="5" max="12"
            value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} />
          <button className="btn btn-primary" type="submit" disabled={saving || !form.name.trim() || !matchId} style={{ minHeight: 48 }}>
            {saving ? 'Adding…' : 'Add Player'}
          </button>
          <StatusMsg msg={msg} />
        </form>
      </div>
    </div>
  );
}

// ─── Points Tab ───────────────────────────────────────────────────────────────

function PointsTab({ matches }) {
  const [matchId, setMatchId] = useState('');
  const [players, setPlayers] = useState([]);
  const [edits, setEdits] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(null);
  const [recalcing, setRecalcing] = useState(false);
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  async function loadPlayers(mid) {
    setMatchId(mid);
    setEdits({});
    setExpanded(null);
    setMsg('');
    if (!mid) { setPlayers([]); return; }
    const { data } = await supabase
      .from('match_players')
      .select('id, name, team, role, is_playing, is_impact_sub, fantasy_points, runs, balls, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, dots_bowled, lbw_bowled_wickets, catches, stumpings, run_outs, direct_run_outs')
      .eq('match_id', mid)
      .order('fantasy_points', { ascending: false, nullsFirst: false });
    setPlayers(data || []);
    const init = {};
    for (const p of (data || [])) init[p.id] = { ...p };
    setEdits(init);
  }

  function setField(id, field, val) {
    setEdits(e => ({ ...e, [id]: { ...e[id], [field]: val === '' ? '' : Number(val) } }));
  }

  async function savePlayer(p) {
    setSaving(p.id);
    setMsg('');
    try {
      const e = edits[p.id];
      const update = {};
      for (const { key } of STAT_FIELDS) update[key] = e[key] === '' ? 0 : Number(e[key]) || 0;
      const { error } = await supabase.from('match_players').update(update).eq('id', p.id);
      if (error) throw error;
      setMsg(`${p.name} saved!`);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(null);
  }

  async function recalculate() {
    setRecalcing(true);
    setMsg('');
    try {
      const { data, error } = await supabase.rpc('calculate_match_scores', { p_match_id: matchId });
      if (error) throw error;
      await loadPlayers(matchId);
      setMsg(`Recalculation complete. Result: ${data !== null && data !== undefined ? JSON.stringify(data) : 'no data returned (void function)'}`);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setRecalcing(false);
  }

  const displayed = showAll ? players : players.filter(p => p.is_playing || p.is_impact_sub);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <SectionTitle>Edit Player Stats & Points</SectionTitle>
        <MatchSelect matches={matches} value={matchId} onChange={loadPlayers} />

        {players.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={recalculate} disabled={recalcing}
                style={{ flex: 1, minHeight: 44, fontSize: 13 }}>
                {recalcing ? 'Recalculating…' : 'Recalculate All Scores'}
              </button>
              <button onClick={() => setShowAll(v => !v)}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 10,
                  border: '1px solid var(--border)', background: showAll ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {showAll ? 'Playing only' : 'Show all'}
              </button>
            </div>

            <StatusMsg msg={msg} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: msg ? 12 : 0 }}>
              {displayed.map(p => {
                const e = edits[p.id] || {};
                const isOpen = expanded === p.id;
                return (
                  <div key={p.id} style={{
                    borderRadius: 12, border: `1px solid ${isOpen ? 'var(--red-primary)' : 'var(--border)'}`,
                    overflow: 'hidden', transition: 'border-color 0.2s',
                  }}>
                    <div
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', cursor: 'pointer', background: 'var(--bg-elevated)',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{p.team} · {p.role}</span>
                        </div>
                        {p.is_impact_sub && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#9C27B0', background: 'rgba(156,39,176,0.12)', padding: '2px 6px', borderRadius: 6 }}>IMPACT</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{p.fantasy_points ?? 0} pts</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: 14, background: 'var(--bg-surface, var(--bg-elevated))', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                          {STAT_FIELDS.map(({ key, label }) => (
                            <div key={key}>
                              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{label}</label>
                              <input
                                type="number" min="0" step={key === 'overs_bowled' ? '0.1' : '1'}
                                value={e[key] ?? 0}
                                onChange={ev => setField(p.id, key, ev.target.value)}
                                style={{
                                  width: '100%', padding: '8px 10px', fontSize: 13, textAlign: 'center',
                                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                  borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Poppins, sans-serif',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <button className="btn btn-primary" onClick={() => savePlayer(p)}
                          disabled={saving === p.id} style={{ minHeight: 44, fontSize: 13 }}>
                          {saving === p.id ? 'Saving…' : `Save ${p.name}`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Leagues Tab ──────────────────────────────────────────────────────────────

function LeaguesTab() {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('leagues').select('id, name, invite_code').order('name').then(({ data }) => setLeagues(data || []));
  }, []);

  async function loadMembers(leagueId) {
    setSelectedLeague(leagueId);
    setMembers([]);
    setMsg('');
    if (!leagueId) return;
    setLoadingMembers(true);
    const { data } = await supabase.from('league_members').select('user_id, users(id, name, email)').eq('league_id', leagueId);
    setMembers((data || []).map(m => m.users));
    setLoadingMembers(false);
  }

  async function removeMember(userId) {
    if (!window.confirm(`Remove this member from the league?`)) return;
    setRemoving(userId);
    setMsg('');
    const { error } = await supabase.from('league_members').delete().eq('league_id', selectedLeague).eq('user_id', userId);
    if (error) { setMsg('Error: ' + error.message); }
    else {
      setMembers(m => m.filter(u => u.id !== userId));
      setMsg('Member removed.');
    }
    setRemoving(null);
  }

  return (
    <div>
      <SectionTitle>Remove Member from League</SectionTitle>
      <select className="input" value={selectedLeague} onChange={e => loadMembers(e.target.value)} style={{ marginBottom: 16 }}>
        <option value="">Select league…</option>
        {leagues.map(l => <option key={l.id} value={l.id}>{l.name} ({l.invite_code})</option>)}
      </select>
      {loadingMembers && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading members…</p>}
      {members.map(u => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
          </div>
          <SmallBtn
            onClick={() => removeMember(u.id)}
            loading={removing === u.id}
            loadingLabel="Removing…"
            label="Remove"
            danger
          />
        </div>
      ))}
      <StatusMsg msg={msg} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function RevealPicksTab({ matches }) {
  const [matchId, setMatchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  async function handleReveal() {
    if (!matchId) { setResult('Error: select a match'); return; }
    setLoading(true);
    setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('reveal-match-picks', {
        body: { matchId },
      });
      if (error || data?.error) setResult('Error: ' + (data?.error || error?.message));
      else setResult(`Revealed ${data.revealed} / ${data.total} teams${data.errors?.length ? ' — errors: ' + data.errors.join(', ') : ''}`);
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionTitle>Reveal Encrypted Picks</SectionTitle>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Decrypts team picks into team_players after match starts. Safe to run multiple times (idempotent).
      </p>
      <MatchSelect matches={matches} value={matchId} onChange={setMatchId} />
      <SmallBtn
        onClick={handleReveal}
        loading={loading}
        disabled={!matchId}
        label="Reveal Picks"
        loadingLabel="Revealing…"
      />
      <StatusMsg msg={result} />
    </div>
  );
}

const TABS = [
  { key: 'sync',    label: 'Sync' },
  { key: 'lineup',  label: 'Lineup' },
  { key: 'players', label: 'Players' },
  { key: 'points',  label: 'Points' },
  { key: 'picks',   label: 'Picks' },
  { key: 'leagues', label: 'Leagues' },
];

export default function Admin() {
  const [tab, setTab] = useState('sync');
  const [matches, setMatches] = useState([]);

  useEffect(() => { loadMatches(); }, []);

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_number');
    setMatches(data || []);
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title" style={{ marginBottom: 12 }}>Admin</h1>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 2,
        scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 24,
            border: tab === t.key ? 'none' : '1px solid var(--border)',
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Poppins, sans-serif',
            background: tab === t.key ? 'var(--red-gradient)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            boxShadow: tab === t.key ? '0 4px 14px rgba(217,30,54,0.35)' : 'none',
            transition: 'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sync'    && <SyncTab matches={matches} onMatchesChange={loadMatches} />}
      {tab === 'lineup'  && <LineupTab matches={matches} />}
      {tab === 'players' && <PlayersTab matches={matches} />}
      {tab === 'points'  && <PointsTab matches={matches} />}
      {tab === 'picks'   && <RevealPicksTab matches={matches} />}
      {tab === 'leagues' && <LeaguesTab />}
    </div>
  );
}
