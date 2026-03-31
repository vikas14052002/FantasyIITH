import { supabase } from './supabase';
import { getUser } from './auth';

let intervalId = null;

export function startHeartbeat() {
  if (intervalId) return;

  function ping() {
    const user = getUser();
    if (!user) return;
    supabase.from('sessions').insert({
      user_id: user.id,
      user_name: user.name,
      page: window.location.pathname,
    }).then(() => {});
  }

  // Ping immediately on start
  ping();

  // Then every 30 seconds
  intervalId = setInterval(ping, 30000);

  // Ping on visibility change (tab focus)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ping();
  });
}

export function stopHeartbeat() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
