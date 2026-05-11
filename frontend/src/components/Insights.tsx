import { useEffect, useState } from "react";
import { AnalysisData, BusinessInsight, InsightType } from "../types";
import { fetchInsights } from "../services/api";

interface Props {
  analysis: AnalysisData;
  filename?: string;
  fileId?: string;
}

const TYPE_CONFIG: Record<
  InsightType,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  revenue: {
    label: "Revenue",
    color: "#4ade80",
    bg: "rgba(74, 222, 128, 0.08)",
    border: "rgba(74, 222, 128, 0.25)",
    icon: "💰",
  },
  opportunity: {
    label: "Opportunity",
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.08)",
    border: "rgba(96, 165, 250, 0.25)",
    icon: "📈",
  },
  risk: {
    label: "Risk",
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.08)",
    border: "rgba(248, 113, 113, 0.25)",
    icon: "⚠️",
  },
  performance: {
    label: "Performance",
    color: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.08)",
    border: "rgba(167, 139, 250, 0.25)",
    icon: "🎯",
  },
};

function buildFallbackInsights(analysis: AnalysisData): BusinessInsight[] {
  const s = analysis.top_summary || {};
  const shape = analysis.shape;
  const insights: BusinessInsight[] = [];

  if (s.total_revenue != null) {
    insights.push({
      type: "revenue",
      title: `Total Revenue: ${s.total_revenue.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
      observation: `Your dataset records a total revenue of ${s.total_revenue.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} across ${shape.rows.toLocaleString()} transactions.`,
      interpretation: "This gives you a baseline to track growth, seasonality, and performance trends over time.",
      action: "Set a revenue target for the next period and compare against this baseline.",
    });
  }

  if (s.best_region) {
    insights.push({
      type: "opportunity",
      title: `Strongest Region: ${s.best_region.name}`,
      observation: `${s.best_region.name} leads all regions with ${s.best_region.value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} in revenue.`,
      interpretation: "This region demonstrates proven demand and market fit for your products.",
      action: `Expand marketing and sales resources in ${s.best_region.name}. Identify what's driving success and replicate it in weaker regions.`,
    });
  }

  if (s.best_salesman) {
    insights.push({
      type: "performance",
      title: `Top Salesperson: ${s.best_salesman.name}`,
      observation: `${s.best_salesman.name} generated ${s.best_salesman.value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} — the highest individual contribution.`,
      interpretation: "This salesperson represents a critical revenue dependency and an internal best practice to learn from.",
      action: `Retain and reward ${s.best_salesman.name}. Document their techniques and run peer coaching sessions.`,
    });
  }

  if (s.best_selling_product) {
    insights.push({
      type: "opportunity",
      title: `Best Product: ${s.best_selling_product.name}`,
      observation: `${s.best_selling_product.name} is your top-selling product by revenue.`,
      interpretation: "This product is your core revenue engine and has demonstrated clear product-market fit.",
      action: `Increase marketing investment in ${s.best_selling_product.name}. Consider bundling with lower-performing products to lift overall sales.`,
    });
  }

  const missing = analysis.missing_values || {};
  const highMissing = Object.entries(missing)
    .filter(([, count]) => count > shape.rows * 0.2)
    .map(([col]) => col);
  if (highMissing.length > 0) {
    insights.push({
      type: "risk",
      title: "Data Quality Warning",
      observation: `Columns with >20% missing values: ${highMissing.slice(0, 3).join(", ")}.`,
      interpretation: "High rates of missing data reduce analysis reliability and may skew KPIs and forecasts.",
      action: "Establish data-entry validation at source. Impute or flag missing values before production analysis.",
    });
  }

  const corr = analysis.correlations || {};
  const reported = new Set<string>();
  for (const c1 of Object.keys(corr)) {
    for (const c2 of Object.keys(corr[c1] || {})) {
      const pair = [c1, c2].sort().join("|");
      if (c1 !== c2 && !reported.has(pair)) {
        const r = corr[c1][c2];
        if (typeof r === "number" && Math.abs(r) > 0.6) {
          reported.add(pair);
          const dir = r > 0 ? "positively" : "negatively";
          insights.push({
            type: "performance",
            title: `Strong Correlation: ${c1} & ${c2}`,
            observation: `'${c1}' and '${c2}' are strongly ${dir} correlated (r = ${r.toFixed(2)}).`,
            interpretation: "This relationship can be leveraged for predictive modelling and proactive planning.",
            action: `Use '${c1}' as a leading indicator for '${c2}'. Build a simple regression model to quantify the relationship.`,
          });
        }
      }
    }
  }

  return insights;
}

function InsightCard({ insight }: { insight: BusinessInsight }) {
  const cfg = TYPE_CONFIG[insight.type] || TYPE_CONFIG.performance;
  return (
    <div
      className="insight-card-v2"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="insight-card-v2-header">
        <span className="insight-card-v2-icon">{cfg.icon}</span>
        <span
          className="insight-card-v2-type"
          style={{ color: cfg.color, borderColor: cfg.border }}
        >
          {cfg.label}
        </span>
      </div>
      <h4 className="insight-card-v2-title">{insight.title}</h4>
      <div className="insight-card-v2-body">
        <div className="insight-field">
          <span className="insight-field-label">Observation</span>
          <p className="insight-field-text">{insight.observation}</p>
        </div>
        <div className="insight-field">
          <span className="insight-field-label">Interpretation</span>
          <p className="insight-field-text">{insight.interpretation}</p>
        </div>
        <div className="insight-field insight-field--action">
          <span className="insight-field-label insight-field-label--action">
            Recommended Action
          </span>
          <p className="insight-field-text insight-field-text--action">{insight.action}</p>
        </div>
      </div>
    </div>
  );
}

export default function Insights({ analysis, filename, fileId }: Props) {
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [summary, setSummary] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InsightType | "all">("all");

  useEffect(() => {
    if (fileId) {
      setLoadingRemote(true);
      fetchInsights(fileId)
        .then((res) => {
          const data = res.data as { insights: BusinessInsight[]; summary: string };
          if (data.insights && data.insights.length > 0) {
            setInsights(data.insights);
            setSummary(data.summary || "");
          } else {
            setInsights(buildFallbackInsights(analysis));
          }
        })
        .catch(() => setInsights(buildFallbackInsights(analysis)))
        .finally(() => setLoadingRemote(false));
    } else {
      setInsights(buildFallbackInsights(analysis));
    }
  }, [fileId]);

  const filtered =
    activeFilter === "all" ? insights : insights.filter((i) => i.type === activeFilter);

  const counts = {
    revenue: insights.filter((i) => i.type === "revenue").length,
    opportunity: insights.filter((i) => i.type === "opportunity").length,
    risk: insights.filter((i) => i.type === "risk").length,
    performance: insights.filter((i) => i.type === "performance").length,
  };

  if (loadingRemote) {
    return (
      <div className="insights-shell">
        <div className="insights-loading">Generating business insights…</div>
      </div>
    );
  }

  return (
    <div className="insights-shell">
      {filename && <p className="insights-subtitle">{filename}</p>}

      {summary && (
        <div className="insights-summary-bar">
          <span className="insights-summary-icon">📋</span>
          <p className="insights-summary-text">{summary}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="insights-filter-row">
        {(["all", "revenue", "opportunity", "risk", "performance"] as const).map((f) => {
          const count =
            f === "all" ? insights.length : counts[f as InsightType] || 0;
          if (f !== "all" && count === 0) return null;
          const cfg = f !== "all" ? TYPE_CONFIG[f as InsightType] : null;
          return (
            <button
              key={f}
              type="button"
              className={`insights-filter-btn${activeFilter === f ? " insights-filter-btn--active" : ""}`}
              style={
                activeFilter === f && cfg
                  ? { borderColor: cfg.color, color: cfg.color }
                  : {}
              }
              onClick={() => setActiveFilter(f)}
            >
              {f === "all" ? "All" : cfg?.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Insight cards */}
      <div className="insights-cards-grid">
        {filtered.length > 0 ? (
          filtered.map((insight, i) => <InsightCard key={i} insight={insight} />)
        ) : (
          <p className="insights-empty">No insights available for this filter.</p>
        )}
      </div>
    </div>
  );
}
