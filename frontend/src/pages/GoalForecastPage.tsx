import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { api, listDatasets } from "../services/api";

interface ForecastPoint { period: number; projected_value: number; label: string; reached_target: boolean; }
interface GoalForecastResult {
  column: string; target: number; current_value: number; gap: number; gap_pct: number;
  trend_direction: string; mom_growth_pct: number; months_required: number | null;
  period_label: string; on_track: boolean; forecast: ForecastPoint[]; recommendations: string[];
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ background: "var(--border)", borderRadius: 8, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 8, transition: "width 0.6s ease" }} />
    </div>
  );
}

export default function GoalForecastPage() {
  const { fileId: paramFileId } = useParams<{ fileId?: string }>();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Array<{ file_id: string; filename: string }>>([]);
  const [fileId, setFileId] = useState(paramFileId ?? "");
  const [target, setTarget] = useState("");
  const [column, setColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoalForecastResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listDatasets().then(r => {
      const ds = r.data.datasets ?? [];
      setDatasets(ds);
      if (!fileId && ds.length > 0) setFileId(ds[0].file_id);
    }).catch(() => {});
  }, []);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileId || !target) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const params: Record<string, string | number> = { target: Number(target) };
      if (column.trim()) params.column = column.trim();
      const r = await api.get(`/goal-forecast/${fileId}`, { params });
      setResult(r.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Forecast failed.");
    } finally { setLoading(false); }
  };

  const trendColor = result?.trend_direction === "growing" ? "#22c55e" : "#ef4444";
  const progressPct = result ? Math.min(100, (result.current_value / result.target) * 100) : 0;

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">AI Forecasting</p>
          <h1>Goal-Based Forecast</h1>
          <p className="section-description">Set a revenue target — AI calculates how long it takes to get there and what's needed.</p>
        </div>
        {result && <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate(`/analysis/${fileId}`)}>← Dashboard</button>
        </div>}
      </div>

      <div className="section-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleRun}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>Dataset</label>
              <select value={fileId} onChange={e => setFileId(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }}>
                {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>Target Value *</label>
              <input type="number" required min={1} value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. 500000"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>Column (optional)</label>
              <input type="text" value={column} onChange={e => setColumn(e.target.value)} placeholder="Auto-detect"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="button button-primary" disabled={loading} style={{ width: "100%", fontSize: "0.9rem" }}>
                {loading ? "Forecasting…" : "Run Forecast →"}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        </form>
      </div>

      {result && (
        <>
          {/* Summary hero */}
          <div style={{ padding: "24px", borderRadius: 14, marginBottom: 20,
            background: `linear-gradient(135deg, ${result.on_track ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)"}, rgba(15,23,42,0.4))`,
            border: `1px solid ${result.on_track ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Target: {result.column}</p>
                <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "var(--text)" }}>
                  {result.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20, fontWeight: 700, fontSize: "0.88rem",
                  background: result.on_track ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: result.on_track ? "#22c55e" : "#ef4444" }}>
                  {result.on_track ? "✓ On Track" : "⚠ Off Track"}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 16 }}>
              {[
                { label: "Current Value", value: result.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "var(--text)" },
                { label: "Gap", value: result.gap.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: result.gap > 0 ? "#f59e0b" : "#22c55e" },
                { label: "MoM Growth", value: `${result.mom_growth_pct > 0 ? "+" : ""}${result.mom_growth_pct.toFixed(1)}%`, color: trendColor },
                { label: result.months_required ? `${result.months_required} ${result.period_label}s needed` : "Time Required", value: result.months_required ? `~${result.months_required}` : "N/A", color: trendColor },
              ].map(stat => (
                <div key={stat.label}>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{stat.label}</p>
                  <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.78rem", color: "var(--muted)" }}>
                <span>Progress to target</span><span>{progressPct.toFixed(1)}%</span>
              </div>
              <ProgressBar pct={progressPct} color={result.on_track ? "#22c55e" : "#f59e0b"} />
            </div>
          </div>

          {/* Forecast timeline */}
          <div className="section-card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px" }}>12-{result.period_label.charAt(0).toUpperCase() + result.period_label.slice(1)} Projection</h3>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", gap: 8, minWidth: "max-content", paddingBottom: 8 }}>
                {result.forecast.map(pt => (
                  <div key={pt.period} style={{ textAlign: "center", width: 72, padding: "10px 6px", borderRadius: 8,
                    background: pt.reached_target ? "rgba(34,197,94,0.12)" : "var(--surface)",
                    border: `1px solid ${pt.reached_target ? "rgba(34,197,94,0.3)" : "var(--border)"}` }}>
                    <p style={{ margin: "0 0 4px", fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600 }}>{pt.label}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: pt.reached_target ? "#22c55e" : "var(--text)" }}>
                      {pt.projected_value >= 1_000_000 ? `${(pt.projected_value / 1_000_000).toFixed(1)}M` : pt.projected_value >= 1_000 ? `${(pt.projected_value / 1_000).toFixed(0)}K` : pt.projected_value.toFixed(0)}
                    </p>
                    {pt.reached_target && <p style={{ margin: "4px 0 0", fontSize: "0.6rem", color: "#22c55e", fontWeight: 700 }}>TARGET</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 14px" }}>AI Recommendations</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {result.recommendations.map((r, i) => (
                <li key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: "0.88rem", lineHeight: 1.6 }}>
                  <span style={{ color: "#6366f1", flexShrink: 0, marginTop: 2 }}>→</span>{r}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </MainLayout>
  );
}
