import { useState, useEffect } from 'react';
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

function LineupTab({ matches }) {
  const [matchId, setMatchId] = useState('');
  const [players, setPlayers] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadPlayers(mid) {
    setMatchId(mid);
    setMsg('');
    if (!mid) { setPlayers([]); setOverrides({}); return; }
    const { data } = await supabase
      .from('match_players')
      .select('id, name, team, role, is_playing, is_impact_sub, batting_order')
      .eq('match_id', mid)
      .order('team').order('batting_order', { ascending: true, nullsFirst: false });
    const list = data || [];
    setPlayers(list);
    const init = {};
    for (const p of list) {
      init[p.id] = { is_playing: p.is_playing ?? false, batting_order: p.batting_order ?? '', is_impact_sub: p.is_impact_sub ?? false };
    }
    setOverrides(init);
  }

  function setField(id, field, val) {
    setOverrides(o => ({ ...o, [id]: { ...o[id], [field]: val } }));
  }

  const playingCount = Object.values(overrides).filter(o => o.is_playing).length;

  const filtered = players.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase())
  );

  // Group by team
  const teams = [...new Set(filtered.map(p => p.team))];

  async function saveLineup() {
    setSaving(true);
    setMsg('');
    try {
      for (const p of players) {
        const o = overrides[p.id];
        if (!o) continue;
        await supabase.from('match_players').update({
          is_playing: o.is_playing,
          is_impact_sub: o.is_impact_sub,
          batting_order: o.batting_order === '' ? null : parseInt(o.batting_order) || null,
        }).eq('id', p.id);
      }
      setMsg('Lineup saved successfully!');
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <SectionTitle>Manual Lineup</SectionTitle>
        <MatchSelect matches={matches} value={matchId} onChange={loadPlayers} />

        {players.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <input className="input" placeholder="Search player or team…" value={search}
                onChange={e => setSearch(e.target.value)} style={{ flex: 1, minHeight: 40 }} />
              <div style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                background: playingCount === 11 ? 'rgba(76,175,80,0.15)' : 'var(--bg-elevated)',
                color: playingCount === 11 ? 'var(--green)' : 'var(--text-secondary)',
              }}>
                {playingCount}/11
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 52px 52px', gap: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Player</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'center' }}>XI</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'center' }}>Order</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'center' }}>Impact</span>
            </div>

            {teams.map(team => (
              <div key={team}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 0 6px' }}>
                  {team}
                </div>
                {filtered.filter(p => p.team === team).map(p => {
                  const o = overrides[p.id] || {};
                  return (
                    <div key={p.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 36px 52px 52px', gap: 8,
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                      opacity: (!o.is_playing && !o.is_impact_sub) ? 0.45 : 1,
                      transition: 'opacity 0.15s',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: o.is_playing ? 600 : 400 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.role}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="checkbox" checked={o.is_playing ?? false}
                          onChange={e => {
                            const checked = e.target.checked;
                            if (checked && playingCount >= 11 && !o.is_playing) return;
                            setField(p.id, 'is_playing', checked);
                            if (!checked) setField(p.id, 'batting_order', '');
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--red-primary)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="number" min="1" max="11" placeholder="—" value={o.batting_order ?? ''}
                          onChange={e => setField(p.id, 'batting_order', e.target.value)}
                          disabled={!o.is_playing}
                          style={{
                            width: 46, padding: '5px 4px', fontSize: 12, textAlign: 'center',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Poppins, sans-serif',
                            opacity: o.is_playing ? 1 : 0.3,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="checkbox" checked={o.is_impact_sub ?? false}
                          onChange={e => setField(p.id, 'is_impact_sub', e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#9C27B0' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <button className="btn btn-primary" onClick={saveLineup} disabled={saving} style={{ marginTop: 16, minHeight: 48 }}>
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
      .select('id, name, team, role, is_playing, is_impact_sub, fantasy_points, runs, balls, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, dots_bowled, lbw_bowled_wickets, catches, stumpings, run_outs')
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
      const { error } = await supabase.rpc('calculate_match_scores_impact_and_fantasy', { p_match_id: matchId });
      if (error) throw error;
      setMsg('All scores recalculated!');
      await loadPlayers(matchId);
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'sync',    label: 'Sync' },
  { key: 'lineup',  label: 'Lineup' },
  { key: 'players', label: 'Players' },
  { key: 'points',  label: 'Points' },
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
    </div>
  );
}
