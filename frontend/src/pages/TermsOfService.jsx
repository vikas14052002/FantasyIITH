import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', color: 'var(--text-primary)', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Last updated: April 2026</p>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>1. Acceptance of Terms</h2>
        <p>By accessing or using PlayXI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>2. Description of Service</h2>
        <p>PlayXI is a free fantasy cricket platform that allows users to create virtual cricket teams, join private leagues, and earn fantasy points based on real IPL match performances. PlayXI is a game of skill, not chance. No real money is wagered, won, or lost on the platform. There are no entry fees, prize pools, or financial transactions of any kind.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>3. Account Registration</h2>
        <p>To use PlayXI, you must register with a valid phone number. You are responsible for maintaining the security of your account credentials. You must provide accurate information and must not create accounts for the purpose of spamming, abusing, or manipulating the platform. Each individual is permitted one account only.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>4. User Conduct</h2>
        <p>You agree not to:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Create multiple accounts to gain unfair advantage</li>
          <li>Use automated tools or bots to interact with the Service</li>
          <li>Attempt to manipulate leaderboards or fantasy point calculations</li>
          <li>Share offensive, abusive, or inappropriate content through team names, league names, or usernames</li>
          <li>Reverse engineer, decompile, or attempt to extract source code from the Service</li>
          <li>Use the Service for any illegal or unauthorized purpose</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>5. Fantasy Teams and Scoring</h2>
        <p>Teams must be submitted before the match deadline (match start time). Once a match begins, teams are locked and cannot be edited. Fantasy points are calculated based on actual match data sourced from publicly available cricket scorecard data. While we strive for accuracy, PlayXI does not guarantee the completeness or precision of fantasy point calculations. Points calculations are final and binding.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>6. Intellectual Property</h2>
        <p>PlayXI and its original content, features, and functionality are owned by the PlayXI team. Player names, team names, and logos belong to their respective owners (IPL, BCCI, franchise teams). PlayXI uses publicly available match data for fantasy scoring purposes under fair use.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>7. Disclaimer</h2>
        <p>PlayXI is provided "as is" without warranties of any kind, express or implied. We do not guarantee uninterrupted, secure, or error-free operation. PlayXI is not affiliated with, endorsed by, or connected to the Indian Premier League (IPL), Board of Control for Cricket in India (BCCI), or any IPL franchise. This is an independent fan-built platform for entertainment purposes only.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>8. Limitation of Liability</h2>
        <p>In no event shall PlayXI or its creators be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Since no monetary transactions occur on the platform, there is no financial liability.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>9. Termination</h2>
        <p>We reserve the right to suspend or terminate your account at any time for violations of these terms or for any other reason at our discretion. You may also delete your account at any time by contacting us.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>10. Changes to Terms</h2>
        <p>We may modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the revised terms.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>11. Governing Law</h2>
        <p>These terms are governed by the laws of India. Any disputes arising from the use of PlayXI shall be subject to the exclusive jurisdiction of courts in Hyderabad, India.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>12. Contact</h2>
        <p>For questions about these terms, contact: <a href="mailto:playxi.fantasy@gmail.com" style={{ color: 'var(--red-primary)' }}>playxi.fantasy@gmail.com</a></p>
      </div>
    </div>
  );
}
