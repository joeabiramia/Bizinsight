interface LoadingSkeletonProps {
  rows?: number;
  /** Show card-style blocks instead of inline rows */
  variant?: "rows" | "cards" | "metric";
  cols?: number;
}

export default function LoadingSkeleton({ rows = 4, variant = "rows", cols = 3 }: LoadingSkeletonProps) {
  if (variant === "metric") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="metric-card" style={{ minHeight: 100 }}>
            <div className="loading-row" style={{ width: "60%", marginBottom: 12 }} />
            <div className="loading-row" style={{ width: "40%", height: 28 }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="section-card" style={{ minHeight: 140 }}>
            <div className="loading-row" style={{ width: "70%", marginBottom: 10 }} />
            <div className="loading-row" style={{ width: "90%", marginBottom: 8 }} />
            <div className="loading-row" style={{ width: "50%" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="loading-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="loading-row"
          style={{ width: i % 3 === 0 ? "100%" : i % 3 === 1 ? "85%" : "70%" }}
        />
      ))}
    </div>
  );
}
