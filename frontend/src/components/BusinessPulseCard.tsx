import { useEffect, useState } from "react";
import { api } from "../services/api";

interface MonitorResult {
  pulse: "positive" | "stable" | "negative";
  summary: string;
  recommendations: string[];
  kpi_snapshot: Record<string, unknown>;
  alert_count: number;
  source: string;
}

interface Props {
  fileId: string;
}

const PULSE_CONFIG = {
  positive: {
    label: "Strong Growth",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    icon: "📈",
    gradient: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))",
  },
  stable: {
    label: "Stable",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
    icon: "📊",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))",
  },
  negative: {
    label: "Needs Attention",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    icon: "⚠️",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.05))",
  },
};

export default function BusinessPulseCard({ fileId }: Props) {
  const [data, setData] = useState<MonitorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api
      .get(`/business-monitor/${fileId}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) {
    return (
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          marginBottom: 24,
          animation: "shimmer 1.5s infinite",
        }}
      >
        <div
          style={{
            height: 20,
            width: "40%",
            background: "var(--border)",
            borderRadius: 6,
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 14,
            width: "80%",
            background: "var(--border)",
            borderRadius: 4,
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  const cfg = PULSE_CONFIG[data.pulse] ?? PULSE_CONFIG.stable;
  const kpis = data.kpi_snapshot ?? {};

  return (
    <div
      style={{
        background: cfg.gradient,
        border: `1px solid ${cfg.border}`,
        borderRadius: 14,
        padding: "20px 24px",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative ring */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `${cfg.color}08`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{cfg.icon}</span>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "0.72rem",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Business Pulse
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: cfg.color,
              }}
            >
              {cfg.label}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data.alert_count > 0 && (
            <span
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {data.alert_count} alert{data.alert_count !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              background: "none",
              border: `1px solid ${cfg.border}`,
              borderRadius: 8,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: "0.78rem",
              color: cfg.color,
              fontWeight: 600,
            }}
          >
            {expanded ? "Less" : "Details"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "0.9rem",
          color: "var(--text)",
          lineHeight: 1.6,
        }}
      >
        {data.summary}
      </p>

      {/* KPI mini-strip */}
      {(kpis.total_revenue || kpis.mom_growth_pct !== undefined) && (
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: expanded ? 16 : 0,
            padding: "10px 0",
            borderTop: `1px solid ${cfg.border}`,
          }}
        >
          {!!kpis.total_revenue && (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Total Revenue
              </p>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text)",
                }}
              >
                {Number(kpis.total_revenue).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          )}
          {kpis.mom_growth_pct !== undefined && (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                MoM Growth
              </p>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color:
                    Number(kpis.mom_growth_pct) > 0
                      ? "#22c55e"
                      : Number(kpis.mom_growth_pct) < 0
                      ? "#ef4444"
                      : "var(--text)",
                }}
              >
                {Number(kpis.mom_growth_pct) > 0 ? "+" : ""}
                {Number(kpis.mom_growth_pct).toFixed(1)}%
              </p>
            </div>
          )}
          {!!kpis.top_region && (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Top Region
              </p>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text)",
                }}
              >
                {String(kpis.top_region)}
              </p>
            </div>
          )}
          {!!kpis.top_product && (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Top Product
              </p>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text)",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {String(kpis.top_product)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expanded recommendations */}
      {expanded && data.recommendations.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${cfg.border}`,
            paddingTop: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            AI Recommendations
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {data.recommendations.map((rec, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  fontSize: "0.85rem",
                  color: "var(--text)",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}>
                  →
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
