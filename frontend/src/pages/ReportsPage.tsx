import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import MainLayout from "../components/layout/MainLayout";
import { fetchAnalysis, generateNotifications, downloadWithAuth } from "../services/api";
import type { AnalysisData } from "../types";

type ExportFormat = "pdf" | "pptx" | "excel";

const FORMAT_CONFIG: Record<ExportFormat, { icon: string; label: string; ext: string; color: string; desc: string }> = {
  pdf: {
    icon: "📄",
    label: "PDF Report",
    ext: ".pdf",
    color: "rgba(239,68,68,0.15)",
    desc: "Professional multi-page report with KPIs, insights, charts, and recommendations.",
  },
  pptx: {
    icon: "📊",
    label: "PowerPoint",
    ext: ".pptx",
    color: "rgba(245,158,11,0.15)",
    desc: "Presentation-ready slides for executive meetings and board presentations.",
  },
  excel: {
    icon: "📋",
    label: "Excel Workbook",
    ext: ".xlsx",
    color: "rgba(34,197,94,0.15)",
    desc: "Structured workbook with KPI data, insights, and raw dataset for further analysis.",
  },
};

export default function ReportsPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifCount, setNotifCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;
    fetchAnalysis(fileId)
      .then(res => setAnalysis(res.data.analysis ?? res.data))
      .catch(() => setError("Could not load analysis data."));
  }, [fileId]);

  const handleDownload = async (format: ExportFormat) => {
    if (!fileId) return;
    setDownloading(format);
    setError(null);
    try {
      await downloadWithAuth(
        `/reports/${fileId}/${format}`,
        `bizinsight_report_${fileId.slice(0, 8)}.${FORMAT_CONFIG[format].ext.replace(".", "")}`
      );
    } catch {
      setError(`Failed to generate ${format.toUpperCase()} report. Ensure reportlab and python-pptx are installed.`);
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

  return (
    <MainLayout title="Executive Reports" subtitle={analysis?.industry ?? "Export & Notifications"}>
      {!fileId ? (
        <div className="empty-state-card">
          <div className="no-dataset-state">
            <span style={{ fontSize: "2rem" }}>📄</span>
            <h3>No Dataset Selected</h3>
            <p>Open a dataset analysis first, then use the Export button to reach this page.</p>
            <Link to="/datasets" className="button button-primary" style={{ marginTop: 8 }}>
              View Datasets
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Dataset summary */}
          {analysis && (
            <div className="section-card">
              <div className="section-card-header">
                <div>
                  <h2 style={{ margin: 0 }}>Dataset Overview</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>Report will be generated from this dataset</p>
                </div>
                <span className="industry-badge">{analysis.industry ?? "General"}</span>
              </div>
              <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 8 }}>
                {[
                  { label: "Records", value: analysis.shape.rows.toLocaleString() },
                  { label: "Columns", value: analysis.shape.columns },
                  { label: "KPI Metrics", value: Object.keys(analysis.numeric_summary ?? {}).length },
                  { label: "Industry", value: analysis.industry ?? "—" },
                ].map((item, i) => (
                  <div key={i} className="summary-tile" style={{ padding: 18 }}>
                    <p className="metric-label">{item.label}</p>
                    <p className="metric-value" style={{ fontSize: "1.4rem" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export cards */}
          <div className="section-card">
            <div className="section-card-header">
              <div>
                <h2 style={{ margin: 0 }}>Export Report</h2>
                <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                  Download an enterprise-grade report in your preferred format
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {(Object.entries(FORMAT_CONFIG) as [ExportFormat, typeof FORMAT_CONFIG.pdf][]).map(([fmt, cfg]) => (
                <motion.div
                  key={fmt}
                  className="report-export-card"
                  style={{ background: cfg.color }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="report-export-icon">{cfg.icon}</div>
                  <h3 className="report-export-title">{cfg.label}</h3>
                  <p className="report-export-desc">{cfg.desc}</p>
                  <button
                    className="button button-primary"
                    style={{ width: "100%", marginTop: 12 }}
                    onClick={() => handleDownload(fmt)}
                    disabled={downloading !== null}
                  >
                    {downloading === fmt ? "Generating…" : `Download ${cfg.ext}`}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Smart Notifications */}
          <div className="section-card">
            <div className="section-card-header">
              <div>
                <h2 style={{ margin: 0 }}>Smart Notifications</h2>
                <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                  Generate AI-powered alerts based on your data patterns
                </p>
              </div>
            </div>
            <div className="report-notif-info">
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.93rem", lineHeight: 1.6 }}>
                Our AI engine scans your dataset for revenue drops, regional underperformance, suspicious anomalies,
                data quality issues, and salesperson performance alerts. Generated notifications appear in the
                notification bell in the top navigation.
              </p>
              {notifCount !== null && (
                <div className="alert" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)", padding: "12px 16px", borderRadius: 12, marginBottom: 14 }}>
                  ✓ Generated {notifCount} notification{notifCount !== 1 ? "s" : ""}. Check the 🔔 bell in the navbar.
                </div>
              )}
              <button
                className="button button-primary"
                onClick={handleGenerateNotifications}
                disabled={notifLoading}
              >
                {notifLoading ? "Scanning data…" : "Generate Smart Notifications"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link to={`/analysis/${fileId}`} className="button button-secondary">
              ← Back to Analysis
            </Link>
            <Link to={`/predictions/${fileId}`} className="button button-primary">
              View Predictions →
            </Link>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
