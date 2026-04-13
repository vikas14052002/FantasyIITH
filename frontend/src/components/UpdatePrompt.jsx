import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function UpdatePrompt() {
  const initialVersion = useRef(null);

  useEffect(() => {
    async function checkVersion() {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'build_version')
        .single();
      if (!data) return;

      if (!initialVersion.current) {
        initialVersion.current = data.value;
        return;
      }

      if (data.value !== initialVersion.current) {
        if (!document.querySelector('input:focus, select:focus, textarea:focus')) {
          window.location.reload();
        } else {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') window.location.reload();
          }, { once: true });
        }
      }
    }

    // Delay first check so it doesn't compete with page load
    const initial = setTimeout(checkVersion, 5000);
    const interval = setInterval(checkVersion, 60 * 60 * 1000); // every 1 hour

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return null;
}
