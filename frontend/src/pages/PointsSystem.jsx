import { useNavigate } from 'react-router-dom';
import './PointsSystem.css';

const sections = [
  {
    title: 'Batting',
    rules: [
      ['Run', '+1'],
      ['Boundary Bonus (4s)', '+4'],
      ['Six Bonus', '+6'],
      ['25 Run Bonus', '+4'],
      ['50 Run Bonus', '+8'],
      ['75 Run Bonus', '+12'],
      ['100 Run Bonus', '+16'],
      ['Dismissal for a Duck', '-2', 'BAT, WK, AR only'],
    ],
  },
  {
    title: 'Strike Rate (Except Bowlers)',
    subtitle: 'Min 10 balls to be played',
    rules: [
      ['Above 170 runs per 100 balls', '+6'],
      ['Between 150.01 - 170', '+4'],
      ['Between 130 - 150', '+2'],
      ['Between 60 - 70', '-2'],
      ['Between 50 - 59.99', '-4'],
      ['Below 50', '-6'],
    ],
  },
  {
    title: 'Bowling',
    rules: [
      ['Wicket (excl. run out)', '+30'],
      ['Bonus (LBW / Bowled)', '+8'],
      ['3 Wicket Bonus', '+4'],
      ['4 Wicket Bonus', '+8'],
      ['5 Wicket Bonus', '+12'],
      ['Maiden Over', '+12'],
      ['Dot Ball', '+1'],
    ],
  },
  {
    title: 'Economy Rate',
    subtitle: 'Min 2 overs to be bowled',
    rules: [
      ['Below 5 runs per over', '+6'],
      ['Between 5 - 5.99', '+4'],
      ['Between 6 - 7', '+2'],
      ['Between 10 - 11', '-2'],
      ['Between 11.01 - 12', '-4'],
      ['Above 12', '-6'],
    ],
  },
  {
    title: 'Fielding',
    rules: [
      ['Catch', '+8'],
      ['3 Catch Bonus', '+4'],
      ['Stumping', '+12'],
      ['Run Out (Direct Hit)', '+12'],
      ['Run Out (Not Direct)', '+6'],
    ],
  },
  {
    title: 'Other',
    rules: [
      ['In Playing XI', '+4'],
      ['Captain', '2x total points'],
      ['Vice Captain', '1.5x total points'],
    ],
  },
];

export default function PointsSystem() {
  const navigate = useNavigate();

  return (
    <div className="pts-page">
      <div className="pts-header">
        <button className="pts-back" onClick={() => navigate(-1)}>←</button>
        <span className="pts-title">Points System</span>
        <div style={{ width: 32 }} />
      </div>

      <div className="pts-content">
        <div className="pts-badge-row">
          <span className="pts-badge">T20</span>
          <span className="pts-badge">IPL 2026</span>
        </div>

        {sections.map(section => (
          <div key={section.title} className="pts-section">
            <div className="pts-section-header">
              <span className="pts-section-title">{section.title}</span>
              {section.subtitle && <span className="pts-section-sub">{section.subtitle}</span>}
            </div>
            {section.rules.map(([label, value, note], i) => (
              <div key={i} className="pts-rule">
                <div className="pts-rule-label">
                  {label}
                  {note && <span className="pts-rule-note">{note}</span>}
                </div>
                <span className={`pts-rule-value ${value.startsWith('-') ? 'negative' : 'positive'}`}>
                  {value.startsWith('-') || value.startsWith('+') ? value : value} pts
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
