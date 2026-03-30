import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateLeague() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const navigate = useNavigate();
  const user = getUser();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const inviteCode = generateCode();
    const { data: league, error } = await supabase
      .from('leagues')
      .insert({ name: name.trim(), invite_code: inviteCode, created_by: user.id })
      .select()
      .single();

    if (error) { alert(error.message); setLoading(false); return; }

    // Auto-join creator
    await supabase.from('league_members').insert({ league_id: league.id, user_id: user.id });

    setCreated(league);
    setLoading(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join my Fantasy League!', text: `Join "${created.name}" on FantasyIITH! Code: ${created.invite_code}` });
    } else {
      navigator.clipboard.writeText(created.invite_code);
      alert('Code copied!');
    }
  };

  if (created) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ marginBottom: 8 }}>League Created!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{created.name}</p>
        <div className="card" style={{ marginBottom: 24, padding: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>INVITE CODE</p>
          <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4 }}>{created.invite_code}</p>
        </div>
        <button className="btn btn-primary" onClick={handleShare} style={{ marginBottom: 12 }}>Share Code</button>
        <button className="btn btn-outline" onClick={() => navigate('/leagues')}>Back to Leagues</button>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title">Create League</h1>
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input className="input" placeholder="League name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <button className="btn btn-primary" type="submit" disabled={!name.trim() || loading}>
          {loading ? 'Creating...' : 'CREATE LEAGUE'}
        </button>
      </form>
    </div>
  );
}
