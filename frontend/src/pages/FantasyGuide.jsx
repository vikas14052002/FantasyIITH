import { useNavigate } from 'react-router-dom';
// import AdBanner from '../components/AdBanner';

export default function FantasyGuide() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', color: 'var(--text-primary)', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Fantasy Cricket Guide</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Everything you need to know about playing fantasy cricket on PlayXI</p>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>What is Fantasy Cricket?</h2>
        <p>Fantasy cricket is an online strategy game where participants create a virtual team of real-life cricket players. Before a match begins, you select a squad of 11 players from both competing teams within a specified credit budget. As the real match unfolds, your selected players earn fantasy points based on their actual on-field performance — runs scored, wickets taken, catches held, strike rates maintained, and more.</p>
        <p>The concept originated from fantasy baseball in the United States and has since become enormously popular in cricket-loving nations. During the IPL season, millions of fans participate in fantasy cricket, adding an extra layer of excitement to every delivery bowled and every boundary hit. Fantasy cricket transforms passive viewers into active participants who analyze player form, pitch conditions, and matchups to build the best possible team.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>How to Build a Winning IPL Fantasy Team</h2>
        <p>Building a successful fantasy cricket team requires a combination of cricket knowledge, statistical analysis, and strategic thinking. Here are the key principles that top fantasy players follow:</p>
        <p><strong>Study Recent Form:</strong> A player's performance in the last 3-5 matches is often more predictive than their career average. Look for batters who are scoring consistently and bowlers who are taking wickets regularly. A player in form is worth more than a big name having a quiet season.</p>
        <p><strong>Consider the Venue:</strong> Different IPL venues favor different types of players. Wankhede Stadium in Mumbai typically offers high-scoring matches favoring batters, while Chennai's Chepauk can assist spinners. Factor in the pitch conditions when selecting your team composition.</p>
        <p><strong>Balance Your Credits:</strong> You have 100 credits to build your 11-player team. Don't spend all your credits on expensive star players. Find value picks — affordable players who are likely to perform well. A balanced team with 3-4 premium picks and 7-8 value selections often outperforms an all-star team that lacks depth.</p>
        <p><strong>Watch the Toss:</strong> The toss can significantly impact player performance. Teams batting first on certain pitches might score more freely, while chasing teams on dew-affected evenings might have an advantage. If possible, finalize your team after the toss.</p>

        {/* <AdBanner /> */}

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Understanding Player Roles</h2>
        <p>In PlayXI, every player is classified into one of four roles. Your team must include players from each category within specified limits:</p>
        <p><strong>Wicket-Keepers (WK) — Pick 1 to 4:</strong> Wicket-keepers earn points for batting, catches, and stumpings. In T20 cricket, many keepers bat in the top order (like Rishabh Pant or Sanju Samson), making them excellent fantasy picks. A keeping batsman who opens or bats at number 3 can score big points from both batting and fielding contributions.</p>
        <p><strong>Batters (BAT) — Pick 3 to 6:</strong> Pure batters earn points primarily through runs, boundaries, and sixes. Look for consistent performers who bat in the top 4, as they face the most deliveries and have the highest chance of scoring big. Strike rate bonuses can add significant points for explosive batters.</p>
        <p><strong>All-Rounders (AR) — Pick 1 to 4:</strong> All-rounders are the most valuable fantasy picks because they contribute with both bat and ball. A player like Hardik Pandya or Ravindra Jadeja can score 30 runs and take 2 wickets in the same match, earning points in multiple categories. Premium all-rounders are worth their higher credit cost.</p>
        <p><strong>Bowlers (BOWL) — Pick 3 to 6:</strong> Bowlers earn points through wickets, maidens, dot balls, and economy rate bonuses. In T20s, death bowlers who bowl at the end often get more wickets. Economy rate below 7 earns bonus points, while an economy above 12 results in penalties. Select bowlers who can take wickets and maintain a tight line.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Captain and Vice-Captain Strategy</h2>
        <p>The Captain and Vice-Captain selections are the most impactful decisions in fantasy cricket. Your Captain earns 2x points on everything they do, while the Vice-Captain earns 1.5x. This means a Captain who scores 50 points effectively gives you 100 points — a massive swing.</p>
        <p><strong>Captain Selection Tips:</strong> Choose a player who is most likely to have a significant all-round impact. All-rounders who bat high in the order are ideal Captain picks because they contribute in multiple ways. If an opener is in red-hot form, they're a strong Captain choice because of the volume of balls they face. Avoid making a bowler your Captain unless they are a genuine all-rounder — bowlers have more inconsistent fantasy outputs.</p>
        <p><strong>Vice-Captain Strategy:</strong> Your Vice-Captain should be a safe, consistent pick — someone who reliably scores 30-50 fantasy points every match. While the Captain is your high-risk, high-reward pick, the Vice-Captain provides insurance with steady points multiplied by 1.5x.</p>
        <p><strong>Differential Picks:</strong> In private leagues, picking a different Captain than your opponents can be the key to winning. If everyone has Virat Kohli as Captain but you pick a less obvious choice who outperforms, you gain a massive advantage. Study what your league members might pick and consider going against the grain strategically.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Credits System Explained</h2>
        <p>Every player in PlayXI is assigned a credit value between 6.0 and 10.5 based on their perceived quality and recent form. Star players like Virat Kohli, Jasprit Bumrah, or Jos Buttler cost 9.5-10.5 credits, while emerging talents and lower-order specialists cost 6.5-7.5 credits.</p>
        <p>You have a total budget of 100 credits to select 11 players. Additionally, you can pick a maximum of 7 players from a single team — this prevents you from loading up entirely on one side and ensures you pick strategically from both competing teams.</p>
        <p>The credit system creates an interesting strategic challenge: you cannot simply pick the 11 best players because you'll exceed the budget. You must find the optimal combination of expensive premium picks and affordable value picks that maximizes your expected fantasy points within the 100-credit limit.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Frequently Asked Questions</h2>
        <p><strong>Is PlayXI free to use?</strong><br />Yes, completely free. There are no entry fees, no real money involved, and no hidden charges. PlayXI is designed for friendly competition only.</p>
        <p><strong>Can I edit my team after creating it?</strong><br />Yes, you can edit your team anytime before the match starts. Once the match begins, all teams are automatically locked.</p>
        <p><strong>How are points calculated?</strong><br />Points are calculated using Dream11-style T20 rules — including runs, boundaries, sixes, wickets, catches, economy rate, strike rate, and milestone bonuses. Visit our <a href="/points" style={{ color: 'var(--red-primary)' }}>Points System page</a> for the complete breakdown.</p>
        <p><strong>Can others see my team before the match?</strong><br />No. Teams are hidden until the match starts. Once the deadline passes, all teams become visible and you can compare with league members.</p>
        <p><strong>How do I join a league?</strong><br />Get an invite code from a friend who created a league, or create your own and share the code via WhatsApp, Instagram, or any messaging app.</p>
      </div>
    </div>
  );
}
