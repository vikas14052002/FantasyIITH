export function computePlayerPoints(stats, config) {
  let points = 0;

  // Playing XI bonus
  if (stats.is_playing) points += config.inPlayingXI || 4;

  // Batting
  points += (stats.runs || 0) * config.run;
  points += (stats.fours || 0) * config.four;
  points += (stats.sixes || 0) * config.six;
  if (stats.runs >= 100) points += config.century;
  else if (stats.runs >= 50) points += config.halfCentury;
  if (stats.runs === 0 && stats.balls > 0 && ['BAT', 'WK', 'AR'].includes(stats.role)) {
    points += config.duck;
  }

  // Bowling
  points += (stats.wickets || 0) * config.wicket;
  points += (stats.maidens || 0) * config.maiden;

  // Fielding
  points += (stats.catches || 0) * config.catch;
  points += (stats.stumpings || 0) * config.stumping;
  points += (stats.run_outs || 0) * config.runOut;

  return points;
}

export function computeTeamScore(teamPlayers, matchPlayers, config) {
  let totalPoints = 0;
  const breakdown = [];

  for (const tp of teamPlayers) {
    const mp = matchPlayers.find(p => p.player_id === tp.player_id);
    if (!mp) continue;

    const basePoints = computePlayerPoints({ ...mp, role: tp.role }, config);
    const multiplier = tp.is_captain ? config.captainMultiplier
      : tp.is_vice_captain ? config.viceCaptainMultiplier
      : 1;
    const finalPoints = basePoints * multiplier;

    totalPoints += finalPoints;
    breakdown.push({
      player_id: tp.player_id,
      player_name: tp.name,
      base_points: basePoints,
      multiplier,
      final_points: finalPoints,
    });
  }

  return { totalPoints, breakdown };
}
