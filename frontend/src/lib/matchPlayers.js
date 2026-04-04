/**
 * True when the player is part of the announced match-day squad for fantasy:
 * official Playing XI or named impact substitute (sync-lineups).
 */
export function isFantasyRosterActive(p) {
  return !!(p && (p.is_playing || p.is_impact_sub));
}
