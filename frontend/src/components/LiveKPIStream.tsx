import { useEffect, useRef, useState } from "react";
import { fetchLiveKPIs } from "../services/api";

interface KPI {
  metric: string;
  total: number;
  average: number;
  latest: number;
  trend: "up" | "down";
  change_pct: number;
}

interface Props {
  fileId: string;
  refreshInterval?: number;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function KPITile({ kpi, flash }: { kpi: KPI; flash: boolean }) {
  const isUp = kpi.trend === "up";
  const hasChange = kpi.change_pct !== 0;

  return (
    <div
      className="kpi-tile-live"
      style={{
        background: flash
          ? "var(--accent-subtle, rgba(99,102,241,0.08))"
          : "var(--surface, #1e1e2e)",
        border: "1px solid var(--border, #2d2d3d)",
        borderRadius: 12,
        padding: "16px 20px",
        transition: "background 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* live pulse dot */}
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#22c55e",
          boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
          animation: "livePulse 2s infinite",
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: "0.78rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {kpi.metric}
      </p>
      <p
        style={{
          margin: "6px 0 4px",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          lineHeight: 1,
        }}
      >
        {fmt(kpi.total)}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {hasChange && (
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: isUp ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(kpi.change_pct).toFixed(1)}%
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          avg {fmt(kpi.average)}
        </span>
      </div>
    </div>
  );
}

export default function LiveKPIStream({ fileId, refreshInterval = 30 }: Props) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [flashSet, setFlashSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const prevTotals = useRef<Record<string, number>>({});

  const refresh = () => {
    fetchLiveKPIs(fileId)
      .then((res) => {
        const fresh: KPI[] = res.data.kpis ?? [];
        const newFlash = new Set<string>();
        fresh.forEach((k) => {
          if (
            prevTotals.current[k.metric] !== undefined &&
            prevTotals.current[k.metric] !== k.total
          ) {
            newFlash.add(k.metric);
          }
          prevTotals.current[k.metric] = k.total;
        });
        setKpis(fresh);
        setFlashSet(newFlash);
        setLastUpdated(new Date());
        setSecondsAgo(0);
        setError("");
        if (newFlash.size > 0) {
          setTimeout(() => setFlashSet(new Set()), 1200);
        }
      })
      .catch(() => setError("Live KPI feed unavailable."));
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [fileId, refreshInterval]);

  // Tick seconds-ago counter
  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  if (error) return null;
  if (kpis.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#fff",
                display: "inline-block",
                animation: "livePulse 1.5s infinite",
              }}
            />
            LIVE
          </span>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            Real-Time KPI Stream
          </h3>
        </div>
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {lastUpdated
            ? secondsAgo < 5
              ? "Updated just now"
              : `Updated ${secondsAgo}s ago`
            : "Loading..."}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {kpis.map((kpi) => (
          <KPITile
            key={kpi.metric}
            kpi={kpi}
            flash={flashSet.has(kpi.metric)}
          />
        ))}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
