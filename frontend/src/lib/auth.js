import { supabase } from './supabase';

const AVATAR_COLORS = [
  '#D91E36', '#0698A7', '#4CAF50', '#FFC107', '#2196F3',
  '#E91E63', '#9C27B0', '#FF5722', '#00BCD4', '#8BC34A',
];

// Phone + OTP login: find or create user by phone number
export async function loginWithPhone(phone, name) {
  const trimmed = phone.replace(/\s/g, '');
  if (!trimmed) throw new Error('Phone number is required');

  // Check if phone exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, avatar_color, phone, created_at')
    .eq('phone', trimmed)
    .maybeSingle();

  if (existing) {
    localStorage.setItem('user', JSON.stringify(existing));
    return existing;
  } else {
    // New user — create with phone + name
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const userName = name || 'Player_' + trimmed.slice(-4);
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: userName.trim().toLowerCase(),
        phone: trimmed,
        avatar_color: color,
      })
      .select('id, name, avatar_color, phone, created_at')
      .single();

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        throw new Error('Name already taken, try a different one');
      }
      throw error;
    }
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  }
}

// Link phone to existing account using old name+password (for migration)
export async function linkPhoneToExisting(oldName, oldPassword, phone) {
  const trimmed = oldName.trim().toLowerCase();

  // Verify old credentials
  const { data, error } = await supabase.rpc('login_user', {
    p_name: trimmed,
    p_password: oldPassword,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Incorrect username or password');

  const user = data[0];

  // Check if phone already taken by someone else
  const { data: phoneTaken } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .neq('id', user.id)
    .maybeSingle();

  if (phoneTaken) throw new Error('This phone is already linked to another account');

  // Link phone
  const { data: updated, error: updateErr } = await supabase
    .from('users')
    .update({ phone })
    .eq('id', user.id)
    .select('id, name, avatar_color, phone, created_at')
    .single();

  if (updateErr) throw updateErr;
  localStorage.setItem('user', JSON.stringify(updated));
  return updated;
}

// Link phone to existing logged-in user (for popup migration)
export async function linkPhone(userId, phone) {
  const trimmed = phone.replace(/\s/g, '');

  // Check if phone already taken
  const { data: taken } = await supabase
    .from('users')
    .select('id')
    .eq('phone', trimmed)
    .neq('id', userId)
    .maybeSingle();

  if (taken) throw new Error('This phone number is already linked to another account');

  const { data, error } = await supabase
    .from('users')
    .update({ phone: trimmed })
    .eq('id', userId)
    .select('id, name, avatar_color, phone, created_at')
    .single();

  if (error) throw error;
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}

// Legacy name+password login (kept for backward compat during migration)
export async function loginWithName(name, password) {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) throw new Error('Name is required');
  if (!password) throw new Error('Password is required');

  const { data: exists } = await supabase
    .from('users')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();

  if (exists) {
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
    const { data, error } = await supabase.rpc('register_user', {
      p_name: trimmed,
      p_password: password,
      p_email: null,
    });
    if (error) throw error;
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

export function needsPhoneLink() {
  const user = getUser();
  return user && !user.phone;
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
    .select('id, name, avatar_color, phone, created_at')
    .single();

  if (error) throw error;
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}
