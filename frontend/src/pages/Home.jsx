import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';
import MatchCard from '../components/MatchCard';
import './Home.css';

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('live');
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [matchRes, leagueRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_number', { ascending: false }),
      supabase.from('league_members').select('league_id, leagues(*)').eq('user_id', user.id),
    ]);
    setMatches(matchRes.data || []);
    setLeagues((leagueRes.data || []).map(lm => lm.leagues));
    setLoading(false);
  }

  const tabCounts = {
    upcoming: matches.filter(m => m.status === 'upcoming').length,
    live: matches.filter(m => m.status === 'live').length,
    completed: matches.filter(m => m.status === 'completed').length,
  };

  const filtered = matches.filter(m => m.status === activeTab).sort((a, b) => {
    if (activeTab === 'upcoming') return new Date(a.start_time) - new Date(b.start_time);
    return new Date(b.start_time) - new Date(a.start_time);
  });
  const firstLeague = leagues[0];

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="home-section">
        <div className="section-header">
          <h2 className="section-title">Matches</h2>
        </div>
        <div className="tabs">
          {['live', 'upcoming', 'completed'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tabCounts[tab] > 0 && <span className="tab-badge">{tabCounts[tab]}</span>}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏏</div>
            <p className="empty-text">No {activeTab} matches</p>
          </div>
        ) : (
          filtered.map(m => <MatchCard key={m.id} match={m} leagueId={firstLeague?.id} />)
        )}
      </div>

      <div className="home-section">
        <div className="section-header">
          <h2 className="section-title">My Leagues</h2>
          <button className="btn-link" onClick={() => navigate('/leagues')}>View All</button>
        </div>
        {leagues.length === 0 ? (
          <div className="card empty-league">
            <p className="empty-text">No leagues yet</p>
            <div className="league-actions">
              <button className="btn btn-primary" onClick={() => navigate('/leagues/create')}>Create League</button>
              <button className="btn btn-outline" onClick={() => navigate('/leagues/join')}>Join League</button>
            </div>
          </div>
        ) : (
          leagues.map(l => (
            <div key={l.id} className="card league-card" onClick={() => navigate(`/leagues/${l.id}`)}>
              <div className="league-card-info">
                <h3 className="league-card-name">{l.name}</h3>
                <p className="league-card-code">Code: {l.invite_code}</p>
              </div>
              <span className="league-card-arrow">→</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
