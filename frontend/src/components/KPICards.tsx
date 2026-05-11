import { NumericColumnSummary } from "../types";

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function KPICards({ data }: { data?: Record<string, NumericColumnSummary> }) {
  if (!data) return null;

  const entries = Object.entries(data).slice(0, 6);
  if (entries.length === 0) return <p>No KPI data available</p>;

  return (
    <div className="kpi-grid">
      {entries.map(([col, summary]) => (
        <div className="kpi-card" key={col}>
          <p className="kpi-label">{col}</p>
          <h3 className="kpi-value">{formatNumber(summary.total)}</h3>
          <p className="kpi-sub">avg {formatNumber(summary.mean)}</p>
        </div>
      ))}
    </div>
  );
}
