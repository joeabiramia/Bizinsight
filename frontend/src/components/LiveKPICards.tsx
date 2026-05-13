import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveKPIs } from "../services/api";
import type { LiveKPI } from "../types";

interface Props {
  fileId: string;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export default function LiveKPICards({ fileId, autoRefresh = false, refreshIntervalMs = 30000 }: Props) {
  const [kpis, setKpis] = useState<LiveKPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(autoRefresh);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadKPIs = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const res = await fetchLiveKPIs(fileId);
      setKpis(res.data.kpis || []);
      setLastUpdated(new Date());
    } catch {
      // silently fail for live updates
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(loadKPIs, refreshIntervalMs);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive, loadKPIs, refreshIntervalMs]);

  const formatValue = (kpi: LiveKPI) => {
    const isCurrency = ["revenue", "sales", "amount", "income", "value", "price"].some((k) =>
      kpi.metric.toLowerCase().includes(k)
    );
    return isCurrency
      ? `$${kpi.latest.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : kpi.latest.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isLive ? "#22c55e" : "#9ca3af",
              display: "inline-block",
              boxShadow: isLive ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {isLive ? `Live (refreshes every ${refreshIntervalMs / 1000}s)` : "Static snapshot"}
          </span>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: "var(--text-tertiary, #9ca3af)" }}>
              · Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="chip"
            onClick={loadKPIs}
            disabled={loading}
            style={{ fontSize: 12 }}
          >
            {loading ? "…" : "Refresh"}
          </button>
          <button
            className="chip"
            onClick={() => setIsLive(!isLive)}
            style={
              isLive
                ? { background: "#22c55e", color: "#fff", fontSize: 12 }
                : { fontSize: 12 }
            }
          >
            {isLive ? "Live ON" : "Go Live"}
          </button>
        </div>
      </div>

      {kpis.length === 0 && !loading ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No KPI data available.</p>
      ) : (
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <div key={kpi.metric} className="kpi-card" style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 12,
                  fontSize: 18,
                  color: kpi.trend === "up" ? "#22c55e" : "#ef4444",
                }}
              >
                {kpi.trend === "up" ? "↑" : "↓"}
              </div>
              <p className="kpi-label">{kpi.metric}</p>
              <p className="kpi-value">{formatValue(kpi)}</p>
              <p className="kpi-sub" style={{ color: kpi.trend === "up" ? "#22c55e" : "#ef4444" }}>
                {kpi.change_pct > 0 ? "+" : ""}{kpi.change_pct.toFixed(1)}% vs prev
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
