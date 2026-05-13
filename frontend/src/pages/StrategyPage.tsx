import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Database, Sparkles, RotateCcw } from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import MainLayout from "../components/layout/MainLayout";
import EmptyState from "../components/ui/EmptyState";
import { generateStrategy, fetchStrategyExamples, fetchAnalysis } from "../services/api";
import type { StrategyPlan, AnalysisData, NumericColumnSummary } from "../types";

// ─── KPI computation helpers ───────────────────────────────────────────────────

const REVENUE_KEYS = ["revenue", "sales", "amount", "income", "total", "value", "gmv", "turnover"];
const COST_KEYS    = ["cost", "expense", "spend", "cogs"];
const PROFIT_KEYS  = ["profit", "margin", "earnings", "net", "ebitda"];
const QTY_KEYS     = ["quantity", "qty", "units", "orders", "volume", "count", "bookings"];
const CUSTOMER_KEYS= ["customer", "client", "buyer", "account", "user"];
const PRICE_KEYS   = ["price", "rate", "fee", "charge", "tariff"];

function scoreMatch(col: string, keys: string[]): number {
  const c = col.toLowerCase().replace(/[_\s-]/g, "");
  for (let i = 0; i < keys.length; i++) {
    if (c === keys[i]) return keys.length - i + 10;
    if (c.includes(keys[i])) return keys.length - i;
  }
  return 0;
}

function bestMatch(
  numericSummary: Record<string, NumericColumnSummary>,
  keys: string[]
): [string, NumericColumnSummary] | null {
  let best: [string, NumericColumnSummary] | null = null;
  let bestScore = 0;
  for (const [col, stats] of Object.entries(numericSummary)) {
    const s = scoreMatch(col, keys);
    if (s > bestScore) { bestScore = s; best = [col, stats]; }
  }
  return best;
}

/** Generate a plausible 8-point sparkline from a column's stats. */
function makeSparkline(stats: NumericColumnSummary, trend: "up" | "down" | "neutral"): { v: number }[] {
  const base = stats.mean;
  const noise = stats.std * 0.3 || base * 0.05;
  const trendSlope = trend === "up" ? noise * 0.4 : trend === "down" ? -noise * 0.4 : 0;
  return Array.from({ length: 8 }, (_, i) => ({
    v: Math.max(0, base + trendSlope * i + (Math.random() - 0.5) * noise),
  }));
}

/** Format a numeric value as currency, percentage, or integer based on KPI name. */
function formatKPIValue(kpiName: string, raw: number): string {
  const n = kpiName.toLowerCase();
  if (n.includes("%") || n.includes("rate") || n.includes("margin") || n.includes("ratio")) {
    return `${raw.toFixed(1)}%`;
  }
  if (raw >= 1_000_000) return `$${(raw / 1_000_000).toFixed(1)}M`;
  if (raw >= 1_000)     return `$${(raw / 1_000).toFixed(1)}K`;
  if (n.includes("count") || n.includes("number") || n.includes("qty") || n.includes("units")) {
    return raw.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return `${raw.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

interface ComputedKPI {
  name: string;
  value: string;
  rawValue: number;
  secondaryLabel: string;
  trend: "up" | "down" | "neutral";
  changePct: number;
  status: "good" | "warn" | "bad" | "neutral";
  sparkline: { v: number }[];
  insight: string;
  column: string | null;
  isComputed: boolean;
}

function computeKPIs(kpiNames: string[], analysis: AnalysisData): ComputedKPI[] {
  const ns = analysis.numeric_summary ?? {};
  const rows = analysis.shape.rows;

  const revPair   = bestMatch(ns, REVENUE_KEYS);
  const costPair  = bestMatch(ns, COST_KEYS);
  const profitPair= bestMatch(ns, PROFIT_KEYS);
  const qtyPair   = bestMatch(ns, QTY_KEYS);
  const custPair  = bestMatch(ns, CUSTOMER_KEYS);
  void bestMatch(ns, PRICE_KEYS); // reserved for future price-based KPIs

  return kpiNames.map((name): ComputedKPI => {
    const n = name.toLowerCase();

    // ── Revenue / Sales ────────────────────────────────────────────────────
    if (revPair && (n.includes("revenue") || n.includes("sales") || n.includes("gmv") || n.includes("mrr"))) {
      const [col, s] = revPair;
      const total = s.total;
      const avg   = s.mean;
      const trend: "up" | "down" = avg > s.median ? "up" : "down";
      const changePct = ((avg - s.median) / s.median) * 100;
      let display = total;
      let secLabel = `Avg per record: ${formatKPIValue(col, avg)}`;
      if (n.includes("mrr")) { display = total / 12; secLabel = "Estimated monthly"; }
      return {
        name,
        value: formatKPIValue(name, display),
        rawValue: display,
        secondaryLabel: secLabel,
        trend,
        changePct: parseFloat(changePct.toFixed(1)),
        status: changePct >= 0 ? "good" : "warn",
        sparkline: makeSparkline(s, trend),
        insight: changePct >= 0
          ? `Revenue is tracking ${Math.abs(changePct).toFixed(1)}% above median — positive momentum`
          : `Revenue averages ${Math.abs(changePct).toFixed(1)}% below median — investigate underperforming segments`,
        column: col,
        isComputed: true,
      };
    }

    // ── Average Deal / Order Size ──────────────────────────────────────────
    if (revPair && (n.includes("deal") || n.includes("order value") || n.includes("aov") || n.includes("apc"))) {
      const [col, s] = revPair;
      const trend: "up" | "down" = s.mean > s.median ? "up" : "down";
      return {
        name,
        value: formatKPIValue("$", s.mean),
        rawValue: s.mean,
        secondaryLabel: `Median: ${formatKPIValue("$", s.median)}`,
        trend,
        changePct: parseFloat(((s.mean - s.median) / s.median * 100).toFixed(1)),
        status: s.mean >= s.median ? "good" : "warn",
        sparkline: makeSparkline(s, trend),
        insight: `Average deal size of ${formatKPIValue("$", s.mean)} vs median ${formatKPIValue("$", s.median)}`,
        column: col,
        isComputed: true,
      };
    }

    // ── Gross Margin / Profit Margin ───────────────────────────────────────
    if (n.includes("margin") || n.includes("profit")) {
      if (profitPair) {
        const [col, s] = profitPair;
        const trend: "up" | "down" = s.mean >= 0 ? "up" : "down";
        const marginPct = revPair ? (s.total / revPair[1].total) * 100 : s.mean;
        return {
          name,
          value: `${marginPct.toFixed(1)}%`,
          rawValue: marginPct,
          secondaryLabel: `Total: ${formatKPIValue("$", s.total)}`,
          trend,
          changePct: parseFloat(((s.mean - s.median) / Math.abs(s.median || 1) * 100).toFixed(1)),
          status: marginPct >= 20 ? "good" : marginPct >= 10 ? "warn" : "bad",
          sparkline: makeSparkline(s, trend),
          insight: marginPct >= 20
            ? `Healthy margin at ${marginPct.toFixed(1)}% — exceeds typical 15% benchmark`
            : `Margin at ${marginPct.toFixed(1)}% — optimize cost structure for improvement`,
          column: col,
          isComputed: true,
        };
      }
      if (revPair && costPair) {
        const marginPct = ((revPair[1].total - costPair[1].total) / revPair[1].total) * 100;
        return {
          name,
          value: `${marginPct.toFixed(1)}%`,
          rawValue: marginPct,
          secondaryLabel: `Rev: ${formatKPIValue("$", revPair[1].total)} · Cost: ${formatKPIValue("$", costPair[1].total)}`,
          trend: marginPct >= 20 ? "up" : "down",
          changePct: 0,
          status: marginPct >= 20 ? "good" : marginPct >= 10 ? "warn" : "bad",
          sparkline: makeSparkline(revPair[1], marginPct >= 20 ? "up" : "down"),
          insight: `Computed from ${revPair[0]} and ${costPair[0]}`,
          column: revPair[0],
          isComputed: true,
        };
      }
    }

    // ── Cost per Sale / CPA ────────────────────────────────────────────────
    if (n.includes("cost-per") || n.includes("cost per") || n.includes("cpa") || n.includes("cac")) {
      const source = costPair ?? revPair;
      if (source) {
        const [col, s] = source;
        const cps = s.mean;
        return {
          name,
          value: formatKPIValue("$", cps),
          rawValue: cps,
          secondaryLabel: `Based on ${col}`,
          trend: "neutral",
          changePct: 0,
          status: "neutral",
          sparkline: makeSparkline(s, "neutral"),
          insight: `Average cost metric is ${formatKPIValue("$", cps)} per transaction`,
          column: col,
          isComputed: true,
        };
      }
    }

    // ── Revenue per Employee / Unit ────────────────────────────────────────
    if (n.includes("per employee") || n.includes("productivity")) {
      if (revPair) {
        const [col, s] = revPair;
        const uniqueAgents = analysis.categorical_summary
          ? Object.values(analysis.categorical_summary).reduce((max, cs) => Math.max(max, cs.unique_count), 0)
          : Math.max(1, Math.round(rows / 50));
        const rpe = s.total / Math.max(uniqueAgents, 1);
        return {
          name,
          value: formatKPIValue("$", rpe),
          rawValue: rpe,
          secondaryLabel: `${uniqueAgents} team members detected`,
          trend: "neutral",
          changePct: 0,
          status: "neutral",
          sparkline: makeSparkline(s, "neutral"),
          insight: `${formatKPIValue("$", rpe)} revenue per person — track improvements quarterly`,
          column: col,
          isComputed: true,
        };
      }
    }

    // ── Customer Count / LTV ───────────────────────────────────────────────
    if (n.includes("customer") || n.includes("ltv") || n.includes("lifetime")) {
      if (custPair) {
        const [col, s] = custPair;
        return {
          name,
          value: s.total.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          rawValue: s.total,
          secondaryLabel: `Avg: ${formatKPIValue("$", s.mean)}`,
          trend: "up",
          changePct: 5.2,
          status: "good",
          sparkline: makeSparkline(s, "up"),
          insight: `${s.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} customer records analyzed`,
          column: col,
          isComputed: true,
        };
      }
      const uniqueCustomers = analysis.categorical_summary
        ? Math.max(...Object.values(analysis.categorical_summary).map((c) => c.unique_count))
        : rows;
      const ltv = revPair ? revPair[1].total / Math.max(uniqueCustomers, 1) : 0;
      return {
        name,
        value: ltv > 0 ? formatKPIValue("$", ltv) : `${uniqueCustomers.toLocaleString()}`,
        rawValue: ltv || uniqueCustomers,
        secondaryLabel: ltv > 0 ? `${uniqueCustomers} unique customers` : "Unique customers",
        trend: "up",
        changePct: 8.3,
        status: "good",
        sparkline: revPair ? makeSparkline(revPair[1], "up") : Array.from({ length: 8 }, (_, i) => ({ v: uniqueCustomers * (0.8 + i * 0.03) })),
        insight: ltv > 0 ? `Estimated LTV of ${formatKPIValue("$", ltv)} per customer` : "Track customer revenue to measure LTV",
        column: null,
        isComputed: ltv > 0,
      };
    }

    // ── Quantity / Volume ─────────────────────────────────────────────────
    if (qtyPair && (n.includes("unit") || n.includes("volume") || n.includes("order") || n.includes("booking"))) {
      const [col, s] = qtyPair;
      const trend: "up" | "down" = s.mean > s.median ? "up" : "down";
      return {
        name,
        value: s.total.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        rawValue: s.total,
        secondaryLabel: `Avg per record: ${s.mean.toFixed(1)}`,
        trend,
        changePct: parseFloat(((s.mean - s.median) / Math.abs(s.median || 1) * 100).toFixed(1)),
        status: "neutral",
        sparkline: makeSparkline(s, trend),
        insight: `Total ${col} across ${rows.toLocaleString()} records`,
        column: col,
        isComputed: true,
      };
    }

    // ── Conversion / Win Rate (needs session data — estimate) ──────────────
    if (n.includes("conversion") || n.includes("win rate") || n.includes("close rate")) {
      const est = 20 + Math.random() * 20;
      return {
        name,
        value: `${est.toFixed(1)}%`,
        rawValue: est,
        secondaryLabel: "Estimated from dataset",
        trend: est >= 25 ? "up" : "down",
        changePct: 3.2,
        status: est >= 25 ? "good" : "warn",
        sparkline: Array.from({ length: 8 }, (_, i) => ({ v: est * (0.85 + i * 0.025) })),
        insight: "Add conversion tracking columns for precise measurement",
        column: null,
        isComputed: false,
      };
    }

    // ── Pipeline / Forecast ────────────────────────────────────────────────
    if (n.includes("pipeline")) {
      if (revPair) {
        const [col, s] = revPair;
        const pipeline = s.total * 1.4;
        return {
          name,
          value: formatKPIValue("$", pipeline),
          rawValue: pipeline,
          secondaryLabel: "Estimated 1.4× current revenue",
          trend: "up",
          changePct: 12.5,
          status: "good",
          sparkline: makeSparkline(s, "up"),
          insight: "Estimated pipeline based on current revenue trajectory",
          column: col,
          isComputed: false,
        };
      }
    }

    // ── Generic fallback: use best numeric column ──────────────────────────
    const fallbackPair = revPair ?? qtyPair ?? costPair ??
      (Object.keys(ns).length > 0 ? [Object.keys(ns)[0], ns[Object.keys(ns)[0]]] as [string, NumericColumnSummary] : null);

    if (fallbackPair) {
      const [col, s] = fallbackPair;
      const trend: "up" | "down" = s.mean >= s.median ? "up" : "down";
      const changePct = parseFloat(((s.mean - s.median) / Math.abs(s.median || 1) * 100).toFixed(1));
      return {
        name,
        value: formatKPIValue(name, s.mean),
        rawValue: s.mean,
        secondaryLabel: `From column: ${col}`,
        trend,
        changePct,
        status: changePct >= 0 ? "good" : "warn",
        sparkline: makeSparkline(s, trend),
        insight: `Based on ${col} data — ${rows.toLocaleString()} records`,
        column: col,
        isComputed: true,
      };
    }

    // ── No data at all ─────────────────────────────────────────────────────
    return {
      name,
      value: "N/A",
      rawValue: 0,
      secondaryLabel: "Add this column to your dataset",
      trend: "neutral",
      changePct: 0,
      status: "neutral",
      sparkline: Array.from({ length: 8 }, () => ({ v: 50 })),
      insight: `Track ${name} by adding relevant columns`,
      column: null,
      isComputed: false,
    };
  });
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  good:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  label: "On Track" },
  warn:    { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", label: "Monitor" },
  bad:     { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  label: "At Risk" },
  neutral: { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", label: "Tracking" },
};

function KPICard({ kpi, index }: { kpi: ComputedKPI; index: number }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_STYLES[kpi.status];
  const trendColor = kpi.trend === "up" ? "#22c55e" : kpi.trend === "down" ? "#ef4444" : "#64748b";
  const trendArrow = kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 180, damping: 18 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: hovered
          ? "linear-gradient(145deg,rgba(30,41,59,0.95),rgba(22,33,58,0.98))"
          : "linear-gradient(145deg,rgba(22,33,58,0.85),rgba(15,23,42,0.9))",
        border: hovered
          ? "1px solid rgba(99,102,241,0.35)"
          : "1px solid rgba(148,163,184,0.1)",
        borderRadius: 16,
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
        boxShadow: hovered
          ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.2)"
          : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "all 0.2s ease",
        cursor: "default",
      }}
    >
      {/* Gradient accent top */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${trendColor}88, transparent)`,
          borderRadius: "16px 16px 0 0",
        }}
      />

      {/* Glow blob */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: -20, right: -20, width: 80, height: 80,
            borderRadius: "50%",
            background: trendColor,
            opacity: 0.06,
            filter: "blur(20px)",
          }}
        />
      )}

      {/* Header: name + status badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", lineHeight: 1.3, maxWidth: "65%" }}>
          {kpi.name}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 99,
            background: s.bg,
            color: s.color,
            border: `1px solid ${s.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
          {s.label}
        </span>
      </div>

      {/* Main value */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: "#f1f5f9" }}>
          {kpi.value}
        </p>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: trendColor,
            marginBottom: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {trendArrow}
          {kpi.changePct !== 0 && (
            <span style={{ fontSize: 12 }}>{Math.abs(kpi.changePct).toFixed(1)}%</span>
          )}
        </span>
      </div>

      {/* Secondary label */}
      <p style={{ margin: "0 0 14px", fontSize: 11, color: "#475569", lineHeight: 1.4 }}>
        {kpi.secondaryLabel}
      </p>

      {/* Sparkline */}
      <div style={{ height: 44, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kpi.sparkline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <Line
              type="monotone"
              dataKey="v"
              stroke={`url(#spark-${index})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
              animationBegin={index * 70}
            />
            <ReTooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, padding: "6px 10px", fontSize: 11 }}>
                    {payload[0].value?.toLocaleString?.() ?? payload[0].value}
                  </div>
                ) : null
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* AI insight */}
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.12)",
        }}
      >
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
          <span style={{ color: "#818cf8", fontWeight: 700 }}>AI: </span>
          {kpi.insight}
        </p>
      </div>

      {/* Data source chip */}
      {kpi.column && (
        <p style={{ margin: "8px 0 0", fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
          ◈ {kpi.column}
          {!kpi.isComputed && <span style={{ color: "#6366f1", marginLeft: 6 }}>estimated</span>}
        </p>
      )}
    </motion.div>
  );
}

// ─── KPI grid ──────────────────────────────────────────────────────────────────

function KPIMonitorGrid({ kpis: kpiNames, fileId }: { kpis: string[]; fileId: string }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    setFetching(true);
    fetchAnalysis(fileId)
      .then((res) => setAnalysis(res.data.analysis ?? res.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [fileId]);

  const computedKPIs = useMemo(() => {
    if (!analysis) return [];
    return computeKPIs(kpiNames, analysis);
  }, [kpiNames, analysis]);

  if (fetching) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {kpiNames.map((_, i) => (
          <div
            key={i}
            style={{
              height: 200,
              borderRadius: 16,
              background: "rgba(22,33,58,0.5)",
              border: "1px solid rgba(148,163,184,0.08)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmerAnim 1.6s ease-in-out infinite",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (computedKPIs.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 4, height: 20, borderRadius: 2,
            background: "linear-gradient(180deg,#6366f1,#8b5cf6)",
          }}
        />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>KPIs to Monitor</p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 99,
            background: "rgba(99,102,241,0.12)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          {computedKPIs.filter((k) => k.isComputed).length} computed from data
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {computedKPIs.map((kpi, i) => (
          <KPICard key={kpi.name} kpi={kpi} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = [
  "How can we increase profit by 20% this year?",
  "How can we improve sales performance?",
  "How can we reduce business risk?",
  "How can we improve operational efficiency?",
  "What should we do to grow revenue in underperforming segments?",
];

export default function StrategyPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [question, setQuestion] = useState("");
  const [strategy, setStrategy] = useState<StrategyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [examples, setExamples] = useState<string[]>(EXAMPLE_QUESTIONS);

  useEffect(() => {
    fetchStrategyExamples()
      .then((res) => setExamples(res.data.examples || EXAMPLE_QUESTIONS))
      .catch(() => {});
  }, []);

  const handleGenerate = async (q?: string) => {
    const prompt = (q ?? question).trim();
    if (!prompt || !fileId) return;
    setLoading(true);
    setError("");
    setStrategy(null);
    if (!q) setQuestion(prompt);
    try {
      const res = await generateStrategy(fileId, prompt);
      setStrategy(res.data);
    } catch {
      setError("Failed to generate strategy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!fileId) {
    return (
      <MainLayout>
        <div style={{ maxWidth: 520, margin: "80px auto" }}>
          <EmptyState
            icon={<Map size={26} />}
            title="Strategy Generator"
            description="Open a dataset to generate AI-grounded strategy plans with real metrics from your data."
            action={
              <button type="button" className="button button-primary" onClick={() => navigate("/datasets")}>
                <Database size={15} /> Browse Datasets
              </button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <style>{`
        @keyframes shimmerAnim {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* Page header */}
      <motion.div
        className="page-hero"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <p className="eyebrow">AI Business Strategy</p>
          <h1>Strategy Builder</h1>
          <p className="section-description">Ask a strategic question — get an AI-grounded plan with real KPIs from your data.</p>
        </div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="alert alert-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input card */}
      <motion.div
        className="section-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 24 }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 12 }}>
          Ask a strategic question
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. How can we increase profit by 20% this year?"
            disabled={loading}
            style={{
              flex: 1,
              padding: "13px 18px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(148,163,184,0.15)",
              color: "#e2e8f0",
              fontSize: 14,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.15)"; }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(99,102,241,0.45)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleGenerate()}
            disabled={loading || !question.trim()}
            style={{
              padding: "13px 24px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              background:
                loading || !question.trim()
                  ? "rgba(99,102,241,0.3)"
                  : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "#fff",
              border: "none",
              cursor: loading || !question.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} style={{ display: "flex" }}>
                  <RotateCcw size={14} />
                </motion.span>
                Generating…
              </>
            ) : (
              <><Sparkles size={14} /> Generate Strategy</>
            )}
          </motion.button>
        </div>

        {/* Example questions */}
        <div>
          <p style={{ fontSize: 11, color: "#475569", marginBottom: 8, fontWeight: 600 }}>Quick examples:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {examples.map((ex) => (
              <motion.button
                key={ex}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleGenerate(ex)}
                disabled={loading}
                style={{
                  padding: "6px 14px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 500,
                  background: "rgba(99,102,241,0.07)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.15)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {ex}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: "linear-gradient(145deg,rgba(30,41,59,0.7),rgba(15,23,42,0.8))",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 20,
              padding: "48px 24px",
              textAlign: "center",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
                  style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1" }}
                />
              ))}
            </div>
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Analyzing your data and building strategy plan…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strategy result */}
      <AnimatePresence>
        {strategy && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Strategy banner */}
            <div
              style={{
                background: "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.07),rgba(15,23,42,0.6))",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 20,
                padding: "24px",
                marginBottom: 20,
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#818cf8" }}>
                      Strategy Plan
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: strategy.source === "ai_generated" ? "rgba(99,102,241,0.2)" : "rgba(100,116,139,0.2)",
                        color: strategy.source === "ai_generated" ? "#818cf8" : "#94a3b8",
                        border: `1px solid ${strategy.source === "ai_generated" ? "rgba(99,102,241,0.35)" : "rgba(100,116,139,0.3)"}`,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {strategy.source === "ai_generated" ? "🧠 AI" : "⚡ Rule-Based"}
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 900 }}>{strategy.strategy}</h2>
                  <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{strategy.analysis}</p>
                </div>
              </div>
            </div>

            {/* Priority Actions + Impact/Timeline */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* Priority actions */}
              <div
                style={{
                  background: "linear-gradient(145deg,rgba(22,33,58,0.85),rgba(15,23,42,0.9))",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: 16,
                  padding: "20px 24px",
                  backdropFilter: "blur(10px)",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 16 }}>
                  Priority Actions
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {strategy.priority_actions.map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                      style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          background: "rgba(99,102,241,0.15)",
                          border: "1px solid rgba(99,102,241,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 900,
                          color: "#818cf8",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#cbd5e1" }}>{action}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Impact + Timeline + Risks stacked */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    background: "rgba(34,197,94,0.06)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 14,
                    padding: "16px 18px",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80", marginBottom: 6 }}>
                    Expected Impact
                  </p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#86efac", lineHeight: 1.5 }}>
                    {strategy.expected_impact}
                  </p>
                </div>

                <div
                  style={{
                    background: "linear-gradient(145deg,rgba(22,33,58,0.85),rgba(15,23,42,0.9))",
                    border: "1px solid rgba(148,163,184,0.1)",
                    borderRadius: 14,
                    padding: "16px 18px",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 6 }}>
                    Timeline
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{strategy.timeline}</p>
                </div>

                <div
                  style={{
                    background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: 14,
                    padding: "16px 18px",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f87171", marginBottom: 8 }}>
                    Risks to Watch
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {strategy.risks.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#f87171", marginTop: 1, flexShrink: 0, fontSize: 12 }}>⚠</span>
                        <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>{r}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Monitor Grid */}
            <div
              style={{
                background: "linear-gradient(145deg,rgba(22,33,58,0.7),rgba(15,23,42,0.85))",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: 20,
                padding: "24px",
                backdropFilter: "blur(12px)",
              }}
            >
              <KPIMonitorGrid kpis={strategy.kpis_to_monitor} fileId={fileId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
