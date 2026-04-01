import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import MatchCard from '../components/MatchCard';
import ShareSheet from '../components/ShareSheet';
import { LeagueDetailSkeleton, SkeletonRow } from '../components/Skeleton';
import './LeagueDetail.css';

export default function LeagueDetail() {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');
  const [matchSubTab, setMatchSubTab] = useState('upcoming');
  const [scores, setScores] = useState([]);
  const [scoresLoaded, setScoresLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadLeague(); }, [id]);

  useEffect(() => {
    if (activeTab === 'leaderboard' && !scoresLoaded) loadScores();
  }, [activeTab, scoresLoaded]);

  async function loadLeague() {
    const [leagueRes, membersRes, matchesRes, teamsRes] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id).single(),
      supabase.from('league_members').select('user_id, users(*)').eq('league_id', id),
      supabase.from('matches').select('*').order('match_number', { ascending: false }),
      supabase.from('teams').select('id, user_id, match_id, total_points').eq('league_id', id),
    ]);
    setLeague(leagueRes.data);
    setMembers((membersRes.data || []).map(m => m.users));
    const matchesData = matchesRes.data || [];
    setMatches(matchesData);
    setTeams(teamsRes.data || []);

    if (matchesData.some(m => m.status === 'live')) setMatchSubTab('live');
    else if (matchesData.some(m => m.status === 'upcoming')) setMatchSubTab('upcoming');
    else setMatchSubTab('completed');

    setLoading(false);
  }

  async function loadScores() {
    const { data } = await supabase
      .from('scores')
      .select('*, users(*)')
      .eq('league_id', id);
    setScores(data || []);
    setScoresLoaded(true);
  }

  const matchTabCounts = useMemo(() => ({
    live: matches.filter(m => m.status === 'live').length,
    upcoming: matches.filter(m => m.status === 'upcoming').length,
    completed: matches.filter(m => m.status === 'completed').length,
  }), [matches]);

  const filteredMatches = useMemo(() => {
    return matches
      .filter(m => m.status === matchSubTab)
      .sort((a, b) => {
        if (matchSubTab === 'upcoming') return new Date(a.start_time) - new Date(b.start_time);
        return new Date(b.start_time) - new Date(a.start_time);
      });
  }, [matches, matchSubTab]);

  const overallScores = useMemo(() => {
    const pointsMap = {};
    scores.forEach(s => {
      if (!pointsMap[s.user_id]) pointsMap[s.user_id] = 0;
      pointsMap[s.user_id] += s.total_points;
    });
    return members
      .map(m => ({ ...m, total_points: pointsMap[m.id] || 0 }))
      .sort((a, b) => b.total_points - a.total_points);
  }, [members, scores]);

  if (loading) return <LeagueDetailSkeleton />;
  if (!league) return <div className="page"><p>League not found</p></div>;

  return (
    <div className="page fade-in">
      {showShare && (
        <ShareSheet
          title="Join my Fantasy League!"
          text={`Join "${league.name}" on PlayXI! Code: ${league.invite_code}`}
          onClose={() => setShowShare(false)}
        />
      )}

      <button onClick={() => navigate('/leagues')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0, fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        <span>&larr;</span> <span>Leagues</span>
      </button>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{league.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ background: 'var(--bg-elevated)', padding: '6px 16px', borderRadius: 8, fontWeight: 700, letterSpacing: 2 }}>
            {league.invite_code}
          </span>
          <button className="btn btn-outline" style={{ width: 'auto', minHeight: 36, padding: '6px 16px', fontSize: 12 }} onClick={() => setShowShare(true)}>
            Share
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
      </div>

      {activeTab === 'matches' ? (
        <>
          <div className="tabs ld-subtabs">
            {['live', 'upcoming', 'completed'].map(tab => (
              <button
                key={tab}
                className={`tab ${matchSubTab === tab ? 'active' : ''}`}
                onClick={() => setMatchSubTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {matchTabCounts[tab] > 0 && <span className="tab-badge">{matchTabCounts[tab]}</span>}
              </button>
            ))}
          </div>
          {filteredMatches.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏏</div>
              <p className="empty-text">No {matchSubTab} matches</p>
            </div>
          ) : (
            filteredMatches.map(m => (
              <MatchCard key={m.id} match={m} leagueId={id}
                hasTeam={teams.some(t => t.user_id === user?.id && t.match_id === m.id)} />
            ))
          )}
        </>
      ) : (
        <>
          {!scoresLoaded ? (
            <div role="status" aria-live="polite" aria-label="Loading leaderboard">
              <span className="sr-only">Loading leaderboard...</span>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : (
            <>
              <div className="ld-members-header">
                <span>Member</span>
                <span>Points</span>
              </div>
              {overallScores.map((member, idx) => {
                const isMe = member.id === user?.id;
                const matchesPlayed = scores.filter(s => s.user_id === member.id).length;
                return (
                  <div
                    key={member.id}
                    className={`ld-member-row clickable ${isMe ? 'is-me' : ''}`}
                    onClick={() => navigate(`/leagues/${id}/breakdown/${member.id}`, { state: { userName: member.name } })}
                  >
                    <div className="ld-member-left">
                      <div className="ld-member-rank">{idx + 1}</div>
                      <div className="avatar" style={{ background: member.avatar_color }}>
                        {member.name[0].toUpperCase()}
                      </div>
                      <div className="ld-member-info">
                        <div className="ld-member-name">
                          {member.name}
                          {isMe && <span className="ld-you-tag">You</span>}
                        </div>
                        <div className="ld-member-status">
                          <span style={{ color: 'var(--text-muted)' }}>
                            {matchesPlayed} match{matchesPlayed !== 1 ? 'es' : ''} played
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ld-member-right">
                      <span className="ld-member-points">{member.total_points}</span>
                      <svg className="ld-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
