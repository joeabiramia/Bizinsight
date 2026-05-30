import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";

interface Alert {
  type: "risk" | "warning" | "opportunity";
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  recommended_action: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  fileId: string;
  refreshInterval?: number;
}

const TYPE_COLORS: Record<string, string> = {
  risk: "#ef4444",
  warning: "#f59e0b",
  opportunity: "#22c55e",
};

const SEVERITY_BG: Record<string, string> = {
  high: "rgba(239,68,68,0.08)",
  medium: "rgba(245,158,11,0.08)",
  low: "rgba(34,197,94,0.06)",
};

const TYPE_ICON: Record<string, string> = {
  risk: "⚠",
  warning: "ℹ",
  opportunity: "✦",
};

export default function AlertsPanel({ fileId, refreshInterval = 60 }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    api
      .get(`/alerts/${fileId}`)
      .then((res) => {
        setAlerts(res.data.alerts ?? []);
        setSummary(res.data.summary ?? {});
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fileId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [load, refreshInterval]);

  const dismiss = (index: number) =>
    setDismissed((prev) => new Set([...prev, index]));

  const visible = alerts.filter((_, i) => !dismissed.has(i));

  if (loading) return null;
  if (visible.length === 0) {
    return (
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.1rem" }}>✅</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>No Active Alerts</p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
              Business metrics are within normal ranges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            Business Alerts
          </h3>
          <span
            style={{
              background: summary.high_severity
                ? "rgba(239,68,68,0.15)"
                : "rgba(245,158,11,0.12)",
              color: summary.high_severity ? "#ef4444" : "#f59e0b",
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {visible.length} alert{visible.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {lastUpdated
            ? `${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => {
          const count = summary[type as keyof typeof summary] ?? 0;
          if (count === 0) return null;
          return (
            <span
              key={type}
              style={{
                background: `${color}18`,
                color,
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                border: `1px solid ${color}30`,
              }}
            >
              {TYPE_ICON[type]} {count} {type}
            </span>
          );
        })}
      </div>

      {/* Alert cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((alert, i) => {
          const color = TYPE_COLORS[alert.type] ?? "#94a3b8";
          return (
            <div
              key={i}
              style={{
                background: SEVERITY_BG[alert.severity] ?? "var(--surface)",
                border: `1px solid ${color}30`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 10,
                padding: "14px 16px",
                position: "relative",
              }}
            >
              <button
                onClick={() => dismiss(alerts.indexOf(alert))}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: 2,
                }}
                title="Dismiss"
              >
                ×
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  paddingRight: 24,
                }}
              >
                <span style={{ fontSize: "1rem", color, lineHeight: 1.2 }}>
                  {TYPE_ICON[alert.type]}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color: "var(--text)",
                      }}
                    >
                      {alert.title}
                    </p>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: "0.82rem",
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {alert.message}
                  </p>
                  <div
                    style={{
                      background: `${color}10`,
                      border: `1px solid ${color}20`,
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: "0.8rem",
                      color: "var(--text)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color,
                        marginRight: 4,
                        fontSize: "0.75rem",
                      }}
                    >
                      RECOMMENDED:
                    </span>
                    {alert.recommended_action}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
