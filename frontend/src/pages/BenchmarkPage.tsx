import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Info, Database, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { getBenchmarkForIndustry, INDUSTRY_BENCHMARKS } from "../data/benchmarks";
import type { IndustryBenchmark } from "../data/benchmarks";
import { listDatasets, classifyDataset } from "../services/api";

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
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [overrideIndustry, setOverrideIndustry] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // The benchmark displayed is the override if set, otherwise the auto-detected one
  const activeIndustry = overrideIndustry ?? classification?.industry ?? "general";
  const benchmark: IndustryBenchmark = getBenchmarkForIndustry(activeIndustry);

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
            const chartData = [
              { name: "Industry Avg", value: metric.industry_avg, fill: "var(--primary)" },
              { name: "Top Quartile", value: metric.top_quartile, fill: "#22c55e" },
            ];
            const gap = ((metric.top_quartile - metric.industry_avg) / metric.industry_avg * 100).toFixed(0);
            const isPositiveGap = metric.higher_is_better
              ? metric.top_quartile > metric.industry_avg
              : metric.top_quartile < metric.industry_avg;
            const maxVal = Math.max(metric.industry_avg, metric.top_quartile) * 1.2;

            return (
              <motion.div
                key={`${activeIndustry}-${metric.name}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="section-card"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "0.9rem", fontWeight: 700 }}>{metric.name}</h3>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{metric.description}</p>
                  </div>
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                    background: isPositiveGap ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: isPositiveGap ? "#4ade80" : "#f87171",
                    flexShrink: 0,
                  }}>
                    {isPositiveGap ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {gap}% gap
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "Industry Average", value: metric.industry_avg, unit: metric.unit, color: "var(--primary-light)" },
                    { label: "Top Quartile",     value: metric.top_quartile, unit: metric.unit, color: "#22c55e" },
                  ].map(stat => (
                    <div key={stat.label} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {stat.label}
                      </p>
                      <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: stat.color, letterSpacing: "-0.02em" }}>
                        {stat.unit === "$" || stat.unit === "$K" ? stat.unit : ""}
                        {stat.value}
                        {stat.unit !== "$" && stat.unit !== "$K" ? " " + stat.unit : ""}
                      </p>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" domain={[0, maxVal]} hide />
                    <YAxis dataKey="name" type="category" tick={{ fill: "var(--muted)", fontSize: 10 }} width={90} />
                    <Tooltip
                      formatter={(v: unknown) => `${v as number} ${metric.unit}`}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(99,102,241,0.05)" }}>
                  <Info size={12} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                    {metric.higher_is_better ? "Higher is better" : "Lower is better"} · Upload your data to see where you rank
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          marginTop: 32, padding: "28px 32px", borderRadius: 20,
          background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
          border: "1px solid rgba(99,102,241,0.2)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 6px", fontWeight: 700 }}>
            {datasets.length > 0 ? "How do you compare?" : "Unlock your industry benchmark"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            {datasets.length > 0
              ? "Your actual metrics will be plotted against these benchmarks once your data is analysed."
              : "Upload a dataset and BizInsight AI will automatically detect your industry and personalise these benchmarks."}
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={datasets.length > 0 && !selectedId}
          onClick={() => navigate(datasets.length > 0 && selectedId ? `/analysis/${selectedId}` : "/upload")}
        >
          {datasets.length > 0 ? "View Analysis →" : "Upload Your Data →"}
        </button>
      </motion.div>
    </MainLayout>
  );
}
