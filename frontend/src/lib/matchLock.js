/**
 * Check if a match has started (deadline passed).
 * After match starts: teams are locked, previews/compare allowed.
 * Before match starts: can create/edit team, cannot view others' teams.
 */
export function hasMatchStarted(match) {
  if (!match) return false;
  if (match.status === 'live' || match.status === 'completed') return true;
  return new Date(match.start_time) <= new Date();
}
