import { isFantasyRosterActive } from '../lib/matchPlayers';
import './PlayerBreakdown.css';

export default function PlayerBreakdown({ player, onClose }) {
  const p = player;
  const c = { run: 1, four: 4, six: 6, halfCentury: 8, century: 16, duck: -2, wicket: 30, maiden: 12, catch: 8, stumping: 12, runOut: 6, directRunOut: 12, inPlayingXI: 4, dotBall: 1, lbwBowledBonus: 8, threeWicketBonus: 4, fourWicketBonus: 8, fiveWicketBonus: 12, twentyFiveBonus: 4, seventyFiveBonus: 12, threeCatchBonus: 4 };
  const lines = []; let total = 0;
  function add(label, value, pts) { if (pts === 0) return; lines.push({ label, value, pts }); total += pts; }
  if (isFantasyRosterActive(p)) add('Playing XI', '', c.inPlayingXI);
  if (p.runs > 0 || p.balls > 0) {
    add('Runs', `${p.runs}`, (p.runs||0)*c.run);
    add('Fours Bonus', `${p.fours||0} x ${c.four}`, (p.fours||0)*c.four);
    add('Sixes Bonus', `${p.sixes||0} x ${c.six}`, (p.sixes||0)*c.six);
    if (p.runs>=100) add('Century', '', c.century);
    else if (p.runs>=75) add('75 Bonus', '', c.seventyFiveBonus);
    else if (p.runs>=50) add('Half Century', '', c.halfCentury);
    else if (p.runs>=25) add('25 Bonus', '', c.twentyFiveBonus);
    if (p.runs===0 && p.balls>0 && ['BAT','WK','AR'].includes(p.role)) add('Duck', '', c.duck);
    if ((p.balls||0) >= 10 && p.role !== 'BOWL') {
      const sr = ((p.runs||0) / p.balls) * 100;
      if (sr > 170) add('SR Bonus', `SR ${sr.toFixed(0)}`, 6);
      else if (sr >= 150.01) add('SR Bonus', `SR ${sr.toFixed(0)}`, 4);
      else if (sr >= 130) add('SR Bonus', `SR ${sr.toFixed(0)}`, 2);
      else if (sr >= 60 && sr <= 70) add('SR Penalty', `SR ${sr.toFixed(0)}`, -2);
      else if (sr >= 50 && sr < 60) add('SR Penalty', `SR ${sr.toFixed(0)}`, -4);
      else if (sr < 50) add('SR Penalty', `SR ${sr.toFixed(0)}`, -6);
    }
  }
  if (p.wickets>0||p.overs_bowled>0) {
    add('Wickets', `${p.wickets||0} x ${c.wicket}`, (p.wickets||0)*c.wicket);
    if (p.lbw_bowled_wickets>0) add('LBW/Bowled', `${p.lbw_bowled_wickets} x ${c.lbwBowledBonus}`, p.lbw_bowled_wickets*c.lbwBowledBonus);
    add('Maidens', `${p.maidens||0} x ${c.maiden}`, (p.maidens||0)*c.maiden);
    add('Dots', `${p.dots_bowled||0} x ${c.dotBall}`, (p.dots_bowled||0)*c.dotBall);
    if (p.wickets>=5) add('5W Bonus', '', c.fiveWicketBonus);
    else if (p.wickets>=4) add('4W Bonus', '', c.fourWicketBonus);
    else if (p.wickets>=3) add('3W Bonus', '', c.threeWicketBonus);
    if ((p.overs_bowled||0) >= 2) {
      const bowlingBalls = Math.floor(p.overs_bowled) * 6 + Math.round((p.overs_bowled - Math.floor(p.overs_bowled)) * 10);
      if (bowlingBalls > 0) {
        const econ = ((p.runs_conceded||0) / bowlingBalls) * 6;
        if (econ < 5) add('Economy Bonus', `Econ ${econ.toFixed(1)}`, 6);
        else if (econ < 6) add('Economy Bonus', `Econ ${econ.toFixed(1)}`, 4);
        else if (econ < 7) add('Economy Bonus', `Econ ${econ.toFixed(1)}`, 2);
        else if (econ >= 10 && econ < 11) add('Economy Penalty', `Econ ${econ.toFixed(1)}`, -2);
        else if (econ >= 11 && econ < 12) add('Economy Penalty', `Econ ${econ.toFixed(1)}`, -4);
        else if (econ >= 12) add('Economy Penalty', `Econ ${econ.toFixed(1)}`, -6);
      }
    }
  }
  const effCatches = (p.catches||0) + (p.delta_catches||0);
  const effStumpings = (p.stumpings||0) + (p.delta_stumpings||0);
  const effRunOuts = (p.run_outs||0) + (p.delta_run_outs||0);
  const effDirectRunOuts = (p.direct_run_outs||0) + (p.delta_direct_run_outs||0);
  if (effCatches>0) { add('Catches', `${effCatches} x ${c.catch}`, effCatches*c.catch); if (effCatches>=3) add('3 Catch Bonus', '', c.threeCatchBonus); }
  if (effStumpings>0) add('Stumpings', `${effStumpings} x ${c.stumping}`, effStumpings*c.stumping);
  if (effRunOuts>0) add('Run Outs', `${effRunOuts} x ${c.runOut}`, effRunOuts*c.runOut);
  if (effDirectRunOuts>0) add('Direct Run Outs', `${effDirectRunOuts} x 12`, effDirectRunOuts*12);

  const multiplier = p.is_captain ? 2 : p.is_vice_captain ? 1.5 : 1;
  const displayTotal = total * multiplier;

  return (
    <>
      <div className="pb-overlay" onClick={onClose} />
      <div className="pb-slider">
        <div className="pb-header">
          <div className="pb-player-info">
            {p.image_url ? <img className="pb-img" src={p.image_url} alt={p.name} /> : <div className="pb-fb">{p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}
            <div>
              <div className="pb-name">{p.name}{p.is_captain && <span className="pb-badge pb-badge-c">C</span>}{p.is_vice_captain && <span className="pb-badge pb-badge-vc">VC</span>}</div>
              <div className="pb-meta">{p.team} • {p.role}</div>
            </div>
          </div>
          <button className="pb-close" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div className="pb-stats-row">
          {p.runs>0&&<div className="pb-stat"><span className="pb-stat-val">{p.runs}</span><span className="pb-stat-label">Runs</span></div>}
          {p.balls>0&&<div className="pb-stat"><span className="pb-stat-val">{p.balls}</span><span className="pb-stat-label">Balls</span></div>}
          {p.fours>0&&<div className="pb-stat"><span className="pb-stat-val">{p.fours}</span><span className="pb-stat-label">4s</span></div>}
          {p.sixes>0&&<div className="pb-stat"><span className="pb-stat-val">{p.sixes}</span><span className="pb-stat-label">6s</span></div>}
          {p.wickets>0&&<div className="pb-stat"><span className="pb-stat-val">{p.wickets}</span><span className="pb-stat-label">Wkts</span></div>}
          {p.overs_bowled>0&&<div className="pb-stat"><span className="pb-stat-val">{p.overs_bowled}</span><span className="pb-stat-label">Overs</span></div>}
          {effCatches>0&&<div className="pb-stat"><span className="pb-stat-val">{effCatches}</span><span className="pb-stat-label">Catches</span></div>}
        </div>
        <div className="pb-breakdown">
          <div className="pb-breakdown-title">Points Breakdown</div>
          {lines.map((l,i) => (
            <div key={i} className={`pb-line ${l.pts<0?'negative':''}`}>
              <span className="pb-line-label">{l.label}</span>
              {l.value && <span className="pb-line-value">{l.value}</span>}
              <span className={`pb-line-pts ${l.pts>0?'pos':l.pts<0?'neg':''}`}>{l.pts>0?'+':''}{l.pts}</span>
            </div>
          ))}
          {multiplier > 1 && (
            <div className="pb-line">
              <span className="pb-line-label">{p.is_captain ? 'Captain 2×' : 'Vice-Captain 1.5×'}</span>
              <span className={`pb-line-pts pos`}>×{multiplier}</span>
            </div>
          )}
          <div className="pb-total"><span>Total</span><span className="pb-total-pts">{displayTotal}</span></div>
        </div>
      </div>
    </>
  );
}
