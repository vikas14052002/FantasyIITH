import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', color: 'var(--text-primary)', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>About PlayXI</h1>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <p>PlayXI is a fantasy cricket platform built for private leagues during the Indian Premier League (IPL). Unlike commercial fantasy sports platforms that focus on paid contests with millions of players, PlayXI is designed for small, intimate groups — your college friends, office colleagues, hostel mates, or family members.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Our Story</h2>
        <p>PlayXI was born out of a WhatsApp group argument about who picks the best IPL teams. We realized there was no simple, free tool for friends to compete in fantasy cricket without dealing with real money, complex apps, or public contests. So we built one.</p>
        <p>What started as a weekend project for a group of friends at IIT Hyderabad has grown into a platform used by cricket fans across India. The focus has always been on simplicity, fun, and friendly competition.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>What Makes PlayXI Different</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li><strong>100% Free</strong> — No entry fees, no real money, no hidden charges</li>
          <li><strong>Private Leagues Only</strong> — Compete with people you know, not strangers</li>
          <li><strong>Dream11-Accurate Scoring</strong> — Same fantasy points system used by major platforms</li>
          <li><strong>Live Score Integration</strong> — Points update automatically during matches</li>
          <li><strong>Mobile First</strong> — Works on any phone browser, no app download needed</li>
          <li><strong>1v1 Comparison</strong> — Compare teams head-to-head with any league member</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Technical Details</h2>
        <p>PlayXI is built with modern web technologies — React for the frontend, Supabase for the backend, and Firebase for authentication. Live match data is sourced from publicly available cricket scorecards and processed through our fantasy scoring engine that implements the complete Dream11 T20 scoring system including strike rate brackets, economy rate brackets, milestone bonuses, and fielding points.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Disclaimer</h2>
        <p>PlayXI is not affiliated with, endorsed by, or connected to the Indian Premier League (IPL), Board of Control for Cricket in India (BCCI), Dream11, or any IPL franchise team. All team names, player names, and logos are the property of their respective owners. PlayXI is an independent, fan-built platform for entertainment purposes only.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Contact Us</h2>
        <p>Have feedback, suggestions, or questions? Reach out to us:</p>
        <p>Email: <a href="mailto:playxi.fantasy@gmail.com" style={{ color: 'var(--red-primary)' }}>playxi.fantasy@gmail.com</a></p>
      </div>
    </div>
  );
}
