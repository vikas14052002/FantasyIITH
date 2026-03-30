import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
      supabase.from('matches').select('*').order('match_number'),
    ]);
    setMembers((membersRes.data || []).map(m => m.users));
    setMatches(matchesRes.data || []);
    setLoading(false);
  }

  async function compare() {
    if (!user1 || !user2 || !selectedMatch) return;
    setComparing(true);

    const [team1Res, team2Res, mpRes] = await Promise.all([
      supabase.from('teams').select('*, team_players(*)').eq('user_id', user1).eq('match_id', selectedMatch).eq('league_id', leagueId).single(),
      supabase.from('teams').select('*, team_players(*)').eq('user_id', user2).eq('match_id', selectedMatch).eq('league_id', leagueId).single(),
      supabase.from('match_players').select('player_id, name, image_url, fantasy_points, role, team').eq('match_id', selectedMatch),
    ]);

    const mp = mpRes.data || [];
    const t1 = team1Res.data;
    const t2 = team2Res.data;

    if (!t1 || !t2) { setComparison({ error: true }); setComparing(false); return; }

    function enrich(tp) {
      const m = mp.find(x => x.player_id === tp.player_id);
      const base = m?.fantasy_points || 0;
      const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
      return { ...tp, image_url: m?.image_url, base_points: base, multiplier: mult, total_points: base * mult };
    }

    const t1Players = t1.team_players.map(enrich);
    const t2Players = t2.team_players.map(enrich);
    const t1Ids = new Set(t1Players.map(p => p.player_id));
    const t2Ids = new Set(t2Players.map(p => p.player_id));

    setComparison({
      error: false,
      user1: members.find(m => m.id === user1),
      user2: members.find(m => m.id === user2),
      team1: t1, team2: t2,
      onlyT1: t1Players.filter(p => !t2Ids.has(p.player_id)),
      onlyT2: t2Players.filter(p => !t1Ids.has(p.player_id)),
      common: t1Players.filter(p => t2Ids.has(p.player_id)).map(p1 => ({
        t1: p1,
        t2: t2Players.find(p2 => p2.player_id === p1.player_id),
      })),
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
          <div className="empty-icon">👥</div>
          <p className="empty-text">One or both users haven't created a team for this match</p>
        </div>
      )}

      {comparison && !comparison.error && (
        <div className="cmp-result fade-in">

          {/* Score strip */}
          <div className="cmp-score-strip card">
            <div className={`cmp-score-side ${comparison.team1.total_points >= comparison.team2.total_points ? 'cmp-winner' : ''}`}>
              <div className="avatar" style={{ background: comparison.user1.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                {comparison.user1.name[0].toUpperCase()}
              </div>
              <div>
                <div className="cmp-score-name">{comparison.user1.name}</div>
                <div className="cmp-score-pts">{comparison.team1.total_points}</div>
              </div>
            </div>
            <div className="cmp-score-center">
              <div className="cmp-score-diff">{Math.abs(comparison.team1.total_points - comparison.team2.total_points)}</div>
              <div className="cmp-score-diff-label">DIFF</div>
            </div>
            <div className={`cmp-score-side cmp-score-right ${comparison.team2.total_points >= comparison.team1.total_points ? 'cmp-winner' : ''}`}>
              <div style={{ textAlign: 'right' }}>
                <div className="cmp-score-name">{comparison.user2.name}</div>
                <div className="cmp-score-pts">{comparison.team2.total_points}</div>
              </div>
              <div className="avatar" style={{ background: comparison.user2.avatar_color, width: 36, height: 36, fontSize: 14 }}>
                {comparison.user2.name[0].toUpperCase()}
              </div>
            </div>
          </div>

          {/* Different players */}
          <div className="cmp-section-header">
            <span>Different Players</span>
            <span className="cmp-section-count">{comparison.onlyT1.length + comparison.onlyT2.length}</span>
          </div>
          <div className="cmp-diff-grid">
            <div className="cmp-diff-col">
              {comparison.onlyT1.map(p => <PCard key={p.player_id} p={p} align="left" />)}
              {comparison.onlyT1.length === 0 && <div className="cmp-empty-col">—</div>}
            </div>
            <div className="cmp-diff-divider" />
            <div className="cmp-diff-col">
              {comparison.onlyT2.map(p => <PCard key={p.player_id} p={p} align="right" />)}
              {comparison.onlyT2.length === 0 && <div className="cmp-empty-col">—</div>}
            </div>
          </div>

          {/* Common players */}
          <div className="cmp-section-header">
            <span>Common Players</span>
            <span className="cmp-section-count">{comparison.common.length}</span>
          </div>
          <div className="cmp-common-list">
            {comparison.common.map(({ t1, t2 }) => (
              <div key={t1.player_id} className="cmp-common-row">
                <div className="cmp-common-side">
                  <span className="cmp-pts">{t1.total_points}</span>
                  {t1.is_captain && <span className="cmp-badge-c">C</span>}
                  {t1.is_vice_captain && <span className="cmp-badge-vc">VC</span>}
                </div>
                <div className="cmp-common-mid">
                  {t1.image_url ? (
                    <img className="cmp-common-img" src={t1.image_url} alt={t1.name} />
                  ) : (
                    <div className="cmp-common-fb">{t1.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  )}
                  <div className="cmp-common-name">{t1.name.split(' ').pop()}</div>
                  <div className="cmp-common-role">{t1.role}</div>
                </div>
                <div className="cmp-common-side cmp-common-side-r">
                  {t2.is_captain && <span className="cmp-badge-c">C</span>}
                  {t2.is_vice_captain && <span className="cmp-badge-vc">VC</span>}
                  <span className="cmp-pts">{t2.total_points}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

function PCard({ p, align }) {
  return (
    <div className={`cmp-pcard ${align}`}>
      {p.image_url ? (
        <img className="cmp-pcard-img" src={p.image_url} alt={p.name} />
      ) : (
        <div className="cmp-pcard-fb">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
      )}
      <div className="cmp-pcard-info">
        <div className="cmp-pcard-name">
          {p.name.split(' ').pop()}
          {p.is_captain && <span className="cmp-badge-c">C</span>}
          {p.is_vice_captain && <span className="cmp-badge-vc">VC</span>}
        </div>
        <div className="cmp-pcard-meta">{p.role} • {p.total_points} pts</div>
      </div>
    </div>
  );
}
