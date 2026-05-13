import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, X, TrendingUp, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { api } from "../services/api";

interface ProactiveInsight {
  type: "opportunity" | "risk" | "performance" | "forecast";
  title: string;
  summary: string;
  action: string;
  metric?: string;
  priority: "high" | "medium" | "low";
}

const TYPE_META = {
  opportunity: { icon: <Lightbulb size={14} />, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  risk:        { icon: <AlertTriangle size={14} />, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  performance: { icon: <TrendingUp size={14} />, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  forecast:    { icon: <Target size={14} />, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
};

// Generate smart insights from analysis data
function generateInsights(analysisData: Record<string, unknown>): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];
  const ns = (analysisData?.numeric_summary || {}) as Record<string, { total: number; mean: number; median: number; std: number }>;
  const cs = (analysisData?.categorical_summary || {}) as Record<string, { unique_count: number; top_value: string; top_count: number }>;
  const shape = (analysisData?.shape || { rows: 0 }) as { rows: number };

  // Revenue concentration insight
  const revKey = Object.keys(ns).find(k => /revenue|sales|amount|income/i.test(k));
  if (revKey && ns[revKey]) {
    const rev = ns[revKey];
    const mean = rev.mean;
    const median = rev.median;
    const skew = ((mean - median) / (median || 1)) * 100;
    if (Math.abs(skew) > 15) {
      insights.push({
        type: "opportunity",
        title: skew > 0 ? "Revenue skewed by top performers" : "Revenue underperforming vs potential",
        summary: `Average ${revKey} ($${mean.toFixed(0)}) is ${Math.abs(skew).toFixed(0)}% ${skew > 0 ? "above" : "below"} median ($${median.toFixed(0)}). This suggests high concentration or outliers.`,
        action: skew > 0 ? "Identify top performers and replicate their approach across the team." : "Investigate the gap between average and median — likely a segment drag.",
        metric: `${Math.abs(skew).toFixed(0)}% skew`,
        priority: Math.abs(skew) > 30 ? "high" : "medium",
      });
    }
  }

  // Category concentration
  const topCatKey = Object.keys(cs).find(k => /product|category|region|destination|type/i.test(k));
  if (topCatKey && cs[topCatKey]) {
    const cat = cs[topCatKey];
    const concentrationPct = ((cat.top_count / (shape.rows || 1)) * 100).toFixed(0);
    if (parseFloat(concentrationPct) > 20) {
      insights.push({
        type: "performance",
        title: `"${cat.top_value}" dominates ${topCatKey}`,
        summary: `"${cat.top_value}" accounts for ${concentrationPct}% of all ${topCatKey} records (${cat.top_count.toLocaleString()} rows) — significantly higher than the average across ${cat.unique_count} categories.`,
        action: `Deep-dive into "${cat.top_value}" to understand what's driving its performance, and identify how to scale those drivers.`,
        metric: `${concentrationPct}% concentration`,
        priority: "medium",
      });
    }
  }

  // Data volume insight
  if (shape.rows > 1000) {
    insights.push({
      type: "forecast",
      title: `Large dataset — ${shape.rows.toLocaleString()} rows detected`,
      summary: `Your dataset has ${shape.rows.toLocaleString()} records, giving strong statistical reliability. Predictions and trend analysis will be highly accurate.`,
      action: "Use the Predictions feature to forecast future trends with high confidence intervals.",
      metric: `${shape.rows.toLocaleString()} rows`,
      priority: "low",
    });
  }

  // Missing values risk
  const mv = analysisData?.missing_values as Record<string, number> | undefined;
  if (mv) {
    const totalMissing = Object.values(mv).reduce((a, b) => a + b, 0);
    if (totalMissing > 0) {
      const worstCol = Object.entries(mv).sort((a, b) => b[1] - a[1])[0];
      insights.push({
        type: "risk",
        title: `${totalMissing} missing values detected`,
        summary: `Column "${worstCol[0]}" has ${worstCol[1]} missing values (${((worstCol[1] / shape.rows) * 100).toFixed(1)}% of rows). This can reduce AI accuracy and cause gaps in charts.`,
        action: "Run Data Quality Analysis to auto-fix missing values and improve analysis reliability.",
        metric: `${totalMissing} gaps`,
        priority: totalMissing > shape.rows * 0.05 ? "high" : "medium",
      });
    }
  }

  return insights.slice(0, 4);
}

interface ProactiveInsightsProps {
  fileId: string;
  analysisData?: Record<string, unknown>;
}

export default function ProactiveInsights({ fileId, analysisData }: ProactiveInsightsProps) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);

    // Try to get AI insights from backend
    api.get(`/insights/${fileId}`)
      .then(res => {
        const data = res.data;
        if (data?.insights?.length) {
          // Map API insights to our format
          const mapped = (data.insights as Array<Record<string, unknown>>).slice(0, 4).map((ins): ProactiveInsight => ({
            type: (ins.type as ProactiveInsight["type"]) || "opportunity",
            title: (ins.title as string) || "Key Finding",
            summary: (ins.observation as string) || "",
            action: (ins.action as string) || "",
            metric: (ins.data_point as string) || "",
            priority: (ins.priority as ProactiveInsight["priority"]) || "medium",
          }));
          setInsights(mapped);
        } else if (analysisData) {
          setInsights(generateInsights(analysisData));
        }
      })
      .catch(() => {
        if (analysisData) setInsights(generateInsights(analysisData));
      })
      .finally(() => setLoading(false));
  }, [fileId, analysisData]);

  const visible = insights.filter((_, i) => !dismissed.has(i));

  if (loading) return null;
  if (visible.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: 24 }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: expanded ? 12 : 0, cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "grid", placeItems: "center", color: "white",
          }}>
            <Sparkles size={14} />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>AI spotted {visible.length} insight{visible.length !== 1 ? "s" : ""} in your data</span>
            <span style={{ marginLeft: 10, fontSize: "0.72rem", color: "var(--muted)" }}>click to {expanded ? "hide" : "show"}</span>
          </div>
        </div>
        <ChevronRight
          size={16}
          style={{ color: "var(--muted)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {insights.map((ins, i) => {
                if (dismissed.has(i)) return null;
                const meta = TYPE_META[ins.type];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.07 }}
                    style={{
                      padding: "16px 18px", borderRadius: 16,
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                      borderLeft: `3px solid ${meta.color}`,
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 3 }}
                      onClick={() => setDismissed(prev => new Set([...prev, i]))}
                    >
                      <X size={12} />
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: "3px 8px", borderRadius: 999, background: meta.bg, color: meta.color, display: "flex", alignItems: "center", gap: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase" }}>
                        {meta.icon} {ins.type}
                      </span>
                      {ins.metric && (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: meta.color }}>{ins.metric}</span>
                      )}
                    </div>

                    <h4 style={{ margin: "0 0 6px", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", paddingRight: 20 }}>{ins.title}</h4>
                    <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{ins.summary}</p>

                    <div style={{ padding: "8px 10px", borderRadius: 8, background: `${meta.color}08`, border: `1px solid ${meta.color}20`, fontSize: "0.75rem", color: meta.color }}>
                      <strong>→ </strong>{ins.action}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
