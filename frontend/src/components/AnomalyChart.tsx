import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import type { AnomaliesResponse } from "../types";
import { fetchAnomalies } from "../services/api";

interface Props {
  fileId: string;
}

const CustomTooltip = ({ active, payload }: Record<string, unknown>) => {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  const d = (payload as Array<{payload: {index: number; value: number; anomaly: boolean}}>)[0].payload;
  return (
    <div className="pred-tooltip">
      <div className="pred-tooltip-period">Row {d.index}</div>
      <div className="pred-tooltip-row" style={{ color: d.anomaly ? "#f87171" : "#94a3b8" }}>
        Value: {d.value.toLocaleString()}
      </div>
      {d.anomaly && <div style={{ color: "#f87171", fontSize: "0.8rem" }}>⚠ Anomaly detected</div>}
    </div>
  );
};

export default function AnomalyChart({ fileId }: Props) {
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCol, setActiveCol] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAnomalies(fileId)
      .then(res => {
        setData(res.data);
        const cols = Object.keys(res.data.chart_series);
        if (cols.length > 0) setActiveCol(cols[0]);
      })
      .catch(() => setError("Anomaly detection failed."))
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) return (
    <div className="section-card">
      <div className="loading-skeleton">
        <div className="loading-row" />
        <div className="loading-row" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="section-card">
      <p style={{ color: "var(--muted)" }}>{error}</p>
    </div>
  );

  const chartCols = Object.keys(data.chart_series);
  const chartPoints = activeCol && data.chart_series[activeCol]
    ? data.chart_series[activeCol].map(p => ({ ...p, fill: p.anomaly ? "#ef4444" : "#6366f1" }))
    : [];

  const colInfo = activeCol && data.column_anomalies[activeCol];

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Anomaly Detection</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{data.summary}</p>
        </div>
        {data.total_anomaly_rows > 0 ? (
          <span className="industry-badge" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
            ⚠ {data.total_anomaly_rows} anomalies
          </span>
        ) : (
          <span className="industry-badge" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
            ✓ No anomalies
          </span>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="pred-kpi-row" style={{ marginBottom: 16 }}>
        <div className="pred-kpi-item">
          <span className="pred-kpi-label">Anomaly Rate</span>
          <span className="pred-kpi-value">{data.anomaly_rate_pct}%</span>
        </div>
        <div className="pred-kpi-item">
          <span className="pred-kpi-label">Affected Columns</span>
          <span className="pred-kpi-value">{data.columns_with_anomalies}</span>
        </div>
        {colInfo && (
          <div className="pred-kpi-item">
            <span className="pred-kpi-label">Normal Mean</span>
            <span className="pred-kpi-value">
              {colInfo.normal_mean?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"}
            </span>
          </div>
        )}
      </div>

      {/* Column selector */}
      {chartCols.length > 1 && (
        <div className="pred-col-tabs">
          {chartCols.map(col => (
            <button
              key={col}
              className={`insights-filter-btn ${activeCol === col ? "insights-filter-btn--active" : ""}`}
              onClick={() => setActiveCol(col)}
            >
              {col}
            </button>
          ))}
        </div>
      )}

      {chartPoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ height: 280, marginTop: 12 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="index"
                name="Row"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
                label={{ value: "Row Index", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }}
              />
              <YAxis
                dataKey="value"
                name="Value"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={chartPoints} name={activeCol ?? ""}>
                {chartPoints.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} opacity={entry.anomaly ? 1 : 0.45} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      <div className="pred-legend-row">
        <span className="pred-legend-item">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#6366f1", marginRight: 5 }} />
          Normal
        </span>
        <span className="pred-legend-item">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#ef4444", marginRight: 5 }} />
          Anomaly (Z-score &gt; 2.5 or IQR outlier)
        </span>
      </div>
    </div>
  );
}
