import { useEffect } from 'react';

const CHECK_INTERVAL = 120000; // check every 2 min

export default function UpdatePrompt() {
  useEffect(() => {
    const currentHash = getCurrentBuildHash();
    if (!currentHash) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/?_check=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Accept': 'text/html' },
        });
        const html = await res.text();
        const freshHash = getBuildHashFromHTML(html);
        if (freshHash && freshHash !== currentHash) {
          clearInterval(interval);
          // Silent reload — only if user is not actively interacting
          // (no form focus, no modal open, no scrolling)
          if (!document.querySelector('input:focus, select:focus, textarea:focus')) {
            window.location.reload();
          } else {
            // If user is busy, wait and reload when they blur
            const onBlur = () => {
              window.removeEventListener('blur', onBlur);
              document.removeEventListener('visibilitychange', onVisChange);
              window.location.reload();
            };
            const onVisChange = () => {
              if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', onVisChange);
                window.removeEventListener('blur', onBlur);
                window.location.reload();
              }
            };
            // Reload when user switches back to tab or blurs input
            window.addEventListener('blur', onBlur);
            document.addEventListener('visibilitychange', onVisChange);
          }
        }
      } catch { /* ignore */ }
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return null; // No visible UI
}

function getCurrentBuildHash() {
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const s of scripts) {
    const match = s.src.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
    if (match) return match[1];
  }
  return null;
}

function getBuildHashFromHTML(html) {
  const match = html.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
  return match ? match[1] : null;
}
