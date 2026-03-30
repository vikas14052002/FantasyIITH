import { supabase } from './supabase';

const AVATAR_COLORS = [
  '#D91E36', '#0698A7', '#4CAF50', '#FFC107', '#2196F3',
  '#E91E63', '#9C27B0', '#FF5722', '#00BCD4', '#8BC34A',
];

export async function loginWithName(name, password) {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) throw new Error('Name is required');
  if (!password) throw new Error('Password is required');

  // Try to find existing user
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('name', trimmed)
    .single();

  if (user) {
    // Existing user — check password
    if (!user.password) {
      // Legacy user without password — set it now
      await supabase.from('users').update({ password }).eq('id', user.id);
    } else if (user.password !== password) {
      throw new Error('Incorrect password');
    }
  } else {
    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: trimmed,
        password,
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      })
      .select()
      .single();

    if (error) throw error;
    user = data;
  }

  // Don't store password in localStorage
  const { password: _, ...safeUser } = user;
  localStorage.setItem('user', JSON.stringify(safeUser));
  return safeUser;
}

export function getUser() {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

export function logout() {
  localStorage.removeItem('user');
}
