import { useState, useEffect } from 'react';

const CHECK_INTERVAL = 60000; // check every 60s

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Store the current script hash on mount
    const currentScripts = getScriptHashes();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(window.location.origin + '/', { cache: 'no-store' });
        const html = await res.text();
        // Extract script src hashes from fresh HTML
        const freshScripts = getScriptHashesFromHTML(html);
        if (freshScripts.length > 0 && currentScripts.length > 0) {
          const changed = freshScripts.some(s => !currentScripts.includes(s));
          if (changed) setUpdateAvailable(true);
        }
      } catch { /* ignore network errors */ }
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

function getScriptHashes() {
  return Array.from(document.querySelectorAll('script[src]'))
    .map(s => s.src)
    .filter(s => s.includes('/assets/'));
}

function getScriptHashesFromHTML(html) {
  const matches = html.match(/\/assets\/[^"']+\.js/g);
  return matches || [];
}
