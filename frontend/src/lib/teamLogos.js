// Cricbuzz team logo image IDs
const TEAM_LOGOS = {
  RR: 'c860055/rajasthan-royals',
  CSK: 'c860038/chennai-super-kings',
  KKR: 'c860046/kolkata-knight-riders',
  MI: 'c860053/mumbai-indians',
  RCB: 'c860056/royal-challengers-bengaluru',
  SRH: 'c860066/sunrisers-hyderabad',
  DC: 'c860041/delhi-capitals',
  PBKS: 'c860054/punjab-kings',
  GT: 'c860044/gujarat-titans',
  LSG: 'c860048/lucknow-super-giants',
};

export function getTeamLogo(shortName) {
  const path = TEAM_LOGOS[shortName];
  if (!path) return null;
  return `https://static.cricbuzz.com/a/img/v1/72x54/i1/${path}.jpg`;
}

// Team primary colors for borders/accents
export const TEAM_COLORS = {
  RR: '#EA1A85',
  CSK: '#FFCB05',
  KKR: '#3A225D',
  MI: '#004BA0',
  RCB: '#EC1C24',
  SRH: '#FF822A',
  DC: '#0078BC',
  PBKS: '#ED1B24',
  GT: '#1C1C2E',
  LSG: '#A72056',
};
