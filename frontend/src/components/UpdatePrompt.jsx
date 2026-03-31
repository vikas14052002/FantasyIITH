import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function UpdatePrompt() {
  const initialVersion = useRef(null);

  useEffect(() => {
    // Get current version on mount
    supabase.from('app_config').select('value').eq('key', 'build_version').single()
      .then(({ data }) => {
        if (data) initialVersion.current = data.value;
      });

    // Listen for changes via Realtime
    const channel = supabase
      .channel('app-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_config',
        filter: 'key=eq.build_version',
      }, (payload) => {
        const newVersion = payload.new?.value;
        if (initialVersion.current && newVersion && newVersion !== initialVersion.current) {
          // Silent reload
          if (!document.querySelector('input:focus, select:focus, textarea:focus')) {
            window.location.reload();
          } else {
            const reload = () => window.location.reload();
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') reload();
            }, { once: true });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null;
}
