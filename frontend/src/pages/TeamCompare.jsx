import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import './TeamCompare.css';

export default function TeamCompare() {
  const { leagueId } = useParams();
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user1, setUser1] = useState('');
  const [user2, setUser2] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => { loadData(); }, [leagueId]);

  async function loadData() {
    const [membersRes, matchesRes] = await Promise.all([
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', leagueId),
      supabase.from('matches').select('*').order('match_number', { ascending: false }),
    ]);
    setMembers((membersRes.data || []).map(m => m.users));
    setMatches(matchesRes.data || []);
    setLoading(false);
  }

  async function compare() {
    if (!user1 || !user2 || !selectedMatch) return;

    // Check if match has started — can only compare after deadline
    const selectedMatchData = matches.find(m => m.id === selectedMatch);
    if (selectedMatchData && !hasMatchStarted(selectedMatchData)) {
      setComparison({ error: true, locked: true });
      return;
    }

    setComparing(true);

    const me = getUser();

    // Get both teams metadata
    const [team1Res, team2Res] = await Promise.all([
      supabase.from('teams').select('*').eq('user_id', user1).eq('match_id', selectedMatch).eq('league_id', leagueId).single(),
      supabase.from('teams').select('*').eq('user_id', user2).eq('match_id', selectedMatch).eq('league_id', leagueId).single(),
    ]);

    const t1 = team1Res.data;
    const t2 = team2Res.data;

    if (!t1 || !t2) { setComparison({ error: true }); setComparing(false); return; }

    // Use secure function to get players (returns empty if match not started for other users)
    const [t1PlayersRes, t2PlayersRes] = await Promise.all([
      supabase.rpc('get_team_preview', { p_team_id: t1.id, p_requesting_user_id: me?.id }),
      supabase.rpc('get_team_preview', { p_team_id: t2.id, p_requesting_user_id: me?.id }),
    ]);

    const t1Raw = t1PlayersRes.data || [];
    const t2Raw = t2PlayersRes.data || [];

    if (t1Raw.length === 0 || t2Raw.length === 0) {
      setComparison({ error: true, locked: true });
      setComparing(false);
      return;
    }

    function enrich(tp) {
      const base = tp.fantasy_points || 0;
      const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
      return { ...tp, base_points: base, multiplier: mult, total_points: base * mult };
    }

    const t1Players = t1Raw.map(enrich);
    const t2Players = t2Raw.map(enrich);
    const t1Map = new Map(t1Players.map(p => [p.player_id, p]));
    const t2Map = new Map(t2Players.map(p => [p.player_id, p]));

    const captain1 = t1Players.find(p => p.is_captain);
    const captain2 = t2Players.find(p => p.is_captain);
    const vc1 = t1Players.find(p => p.is_vice_captain);
    const vc2 = t2Players.find(p => p.is_vice_captain);

    // C/VC players go in the C&VC section ONLY if both users have that player
    // If only one user has them, they go in Different Players with the C/VC label
    const cvSharedIds = new Set();
    [captain1, captain2, vc1, vc2].forEach(p => {
      if (p && t1Map.has(p.player_id) && t2Map.has(p.player_id)) {
        cvSharedIds.add(p.player_id);
      }
    });

    // Different players: only in one team (include C/VC if not shared)
    const onlyT1 = t1Players.filter(p => !t2Map.has(p.player_id));
    const onlyT2 = t2Players.filter(p => !t1Map.has(p.player_id));

    // Common players: in both teams but NOT in the C&VC shared section
    const common = t1Players
      .filter(p => t2Map.has(p.player_id) && !cvSharedIds.has(p.player_id))
      .map(p1 => ({ t1: p1, t2: t2Map.get(p1.player_id) }));

    setComparison({
      error: false,
      user1: members.find(m => m.id === user1),
      user2: members.find(m => m.id === user2),
      team1: t1, team2: t2,
      t1Map, t2Map,
      captain1, captain2, vc1, vc2,
      cvSharedIds,
      common, onlyT1, onlyT2,
    });
    setComparing(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <h1 className="page-title">Compare Teams</h1>

      <div className="cmp-selectors">
        <select className="input" value={selectedMatch} onChange={e => { setSelectedMatch(e.target.value); setComparison(null); }}>
          <option value="">Select Match</option>
          {matches.map(m => <option key={m.id} value={m.id}>M{m.match_number}: {m.team1_short} vs {m.team2_short}</option>)}
        </select>
        <div className="cmp-user-row">
          <select className="input" value={user1} onChange={e => { setUser1(e.target.value); setComparison(null); }}>
            <option value="">User 1</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <span className="cmp-vs-label">VS</span>
          <select className="input" value={user2} onChange={e => { setUser2(e.target.value); setComparison(null); }}>
            <option value="">User 2</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={compare}
          disabled={!user1 || !user2 || !selectedMatch || user1 === user2 || comparing}>
          {comparing ? 'COMPARING...' : 'COMPARE'}
        </button>
      </div>

      {comparison?.error && (
        <div className="empty">
          <div className="empty-icon">{comparison.locked ? '🔒' : '👥'}</div>
          <p className="empty-text">
            {comparison.locked
              ? 'Teams can only be compared after the match starts'
              : "One or both users haven't created a team for this match"}
          </p>
        </div>
      )}

      {comparison && !comparison.error && (() => {
        const c = comparison;
        const t1Total = c.team1.total_points || 0;
        const t2Total = c.team2.total_points || 0;
        const diff = t1Total - t2Total;

        return (
          <div className="cmp-result fade-in">

            {/* Score strip */}
            <div className="cmp-score-strip card">
              <div className={`cmp-score-side ${t1Total >= t2Total ? 'cmp-winner' : ''}`}>
                <div className="avatar" style={{ background: c.user1.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                  {c.user1.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="cmp-score-name">{c.user1.name}</div>
                  <div className="cmp-score-pts">{t1Total}</div>
                </div>
              </div>
              <div className="cmp-score-center">
                <div className={`cmp-total-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </div>
                <div className="cmp-score-diff-label">DIFF</div>
              </div>
              <div className={`cmp-score-side cmp-score-right ${t2Total >= t1Total ? 'cmp-winner' : ''}`}>
                <div style={{ textAlign: 'right' }}>
                  <div className="cmp-score-name">{c.user2.name}</div>
                  <div className="cmp-score-pts">{t2Total}</div>
                </div>
                <div className="avatar" style={{ background: c.user2.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                  {c.user2.name[0].toUpperCase()}
                </div>
              </div>
            </div>

            {/* 1. Different Players */}
            {(c.onlyT1.length > 0 || c.onlyT2.length > 0) && (
              <CategoryHeader title="Different Players" count={c.onlyT1.length + c.onlyT2.length}
                pts1={c.onlyT1.reduce((s, p) => s + p.total_points, 0)}
                pts2={c.onlyT2.reduce((s, p) => s + p.total_points, 0)} />
            )}
            {(c.onlyT1.length > 0 || c.onlyT2.length > 0) && (
              <div className="cmp-cat-body">
                {Array.from({ length: Math.max(c.onlyT1.length, c.onlyT2.length) }).map((_, i) => (
                  <DiffRow key={i} p1={c.onlyT1[i]} p2={c.onlyT2[i]} />
                ))}
              </div>
            )}

            {/* 2. Captain & Vice Captain (only shared players) */}
            {c.cvSharedIds.size > 0 && (
              <>
            <CategoryHeader title="Captain & Vice Captain"
              pts1={[c.captain1, c.vc1].filter(p => p && c.cvSharedIds.has(p.player_id)).reduce((s, p) => s + p.total_points, 0)}
              pts2={[c.captain2, c.vc2].filter(p => p && c.cvSharedIds.has(p.player_id)).reduce((s, p) => s + p.total_points, 0)} />
            <div className="cmp-cat-body">
              {/* User1's captain — if both users have this player */}
              {c.captain1 && c.cvSharedIds.has(c.captain1.player_id) && (
                <CVRow
                  p1={c.captain1} label1="C"
                  p2Right={c.t2Map.get(c.captain1.player_id)}
                  isUser1Row
                />
              )}
              {/* User2's captain — if different from user1's and both have this player */}
              {c.captain2 && c.captain2.player_id !== c.captain1?.player_id && c.cvSharedIds.has(c.captain2.player_id) && (
                <CVRow
                  p2={c.captain2} label2="C"
                  p1Left={c.t1Map.get(c.captain2.player_id)}
                />
              )}
              {/* User1's VC — if both users have this player */}
              {c.vc1 && c.cvSharedIds.has(c.vc1.player_id) && (
                <CVRow
                  p1={c.vc1} label1="VC"
                  p2Right={c.t2Map.get(c.vc1.player_id)}
                  isUser1Row
                />
              )}
              {/* User2's VC — if different from user1's and both have this player */}
              {c.vc2 && c.vc2.player_id !== c.vc1?.player_id && c.cvSharedIds.has(c.vc2.player_id) && (
                <CVRow
                  p2={c.vc2} label2="VC"
                  p1Left={c.t1Map.get(c.vc2.player_id)}
                />
              )}
            </div>
              </>
            )}

            {/* 3. Common Players */}
            {c.common.length > 0 && (
              <>
                <CategoryHeader title="Common Players" count={c.common.length}
                  pts1={c.common.reduce((s, x) => s + x.t1.total_points, 0)}
                  pts2={c.common.reduce((s, x) => s + x.t2.total_points, 0)} />
                <div className="cmp-cat-body">
                  {c.common.map(({ t1, t2 }) => (
                    <div key={t1.player_id} className="cmp-common-row">
                      <span className="cmp-pts">{t1.total_points}</span>
                      <div className="cmp-diff-side left"><PlayerChip p={t1} label={getLabel(t1)} /></div>
                      <div className="cmp-diff-vs"></div>
                      <div className="cmp-diff-side right"><PlayerChip p={t2} label={getLabel(t2)} /></div>
                      <span className="cmp-pts">{t2.total_points}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        );
      })()}
    </div>
  );
}

function CategoryHeader({ title, badge, badgeClass, count, pts1, pts2 }) {
  const diff = pts1 - pts2;
  return (
    <div className="cmp-cat-header">
      <div className="cmp-cat-title">
        {badge && <span className={badgeClass}>{badge}</span>}
        <span>{title}</span>
        {count != null && <span className="cmp-cat-count">{count}</span>}
      </div>
      <div className="cmp-cat-summary">
        <span className="cmp-cat-pts">{pts1}</span>
        <span className={`cmp-cat-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
          {diff > 0 ? '+' : ''}{diff}
        </span>
        <span className="cmp-cat-pts">{pts2}</span>
      </div>
    </div>
  );
}

function CVRow({ p1, label1, p2, label2, p2Right, p1Left, isUser1Row }) {
  if (isUser1Row && p1) {
    return (
      <div className="cmp-cv-row">
        <span className="cmp-cv-pts">{p1.total_points}</span>
        <div className="cmp-cv-side left"><PlayerChip p={p1} label={label1} /></div>
        <div className="cmp-cv-vs">vs</div>
        <div className="cmp-cv-side right">
          {p2Right ? <PlayerChip p={p2Right} label={p2Right.is_captain ? 'C' : p2Right.is_vice_captain ? 'VC' : null} /> : <span className="cmp-cv-empty">—</span>}
        </div>
        <span className="cmp-cv-pts">{p2Right ? p2Right.total_points : ''}</span>
      </div>
    );
  }

  if (p2) {
    return (
      <div className="cmp-cv-row">
        <span className="cmp-cv-pts">{p1Left ? p1Left.total_points : ''}</span>
        <div className="cmp-cv-side left">
          {p1Left ? <PlayerChip p={p1Left} label={p1Left.is_captain ? 'C' : p1Left.is_vice_captain ? 'VC' : null} /> : <span className="cmp-cv-empty">—</span>}
        </div>
        <div className="cmp-cv-vs">vs</div>
        <div className="cmp-cv-side right"><PlayerChip p={p2} label={label2} /></div>
        <span className="cmp-cv-pts">{p2.total_points}</span>
      </div>
    );
  }

  return null;
}

function getLabel(p) {
  if (!p) return null;
  if (p.is_captain) return 'C';
  if (p.is_vice_captain) return 'VC';
  return null;
}

function DiffRow({ p1, p2 }) {
  return (
    <div className="cmp-diff-row">
      <span className="cmp-diff-pts">{p1 ? p1.total_points : ''}</span>
      <div className="cmp-diff-side left">
        {p1 ? <PlayerChip p={p1} label={getLabel(p1)} /> : null}
      </div>
      <div className="cmp-diff-vs">vs</div>
      <div className="cmp-diff-side right">
        {p2 ? <PlayerChip p={p2} label={getLabel(p2)} /> : null}
      </div>
      <span className="cmp-diff-pts">{p2 ? p2.total_points : ''}</span>
    </div>
  );
}

function PlayerChip({ p, label }) {
  if (!p) return null;
  return (
    <div className="cmp-chip">
      {p.image_url ? (
        <img className="cmp-chip-img" src={p.image_url} alt={p.name} />
      ) : (
        <div className="cmp-chip-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
      )}
      <div className="cmp-chip-info">
        <div className="cmp-chip-name">
          {p.name.split(' ').pop()}
          {label && <span className={`cmp-chip-label ${label === 'C' ? 'cmp-badge-c' : label === 'VC' ? 'cmp-badge-vc' : ''}`}>{label}</span>}
        </div>
        <div className="cmp-chip-role">{p.role}</div>
      </div>
    </div>
  );
}
