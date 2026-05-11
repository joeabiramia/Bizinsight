export default function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="loading-row" />
      ))}
    </div>
  );
}
