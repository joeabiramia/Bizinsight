import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart2, Download, X, Maximize2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

export interface NLChartData {
  chart_type: "bar" | "line" | "pie" | "horizontal_bar";
  title: string;
  x_label?: string;
  y_label?: string;
  data: Array<{ name: string; value: number; [key: string]: string | number }>;
  summary: string;
  insight?: string;
}

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#8b5cf6","#ec4899","#84cc16"];

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
};

function ChartRenderer({ chart, height = 240 }: { chart: NLChartData; height?: number }) {
  if (chart.chart_type === "bar" || chart.chart_type === "horizontal_bar") {
    const isHorizontal = chart.chart_type === "horizontal_bar";
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chart.data} layout={isHorizontal ? "vertical" : "horizontal"}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-alt)" />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
            </>
          )}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
            {chart.data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-alt)" />
          <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "pie") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ResponsiveContainer width={180} height={height}>
          <PieChart>
            <Pie data={chart.data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {chart.data.slice(0, 6).map((item, i) => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], display: "inline-block", flexShrink: 0 }} />
                <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
              </div>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

interface NLChartProps {
  chart: NLChartData;
  onClose?: () => void;
}

export default function NLChart({ chart, onClose }: NLChartProps) {
  const [expanded, setExpanded] = useState(false);

  const downloadChart = () => {
    const data = JSON.stringify(chart.data, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chart.title.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 14,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Chart header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart2 size={14} style={{ color: "var(--primary-light)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{chart.title}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="button button-ghost button-sm" style={{ padding: "4px 8px" }} onClick={downloadChart} title="Download data">
            <Download size={12} />
          </button>
          <button type="button" className="button button-ghost button-sm" style={{ padding: "4px 8px" }} onClick={() => setExpanded(!expanded)} title="Expand">
            <Maximize2 size={12} />
          </button>
          {onClose && (
            <button type="button" className="button button-ghost button-sm" style={{ padding: "4px 8px" }} onClick={onClose} title="Close">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Chart body */}
      <div style={{ padding: "16px" }}>
        <ChartRenderer chart={chart} height={expanded ? 320 : 220} />
      </div>

      {/* Summary + insight */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{chart.summary}</p>
        {chart.insight && (
          <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--primary-light)", lineHeight: 1.5 }}>
            💡 {chart.insight}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Helper to detect if an AI answer should generate a chart
export function detectChartRequest(question: string): boolean {
  const chartKeywords = /show|chart|graph|plot|visualize|bar chart|line chart|pie chart|compare|trend|distribution|breakdown/i;
  return chartKeywords.test(question);
}

// Generate chart data from AI response text + analysis context
export function buildChartFromResponse(
  question: string,
  chartData: Record<string, Array<{ name: string; value: number }>>
): NLChartData | null {
  if (!chartData) return null;

  const q = question.toLowerCase();

  // Pick the right chart data based on question
  let data: Array<{ name: string; value: number }> | null = null;
  let title = "Data Visualization";
  let chartType: NLChartData["chart_type"] = "bar";

  if (q.includes("month") || q.includes("trend") || q.includes("over time")) {
    const monthKey = Object.keys(chartData).find(k => k.includes("month") || k.includes("revenue"));
    if (monthKey) { data = chartData[monthKey]; title = "Trend Over Time"; chartType = "line"; }
  } else if (q.includes("region") || q.includes("location") || q.includes("country")) {
    const regionKey = Object.keys(chartData).find(k => k.includes("region") || k.includes("location") || k.includes("country"));
    if (regionKey) { data = chartData[regionKey]; title = "By Region"; chartType = "horizontal_bar"; }
  } else if (q.includes("product") || q.includes("category")) {
    const prodKey = Object.keys(chartData).find(k => k.includes("product") || k.includes("category"));
    if (prodKey) { data = chartData[prodKey]; title = "By Product/Category"; chartType = "bar"; }
  } else if (q.includes("type") || q.includes("distribution") || q.includes("breakdown")) {
    const typeKey = Object.keys(chartData).find(k => k.includes("type") || k.includes("status"));
    if (typeKey) { data = chartData[typeKey]; title = "Distribution Breakdown"; chartType = "pie"; }
  }

  // Fallback: use the first available chart data
  if (!data && Object.keys(chartData).length > 0) {
    const firstKey = Object.keys(chartData)[0];
    data = chartData[firstKey];
    title = `${firstKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`;
  }

  if (!data || data.length === 0) return null;

  return {
    chart_type: chartType,
    title,
    data: data.slice(0, 10),
    summary: `Showing top ${Math.min(data.length, 10)} entries for "${title}".`,
    insight: `Top entry: ${data[0]?.name} with ${data[0]?.value?.toLocaleString()}`,
  };
}
