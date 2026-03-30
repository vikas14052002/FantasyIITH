import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUser } from '../lib/auth';

export default function JoinLeague() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');

    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .single();

    if (!league) { setError('Invalid invite code'); setLoading(false); return; }

    // Check if already a member
    const { data: existing } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      navigate(`/leagues/${league.id}`);
      return;
    }

    // Check member count
    const { count } = await supabase
      .from('league_members')
      .select('id', { count: 'exact' })
      .eq('league_id', league.id);

    if (count >= league.max_members) { setError('League is full'); setLoading(false); return; }

    await supabase.from('league_members').insert({ league_id: league.id, user_id: user.id });
    navigate(`/leagues/${league.id}`);
  };

  return (
    <div className="page fade-in">
      <h1 className="page-title">Join League</h1>
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          className="input"
          placeholder="Enter invite code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
          maxLength={6}
          autoFocus
        />
        {error && <p style={{ color: 'var(--coral)', fontSize: 12, textAlign: 'center' }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={code.length < 6 || loading}>
          {loading ? 'Joining...' : 'JOIN LEAGUE'}
        </button>
      </form>
    </div>
  );
}
