import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Presentation, Sheet, Bell, ArrowLeft, ArrowRight, Database, CheckCircle2 } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { fetchAnalysis, generateNotifications, downloadWithAuth } from "../services/api";
import type { AnalysisData } from "../types";

type ExportFormat = "pdf" | "pptx" | "excel";

const FORMAT_CONFIG: Record<ExportFormat, {
  icon: React.ReactNode; label: string; ext: string;
  accentColor: string; borderColor: string; desc: string;
}> = {
  pdf: {
    icon: <FileText size={28} />,
    label: "PDF Report",
    ext: "pdf",
    accentColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.25)",
    desc: "Professional multi-page report with KPIs, insights, charts, and recommendations.",
  },
  pptx: {
    icon: <Presentation size={28} />,
    label: "PowerPoint",
    ext: "pptx",
    accentColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.25)",
    desc: "Presentation-ready slides for executive meetings and board presentations.",
  },
  excel: {
    icon: <Sheet size={28} />,
    label: "Excel Workbook",
    ext: "xlsx",
    accentColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.25)",
    desc: "Structured workbook with KPI data, insights, and raw dataset for further analysis.",
  },
};

export default function ReportsPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [analysis, setAnalysis]       = useState<AnalysisData | null>(null);
  const [analysisLoading, setALoading] = useState(true);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifCount, setNotifCount]   = useState<number | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) { setALoading(false); return; }
    fetchAnalysis(fileId)
      .then(res => setAnalysis(res.data.analysis ?? res.data))
      .catch(() => setError("Could not load analysis data."))
      .finally(() => setALoading(false));
  }, [fileId]);

  const handleDownload = async (format: ExportFormat) => {
    if (!fileId) return;
    setDownloading(format);
    setError(null);
    try {
      await downloadWithAuth(
        `/reports/${fileId}/${format}`,
        `bizinsight_report_${fileId.slice(0, 8)}.${FORMAT_CONFIG[format].ext}`
      );
    } catch {
      setError(`Failed to generate ${format.toUpperCase()} report. Please ensure the backend has the required libraries installed.`);
    } finally {
      setDownloading(null);
    }
  };

  const handleGenerateNotifications = async () => {
    if (!fileId) return;
    setNotifLoading(true);
    try {
      const res = await generateNotifications(fileId);
      setNotifCount(res.data.generated);
    } catch {
      setError("Could not generate notifications.");
    } finally {
      setNotifLoading(false);
    }
  };

  if (!fileId) {
    return (
      <MainLayout>
        <EmptyState
          icon={<FileText size={24} />}
          title="No Dataset Selected"
          description="Open a dataset analysis first, then use the Export button to reach this page."
          action={<Link to="/datasets" className="button button-primary"><Database size={15} /> View Datasets</Link>}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Export & Reports"
        title="Executive Reports"
        description="Download board-ready reports in PDF, PowerPoint, or Excel format."
        actions={
          <Link to={`/analysis/${fileId}`} className="button button-secondary button-sm">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Dataset summary */}
        {analysisLoading ? (
          <LoadingSkeleton variant="metric" rows={4} cols={4} />
        ) : analysis ? (
          <div className="section-card">
            <div className="section-card-header">
              <div>
                <h2>Dataset Overview</h2>
                <p>Report will be generated from this dataset</p>
              </div>
              {analysis.industry && <span className="industry-badge">{analysis.industry}</span>}
            </div>
            <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
              {[
                { label: "Records",     value: analysis.shape.rows.toLocaleString() },
                { label: "Columns",     value: analysis.shape.columns },
                { label: "KPI Metrics", value: Object.keys(analysis.numeric_summary ?? {}).length },
                { label: "Industry",    value: analysis.industry ?? "General" },
              ].map((item, i) => (
                <div key={i} className="summary-tile" style={{ padding: 18 }}>
                  <p className="metric-label">{item.label}</p>
                  <p className="metric-value" style={{ fontSize: "1.4rem" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Export cards */}
        <div className="section-card">
          <div className="section-card-header">
            <h2>Export Report</h2>
            <p>Download an enterprise-grade report in your preferred format</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {(Object.entries(FORMAT_CONFIG) as [ExportFormat, typeof FORMAT_CONFIG.pdf][]).map(([fmt, cfg], i) => (
              <motion.div
                key={fmt}
                className="report-export-card"
                style={{ background: cfg.accentColor, borderColor: cfg.borderColor }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -3 }}
              >
                <div style={{ color: "var(--text-secondary)", marginBottom: 14 }}>{cfg.icon}</div>
                <h3 className="report-export-title">{cfg.label}</h3>
                <p className="report-export-desc">{cfg.desc}</p>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ width: "100%", marginTop: 16, justifyContent: "center" }}
                  onClick={() => handleDownload(fmt)}
                  disabled={downloading !== null}
                >
                  {downloading === fmt
                    ? "Generating…"
                    : `Download .${cfg.ext}`}
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Smart Notifications */}
        <div className="section-card">
          <div className="section-card-header">
            <div>
              <h2>Smart Notifications</h2>
              <p>Generate AI-powered alerts based on your data patterns</p>
            </div>
            <Bell size={20} style={{ color: "var(--primary-light)" }} />
          </div>

          <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Our AI engine scans your dataset for revenue drops, regional underperformance, suspicious anomalies,
            data quality issues, and performance alerts. Generated notifications appear in the bell icon in the navbar.
          </p>

          {notifCount !== null && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              <CheckCircle2 size={15} />
              Generated {notifCount} notification{notifCount !== 1 ? "s" : ""}. Check the bell in the top navigation.
            </div>
          )}

          <button
            type="button"
            className="button button-primary"
            onClick={handleGenerateNotifications}
            disabled={notifLoading}
          >
            <Bell size={15} />
            {notifLoading ? "Scanning data…" : "Generate Smart Notifications"}
          </button>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/analysis/${fileId}`} className="button button-secondary">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
          <Link to={`/predictions/${fileId}`} className="button button-primary">
            View Predictions <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
