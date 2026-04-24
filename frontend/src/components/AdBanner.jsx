import { useEffect, useRef } from 'react';

const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === 'true';

export default function AdBanner({ style = {} }) {
  const containerRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!ADS_ENABLED || loaded.current || !containerRef.current) return;
    loaded.current = true;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-aa', '2434012');
    iframe.src = '//acceptable.a-ads.com/2434012/?size=728x90';
    iframe.style.cssText = 'border:0; padding:0; width:100%; height:90px; overflow:hidden;';
    containerRef.current.appendChild(iframe);
  }, []);

  if (!ADS_ENABLED) return null;

  return (
    <div
      ref={containerRef}
      className="ad-banner"
      style={{
        margin: '12px 0',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        minHeight: 50,
        display: 'flex',
        justifyContent: 'center',
        ...style,
      }}
    />
  );
}
