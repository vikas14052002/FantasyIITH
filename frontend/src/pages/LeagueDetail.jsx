import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import { hasMatchStarted } from '../lib/matchLock';
import MatchCard from '../components/MatchCard';
import './LeagueDetail.css';

export default function LeagueDetail() {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadLeague(); }, [id]);

  // When match selection changes, load teams for that match
  useEffect(() => {
    if (selectedMatchId) loadTeamsForMatch(selectedMatchId);
  }, [selectedMatchId]);

  async function loadLeague() {
    const [leagueRes, membersRes, matchesRes, teamsRes] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id).single(),
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', id),
      supabase.from('matches').select('*').order('match_number', { ascending: false }),
      supabase.from('teams').select('id, user_id, match_id, total_points').eq('league_id', id),
    ]);
    setLeague(leagueRes.data);
    setMembers((membersRes.data || []).map(m => m.users));
    setMatches(matchesRes.data || []);
    setTeams(teamsRes.data || []);

    // Default to first match with any teams, or first match overall
    const matchesData = matchesRes.data || [];
    const teamsData = teamsRes.data || [];
    const matchWithTeams = matchesData.find(m => teamsData.some(t => t.match_id === m.id));
    if (matchWithTeams) setSelectedMatchId(matchWithTeams.id);
    else if (matchesData.length > 0) setSelectedMatchId(matchesData[0].id);

    setLoading(false);
  }

  async function loadTeamsForMatch(matchId) {
    const { data } = await supabase
      .from('teams')
      .select('id, user_id, match_id, total_points')
      .eq('league_id', id)
      .eq('match_id', matchId);
    if (data) {
      setTeams(prev => {
        // Replace teams for this match, keep others
        const other = prev.filter(t => t.match_id !== matchId);
        return [...other, ...data];
      });
    }
  }

  const selectedMatch = useMemo(() =>
    matches.find(m => m.id === selectedMatchId), [matches, selectedMatchId]);

  // Build member list with their team info for the selected match
  const membersWithTeams = useMemo(() => {
    return members.map(m => {
      const team = teams.find(t => t.user_id === m.id && t.match_id === selectedMatchId);
      return { ...m, team };
    }).sort((a, b) => {
      // Members with teams first, sorted by points desc
      if (a.team && !b.team) return -1;
      if (!a.team && b.team) return 1;
      if (a.team && b.team) return (b.team.total_points || 0) - (a.team.total_points || 0);
      return a.name.localeCompare(b.name);
    });
  }, [members, teams, selectedMatchId]);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join my Fantasy League!', text: `Join "${league.name}" on FantasyIITH! Code: ${league.invite_code}` });
    } else {
      navigator.clipboard.writeText(league.invite_code);
      alert('Code copied!');
    }
  };

  function handleMemberClick(member) {
    if (!member.team) return;
    const isMe = member.id === user?.id;
    // Can only view others' teams after match starts
    if (!isMe && selectedMatch && !hasMatchStarted(selectedMatch)) return;
    navigate(`/team-preview/${member.team.id}`);
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!league) return <div className="page"><p>League not found</p></div>;

  const currentUserTeam = teams.find(t => t.user_id === user?.id && t.match_id === selectedMatchId);

  return (
    <div className="page fade-in">
      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{league.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ background: 'var(--bg-elevated)', padding: '6px 16px', borderRadius: 8, fontWeight: 700, letterSpacing: 2 }}>
            {league.invite_code}
          </span>
          <button className="btn btn-outline" style={{ width: 'auto', minHeight: 36, padding: '6px 16px', fontSize: 12 }} onClick={handleShare}>
            Share
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1, minHeight: 40, fontSize: 13 }}
            onClick={() => navigate(`/leaderboard?league=${id}`)}>
            Leaderboard
          </button>
          <button className="btn btn-outline" style={{ flex: 1, minHeight: 40, fontSize: 13 }}
            onClick={() => navigate(`/compare/${id}`)}>
            Compare
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={`tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>Members</button>
      </div>

      {activeTab === 'matches' ? (
        matches.map(m => <MatchCard key={m.id} match={m} leagueId={id} />)
      ) : (
        <div className="ld-members">
          {/* Match selector */}
          <div className="ld-match-select-wrap">
            <select
              className="ld-match-select"
              value={selectedMatchId || ''}
              onChange={e => setSelectedMatchId(e.target.value)}
            >
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  Match {m.match_number} — {m.team1_short} vs {m.team2_short}
                  {m.status === 'live' ? ' (Live)' : m.status === 'completed' ? ' (Done)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Match info bar */}
          {selectedMatch && (
            <div className="ld-match-info">
              <span className="ld-match-teams">{selectedMatch.team1_short} vs {selectedMatch.team2_short}</span>
              <span className={`badge badge-${selectedMatch.status}`}>
                {selectedMatch.status === 'live' ? '● LIVE' : selectedMatch.status.toUpperCase()}
              </span>
            </div>
          )}

          {/* Create/Edit team CTA for current user */}
          {selectedMatch?.status === 'upcoming' && (
            <button
              className={`btn ${currentUserTeam ? 'btn-outline' : 'btn-primary'} ld-team-cta`}
              onClick={() => navigate(`/create-team/${selectedMatchId}/${id}`)}
            >
              {currentUserTeam ? 'Edit Your Team' : 'Create Your Team'}
            </button>
          )}

          {/* Column header */}
          <div className="ld-members-header">
            <span>Member</span>
            <span>Points</span>
          </div>

          {/* Members list */}
          {membersWithTeams.map((m, idx) => {
            const isMe = m.id === user?.id;
            const hasTeam = !!m.team;
            return (
              <div
                key={m.id}
                className={`ld-member-row ${hasTeam ? 'clickable' : ''} ${isMe ? 'is-me' : ''}`}
                onClick={() => handleMemberClick(m)}
              >
                <div className="ld-member-left">
                  <div className="ld-member-rank">{idx + 1}</div>
                  <div className="avatar" style={{ background: m.avatar_color }}>
                    {m.name[0].toUpperCase()}
                  </div>
                  <div className="ld-member-info">
                    <div className="ld-member-name">
                      {m.name}
                      {isMe && <span className="ld-you-tag">You</span>}
                    </div>
                    <div className="ld-member-status">
                      {hasTeam ? (
                        <span className="ld-has-team">Team created</span>
                      ) : (
                        <span className="ld-no-team">No team yet</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ld-member-right">
                  {hasTeam ? (
                    <span className="ld-member-points">{m.team.total_points || 0}</span>
                  ) : (
                    <span className="ld-member-points ld-pts-none">—</span>
                  )}
                  {hasTeam && (
                    <svg className="ld-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
