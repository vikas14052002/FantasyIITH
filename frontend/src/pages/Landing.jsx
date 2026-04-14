import { useNavigate } from 'react-router-dom';
import { getUser } from '../lib/auth';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AdBanner from '../components/AdBanner';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ users: 0, teams: 0, matches: 0, leagues: 0 });

  useEffect(() => {
    if (user) { navigate('/leagues', { replace: true }); return; }
    supabase.rpc('get_public_stats').then(({ data }) => {
      if (data) setStats(data);
    }).catch(() => {});
  }, []);

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-emoji">🏏</span>
          <h1 className="hero-title">Play<span className="hero-accent">XI</span></h1>
          <p className="hero-subtitle">Fantasy Cricket for IPL 2026</p>
          <p className="hero-desc">
            Build your dream playing XI, compete with friends in private leagues, and track live fantasy points during every IPL match. Free to play, no real money involved.
          </p>
          <button className="btn btn-primary hero-cta" onClick={() => navigate('/login')}>
            Get Started — It's Free
          </button>
        </div>
      </section>

      {/* Live Stats */}
      <section className="landing-stats">
        <div className="landing-stat"><span className="landing-stat-num">{stats.users}+</span><span className="landing-stat-label">Players</span></div>
        <div className="landing-stat"><span className="landing-stat-num">{stats.teams}+</span><span className="landing-stat-label">Teams</span></div>
        <div className="landing-stat"><span className="landing-stat-num">{stats.matches}+</span><span className="landing-stat-label">Matches</span></div>
        <div className="landing-stat"><span className="landing-stat-num">{stats.leagues}+</span><span className="landing-stat-label">Leagues</span></div>
      </section>

      {/* How It Works */}
      <section className="landing-section">
        <h2 className="landing-heading">How It Works</h2>
        <div className="steps">
          <div className="step"><div className="step-num">1</div><h3>Pick 11 Players</h3><p>Choose your playing XI from both teams within a 100-credit budget. Pick wicket-keepers, batters, all-rounders, and bowlers strategically.</p></div>
          <div className="step"><div className="step-num">2</div><h3>Choose Captain & VC</h3><p>Your Captain earns 2x points and Vice-Captain earns 1.5x points. This is where the real strategy lies — pick wisely!</p></div>
          <div className="step"><div className="step-num">3</div><h3>Join a Private League</h3><p>Create your own league or join a friend's with an invite code. Compete head-to-head with people you know.</p></div>
          <div className="step"><div className="step-num">4</div><h3>Win with Fantasy Points</h3><p>Earn points based on real match performance — runs, wickets, catches, strike rate, economy rate. Every ball counts!</p></div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <h2 className="landing-heading">Features</h2>
        <div className="features">
          <div className="feature"><span className="feature-icon">📊</span><h3>Live Scoring</h3><p>Fantasy points update automatically during live IPL matches. Watch your rank change in real-time as players perform on the field.</p></div>
          <div className="feature"><span className="feature-icon">🔒</span><h3>Private Leagues</h3><p>No public contests or strangers. Play exclusively with your friends, classmates, or colleagues in invite-only leagues.</p></div>
          <div className="feature"><span className="feature-icon">⚔️</span><h3>1v1 Compare</h3><p>Compare your team head-to-head with any league member. See common players, different picks, captain choices, and point breakdowns.</p></div>
          <div className="feature"><span className="feature-icon">🏆</span><h3>Leaderboards</h3><p>Track cumulative standings across the entire IPL season. Match-wise and overall rankings with detailed point breakdowns per player.</p></div>
          <div className="feature"><span className="feature-icon">📱</span><h3>Mobile First</h3><p>Designed for phones. Fast, responsive, works on any browser — no app download required. Just open the link and play.</p></div>
          <div className="feature"><span className="feature-icon">🎯</span><h3>Dream11 Scoring</h3><p>Accurate fantasy points using the same rules as Dream11 — runs, boundaries, sixes, wickets, economy rate, strike rate, catches, and more.</p></div>
        </div>
      </section>

      <AdBanner />

      {/* Points Preview */}
      <section className="landing-section">
        <h2 className="landing-heading">Fantasy Points System</h2>
        <p className="landing-text">Points are calculated based on real match performance. Here's a quick overview of our T20 scoring system:</p>
        <div className="points-preview">
          <div className="pp-group">
            <h4>Batting</h4>
            <div className="pp-row"><span>Run scored</span><span className="pp-val green">+1</span></div>
            <div className="pp-row"><span>Boundary (4s)</span><span className="pp-val green">+4</span></div>
            <div className="pp-row"><span>Six</span><span className="pp-val green">+6</span></div>
            <div className="pp-row"><span>50 runs bonus</span><span className="pp-val green">+8</span></div>
            <div className="pp-row"><span>100 runs bonus</span><span className="pp-val green">+16</span></div>
            <div className="pp-row"><span>Duck penalty</span><span className="pp-val red">-2</span></div>
          </div>
          <div className="pp-group">
            <h4>Bowling</h4>
            <div className="pp-row"><span>Wicket</span><span className="pp-val green">+30</span></div>
            <div className="pp-row"><span>LBW/Bowled bonus</span><span className="pp-val green">+8</span></div>
            <div className="pp-row"><span>Maiden over</span><span className="pp-val green">+12</span></div>
            <div className="pp-row"><span>3 wicket bonus</span><span className="pp-val green">+4</span></div>
          </div>
          <div className="pp-group">
            <h4>Fielding</h4>
            <div className="pp-row"><span>Catch</span><span className="pp-val green">+8</span></div>
            <div className="pp-row"><span>Stumping</span><span className="pp-val green">+12</span></div>
            <div className="pp-row"><span>Run out</span><span className="pp-val green">+12</span></div>
          </div>
          <div className="pp-group">
            <h4>Multipliers</h4>
            <div className="pp-row"><span>Captain</span><span className="pp-val green">2x</span></div>
            <div className="pp-row"><span>Vice Captain</span><span className="pp-val green">1.5x</span></div>
          </div>
        </div>
        <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => navigate('/points')}>View Full Points System →</button>
      </section>

      {/* What is Fantasy Cricket */}
      <section className="landing-section">
        <h2 className="landing-heading">What is Fantasy Cricket?</h2>
        <p className="landing-text">
          Fantasy cricket is a strategy game where you build a virtual team of real cricket players before a match begins. As the actual match unfolds, your selected players earn fantasy points based on their real-life performance — runs scored, wickets taken, catches held, and more. The better your players perform on the field, the more points your fantasy team earns.
        </p>
        <p className="landing-text">
          PlayXI brings this experience to private groups. Unlike large-scale fantasy platforms where you compete against millions of strangers, PlayXI is designed for small, intimate leagues — your college friends, office colleagues, or family WhatsApp group. Create a league, share the invite code, and compete with people you actually know. The bragging rights are what make it fun.
        </p>
        <p className="landing-text">
          Every IPL 2026 match is supported with automatic squad updates, live score tracking, and real-time fantasy point calculations. You pick your 11 players within a credit budget, choose a Captain (2x points) and Vice-Captain (1.5x points), and watch the leaderboard shift as the match progresses. After the match, compare your team with friends to see who made the smarter picks.
        </p>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>Ready to Play?</h2>
        <p>Join thousands of cricket fans playing fantasy cricket on PlayXI</p>
        <button className="btn btn-primary hero-cta" onClick={() => navigate('/login')}>
          Start Playing Now
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-links">
          <a href="/about">About</a>
          <a href="/guide">Fantasy Guide</a>
          <a href="/points">Points System</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </div>
        <p className="footer-disclaimer">PlayXI is not affiliated with IPL, BCCI, or any cricket board. This is a free fantasy sports platform for entertainment purposes only. No real money is involved.</p>
        <p className="footer-copy">© 2026 PlayXI. All rights reserved.</p>
      </footer>
    </div>
  );
}
