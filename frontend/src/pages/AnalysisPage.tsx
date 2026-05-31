import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, TrendingUp, Target, Bot,
  Share2, RefreshCw, Download, Upload, BarChart2,
  ChevronRight, Activity, Lightbulb, LayoutGrid,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import ProactiveInsights from "../components/ProactiveInsights";
import KPICards from "../components/KPICards";
import Charts from "../components/Charts";
import Insights from "../components/Insights";
import HealthScoreCard from "../components/HealthScoreCard";
import AlertsPanel from "../components/AlertsPanel";
import BusinessPulseCard from "../components/BusinessPulseCard";
import { fetchAnalysis, api } from "../services/api";
import type { AnalysisReport } from "../types";

type Tab = "overview" | "charts" | "insights";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",  label: "Overview",               icon: <LayoutGrid size={14} /> },
  { id: "charts",    label: "Charts",                  icon: <BarChart2 size={14} /> },
  { id: "insights",  label: "Insights & Actions",      icon: <Lightbulb size={14} /> },
];

const LIVE_REFRESH_INTERVAL = 30;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function industryLabel(raw: string): string {
  const map: Record<string, string> = {
    "retail": "Retail & E-commerce", "technology": "SaaS / Technology",
    "finance": "Financial Services", "hr": "HR & Workforce",
    "logistics": "Logistics", "manufacturing": "Manufacturing",
    "travel": "Travel & Hospitality", "general": "General Business",
  };
  return map[raw?.toLowerCase()] || raw || "Business";
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{
      display: "flex",
      borderBottom: "2px solid var(--border)",
      marginBottom: 28,
      gap: 0,
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "11px 22px",
            fontSize: "0.875rem", fontWeight: active === tab.id ? 600 : 500,
            color: active === tab.id ? "var(--primary)" : "var(--text-secondary)",
            background: "none", border: "none",
            borderBottom: `2px solid ${active === tab.id ? "var(--primary)" : "transparent"}`,
            marginBottom: -2,
            cursor: "pointer",
            transition: "color 0.15s, border-color 0.15s",
          }}
        >
          <span style={{ color: active === tab.id ? "var(--primary)" : "var(--muted)" }}>
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Executive summary banner ───────────────────────────────────────────────────

function ExecutiveBanner({ report }: { report: AnalysisReport }) {
  const { analysis, filename } = report;
  const industry = industryLabel(analysis.industry ?? "");
  const rows     = analysis.shape?.rows ?? 0;
  const cols     = analysis.shape?.columns ?? 0;

  // Find the headline metric (highest-value numeric column)
  const numEntries = Object.entries(analysis.numeric_summary ?? {});
  const revEntry   = numEntries.find(([k]) => /revenue|sales|amount|total|income/i.test(k))
    ?? numEntries.sort((a, b) => b[1].total - a[1].total)[0];

  // Find the top categorical split
  const breakdowns   = analysis.chart_data?.breakdowns ?? {};
  const topBreakdown = Object.entries(breakdowns)[0];
  const topPerformer = topBreakdown?.[1]?.data?.[0];

  const bullets: string[] = [];
  if (revEntry) {
    bullets.push(`Total ${revEntry[0]}: ${fmt(revEntry[1].total)} across ${rows.toLocaleString()} records`);
  }
  if (topPerformer && topBreakdown) {
    const catCol = topBreakdown[1].data[0]?.name;
    const metCol = topBreakdown[1].value_column;
    if (catCol && metCol) {
      bullets.push(`Top performer: ${catCol} — ${fmt(topPerformer.value)} in ${metCol}`);
    }
  }
  if (numEntries.length > 1) {
    const second = numEntries.find(([k]) => /quantity|qty|units|orders|count/i.test(k));
    if (second) {
      bullets.push(`Average ${second[0]} per record: ${second[1].mean.toFixed(1)}`);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: "20px 24px",
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        marginBottom: 24,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
              {filename}
            </h2>
            <span style={{
              padding: "2px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 700,
              background: "var(--primary-dim)", color: "var(--primary)",
              textTransform: "capitalize",
            }}>
              {industry}
            </span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {rows.toLocaleString()} records · {cols} columns · Analysis complete
          </p>
          {bullets.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {bullets.map((b, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--text)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{
          padding: "10px 16px", borderRadius: 10,
          background: "var(--surface-alt)", border: "1px solid var(--border)",
          textAlign: "center", flexShrink: 0,
        }}>
          <Activity size={16} style={{ color: "var(--primary)", marginBottom: 4 }} />
          <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
                       letterSpacing: "0.05em", color: "var(--muted)" }}>Dataset size</p>
          <p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: "0.95rem" }}>
            {rows >= 1000 ? `${(rows / 1000).toFixed(1)}K rows` : `${rows} rows`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Overview tab — the story ────────────────────────────────────────────────────

function OverviewTab({ report, id, navigate }: { report: AnalysisReport; id: string; navigate: ReturnType<typeof useNavigate> }) {
  const nextSteps = [
    { icon: <Bot size={16} />,       label: "Ask AI Copilot",    desc: "Natural language queries on your data", to: `/ai-chat/${id}`,      primary: true },
    { icon: <TrendingUp size={16} />, label: "Forecasting",       desc: "Predict future performance",           to: `/predictions/${id}`,   primary: false },
    { icon: <Target size={16} />,     label: "Scenario Planner",  desc: "Model what-if business outcomes",      to: `/scenarios/${id}`,     primary: false },
    { icon: <FileText size={16} />,   label: "Export Report",     desc: "PDF, PowerPoint, or Excel",            to: `/reports/${id}`,       primary: false },
  ];

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* KPIs */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                     letterSpacing: "0.08em", color: "var(--muted)" }}>
          Key Performance Indicators
        </p>
        <KPICards data={report.analysis.numeric_summary} />
      </div>

      {/* Health score + top chart side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <HealthScoreCard fileId={id} />
        <SectionCard title="Performance Breakdown" index={0}>
          <Charts data={report.analysis.chart_data} fileId={id} maxCharts={1} />
        </SectionCard>
      </div>

      {/* Top 3 AI insights — the "what does it mean" layer */}
      <div className="section-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Key Findings</h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              AI-identified highlights from your data
            </p>
          </div>
        </div>
        <ProactiveInsights
          fileId={id}
          analysisData={report.analysis as unknown as Record<string, unknown>}
          compact
        />
      </div>

      {/* Next steps — where to go from here */}
      <div className="section-card">
        <h3 style={{ margin: "0 0 4px", fontSize: "0.95rem", fontWeight: 700 }}>Continue your analysis</h3>
        <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          Go deeper with AI-powered tools built on this dataset.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {nextSteps.map(step => (
            <button
              key={step.to}
              type="button"
              onClick={() => navigate(step.to)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 6, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${step.primary ? "var(--primary)" : "var(--border)"}`,
                background: step.primary ? "var(--primary-dim)" : "var(--surface)",
                color: "var(--text)", textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--primary-dim)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = step.primary ? "var(--primary)" : "var(--border)"; e.currentTarget.style.background = step.primary ? "var(--primary-dim)" : "var(--surface)"; }}
            >
              <span style={{ color: "var(--primary)" }}>{step.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 600 }}>{step.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.73rem", color: "var(--text-secondary)", fontWeight: 400 }}>{step.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Charts tab ─────────────────────────────────────────────────────────────────

function ChartsTab({ report, id }: { report: AnalysisReport; id: string }) {
  return (
    <motion.div
      key="charts"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Dataset snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Records",  value: (report.analysis.shape?.rows ?? 0).toLocaleString() },
          { label: "Columns",        value: report.analysis.shape?.columns ?? 0 },
          { label: "Numeric fields", value: report.analysis.column_types?.numeric?.length ?? 0 },
          { label: "Category fields",value: report.analysis.column_types?.categorical?.length ?? 0 },
        ].map((kpi, i) => (
          <div key={i} style={{
            padding: "16px", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--surface)",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase",
                         letterSpacing: "0.05em", color: "var(--muted)" }}>{kpi.label}</p>
            <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Detected columns */}
      {(report.analysis.columns ?? []).length > 0 && (
        <div className="section-card">
          <p style={{ margin: "0 0 10px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                       letterSpacing: "0.06em", color: "var(--muted)" }}>
            Detected columns
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {report.analysis.columns.map(col => (
              <span key={col} style={{
                padding: "3px 10px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 500,
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontFamily: "monospace",
              }}>
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All charts */}
      <SectionCard title="Data Visualisations" description="Auto-generated charts based on your dataset structure." index={0}>
        <Charts data={report.analysis.chart_data} fileId={id} />
      </SectionCard>

      {/* Alerts */}
      <AlertsPanel fileId={id} refreshInterval={60} />
    </motion.div>
  );
}

// ── Insights tab ───────────────────────────────────────────────────────────────

function InsightsTab({ report, id, navigate }: { report: AnalysisReport; id: string; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.div
      key="insights"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Business Pulse */}
      <BusinessPulseCard fileId={id} />

      {/* Full AI Insights */}
      <SectionCard
        title="Analysis & Recommendations"
        description="AI-identified patterns, risks, and growth opportunities from your data."
        index={0}
      >
        <Insights analysis={report.analysis} filename={report.filename} fileId={report.file_id} />
      </SectionCard>

      {/* Action CTA */}
      <div style={{
        padding: "20px 24px", borderRadius: 12,
        background: "var(--primary-dim)", border: "1px solid rgba(37,99,235,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.95rem" }}>
            Discuss these findings with AI
          </p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
            Ask follow-up questions, drill into specific metrics, and get recommendations tailored to your goals.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}
          onClick={() => navigate(`/ai-chat/${id}`)}
        >
          <Bot size={15} /> Open AI Copilot
          <ChevronRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { fileId } = useParams();
  const navigate   = useNavigate();

  const [report,     setReport]     = useState<AnalysisReport | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState<Tab>("overview");
  const [liveMode,   setLiveMode]   = useState(false);
  const [shareUrl,   setShareUrl]   = useState("");
  const [sharing,    setSharing]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastFetchRef = useRef<Date | null>(null);

  const resolvedId = fileId || localStorage.getItem("lastDatasetId") || "";

  const loadAnalysis = useCallback((silent = false) => {
    if (!resolvedId) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    fetchAnalysis(resolvedId)
      .then(res => {
        setReport(res.data as AnalysisReport);
        lastFetchRef.current = new Date();
        setSecondsAgo(0);
        setError("");
      })
      .catch(() => { if (!silent) setError("Failed to load analysis. The file may have been removed."); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [resolvedId]);

  useEffect(() => {
    if (!resolvedId) { setError("No dataset selected."); setLoading(false); return; }
    localStorage.setItem("lastDatasetId", resolvedId);
    loadAnalysis();
  }, [resolvedId]);

  useEffect(() => {
    if (!liveMode || !resolvedId) return;
    const id = setInterval(() => loadAnalysis(true), LIVE_REFRESH_INTERVAL * 1000);
    return () => clearInterval(id);
  }, [liveMode, resolvedId, loadAnalysis]);

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const id = report?.file_id || resolvedId;

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Analysis"
        title="Dataset Analysis"
        description={report ? `${report.filename} — ${(report.analysis.shape?.rows ?? 0).toLocaleString()} records` : "Loading…"}
        actions={
          <>
            <button type="button" className="button button-secondary button-sm"
                    onClick={() => navigate("/datasets")}>
              <ArrowLeft size={14} /> Datasets
            </button>
            {id && (
              <>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={async () => {
                    if (shareUrl) { navigator.clipboard?.writeText(window.location.origin + shareUrl); return; }
                    setSharing(true);
                    try {
                      const r = await api.post(`/share/create/${id}`, {});
                      setShareUrl(r.data.share_url);
                      navigator.clipboard?.writeText(window.location.origin + r.data.share_url);
                    } catch { /* silent */ } finally { setSharing(false); }
                  }}
                  disabled={sharing}
                >
                  <Share2 size={13} /> {sharing ? "Sharing…" : shareUrl ? "Copy link" : "Share"}
                </button>
                <button type="button" className="button button-secondary button-sm"
                        onClick={() => loadAnalysis(true)} disabled={refreshing}>
                  <RefreshCw size={13} /> {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </>
            )}
          </>
        }
      />

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <LoadingSkeleton variant="metric" rows={4} cols={4} />
          <LoadingSkeleton rows={5} />
        </div>
      ) : error ? (
        <EmptyState
          icon={<BarChart2 size={24} />}
          title="Analysis unavailable"
          description={error}
          action={
            <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
              <Upload size={15} /> Upload Dataset
            </button>
          }
        />
      ) : report ? (
        <>
          {/* Executive summary banner */}
          <ExecutiveBanner report={report} />

          {/* Tab navigation */}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <OverviewTab key="overview" report={report} id={id} navigate={navigate} />
            )}
            {activeTab === "charts" && (
              <ChartsTab key="charts" report={report} id={id} />
            )}
            {activeTab === "insights" && (
              <InsightsTab key="insights" report={report} id={id} navigate={navigate} />
            )}
          </AnimatePresence>
        </>
      ) : (
        <EmptyState
          icon={<BarChart2 size={24} />}
          title="No analysis available"
          description="Upload a dataset to generate your first business intelligence analysis."
          action={
            <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
              <Upload size={15} /> Upload Dataset
            </button>
          }
        />
      )}
    </MainLayout>
  );
}
