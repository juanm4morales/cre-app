interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
}

export function Skeleton({ className = '', height, width }: SkeletonProps) {
  return (
    <div
      className={`skeleton-loader ${className}`}
      style={{
        height: height || undefined,
        width: width || undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 4, cols = 4, label = 'Cargando datos...' }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div className="skeleton-table-wrapper" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`th-${i}`} height="1.2rem" className="skeleton-th" />
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="skeleton-tr">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`td-${r}-${c}`} height="1rem" className="skeleton-td" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="skeleton-card" aria-label="Cargando tarjeta...">
      <Skeleton height="1.5rem" width="40%" className="mb-2" />
      <Skeleton height="1rem" width="70%" className="mb-4" />
      <Skeleton height="2.5rem" width="100%" />
    </div>
  );
}

export default Skeleton;
