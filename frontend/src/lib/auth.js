import { supabase } from './supabase';

export async function loginWithName(name, password) {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) throw new Error('Name is required');
  if (!password) throw new Error('Password is required');

  // Check if user exists
  const { data: exists } = await supabase
    .from('users')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();

  if (exists) {
    // Existing user — verify password via secure DB function
    const { data, error } = await supabase.rpc('login_user', {
      p_name: trimmed,
      p_password: password,
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Incorrect password');

    const user = data[0];
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } else {
    // New user — register via secure DB function (hashes password server-side)
    const { data, error } = await supabase.rpc('register_user', {
      p_name: trimmed,
      p_password: password,
      p_email: null,
    });

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        throw new Error('Name already taken');
      }
      throw error;
    }
    if (!data || data.length === 0) throw new Error('Registration failed');

    const user = data[0];
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }
}

export function getUser() {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

export function logout() {
  localStorage.removeItem('user');
}

export async function updateProfile(userId, newName, newPassword) {
  const trimmed = newName.trim().toLowerCase();
  if (!trimmed) throw new Error('Name is required');

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('name', trimmed)
    .neq('id', userId)
    .maybeSingle();

  if (existing) throw new Error('Name already taken');

  const { data, error } = await supabase
    .from('users')
    .update({ name: trimmed })
    .eq('id', userId)
    .select('id, name, avatar_color, created_at')
    .single();

  if (error) throw error;

  if (newPassword) {
    await supabase.rpc('update_user_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    });
  }

  localStorage.setItem('user', JSON.stringify(data));
  return data;
}
