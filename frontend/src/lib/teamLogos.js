// Official IPL CDN team logos
export function getTeamLogo(shortName) {
  const teams = ['CSK', 'MI', 'RCB', 'KKR', 'RR', 'SRH', 'DC', 'PBKS', 'GT', 'LSG'];
  if (!teams.includes(shortName)) return null;
  return `https://documents.iplt20.com/ipl/${shortName}/Logos/Roundbig/${shortName}roundbig.png`;
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
