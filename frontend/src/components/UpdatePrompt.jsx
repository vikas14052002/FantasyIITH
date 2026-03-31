import { useState, useEffect } from 'react';

const CHECK_INTERVAL = 120000; // check every 2 min

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Get the main entry JS filename hash from current page
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
          setUpdateAvailable(true);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="update-banner" onClick={() => window.location.reload()}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      New update available — tap to refresh
    </div>
  );
}

// Extract the hash from the main index JS file (e.g. "index-DqqousuV" → "DqqousuV")
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
