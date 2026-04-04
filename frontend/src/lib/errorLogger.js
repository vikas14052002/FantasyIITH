import { supabase } from './supabase';

export async function logError(action, error, extra = {}) {
  try {
    await supabase.from('error_logs').insert({
      user_name: extra.userName || null,
      phone: extra.phone || null,
      action,
      error_code: error?.code || null,
      error_message: error?.message || String(error),
      page: window.location.pathname,
    });
  } catch {
    // Don't throw if logging fails
  }
}
