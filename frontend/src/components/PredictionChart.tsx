import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import type { ColumnPrediction, PredictionsResponse } from "../types";
import { fetchPredictions } from "../services/api";

interface Props {
  fileId: string;
}

function buildChartData(pred: ColumnPrediction) {
  const historical = pred.historical.map(h => ({
    period: h.period,
    actual: h.actual,
    fitted: h.fitted,
    forecast: null as number | null,
    ci_upper: null as number | null,
    ci_lower: null as number | null,
    type: "historical",
  }));

  const forecasted = pred.forecast.map(f => ({
    period: f.period,
    actual: null as number | null,
    fitted: null as number | null,
    forecast: f.forecast,
    ci_upper: f.ci_upper,
    ci_lower: f.ci_lower,
    type: "forecast",
  }));

  return [...historical, ...forecasted];
}

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="pred-tooltip">
      <div className="pred-tooltip-period">{String(label)}</div>
      {(payload as Array<{name: string; value: number; color: string}>).map((p, i) => (
        p.value !== null && p.value !== undefined && (
          <div key={i} className="pred-tooltip-row" style={{ color: p.color }}>
            <span>{p.name}:</span>
            <span>{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )
      ))}
    </div>
  );
};

export default function PredictionChart({ fileId }: Props) {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCol, setActiveCol] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPredictions(fileId)
      .then(res => {
        setData(res.data);
        const cols = Object.keys(res.data.predictions);
        if (cols.length > 0) setActiveCol(cols[0]);
      })
      .catch(() => setError("Forecasting requires numeric columns with sufficient data."))
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) return (
    <div className="section-card">
      <div className="loading-skeleton">
        <div className="loading-row" />
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

  const cols = Object.keys(data.predictions);
  if (cols.length === 0) return (
    <div className="section-card">
      <p style={{ color: "var(--muted)" }}>No forecasts available. {data.errors?.[0]}</p>
    </div>
  );

  const pred = activeCol && data.predictions[activeCol] ? data.predictions[activeCol] : data.predictions[cols[0]];
  const chartData = buildChartData(pred);
  const isUp = pred.trend_direction === "upward";

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Predictive Analytics</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
            {data.summary}
          </p>
        </div>
        <span
          className="industry-badge"
          style={{
            background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: isUp ? "#4ade80" : "#f87171",
            border: `1px solid ${isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {isUp ? "↑" : "↓"} {pred.trend_pct_per_period > 0 ? "+" : ""}{pred.trend_pct_per_period}% per period
        </span>
      </div>

      {/* Column selector */}
      {cols.length > 1 && (
        <div className="pred-col-tabs">
          {cols.map(col => (
            <button
              key={col}
              className={`insights-filter-btn ${activeCol === col ? "insights-filter-btn--active" : ""}`}
              onClick={() => setActiveCol(col)}
            >
              {data.predictions[col].label}
            </button>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="pred-kpi-row">
        <div className="pred-kpi-item">
          <span className="pred-kpi-label">Model Accuracy (R²)</span>
          <span className="pred-kpi-value">{(pred.r2_score * 100).toFixed(1)}%</span>
        </div>
        <div className="pred-kpi-item">
          <span className="pred-kpi-label">Forecast Horizon</span>
          <span className="pred-kpi-value">{pred.horizon_periods} periods</span>
        </div>
        <div className="pred-kpi-item">
          <span className="pred-kpi-label">Trend</span>
          <span className="pred-kpi-value" style={{ color: isUp ? "#4ade80" : "#f87171" }}>
            {isUp ? "📈 Upward" : "📉 Downward"}
          </span>
        </div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ height: 340, marginTop: 16 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis
              dataKey="period"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />

            {/* Confidence interval area */}
            <Area
              type="monotone"
              dataKey="ci_upper"
              stroke="none"
              fill="rgba(99,102,241,0.12)"
              name="CI Upper"
              legendType="none"
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="ci_lower"
              stroke="none"
              fill="rgba(99,102,241,0.12)"
              name="CI Lower"
              legendType="none"
              connectNulls={false}
            />

            {/* Actual data */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              name="Actual"
              connectNulls={false}
            />

            {/* Fitted trend */}
            <Line
              type="monotone"
              dataKey="fitted"
              stroke="rgba(99,102,241,0.5)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name="Model Fit"
              connectNulls={false}
            />

            {/* Forecast */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#a78bfa"
              strokeWidth={2.5}
              strokeDasharray="8 4"
              dot={{ r: 4, fill: "#a78bfa" }}
              name="Forecast"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      <p className="pred-disclaimer">
        Forecasts use polynomial regression on historical patterns. Confidence interval at 95% (±1.96σ).
      </p>
    </div>
  );
}
