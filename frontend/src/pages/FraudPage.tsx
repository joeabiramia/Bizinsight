import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { detectFraud } from "../services/api";
import type { FraudAlert, FraudReport } from "../types";

const RISK_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fee2e2", label: "CRITICAL" },
  high:     { color: "#ef4444", bg: "#fee2e2", label: "HIGH RISK" },
  medium:   { color: "#f59e0b", bg: "#fef3c7", label: "MEDIUM RISK" },
  low:      { color: "#22c55e", bg: "#dcfce7", label: "LOW RISK" },
};

const SEVERITY_COLORS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#3b82f6",
};

const TYPE_ICONS: Record<string, string> = {
  high_discount: "ðŸ’¸",
  abnormal_amount: "ðŸ’°",
  high_frequency_customer: "ðŸ‘¤",
  performance_spike: "ðŸ“ˆ",
  off_hours_activity: "ðŸ•",
};

export default function FraudPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [report, setReport] = useState<FraudReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => {
    if (!fileId) return;
    runScan();
  }, [fileId]);

  const runScan = async () => {
    if (!fileId) return;
    setLoading(true);
    setError("");
    try {
      const res = await detectFraud(fileId);
      setReport(res.data);
    } catch {
      setError("Failed to run fraud scan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = report?.alerts.filter(
    (a) => filter === "all" || a.severity === filter
  ) || [];

  if (!fileId) {
    return (
      <MainLayout>
        <div className="page-hero"><div><h1>Fraud Detection</h1></div></div>
        <div className="no-dataset-state">
          <h3>No dataset selected</h3>
          <p>Open a dataset to run fraud detection.</p>
          <button className="button button-primary" onClick={() => navigate("/datasets")}>Browse datasets</button>
        </div>
      </MainLayout>
    );
  }

  const riskStyle = report ? (RISK_STYLES[report.risk_level] || RISK_STYLES.low) : null;

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Fraud & Suspicious Activity Detection</p>
          <h1>Fraud Analysis</h1>
          <p className="section-description">
            Detect unusual patterns: abnormal discounts, transaction anomalies, suspicious customers, and off-hours activity.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={runScan} disabled={loading}>
            {loading ? "Scanningâ€¦" : "Re-scan"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="section-card" style={{ textAlign: "center", padding: "48px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Scanning for suspicious patternsâ€¦</p>
        </div>
      )}

      {report && !loading && (
        <>
          {/* Risk Score Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div
              className="section-card"
              style={{ borderLeft: `6px solid ${riskStyle?.color}`, background: riskStyle?.bg }}
            >
              <p style={{ fontSize: 12, color: riskStyle?.color, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4 }}>
                OVERALL RISK LEVEL
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <p style={{ fontSize: 48, fontWeight: 900, color: riskStyle?.color, margin: 0 }}>
                  {report.risk_score}
                </p>
                <div>
                  <p style={{ fontWeight: 700, color: riskStyle?.color, fontSize: 20 }}>{riskStyle?.label}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>out of 100</p>
                </div>
              </div>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Critical Alerts</p>
              <p className="kpi-value" style={{ color: "#ef4444" }}>{report.high_severity}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Medium Alerts</p>
              <p className="kpi-value" style={{ color: "#f59e0b" }}>{report.medium_severity}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Low Alerts</p>
              <p className="kpi-value" style={{ color: "#3b82f6" }}>{report.low_severity}</p>
            </div>
          </div>

          <div className="section-card" style={{ marginBottom: 16 }}>
            <p style={{ color: "var(--text-secondary)" }}>{report.summary}</p>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Columns analyzed:</span>
              {Object.entries(report.columns_analyzed)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k} className="chip">{k}: <strong>{v}</strong></span>
                ))}
            </div>
          </div>

          {/* Filter + Alerts */}
          <div className="section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{report.total_alerts} Suspicious Patterns</h2>
              <div style={{ display: "flex", gap: 8 }}>
                {(["all", "high", "medium", "low"] as const).map((f) => (
                  <button
                    key={f}
                    className="chip"
                    onClick={() => setFilter(f)}
                    style={filter === f ? { background: "var(--accent)", color: "#fff" } : {}}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 32, marginBottom: 8 }}>âœ…</p>
                <p>
                  <strong>No suspicious patterns detected</strong> at the selected severity level.{" "}
                  {filter !== "all" && "Try showing 'All' alerts."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredAlerts.map((alert: FraudAlert, i: number) => (
                  <div
                    key={i}
                    className="insight-card insight-card--risk"
                    style={{ borderLeft: `4px solid ${SEVERITY_COLORS[alert.severity]}` }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 20 }}>{TYPE_ICONS[alert.type] || "âš ï¸"}</span>
                          <strong>{alert.title}</strong>
                          <span className={`severity-badge severity-badge--${alert.severity === "high" ? "critical" : alert.severity === "medium" ? "high" : "low"}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 6 }}>{alert.description}</p>
                        {alert.value !== null && alert.value !== undefined && (
                          <p style={{ fontSize: 13 }}>
                            <strong>Value:</strong> {String(alert.value)}
                            {typeof alert.transaction_count === "number" && ` Â· ${alert.transaction_count} transactions`}
                            {typeof alert.total_amount === "number" && ` Â· $${alert.total_amount.toLocaleString()} total`}
                            {typeof alert.z_score === "number" && ` Â· Z-score: ${alert.z_score}`}
                          </p>
                        )}
                        <p style={{ color: "#6366f1", fontSize: 13, marginTop: 6 }}>
                          ðŸ’¡ {alert.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}

