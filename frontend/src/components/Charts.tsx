import { useState } from "react";
import {
  Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AnalysisData } from "../types";
import { api } from "../services/api";

const PALETTE = ["#4f46e5", "#14b8a6", "#f59e0b", "#ec4899", "#38bdf8", "#a78bfa"];

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]+/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatTooltipValue(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Ask Your Chart Popover ────────────────────────────────────────────────────

interface AskChartPanelProps {
  fileId?: string;
  chartType: string;
  segmentLabel: string;
  segmentValue: number;
  metric: string;
  onClose: () => void;
}

function AskChartPanel({ fileId, chartType, segmentLabel, segmentValue, metric, onClose }: AskChartPanelProps) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchExplanation = async () => {
    if (!fileId || fetched) return;
    setLoading(true);
    try {
      const r = await api.post(`/ai-chat/${fileId}/chart-explain`, {
        chart_type: chartType,
        segment_label: segmentLabel,
        segment_value: segmentValue,
        metric,
      });
      setExplanation(r.data.explanation);
      setFetched(true);
    } catch {
      setExplanation("Could not generate explanation. Check your AI configuration.");
      setFetched(true);
    } finally { setLoading(false); }
  };

  // Auto-fetch on mount
  if (!fetched && !loading && fileId) { fetchExplanation(); }

  return (
    <div style={{
      position: "absolute", zIndex: 100, bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
      background: "var(--surface,#1e1e2e)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 12,
      padding: "14px 16px", minWidth: 260, maxWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6366f1", background: "rgba(99,102,241,0.12)", padding: "2px 8px", borderRadius: 20 }}>ASK AI</span>
          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{segmentLabel}</span>
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", padding: "2px 4px", lineHeight: 1 }}>×</button>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "var(--muted)" }}>
        Value: <strong style={{ color: "var(--text)" }}>{segmentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
      </p>
      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Analysing…</p>
      ) : (
        <p style={{ margin: 0, fontSize: "0.83rem", lineHeight: 1.6, color: "var(--text)" }}>{explanation}</p>
      )}
    </div>
  );
}

// ── Clickable bar cell ────────────────────────────────────────────────────────

interface ClickPayload { name: string; value: number; }

interface ClickableBarCardProps {
  title: string;
  data: { name: string; value: number }[];
  fileId?: string;
  metric?: string;
}

function ClickableBarCard({ title, data, fileId, metric }: ClickableBarCardProps) {
  const [active, setActive] = useState<ClickPayload | null>(null);
  return (
    <div className="chart-card" style={{ position: "relative" }}>
      <div className="chart-card-title">{title}</div>
      {active && fileId && (
        <AskChartPanel fileId={fileId} chartType="bar" segmentLabel={active.name} segmentValue={active.value} metric={metric ?? title} onClose={() => setActive(null)} />
      )}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} width={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxis} width={54} />
          <Tooltip formatter={formatTooltipValue as never} />
          <Bar dataKey="value" radius={[6,6,0,0]} maxBarSize={48} cursor="pointer"
            onClick={(d) => { const name = String(d.name ?? ""); const val = Number(d.value ?? 0); setActive(a => a?.name === name ? null : { name, value: val }); }}>
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={active?.name === entry.name ? "#8b5cf6" : "#4f46e5"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {fileId && <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--muted)", textAlign: "center" }}>Click a bar to ask AI</p>}
    </div>
  );
}

function ClickablePieCard({ title, data, fileId, metric }: ClickableBarCardProps) {
  const [active, setActive] = useState<ClickPayload | null>(null);
  return (
    <div className="chart-card" style={{ position: "relative" }}>
      <div className="chart-card-title">{title}</div>
      {active && fileId && (
        <AskChartPanel fileId={fileId} chartType="pie" segmentLabel={active.name} segmentValue={active.value} metric={metric ?? title} onClose={() => setActive(null)} />
      )}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3}
            onClick={(d) => { const name = String(d.name ?? ""); const val = Number(d.value ?? 0); setActive(a => a?.name === name ? null : { name, value: val }); }}
            cursor="pointer">
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={active?.name === entry.name ? "#8b5cf6" : PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={formatTooltipValue as never} />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      {fileId && <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--muted)", textAlign: "center" }}>Click a slice to ask AI</p>}
    </div>
  );
}

const LineCard = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <div className="chart-card">
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxis} width={54} />
        <Tooltip formatter={formatTooltipValue as never} />
        <Line type="monotone" dataKey="value" stroke="#4f46e5" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export default function Charts({ data, fileId }: { data?: AnalysisData["chart_data"]; fileId?: string }) {
  if (!data) return <p>No chart data available.</p>;

  const charts: JSX.Element[] = [];

  if (data.time_series && data.time_series.length > 0) {
    const tsData = data.time_series.map((p) => ({ name: p.month, value: p.value }));
    const label = data.time_series_meta ? `${data.time_series_meta.value_column} over time` : "Trend over time";
    charts.push(<LineCard key="time-series" title={label} data={tsData} />);
  }

  if (data.breakdowns) {
    const bdEntries = Object.entries(data.breakdowns).slice(0, 4);
    bdEntries.forEach(([col, bd], i) => {
      if (!bd.data || bd.data.length === 0) return;
      const normalized = bd.data.map((p) => ({ name: String(p.name), value: safeNumber(p.value) ?? 0 }));
      const title = bd.value_column ? `${bd.value_column} by ${col}` : col;
      const metric = bd.value_column ?? col;
      if (i === 0 && normalized.length <= 8) {
        charts.push(<ClickablePieCard key={`bd-${col}`} title={title} data={normalized} fileId={fileId} metric={metric} />);
      } else {
        charts.push(<ClickableBarCard key={`bd-${col}`} title={title} data={normalized} fileId={fileId} metric={metric} />);
      }
    });
  }

  if (data.distributions) {
    Object.entries(data.distributions).slice(0, 3).forEach(([col, dist]) => {
      if (!dist || dist.length === 0) return;
      const distData = dist.map((b) => ({ name: b.range, value: b.count }));
      charts.push(<ClickableBarCard key={`dist-${col}`} title={`${col} distribution`} data={distData} fileId={fileId} metric={col} />);
    });
  }

  const means = (data.kpi_means || []).map((p) => ({ name: String(p.name), value: safeNumber(p.value) ?? 0 }));
  if (means.length > 0) {
    charts.push(<ClickableBarCard key="kpi-means" title="Column averages" data={means} fileId={fileId} metric="average" />);
  }

  if (charts.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No chart data was generated. Upload a file with numeric columns to see charts.</p>;
  }

  return <div className="charts-grid">{charts}</div>;
}
