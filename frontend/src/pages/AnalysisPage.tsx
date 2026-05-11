import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import KPICards from "../components/KPICards";
import Charts from "../components/Charts";
import Insights from "../components/Insights";
import { fetchAnalysis } from "../services/api";
import { AnalysisReport } from "../types";

export default function AnalysisPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resolvedId = fileId || localStorage.getItem("lastDatasetId") || "";

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

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Analysis dashboard</p>
          <h1>Dataset intelligence</h1>
          <p className="section-description">
            KPIs, charts, and business insights generated automatically from your file.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate("/datasets")}>
            Back to datasets
          </button>
          {report && (
            <button type="button" className="button button-primary" onClick={() => navigate(`/ai-chat/${report.file_id}`)}>
              Open AI chat
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
              <span className="industry-badge">
                {report.analysis.industry}
              </span>
            )}
            <button type="button" className="button button-secondary" onClick={handleExport}>
              Export summary JSON
            </button>
          </div>

          {/* Summary + KPI grid */}
          <div className="overview-grid">
            <SectionCard title="Dataset summary">
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

            <SectionCard title="Key metrics">
              <KPICards data={report.analysis.numeric_summary} />
            </SectionCard>
          </div>

          <SectionCard title="Business charts">
            <Charts data={report.analysis.chart_data} />
          </SectionCard>

          <SectionCard title="Actionable insights">
            <Insights analysis={report.analysis} filename={report.filename} fileId={report.file_id} />
          </SectionCard>
        </>
      ) : (
        <div className="no-dataset-state">
          <h3>No analysis available</h3>
          <p>Upload a dataset to generate your first analysis.</p>
          <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
            Upload dataset
          </button>
        </div>
      )}
    </MainLayout>
  );
}
