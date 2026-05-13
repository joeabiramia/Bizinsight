import { useState } from "react";
import type { BusinessInsight, ExplainabilityData } from "../types";
import { explainInsight } from "../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PRIORITY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: "#dc2626", bg: "#fee2e2", border: "#dc2626" },
  high:     { color: "#ea580c", bg: "#fff7ed", border: "#ea580c" },
  medium:   { color: "#ca8a04", bg: "#fefce8", border: "#ca8a04" },
  low:      { color: "#16a34a", bg: "#f0fdf4", border: "#16a34a" },
};

const TYPE_ICONS: Record<string, string> = {
  risk: "⚠️",
  opportunity: "💡",
  performance: "📊",
  revenue: "💰",
};

interface Props {
  insight: BusinessInsight;
  index: number;
  fileId: string;
  mode?: string;
}

export default function ExplainableInsight({ insight, index, fileId, mode = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [explainData, setExplainData] = useState<ExplainabilityData | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  const priority = insight.priority || "medium";
  const pStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;

  const handleExplain = async () => {
    setShowExplain(true);
    setExpanded(true);
    if (explainData) return;
    setLoadingExplain(true);
    try {
      const res = await explainInsight(fileId, index, mode);
      setExplainData(res.data.explainability);
    } catch {
      // silently ignore
    } finally {
      setLoadingExplain(false);
    }
  };

  return (
    <div
      className={`insight-card insight-card--${insight.type}`}
      style={{ borderLeft: `4px solid ${pStyle.border}`, marginBottom: 12 }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>{TYPE_ICONS[insight.type] || "📌"}</span>
            <strong style={{ fontSize: 15 }}>{insight.title}</strong>
            <span
              className="tag"
              style={{ background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.color}`, fontSize: 11 }}
            >
              {priority.toUpperCase()}
            </span>
            {insight.confidence && (
              <span className="tag" style={{ fontSize: 11 }}>
                {insight.confidence} confidence
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-primary)", marginBottom: 4 }}>{insight.observation}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            className="chip"
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 12 }}
          >
            {expanded ? "Less" : "More"}
          </button>
          <button
            className="chip"
            onClick={handleExplain}
            style={{
              fontSize: 12,
              background: showExplain ? "var(--accent, #6366f1)" : undefined,
              color: showExplain ? "#fff" : undefined,
            }}
          >
            Why?
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border, #e5e7eb)" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            <strong>Interpretation:</strong> {insight.interpretation}
          </p>
          <p style={{ color: "#6366f1" }}>
            <strong>Action:</strong> {insight.action}
          </p>
          {insight.urgency && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>
              Urgency: <strong>{insight.urgency.replace("_", " ")}</strong>
            </p>
          )}
        </div>
      )}

      {/* Explainability Panel */}
      {showExplain && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            🔍 Why this insight?
          </h4>

          {loadingExplain ? (
            <div className="loading-pulse" style={{ height: 80 }} />
          ) : explainData ? (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>
                {explainData.reasoning}
              </p>

              {/* Source data stats */}
              {explainData.source_data.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Source Data Used:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {explainData.source_data.map((d) => (
                      <div
                        key={d.column}
                        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", minWidth: 140 }}
                      >
                        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{d.column}</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total: {d.total.toLocaleString()}</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Mean: {d.mean.toLocaleString()}</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>n = {d.count.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chart evidence */}
              {explainData.chart_evidence.map((chart, ci) => (
                <div key={ci} style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    {chart.y_axis} by {chart.x_axis}:
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chart.data.slice(0, 10)} margin={{ top: 0, right: 8, left: 0, bottom: 20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={((v: number) => v.toLocaleString()) as any} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chart.data.slice(0, 10).map((_, idx) => (
                          <Cell key={idx} fill={idx === 0 ? "#6366f1" : "#c7d2fe"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}

              {/* Confidence + freshness */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                <span className="chip">
                  Confidence: {explainData.confidence_level}
                </span>
                <span className="chip" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {explainData.data_freshness}
                </span>
                <span className="chip" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {explainData.row_count.toLocaleString()} rows analyzed
                </span>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Could not load explainability data.</p>
          )}
        </div>
      )}
    </div>
  );
}
