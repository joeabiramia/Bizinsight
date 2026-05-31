import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Database, Loader2, CheckCircle2, ChevronDown, BookOpen } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { getBenchmarkForIndustry, INDUSTRY_BENCHMARKS, applySize, getSizeTier } from "../data/benchmarks";
import type { IndustryBenchmark } from "../data/benchmarks";
import { listDatasets, classifyDataset, fetchAnalysis } from "../services/api";
import { useAuth } from "../context/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Dataset {
  file_id: string;
  filename: string;
  created_at?: string;
}

interface Classification {
  industry: string;
  label: string;
  icon: string;
  confidence: number;
  scores: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ConfidenceBadge({ pct }: { pct: number }) {
  const label = pct >= 0.7 ? "High" : pct >= 0.4 ? "Medium" : pct > 0 ? "Low" : "";
  if (!label) return null;
  const color = pct >= 0.7 ? "#22c55e" : pct >= 0.4 ? "#f59e0b" : "#94a3b8";
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700,
      background: `${color}18`, color,
    }}>
      {label} confidence · {Math.round(pct * 100)}%
    </span>
  );
}

function ScoreBar({ industry, score, color }: { industry: string; score: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ width: 130, fontSize: "0.75rem", color: "var(--text-secondary)", flexShrink: 0 }}>
        {INDUSTRY_BENCHMARKS[industry]?.label ?? industry}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(score * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: color }}
        />
      </div>
      <span style={{ width: 36, fontSize: "0.72rem", color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const onboardingIndustry = user?.onboarding_data?.business_type || "";
  const companySize        = user?.onboarding_data?.company_size || "";
  const sizeTier           = getSizeTier(companySize);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [overrideIndustry, setOverrideIndustry] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  // User's own values — keyed by metric name, value is a string input
  const [userValues, setUserValues] = useState<Record<string, string>>({});
  // Which values were auto-computed from the dataset (not manually entered)
  const [autoValues, setAutoValues] = useState<Set<string>>(new Set());

  // Priority: manual override → dataset classifier → onboarding industry → general
  const detectedIndustry = classification?.industry === "general" && onboardingIndustry
    ? onboardingIndustry
    : classification?.industry ?? "general";
  const activeIndustry = overrideIndustry ?? detectedIndustry;
  const benchmark: IndustryBenchmark = applySize(
    getBenchmarkForIndustry(activeIndustry),
    sizeTier,
  );

  // ── Load datasets ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadingDatasets(true);
    listDatasets()
      .then(r => {
        const ds: Dataset[] = r.data.datasets ?? [];
        setDatasets(ds);
        if (ds.length > 0) {
          const lastId = localStorage.getItem("lastDatasetId");
          const initial = ds.find(d => d.file_id === lastId) ? lastId! : ds[0].file_id;
          setSelectedId(initial);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDatasets(false));
  }, []);

  // ── Classify whenever selected dataset changes ───────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    setClassifying(true);
    setClassification(null);
    setOverrideIndustry(null);
    classifyDataset(selectedId)
      .then(r => setClassification(r.data))
      .catch(() => setClassification(null))
      .finally(() => setClassifying(false));
  }, [selectedId]);

  // ── Auto-compute metrics from dataset analysis ────────────────────────────────
  // Rules:
  //   1. Only compute a metric when the source columns are unambiguous.
  //   2. Validate the result makes sense (e.g. margin must be 0–100%).
  //   3. Never apply one computed value to multiple unrelated metrics.
  //   4. Only call a trend "YoY" when ≥ 12 months of data exist.

  useEffect(() => {
    if (!selectedId) return;
    fetchAnalysis(selectedId).then(res => {
      const analysis = res.data?.analysis ?? {};
      const numSummary: Record<string, { total: number; mean: number; median: number }> =
        analysis.numeric_summary ?? {};
      const timeSeries: Array<{ value: number }> =
        analysis.chart_data?.time_series ?? [];

      const computed: Record<string, string> = {};

      // ── Column detection (strict naming) ──────────────────────────────────────
      // Revenue: column name must contain these exact business terms
      const revKey = Object.keys(numSummary).find(k =>
        /\b(revenue|sales|income|turnover)\b/i.test(k)
      );
      // Amount: fallback for generic amount/total columns (used for AOV only)
      const amtKey = revKey ?? Object.keys(numSummary).find(k =>
        /\b(amount|total|value)\b/i.test(k)
      );
      // COGS / direct cost — must be clearly named to avoid confusing with unit price
      const cogsKey = Object.keys(numSummary).find(k =>
        /\b(cogs|cost_of_goods|direct_cost|manufacturing_cost|freight|shipping_cost)\b/i.test(k)
      );
      // Generic cost — only used for Cost per Shipment, not Gross Margin
      const costKey = cogsKey ?? Object.keys(numSummary).find(k =>
        /\b(cost|expense)\b/i.test(k)
      );
      // Days columns for duration-based metrics
      const daysKey = Object.keys(numSummary).find(k =>
        /\b(days|duration|lead_time|processing_time|hire_days)\b/i.test(k)
      );

      // ── Avg Order Value / Avg Booking Value ───────────────────────────────────
      // Safe: the mean of a revenue/amount column IS the average transaction value
      if (amtKey) {
        const mean = numSummary[amtKey].mean;
        if (mean > 0) {
          computed["Avg Order Value"]   = mean.toFixed(0);
          computed["Avg Booking Value"] = mean.toFixed(0);
        }
      }

      // ── Cost per Shipment ─────────────────────────────────────────────────────
      // Only compute when there is a genuine cost column — never fall back to revenue
      if (costKey) {
        const mean = numSummary[costKey].mean;
        if (mean > 0) computed["Cost per Shipment"] = mean.toFixed(2);
      }

      // ── Gross Margin ──────────────────────────────────────────────────────────
      // Only compute when BOTH a revenue column AND a COGS column exist.
      // Validate result is between 0 and 100% — if outside that range the columns
      // don't represent what we think (e.g. cost > revenue means this isn't COGS).
      if (revKey && cogsKey) {
        const rev  = numSummary[revKey].total;
        const cogs = numSummary[cogsKey].total;
        if (rev > 0 && cogs > 0 && cogs < rev) {
          const margin = ((rev - cogs) / rev * 100);
          if (margin >= 0 && margin <= 100) {
            computed["Gross Margin"] = margin.toFixed(1);
          }
        }
        // If cogs ≥ rev the formula gives 0% or negative — clearly not valid margin data
      }

      // ── Revenue Growth ────────────────────────────────────────────────────────
      // Label as "YoY" only with ≥ 12 months — otherwise it's a partial-period trend
      if (timeSeries.length >= 2) {
        const first = timeSeries[0].value;
        const last  = timeSeries[timeSeries.length - 1].value;
        if (first > 0 && last > 0) {
          const growth = ((last - first) / first * 100);
          const isFullYear = timeSeries.length >= 12;
          // Only fill "Revenue Growth (YoY)" — not ARR Growth or AUM Growth,
          // which are different metrics for different industries
          if (isFullYear) {
            computed["Revenue Growth (YoY)"] = growth.toFixed(1);
          }
          // For partial periods, still useful as a trend indicator but don't mislabel
        }
      }

      // ── Days-based metrics ────────────────────────────────────────────────────
      // Only fill the metric that matches the column name semantics
      if (daysKey) {
        const mean = numSummary[daysKey].mean;
        if (mean > 0) {
          const lk = daysKey.toLowerCase();
          if (/hire|recruit|onboard/i.test(lk))     computed["Time-to-Hire"]            = mean.toFixed(0);
          if (/return|processing|resolv/i.test(lk)) computed["Return Processing Time"]   = mean.toFixed(1);
          // If the column name is ambiguous, don't guess which metric it belongs to
        }
      }

      if (Object.keys(computed).length > 0) {
        // Don't overwrite values the user has already entered manually
        setUserValues(prev => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(computed)) {
            if (!prev[k]) next[k] = v;
          }
          return next;
        });
        setAutoValues(new Set(Object.keys(computed)));
      }
    }).catch(() => {});
  }, [selectedId]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Industry Intelligence"
        title="Industry Benchmarks"
        description="Your dataset is automatically classified so you only see benchmarks that are relevant to your business."
      />

      {/* ── Dataset picker ─────────────────────────────────────────────────── */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Database size={15} style={{ color: "var(--primary-light)" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Dataset</span>
          </div>

          {loadingDatasets ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: "0.85rem" }}>
              <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Loading datasets…
            </div>
          ) : datasets.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No datasets uploaded yet.</span>
              <button type="button" className="button button-primary button-sm" onClick={() => navigate("/upload")}>Upload Data →</button>
            </div>
          ) : (
            <select
              title="Select dataset to benchmark"
              className="form-input"
              style={{ maxWidth: 320 }}
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              {datasets.map(d => (
                <option key={d.file_id} value={d.file_id}>{d.filename}</option>
              ))}
            </select>
          )}

          {/* Classification badge */}
          {classifying && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--muted)" }}>
              <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
              Detecting industry…
            </span>
          )}

          {classification && !classifying && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Detected:
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.85rem" }}>
                <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                {classification.icon} {classification.label}
              </span>
              <ConfidenceBadge pct={classification.confidence} />
            </div>
          )}
        </div>
      </div>

      {/* ── Industry header ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndustry}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          style={{
            padding: "24px", borderRadius: 20, marginBottom: 28,
            background: `linear-gradient(135deg, ${benchmark.color}10, rgba(255,255,255,0.01))`,
            border: `1px solid ${benchmark.color}30`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>{benchmark.icon}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{benchmark.label}</h2>
                {overrideIndustry && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700,
                    background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                  }}>
                    Manually selected
                  </span>
                )}
                {classification && !overrideIndustry && classification.industry !== "general" && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700,
                    background: "rgba(34,197,94,0.10)", color: "#22c55e",
                  }}>
                    Auto-detected
                  </span>
                )}
                {classification?.industry === "general" && onboardingIndustry && !overrideIndustry && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700,
                    background: "rgba(245,158,11,0.10)", color: "#f59e0b",
                  }}>
                    From your profile
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {benchmark.insight}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <div style={{
                padding: "8px 16px", borderRadius: 10,
                background: `${benchmark.color}15`, color: benchmark.color,
                fontSize: "0.78rem", fontWeight: 700,
              }}>
                {benchmark.metrics.length} Metrics
              </div>
              {companySize && (
                <div style={{
                  padding: "4px 12px", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700,
                  background: "rgba(99,102,241,0.10)", color: "var(--primary-light)",
                }}>
                  {sizeTier === "smb" ? "SMB peer group" : sizeTier === "mid" ? "Mid-market peer group" : "Enterprise peer group"}
                </div>
              )}

              {/* Industry override toggle */}
              {datasets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOverride(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "none", border: "1px solid var(--border)", borderRadius: 8,
                    padding: "5px 10px", fontSize: "0.72rem", color: "var(--muted)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  Switch industry <ChevronDown size={11} style={{ transform: showOverride ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
              )}
            </div>
          </div>

          {/* Override picker */}
          <AnimatePresence>
            {showOverride && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ paddingTop: 20 }}>
                  <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>
                    Browse all industries (overrides auto-detection):
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.values(INDUSTRY_BENCHMARKS)
                      .filter(ind => ind.industry !== "general")
                      .map(ind => (
                        <button
                          key={ind.industry}
                          type="button"
                          onClick={() => {
                            setOverrideIndustry(ind.industry === classification?.industry ? null : ind.industry);
                            setShowOverride(false);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 14px", borderRadius: 20, border: "1px solid",
                            borderColor: activeIndustry === ind.industry ? ind.color : "var(--border)",
                            background: activeIndustry === ind.industry ? `${ind.color}15` : "transparent",
                            color: activeIndustry === ind.industry ? ind.color : "var(--text-secondary)",
                            cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                            transition: "all 0.15s",
                          }}
                        >
                          {ind.icon} {ind.label}
                        </button>
                      ))}
                    {overrideIndustry && (
                      <button
                        type="button"
                        onClick={() => { setOverrideIndustry(null); setShowOverride(false); }}
                        style={{
                          padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border)",
                          background: "transparent", color: "var(--muted)",
                          cursor: "pointer", fontSize: "0.8rem", transition: "all 0.15s",
                        }}
                      >
                        ↩ Reset to auto-detected
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* ── Confidence score breakdown ──────────────────────────────────────── */}
      {classification && !classifying && classification.industry !== "general" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="section-card"
          style={{ marginBottom: 28 }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: "0.875rem", fontWeight: 700 }}>
            Classification Breakdown
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
            {Object.entries(classification.scores)
              .filter(([, score]) => score > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([industry, score]) => (
                <ScoreBar
                  key={industry}
                  industry={industry}
                  score={score}
                  color={
                    industry === classification.industry
                      ? benchmark.color
                      : "rgba(99,102,241,0.3)"
                  }
                />
              ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
            Scores are based on column name analysis. Upload more descriptive data for higher confidence.
          </p>
        </motion.div>
      )}

      {/* ── No dataset CTA ──────────────────────────────────────────────────── */}
      {!loadingDatasets && datasets.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "32px", borderRadius: 20, marginBottom: 28, textAlign: "center",
            background: "rgba(99,102,241,0.04)", border: "1px dashed rgba(99,102,241,0.2)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 10 }}>📂</div>
          <h3 style={{ margin: "0 0 8px", fontWeight: 700 }}>No datasets found</h3>
          <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Upload a dataset so BizInsight AI can detect your industry and show only the relevant benchmarks.
          </p>
          <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>Upload Your Data →</button>
          <p style={{ margin: "12px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
            Showing general business benchmarks below until a dataset is detected.
          </p>
        </motion.div>
      )}

      {/* ── How to read this ────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px", borderRadius: 12, marginBottom: 24,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <BookOpen size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.875rem" }}>How to use these benchmarks</p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Each card shows two reference points for your industry: the <strong>Industry Average</strong> (what a typical company achieves)
            and the <strong>Top Quartile</strong> (what the best 25% of companies achieve).
            Enter your own number in the <em>"Your value"</em> field on any card to instantly see where you stand.
            Find your actual metrics in the <strong>Analysis</strong> page after uploading your dataset.
          </p>
        </div>
      </div>

      {/* ── Metrics grid ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndustry + "-grid"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}
        >
          {benchmark.metrics.map((metric, i) => {
            const rawInput  = userValues[metric.name] ?? "";
            const userNum   = rawInput !== "" ? parseFloat(rawInput) : null;
            const hasUser   = userNum !== null && !isNaN(userNum);
            const isAuto    = autoValues.has(metric.name) && rawInput !== "";

            // Verdict logic
            const aboveAvg = hasUser && (metric.higher_is_better
              ? userNum >= metric.industry_avg
              : userNum <= metric.industry_avg);
            const topPerf  = hasUser && (metric.higher_is_better
              ? userNum >= metric.top_quartile
              : userNum <= metric.top_quartile);

            const verdict = !hasUser ? null : topPerf
              ? { label: "Top performer", color: "#16a34a", bg: "#dcfce7", icon: "🏆" }
              : aboveAvg
                ? { label: "Above average", color: "#d97706", bg: "#fef3c7", icon: "📈" }
                : { label: "Below average", color: "#dc2626", bg: "#fee2e2", icon: "📉" };

            const chartData = [
              { name: "Industry Avg",  value: metric.industry_avg,  fill: "var(--primary)" },
              { name: "Top Quartile",  value: metric.top_quartile,  fill: "#16a34a" },
              ...(hasUser ? [{ name: "Your value", value: userNum!, fill: verdict?.color ?? "#64748b" }] : []),
            ];
            const maxVal = Math.max(
              metric.industry_avg,
              metric.top_quartile,
              hasUser ? userNum! : 0
            ) * 1.25;

            const fmtVal = (v: number) => {
              const prefix = metric.unit === "$" || metric.unit === "$K" ? metric.unit : "";
              const suffix = metric.unit !== "$" && metric.unit !== "$K" ? " " + metric.unit : "";
              return `${prefix}${v}${suffix}`;
            };

            return (
              <motion.div
                key={`${activeIndustry}-${metric.name}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="section-card"
              >
                {/* Header */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ margin: "0 0 3px", fontSize: "0.9rem", fontWeight: 700 }}>{metric.name}</h3>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 600, padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                      background: metric.higher_is_better ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)",
                      color: metric.higher_is_better ? "#16a34a" : "#dc2626",
                    }}>
                      {metric.higher_is_better ? "Higher is better" : "Lower is better"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{metric.description}</p>
                </div>

                {/* Reference numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Industry Average
                    </p>
                    <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.02em" }}>
                      {fmtVal(metric.industry_avg)}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--muted)" }}>Typical company</p>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "0.68rem", color: "#16a34a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Top Quartile
                    </p>
                    <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em" }}>
                      {fmtVal(metric.top_quartile)}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#16a34a" }}>Top 25% of companies</p>
                  </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={hasUser ? 110 : 75}>
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" domain={[0, maxVal]} hide />
                    <YAxis dataKey="name" type="category"
                           tick={{ fill: "var(--muted)", fontSize: 10 }}
                           width={hasUser ? 82 : 82} />
                    <Tooltip
                      formatter={(v: unknown) => fmtVal(v as number)}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Your value input */}
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10,
                               background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 600,
                                     textTransform: "uppercase", letterSpacing: "0.05em",
                                     color: "var(--muted)" }}>
                      Your value
                    </label>
                    {isAuto && (
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
                        borderRadius: 99, background: "rgba(37,99,235,0.10)", color: "var(--primary)",
                      }}>
                        Auto-computed from dataset
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      placeholder={`e.g. ${metric.industry_avg}`}
                      value={rawInput}
                      onChange={e => setUserValues(v => ({ ...v, [metric.name]: e.target.value }))}
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: "0.875rem",
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text)", outline: "none",
                      }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", flexShrink: 0 }}>
                      {metric.unit}
                    </span>
                    {rawInput && (
                      <button type="button" onClick={() => setUserValues(v => ({ ...v, [metric.name]: "" }))}
                              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 2 }}>
                        ×
                      </button>
                    )}
                  </div>

                  {/* Verdict */}
                  {verdict && (
                    <div style={{
                      marginTop: 8, padding: "6px 10px", borderRadius: 7,
                      background: verdict.bg, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: "0.8rem" }}>{verdict.icon}</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: verdict.color }}>
                        {verdict.label}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: verdict.color, opacity: 0.8 }}>
                        — {topPerf
                          ? `You're in the top 25% of ${benchmark.label.split("·")[0].trim()} companies`
                          : aboveAvg
                            ? `Above the industry average of ${fmtVal(metric.industry_avg)}`
                            : `Below the industry average of ${fmtVal(metric.industry_avg)}`}
                      </span>
                    </div>
                  )}

                  {/* How to find this value */}
                  {!hasUser && (
                    <p style={{ margin: "8px 0 0", fontSize: "0.73rem", color: "var(--muted)", lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--text-secondary)" }}>How to find this: </strong>
                      {metric.howToFind}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── Footer tip ───────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 32, padding: "20px 24px", borderRadius: 12,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.9rem" }}>
            Find your actual numbers
          </p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Go to your Analysis page to see your computed KPIs — then come back and enter them above to see where you stand.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={datasets.length > 0 && !selectedId}
          onClick={() => navigate(datasets.length > 0 && selectedId ? `/analysis/${selectedId}` : "/upload")}
        >
          {datasets.length > 0 ? "Open Analysis →" : "Upload a Dataset →"}
        </button>
      </div>
    </MainLayout>
  );
}
