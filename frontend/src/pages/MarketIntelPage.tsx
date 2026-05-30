import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { fetchContextualMarketInsights } from "../services/api";
import type { MarketIntelligence } from "../types";

export default function MarketIntelPage() {
  const { fileId: paramFileId } = useParams();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [data, setData] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    fetchContextualMarketInsights(fileId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load market intelligence"))
      .finally(() => setLoading(false));
  }, [fileId]);

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Market Intelligence</p>
          <h1>Market Context</h1>
          <p className="section-description">
            Industry trends and benchmarks contextualized to your business data.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="section-card"><div className="loading-row" style={{ height: 200 }} /></div>}

      {data && (
        <>
          <div className="section-card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>ðŸŒ</span>
              <div>
                <strong>{data.industry} Market Intelligence</strong>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                  As of {data.as_of_date} Â· {data.integration_note}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Trends */}
            <div className="section-card">
              <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Market Trends</h3>
              {data.market_trends.map((t, i) => (
                <div
                  key={i}
                  className="insight-card insight-card--performance"
                  style={{
                    borderLeft: `4px solid ${t.direction === "positive" ? "#22c55e" : t.direction === "negative" ? "#ef4444" : "#f59e0b"}`,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>
                      {t.direction === "positive" ? "ðŸ“ˆ" : t.direction === "negative" ? "ðŸ“‰" : "âž¡ï¸"}
                    </span>
                    <strong>{t.title}</strong>
                    <span className={t.impact === "high" ? "badge badge-danger" : t.impact === "medium" ? "badge badge-warning" : "badge badge-success"}>
                      {t.impact} impact
                    </span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{t.summary}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary, #9ca3af)", marginTop: 6 }}>
                    Source: {t.source}
                  </p>
                </div>
              ))}
            </div>

            <div>
              {/* Benchmarks */}
              <div className="section-card" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Industry Benchmarks</h3>
                {Object.keys(data.industry_benchmarks).length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No benchmarks available.</p>
                ) : (
                  Object.entries(data.industry_benchmarks).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border, #e5e7eb)",
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {k.replace(/_/g, " ")}
                      </span>
                      <strong>
                        {typeof v === "number"
                          ? k.includes("pct") || k.includes("rate")
                            ? `${v}%`
                            : k.includes("usd") || k.includes("value")
                            ? `$${v.toLocaleString()}`
                            : v.toLocaleString()
                          : String(v)}
                      </strong>
                    </div>
                  ))
                )}
              </div>

              {/* Currency Rates */}
              <div className="section-card">
                <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Currency Rates</h3>
                {Object.entries(data.currency_rates)
                  .filter(([k]) => k !== "note")
                  .map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{k}</span>
                      <strong>{typeof v === "number" ? v.toFixed(4) : String(v)}</strong>
                    </div>
                  ))}
                {data.currency_rates.note && (
                  <p style={{ fontSize: 11, color: "var(--text-tertiary, #9ca3af)", marginTop: 8 }}>
                    {String(data.currency_rates.note)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contextual recommendations */}
          {data.contextual_recommendations && data.contextual_recommendations.length > 0 && (
            <div className="section-card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>AI Recommendations Based on Market Conditions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.contextual_recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className={`insight-card insight-card--${rec.type === "opportunity" ? "opportunity" : "risk"}`}
                    style={{
                      borderLeft: `4px solid ${rec.type === "opportunity" ? "#22c55e" : "#ef4444"}`,
                    }}
                  >
                    <strong>{rec.title}</strong>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{rec.insight}</p>
                    <p style={{ color: "#6366f1", fontSize: 13, marginTop: 6 }}>ðŸ’¡ {rec.action}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary, #9ca3af)", marginTop: 4 }}>
                      Source: {rec.source_label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}

