import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

function normalize(items: unknown[], valueKey: string): { name: string; value: number }[] {
  return (items as Record<string, unknown>[]).map((item) => ({
    name: String(item.name ?? ""),
    value: safeNumber(item[valueKey]) ?? 0,
  }));
}

export default function Charts({ data }: { data?: Record<string, unknown[]> }) {
  if (!data) return <p>No chart data available.</p>;

  const means = normalize(data.kpi_means || [], "value");
  const productMix = normalize(data.product_mix || [], "value");
  const salesByRegion = normalize(data.sales_by_region || [], "value");
  const salesBySalesman = normalize(data.sales_by_salesman || [], "value");
  const quantityDist = (data.quantity_distribution || []).map((item) => {
    const i = item as Record<string, unknown>;
    return { name: String(i.range ?? ""), value: safeNumber(i.count) ?? 0 };
  });

  const charts: JSX.Element[] = [];

  if (productMix.length > 0) charts.push(<PieCard key="product-mix" title="Product mix" data={productMix} />);
  if (salesByRegion.length > 0) charts.push(<BarCard key="by-region" title="Revenue by region" data={salesByRegion} />);
  if (salesBySalesman.length > 0) charts.push(<BarCard key="by-salesman" title="Revenue by salesperson" data={salesBySalesman} />);
  if (quantityDist.length > 0) charts.push(<BarCard key="qty-dist" title="Quantity distribution" data={quantityDist} />);
  if (means.length > 0) charts.push(<BarCard key="kpi-means" title="Column averages" data={means} />);

  if (charts.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No chart data was generated. Upload a file with numeric columns to see charts.
      </p>
    );
  }

  return <div className="charts-grid">{charts}</div>;
}
