import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalysisData } from "../types";

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

const BarCard = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <div className="chart-card">
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} width={60} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxis} width={54} />
        <Tooltip formatter={formatTooltipValue} />
        <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const PieCard = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <div className="chart-card">
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={52}
          outerRadius={88}
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={formatTooltipValue} />
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

const LineCard = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <div className="chart-card">
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxis} width={54} />
        <Tooltip formatter={formatTooltipValue} />
        <Line type="monotone" dataKey="value" stroke="#4f46e5" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default function Charts({ data }: { data?: AnalysisData["chart_data"] }) {
  if (!data) return <p>No chart data available.</p>;

  const charts: JSX.Element[] = [];

  // Time series
  if (data.time_series && data.time_series.length > 0) {
    const tsData = data.time_series.map((p) => ({ name: p.month, value: p.value }));
    const label = data.time_series_meta
      ? `${data.time_series_meta.value_column} over time`
      : "Trend over time";
    charts.push(<LineCard key="time-series" title={label} data={tsData} />);
  }

  // Breakdowns (bar/pie per categorical column)
  if (data.breakdowns) {
    const bdEntries = Object.entries(data.breakdowns).slice(0, 4);
    bdEntries.forEach(([col, bd], i) => {
      if (!bd.data || bd.data.length === 0) return;
      const normalized = bd.data.map((p) => ({
        name: String(p.name),
        value: safeNumber(p.value) ?? 0,
      }));
      const title = bd.value_column ? `${bd.value_column} by ${col}` : col;
      if (i === 0 && normalized.length <= 8) {
        charts.push(<PieCard key={`bd-${col}`} title={title} data={normalized} />);
      } else {
        charts.push(<BarCard key={`bd-${col}`} title={title} data={normalized} />);
      }
    });
  }

  // Distributions
  if (data.distributions) {
    Object.entries(data.distributions).slice(0, 3).forEach(([col, dist]) => {
      if (!dist || dist.length === 0) return;
      const distData = dist.map((b) => ({ name: b.range, value: b.count }));
      charts.push(<BarCard key={`dist-${col}`} title={`${col} distribution`} data={distData} />);
    });
  }

  // KPI means fallback
  const means = (data.kpi_means || []).map((p) => ({
    name: String(p.name),
    value: safeNumber(p.value) ?? 0,
  }));
  if (means.length > 0) {
    charts.push(<BarCard key="kpi-means" title="Column averages" data={means} />);
  }

  if (charts.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No chart data was generated. Upload a file with numeric columns to see charts.
      </p>
    );
  }

  return <div className="charts-grid">{charts}</div>;
}
