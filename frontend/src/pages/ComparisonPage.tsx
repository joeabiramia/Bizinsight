import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { api, listDatasets } from "../services/api";

interface Dataset { file_id: string; filename: string; created_at?: string; }

interface MetricDiff {
  metric: string;
  total: { a: number; b: number; diff: number; pct_change: number | null; winner: string };
  mean: { a: number; b: number; diff: number; pct_change: number | null; winner: string };
}

interface CompareResult {
  label_a: string;
  label_b: string;
  file_id_a: string;
  file_id_b: string;
  meta_a: { rows: number; columns: number };
  meta_b: { rows: number; columns: number };
  comparison: MetricDiff[];
  only_in_a: string[];
  only_in_b: string[];
  shared_metrics: number;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function ComparisonPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listDatasets().then(r => setDatasets(r.data.datasets ?? [])).catch(() => {});
  }, []);

  const handleCompare = async () => {
    if (!idA || !idB || idA === idB) { setError("Select two different datasets."); return; }
    setComparing(true); setError(""); setResult(null);
    try {
      const r = await api.post("/compare", { file_id_a: idA, file_id_b: idB });
      setResult(r.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Comparison failed.");
    } finally { setComparing(false); }
  };

  const winnerColor = (w: string, side: "a" | "b") =>
    w === side ? "#22c55e" : w === "tie" ? "#3b82f6" : "#ef4444";

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Analysis</p>
          <h1>Compare Datasets</h1>
          <p className="section-description">Side-by-side KPI comparison — perfect for period-over-period or product-line analysis.</p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom:24 }}>
        <h3 style={{ margin:"0 0 16px" }}>Select Two Datasets</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:16, alignItems:"end" }}>
          <div>
            <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Dataset A</label>
            <select value={idA} onChange={e => setIdA(e.target.value)}
              style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }}>
              <option value="">Choose…</option>
              {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
            </select>
          </div>
          <div style={{ textAlign:"center", color:"var(--muted)", fontWeight:700, paddingBottom:8 }}>vs</div>
          <div>
            <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Dataset B</label>
            <select value={idB} onChange={e => setIdB(e.target.value)}
              style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }}>
              <option value="">Choose…</option>
              {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop:12 }}>{error}</div>}
        <button type="button" className="button button-primary" style={{ marginTop:16 }} onClick={handleCompare} disabled={comparing || !idA || !idB}>
          {comparing ? "Comparing…" : "Compare →"}
        </button>
      </div>

      {result && (
        <>
          {/* Meta comparison */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
            {(["a","b"] as const).map(side => (
              <div key={side} style={{ padding:"16px 20px", borderRadius:12, border:"1px solid var(--border)", background:"var(--surface)" }}>
                <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:"1rem" }}>{side === "a" ? result.label_a : result.label_b}</p>
                <p style={{ margin:0, fontSize:"0.8rem", color:"var(--muted)" }}>
                  {side === "a" ? result.meta_a.rows : result.meta_b.rows} rows · {side === "a" ? result.meta_a.columns : result.meta_b.columns} columns
                </p>
                <button type="button" className="button button-secondary" style={{ marginTop:10, fontSize:"0.78rem", padding:"4px 12px" }}
                  onClick={() => navigate(`/analysis/${side === "a" ? result.file_id_a : result.file_id_b}`)}>
                  View Dashboard →
                </button>
              </div>
            ))}
          </div>

          {/* Metric comparison table */}
          <div className="section-card">
            <h3 style={{ margin:"0 0 16px" }}>Metric Comparison ({result.shared_metrics} shared metrics)</h3>
            {result.comparison.length === 0 ? (
              <p style={{ color:"var(--muted)" }}>No shared numeric metrics found between these datasets.</p>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.88rem" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--border)" }}>
                      <th style={{ padding:"10px 14px", textAlign:"left", color:"var(--muted)", fontWeight:600, fontSize:"0.78rem", textTransform:"uppercase" }}>Metric</th>
                      <th style={{ padding:"10px 14px", textAlign:"right", color:"var(--muted)", fontWeight:600, fontSize:"0.78rem", textTransform:"uppercase" }}>A Total</th>
                      <th style={{ padding:"10px 14px", textAlign:"right", color:"var(--muted)", fontWeight:600, fontSize:"0.78rem", textTransform:"uppercase" }}>B Total</th>
                      <th style={{ padding:"10px 14px", textAlign:"right", color:"var(--muted)", fontWeight:600, fontSize:"0.78rem", textTransform:"uppercase" }}>Change</th>
                      <th style={{ padding:"10px 14px", textAlign:"center", color:"var(--muted)", fontWeight:600, fontSize:"0.78rem", textTransform:"uppercase" }}>Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.map(m => (
                      <tr key={m.metric} style={{ borderBottom:"1px solid var(--border)" }}>
                        <td style={{ padding:"12px 14px", fontWeight:600 }}>{m.metric}</td>
                        <td style={{ padding:"12px 14px", textAlign:"right", color: m.total.winner === "a" ? "#22c55e" : "var(--text)" }}>{fmt(m.total.a)}</td>
                        <td style={{ padding:"12px 14px", textAlign:"right", color: m.total.winner === "b" ? "#22c55e" : "var(--text)" }}>{fmt(m.total.b)}</td>
                        <td style={{ padding:"12px 14px", textAlign:"right" }}>
                          {m.total.pct_change !== null && (
                            <span style={{ color: m.total.pct_change >= 0 ? "#22c55e" : "#ef4444", fontWeight:600 }}>
                              {m.total.pct_change >= 0 ? "+" : ""}{m.total.pct_change.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td style={{ padding:"12px 14px", textAlign:"center" }}>
                          <span style={{ fontWeight:700, color: winnerColor(m.total.winner, "a"), fontSize:"0.82rem" }}>
                            {m.total.winner === "a" ? "A" : m.total.winner === "b" ? "B" : "TIE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(result.only_in_a.length > 0 || result.only_in_b.length > 0) && (
              <div style={{ marginTop:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, fontSize:"0.82rem", color:"var(--muted)" }}>
                {result.only_in_a.length > 0 && <div><strong>Only in A:</strong> {result.only_in_a.join(", ")}</div>}
                {result.only_in_b.length > 0 && <div><strong>Only in B:</strong> {result.only_in_b.join(", ")}</div>}
              </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
