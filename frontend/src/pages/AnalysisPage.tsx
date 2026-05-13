import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import KPICards from "../components/KPICards";
import Charts from "../components/Charts";
import Insights from "../components/Insights";
import HealthScoreCard from "../components/HealthScoreCard";
import { fetchAnalysis } from "../services/api";
import type { AnalysisReport } from "../types";

export default function AnalysisPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = fileId || localStorage.getItem("lastDatasetId");
    if (!id) {
      setError("No dataset selected. Please choose a dataset from history.");
      setLoading(false);
      return;
    }
    localStorage.setItem("lastDatasetId", id);
    fetchAnalysis(id)
      .then((res) => setReport(res.data as AnalysisReport))
      .catch(() => setError("Failed to load analysis. The file may have been removed."))
      .finally(() => setLoading(false));
  }, [fileId]);

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

  const id = report?.file_id || fileId || "";

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Analysis dashboard</p>
          <h1>Dataset Intelligence</h1>
          <p className="section-description">
            KPIs, charts, business insights, health scores, and AI-powered analytics.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate("/datasets")}>
            ← Datasets
          </button>
          {id && (
            <button type="button" className="button button-secondary" onClick={() => navigate(`/reports/${id}`)}>
              📄 Export Report
            </button>
          )}
          {id && (
            <button type="button" className="button button-secondary" onClick={() => navigate(`/predictions/${id}`)}>
              🔮 Predictions
            </button>
          )}
          {id && (
            <button type="button" className="button button-secondary" onClick={() => navigate(`/scenarios/${id}`)}>
              🎯 Scenarios
            </button>
          )}
          {id && (
            <button type="button" className="button button-primary" onClick={() => navigate(`/ai-chat/${id}`)}>
              🤖 AI Copilot
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : report ? (
        <>
          {/* Action row */}
          <div className="analysis-actions">
            {report.analysis.industry && (
              <span className="industry-badge">{report.analysis.industry}</span>
            )}
            <button type="button" className="button button-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }} onClick={handleExport}>
              Export JSON
            </button>
          </div>

          {/* Summary + KPI grid */}
          <div className="overview-grid">
            <SectionCard title="Dataset Summary">
              <div className="summary-grid">
                <div className="summary-tile">
                  <span>Rows</span>
                  <strong>{report.analysis.shape.rows.toLocaleString()}</strong>
                </div>
                <div className="summary-tile">
                  <span>Columns</span>
                  <strong>{report.analysis.shape.columns}</strong>
                </div>
                {(() => {
                  const numericEntries = Object.entries(report.analysis.numeric_summary ?? {});
                  const mainEntry = numericEntries.find(([k]) =>
                    /revenue|sales|amount|total|price|value/i.test(k)
                  ) ?? numericEntries[0];
                  const qtyEntry = numericEntries.find(([k]) =>
                    /quantity|qty|units|count/i.test(k)
                  ) ?? numericEntries[1];
                  return (
                    <>
                      <div className="summary-tile">
                        <span>{mainEntry ? mainEntry[0] : "Total"}</span>
                        <strong>
                          {mainEntry
                            ? mainEntry[1].total.toLocaleString(undefined, { maximumFractionDigits: 0 })
                            : "N/A"}
                        </strong>
                      </div>
                      <div className="summary-tile">
                        <span>{qtyEntry ? `Avg ${qtyEntry[0]}` : "Avg"}</span>
                        <strong>
                          {qtyEntry ? qtyEntry[1].mean.toFixed(1) : "N/A"}
                        </strong>
                      </div>
                    </>
                  );
                })()}
              </div>

              {report.analysis.columns.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <p style={{ margin: "0 0 8px", fontSize: "0.88rem", color: "var(--muted)" }}>
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

            <SectionCard title="Key Metrics">
              <KPICards data={report.analysis.numeric_summary} />
            </SectionCard>
          </div>

          {/* Business Health Score */}
          {id && <HealthScoreCard fileId={id} />}

          <SectionCard title="Business Charts">
            <Charts data={report.analysis.chart_data} />
          </SectionCard>

          <SectionCard title="Actionable Insights">
            <Insights analysis={report.analysis} filename={report.filename} fileId={report.file_id} />
          </SectionCard>

          {/* Quick navigation to new features */}
          <div className="section-card" style={{ padding: "20px 24px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Continue Your Analysis</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {[
                { icon: "📄", label: "Export Report", desc: "PDF / PPTX / Excel", to: `/reports/${id}` },
                { icon: "🔮", label: "Predictions",   desc: "ML Forecasting",      to: `/predictions/${id}` },
                { icon: "🎯", label: "Scenarios",     desc: "What-If Simulation",  to: `/scenarios/${id}` },
                { icon: "🤖", label: "AI Copilot",    desc: "Ask Your Data",       to: `/ai-chat/${id}` },
              ].map(item => (
                <button
                  key={item.to}
                  className="button button-secondary"
                  style={{ flexDirection: "column", gap: 4, padding: "16px", height: "auto", textAlign: "center" }}
                  onClick={() => navigate(item.to)}
                  type="button"
                >
                  <span style={{ fontSize: "1.4rem" }}>{item.icon}</span>
                  <strong style={{ fontSize: "0.93rem" }}>{item.label}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="no-dataset-state">
          <h3>No analysis available</h3>
          <p>Upload a dataset to generate your first analysis.</p>
          <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
            Upload Dataset
          </button>
        </div>
      )}
    </MainLayout>
  );
}
