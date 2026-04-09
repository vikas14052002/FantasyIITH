import { useState, useEffect, useRef } from 'react';

export default function AnimatedNumber({ value, duration = 600, className, style }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = typeof value === 'number' ? value : 0;
    if (from === to) return;

    const start = performance.now();
    const diff = to - from;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        setDisplay(Math.round(from + diff * eased));
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to); // exact value — no rounding
        prevRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  const formatted = Number.isInteger(display) ? display : display.toFixed(1);
  return <span className={className} style={style}>{formatted}</span>;
}
