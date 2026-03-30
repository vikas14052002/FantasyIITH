import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { getTeamLogo } from '../lib/teamLogos';
import { getUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import './MatchCard.css';

export default function MatchCard({ match, leagueId }) {
  const navigate = useNavigate();
  const user = getUser();
  const [existingTeam, setExistingTeam] = useState(null);

  useEffect(() => {
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
  }, [match.id, leagueId, user?.id]);

  const handleClick = () => {
    if (match.status === 'upcoming' && leagueId) {
      navigate(`/create-team/${match.id}/${leagueId}`);
    } else {
      navigate(`/match/${match.id}`);
    }
  };

  const logo1 = getTeamLogo(match.team1_short);
  const logo2 = getTeamLogo(match.team2_short);

  return (
    <div className="match-card card fade-in" onClick={handleClick}>
      <div className="match-card-header">
        <span className="match-label">Match {match.match_number} • IPL 2026</span>
        <span className={`badge badge-${match.status}`}>
          {match.status === 'live' ? '● LIVE' : match.status.toUpperCase()}
        </span>
      </div>

      <div className="match-card-teams">
        <div className="match-team">
          {logo1 ? (
            <img className="team-logo" src={logo1} alt={match.team1_short} />
          ) : (
            <div className="team-badge">{match.team1_short}</div>
          )}
          <span className="team-name">{match.team1_short}</span>
        </div>
        <div className="match-vs">VS</div>
        <div className="match-team">
          {logo2 ? (
            <img className="team-logo" src={logo2} alt={match.team2_short} />
          ) : (
            <div className="team-badge">{match.team2_short}</div>
          )}
          <span className="team-name">{match.team2_short}</span>
        </div>
      </div>

      <div className="match-card-footer">
        {match.status === 'upcoming' ? (
          <>
            <CountdownTimer targetDate={match.start_time} />
            {leagueId && (
              <span className={`mc-team-status ${existingTeam ? 'mc-has-team' : ''}`}>
                {existingTeam ? 'Edit Team' : 'Create Team'}
              </span>
            )}
          </>
        ) : match.status === 'completed' ? (
          <span className="match-result">Completed</span>
        ) : (
          <span className="match-result live">In Progress</span>
        )}
      </div>
    </div>
  );
}
