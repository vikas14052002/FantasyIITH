import './Skeleton.css';

export function SkeletonText({ width = '100%', height, size = 'md', style }) {
  const cls = size === 'sm' ? 'skeleton-text-sm' : size === 'lg' ? 'skeleton-text-lg' : 'skeleton-text';
  return <div className={`skeleton ${cls}`} style={{ width, ...style }} aria-hidden="true" />;
}

export function SkeletonCircle({ size = 36, style }) {
  return <div className="skeleton skeleton-circle" style={{ width: size, height: size, ...style }} aria-hidden="true" />;
}

export function SkeletonCard({ style }) {
  return (
    <div className="skeleton skeleton-card" style={style} aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonCircle />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonText width="60%" />
          <SkeletonText width="40%" size="sm" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ style }) {
  return (
    <div className="skeleton-row" style={style} aria-hidden="true">
      <SkeletonCircle />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonText width="55%" />
        <SkeletonText width="35%" size="sm" />
      </div>
      <SkeletonText width="40px" style={{ flexShrink: 0 }} />
    </div>
  );
}

export function SkeletonHeader({ style }) {
  return (
    <div className="skeleton skeleton-header" style={style} aria-hidden="true">
      <SkeletonText width="50%" size="lg" />
      <SkeletonText width="30%" size="sm" />
      <SkeletonText width="40%" />
    </div>
  );
}

export function SkeletonTabs({ count = 3 }) {
  return (
    <div className="skeleton-tabs" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-tab" />
      ))}
    </div>
  );
}

export function LeaguesSkeleton() {
  return (
    <div className="skeleton-container" role="status" aria-live="polite" aria-label="Loading leagues">
      <span className="sr-only">Loading leagues...</span>
      <SkeletonText width="40%" size="lg" style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="skeleton" style={{ flex: 1, height: 52, borderRadius: 'var(--radius)' }} />
        <div className="skeleton" style={{ flex: 1, height: 52, borderRadius: 'var(--radius)' }} />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function LeagueDetailSkeleton() {
  return (
    <div className="skeleton-container" role="status" aria-live="polite" aria-label="Loading league details">
      <span className="sr-only">Loading league details...</span>
      <SkeletonHeader />
      <SkeletonTabs count={2} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

export function MatchDetailSkeleton() {
  return (
    <div className="skeleton-container" role="status" aria-live="polite" aria-label="Loading match details">
      <span className="sr-only">Loading match details...</span>
      <SkeletonHeader style={{ minHeight: 120 }} />
      <SkeletonTabs count={3} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

export function PageLoaderSkeleton() {
  return (
    <div className="skeleton-page-loader" role="status" aria-live="polite" aria-label="Loading page">
      <span className="sr-only">Loading...</span>
      <SkeletonHeader />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
