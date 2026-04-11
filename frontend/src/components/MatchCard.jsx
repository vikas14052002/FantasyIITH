import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { getTeamLogo, TEAM_COLORS } from '../lib/teamLogos';
import { getUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import './MatchCard.css';

export default function MatchCard({ match, leagueId, hasTeam: hasTeamProp }) {
  const navigate = useNavigate();
  const user = getUser();
  const [existingTeam, setExistingTeam] = useState(null);

  useEffect(() => {
    // Only query individually if parent didn't provide the info
    if (hasTeamProp !== undefined) return;
    if (leagueId && user) {
      supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .eq('match_id', match.id)
        .eq('league_id', leagueId)
        .maybeSingle()
        .then(({ data }) => setExistingTeam(data));
    }
  }, [match.id, leagueId, user?.id, hasTeamProp]);

  const teamExists = hasTeamProp !== undefined ? hasTeamProp : !!existingTeam;

  const handleClick = () => {
    navigate(`/match/${match.id}`, leagueId ? { state: { leagueId } } : undefined);
  };

  const logo1 = getTeamLogo(match.team1_short);
  const logo2 = getTeamLogo(match.team2_short);
  const color1 = TEAM_COLORS[match.team1_short] || 'var(--border)';
  const color2 = TEAM_COLORS[match.team2_short] || 'var(--border)';

  return (
    <div
      className="match-card fade-in"
      onClick={handleClick}
      style={{ '--mc-color1': color1, '--mc-color2': color2 }}
    >
      <div className="match-card-inner">
        <div className="match-card-header">
          <span className="match-label">Match {match.match_number} • PlayXI</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {match.lineups_synced && match.status === 'upcoming' && (
              <span className="mc-lineups-badge">Lineups Out</span>
            )}
            <span className={`badge badge-${match.status}`}>
              {match.status === 'live' ? '● LIVE' : match.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="match-card-teams">
          <div className="match-team">
            {logo1 ? (
              <img className="team-logo" src={logo1} alt={match.team1_short} />
            ) : (
              <div className="team-badge">{match.team1_short}</div>
            )}
            <span className="team-name">{match.team1_short}</span>
            {match.team1_score && <span className="team-score">{match.team1_score}</span>}
          </div>
          <div className="match-vs">VS</div>
          <div className="match-team">
            {logo2 ? (
              <img className="team-logo" src={logo2} alt={match.team2_short} />
            ) : (
              <div className="team-badge">{match.team2_short}</div>
            )}
            <span className="team-name">{match.team2_short}</span>
            {match.team2_score && <span className="team-score">{match.team2_score}</span>}
          </div>
        </div>

        {match.venue && match.venue !== 'TBD' && (
          <div className="match-card-venue">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {match.venue}
          </div>
        )}

        <div className="match-card-footer">
          {match.status === 'upcoming' ? (
            <>
              <CountdownTimer targetDate={match.start_time} />
              {leagueId && (
                <span className={`mc-team-status ${teamExists ? 'mc-has-team' : ''}`}>
                  {teamExists ? 'Edit Team' : 'Create Team'}
                </span>
              )}
            </>
          ) : match.status === 'completed' ? (
            <span className="match-result">{match.result || 'Completed'}</span>
          ) : (
            <span className="match-result live">In Progress</span>
          )}
        </div>
      </div>
    </div>
  );
}
