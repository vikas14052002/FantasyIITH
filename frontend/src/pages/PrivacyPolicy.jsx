import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', color: 'var(--text-primary)', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Last updated: April 2026</p>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>1. Information We Collect</h2>
        <p>When you use PlayXI, we collect the following information:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li><strong>Phone number</strong> — used for account verification via OTP (Firebase Authentication)</li>
          <li><strong>Display name</strong> — chosen by you, visible to other league members</li>
          <li><strong>Team selections</strong> — your fantasy team picks, captain/vice-captain choices</li>
          <li><strong>Usage data</strong> — pages visited, time spent, features used (anonymous analytics)</li>
          <li><strong>Device information</strong> — browser type, screen size (for responsive design optimization)</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>2. How We Use Your Information</h2>
        <p>Your information is used to:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Create and manage your PlayXI account</li>
          <li>Enable participation in fantasy cricket leagues</li>
          <li>Calculate and display fantasy points and leaderboards</li>
          <li>Enable team comparison features between league members</li>
          <li>Improve the platform based on usage patterns</li>
          <li>Send important notifications about matches and deadlines</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>3. Third-Party Services</h2>
        <p>PlayXI uses the following third-party services:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li><strong>Supabase</strong> — database hosting and API (stores your account data and team selections)</li>
          <li><strong>Firebase Authentication</strong> — phone number verification via OTP</li>
          <li><strong>Google AdSense</strong> — may display personalized advertisements. Google uses cookies to serve ads based on your prior visits to this or other websites. You can opt out of personalized advertising at <a href="https://www.google.com/settings/ads" style={{ color: 'var(--red-primary)' }}>Google Ads Settings</a>.</li>
          <li><strong>Vercel</strong> — web hosting and content delivery</li>
          <li><strong>Cricbuzz</strong> — cricket match data and player statistics (public data)</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>4. Cookies</h2>
        <p>PlayXI and its third-party partners (including Google AdSense) use cookies and similar technologies to:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Keep you logged in across sessions</li>
          <li>Remember your preferences</li>
          <li>Serve relevant advertisements</li>
          <li>Analyze site usage and performance</li>
        </ul>
        <p>You can control cookie settings through your browser preferences. Disabling cookies may affect some features of the platform.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>5. Data Storage and Security</h2>
        <p>Your data is stored securely on Supabase servers. We implement appropriate technical measures to protect your personal information against unauthorized access, alteration, or destruction. Phone numbers are used solely for authentication and are not shared with any third party except Firebase for OTP verification.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>6. Data Retention and Deletion</h2>
        <p>Your account data is retained as long as your account is active. You may request deletion of your account and associated data by contacting us. Upon deletion, your personal data will be removed from our systems within 30 days, except where retention is required by law.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>7. Children's Privacy</h2>
        <p>PlayXI is not intended for children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us for removal.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>8. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. You may also opt out of personalized advertising through Google's ad settings. For any privacy-related requests, contact us at the email below.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>9. Changes to This Policy</h2>
        <p>We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>10. Contact Us</h2>
        <p>For any questions about this privacy policy, contact us at: <a href="mailto:playxi.fantasy@gmail.com" style={{ color: 'var(--red-primary)' }}>playxi.fantasy@gmail.com</a></p>
      </div>
    </div>
  );
}
