import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, TrendingUp, Target, Bot,
  Share2, RefreshCw, Download, Upload,
  BarChart2, Plug,
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
import LiveKPIStream from "../components/LiveKPIStream";
import AlertsPanel from "../components/AlertsPanel";
import BusinessPulseCard from "../components/BusinessPulseCard";
import { fetchAnalysis, api } from "../services/api";
import type { AnalysisReport } from "../types";

const LIVE_REFRESH_INTERVAL = 30;

export default function AnalysisPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveMode, setLiveMode] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchRef = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resolvedId = fileId || localStorage.getItem("lastDatasetId") || "";

  const loadAnalysis = useCallback(
    (silent = false) => {
      if (!resolvedId) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      fetchAnalysis(resolvedId)
        .then((res) => {
          setReport(res.data as AnalysisReport);
          lastFetchRef.current = new Date();
          setSecondsAgo(0);
          setError("");
        })
        .catch(() => {
          if (!silent) setError("Failed to load analysis. The file may have been removed.");
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [resolvedId]
  );

  useEffect(() => {
    if (!resolvedId) {
      setError("No dataset selected. Please choose a dataset from history.");
      setLoading(false);
      return;
    }
    localStorage.setItem("lastDatasetId", resolvedId);
    loadAnalysis();
  }, [resolvedId]);

  useEffect(() => {
    if (!liveMode || !resolvedId) return;
    timerRef.current = setInterval(() => loadAnalysis(true), LIVE_REFRESH_INTERVAL * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [liveMode, resolvedId, loadAnalysis]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleExport = () => {
    if (!report) return;
    const summary = {
      filename: report.filename,
      industry: report.analysis.industry,
      rows: report.analysis.shape.rows,
      columns: report.analysis.shape.columns,
      numeric_summary: report.analysis.numeric_summary,
      generated_at: report.analysis.generated_at,
    };
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.filename}-summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const id = report?.file_id || resolvedId;

  const nextSteps = [
    { icon: <FileText size={18} />, label: "Export Report",   desc: "PDF / PPTX / Excel",      to: `/reports/${id}` },
    { icon: <TrendingUp size={18} />, label: "Predictions",   desc: "ML Forecasting",           to: `/predictions/${id}` },
    { icon: <Target size={18} />,  label: "Scenarios",        desc: "What-If Simulation",       to: `/scenarios/${id}` },
    { icon: <Bot size={18} />,     label: "AI Copilot",       desc: "Ask Your Data",            to: `/ai-chat/${id}` },
    { icon: <Plug size={18} />,    label: "Live Sheets",      desc: "Connect Google Sheets",    to: "/google-sheets" },
  ];

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Analysis Dashboard"
        title="Dataset Intelligence"
        description="KPIs, charts, business insights, health scores, and AI-powered analytics."
        actions={
          <>
            <button type="button" className="button button-secondary button-sm" onClick={() => navigate("/datasets")}>
              <ArrowLeft size={14} /> Datasets
            </button>
            {id && (
              <>
                <button type="button" className="button button-secondary button-sm" onClick={() => navigate(`/reports/${id}`)}>
                  <FileText size={14} /> Report
                </button>
                <button type="button" className="button button-secondary button-sm" onClick={() => navigate(`/predictions/${id}`)}>
                  <TrendingUp size={14} /> Predictions
                </button>
                <button type="button" className="button button-primary button-sm" onClick={() => navigate(`/ai-chat/${id}`)}>
                  <Bot size={14} /> AI Copilot
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
          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {report.analysis.industry && (
                <span className="industry-badge">{report.analysis.industry}</span>
              )}
              <button
                type="button"
                onClick={() => setLiveMode((m) => !m)}
                className={liveMode ? "live-indicator" : "badge badge-neutral"}
                style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span className={liveMode ? "live-dot" : undefined} />
                {liveMode ? "Live" : "Paused"}
              </button>
              {liveMode && lastFetchRef.current && (
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {refreshing ? "Refreshing…" : secondsAgo < 5 ? "Just updated" : `Updated ${secondsAgo}s ago`}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <Share2 size={13} />
                {sharing ? "Sharing…" : shareUrl ? "Copy link" : "Share"}
              </button>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={() => loadAnalysis(true)}
                disabled={refreshing}
              >
                <RefreshCw size={13} className={refreshing ? "spin" : ""} />
                Refresh
              </button>
              <button type="button" className="button button-secondary button-sm" onClick={handleExport}>
                <Download size={13} /> Export JSON
              </button>
            </div>
          </motion.div>

          {/* Proactive AI Insights */}
          {id && (
            <ProactiveInsights
              fileId={id}
              analysisData={report.analysis as unknown as Record<string, unknown>}
            />
          )}

          {/* Business Pulse */}
          {id && <BusinessPulseCard fileId={id} />}

          {/* Alerts */}
          {id && <AlertsPanel fileId={id} refreshInterval={60} />}

          {/* Live KPI Stream */}
          {id && (
            <LiveKPIStream fileId={id} refreshInterval={liveMode ? LIVE_REFRESH_INTERVAL : 999999} />
          )}

          {/* Summary + KPI grid */}
          <div className="overview-grid" style={{ marginBottom: 20 }}>
            <SectionCard title="Dataset Summary" index={0}>
              <div className="summary-grid" style={{ marginBottom: 16 }}>
                {[
                  { label: "Rows",    value: report.analysis.shape.rows.toLocaleString() },
                  { label: "Columns", value: report.analysis.shape.columns },
                  (() => {
                    const entries = Object.entries(report.analysis.numeric_summary ?? {});
                    const main = entries.find(([k]) => /revenue|sales|amount|total|price|value/i.test(k)) ?? entries[0];
                    return {
                      label: main ? main[0] : "Total",
                      value: main ? main[1].total.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "N/A",
                    };
                  })(),
                  (() => {
                    const entries = Object.entries(report.analysis.numeric_summary ?? {});
                    const qty = entries.find(([k]) => /quantity|qty|units|count/i.test(k)) ?? entries[1];
                    return {
                      label: qty ? `Avg ${qty[0]}` : "Average",
                      value: qty ? qty[1].mean.toFixed(1) : "N/A",
                    };
                  })(),
                ].map((item, i) => (
                  <div key={i} className="summary-tile" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 18px" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                      {item.label}
                    </span>
                    <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>

              {report.analysis.columns.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                    Detected columns
                  </p>
                  <div className="column-tags">
                    {report.analysis.columns.map((col) => (
                      <span key={col} className="column-tag">{col}</span>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Key Metrics" index={1}>
              <KPICards data={report.analysis.numeric_summary} />
            </SectionCard>
          </div>

          {/* Health Score */}
          {id && <HealthScoreCard fileId={id} />}

          {/* Charts */}
          <SectionCard title="Business Charts" description="Visual breakdown of your dataset metrics." index={2}>
            <Charts data={report.analysis.chart_data} fileId={id} />
          </SectionCard>

          {/* Insights */}
          <SectionCard title="Actionable Insights" description="AI-generated observations and recommendations." index={3}>
            <Insights analysis={report.analysis} filename={report.filename} fileId={report.file_id} />
          </SectionCard>

          {/* Next steps nav */}
          <SectionCard title="Continue Your Analysis" description="Explore more capabilities for this dataset." index={4}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {nextSteps.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className="button button-secondary"
                  style={{ flexDirection: "column", gap: 8, padding: "18px 14px", height: "auto", alignItems: "center" }}
                  onClick={() => navigate(item.to)}
                >
                  <span style={{ color: "var(--primary-light)" }}>{item.icon}</span>
                  <strong style={{ fontSize: "0.875rem" }}>{item.label}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>{item.desc}</span>
                </button>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <EmptyState
          icon={<BarChart2 size={24} />}
          title="No analysis available"
          description="Upload a dataset to generate your first AI-powered analysis."
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
