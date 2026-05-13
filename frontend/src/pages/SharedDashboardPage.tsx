import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import KPICards from "../components/KPICards";
import Charts from "../components/Charts";
import Insights from "../components/Insights";
import { api } from "../services/api";
import type { AnalysisReport } from "../types";

interface PublicData {
  token: string;
  label: string;
  filename: string;
  views: number;
  file_id: string;
  analysis: AnalysisReport["analysis"];
}

export default function SharedDashboardPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get(`/public/dashboard/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError("This link is invalid or has been revoked."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"var(--bg,#0a0a14)", padding:"40px 24px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <LoadingSkeleton rows={6} />
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight:"100vh", background:"var(--bg,#0a0a14)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"3rem", marginBottom:16 }}>🔒</div>
        <h2 style={{ color:"var(--text,#f1f5f9)" }}>Link Not Found</h2>
        <p style={{ color:"var(--muted,#64748b)" }}>{error || "This shared dashboard is no longer available."}</p>
      </div>
    </div>
  );

  const analysis = data.analysis;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg,#0a0a14)", padding:"0 0 48px" }}>
      {/* Header bar */}
      <div style={{ background:"var(--surface,#1e1e2e)", borderBottom:"1px solid var(--border,#2d2d3d)", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:"#6366f1", color:"#fff", fontWeight:800, fontSize:"0.8rem", padding:"4px 10px", borderRadius:8 }}>BI</div>
          <div>
            <p style={{ margin:0, fontWeight:700, color:"var(--text,#f1f5f9)", fontSize:"0.95rem" }}>{data.label}</p>
            <p style={{ margin:0, fontSize:"0.75rem", color:"var(--muted,#64748b)" }}>Shared dashboard · {data.filename}</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:"0.75rem", color:"var(--muted,#64748b)" }}>{data.views} view{data.views !== 1 ? "s" : ""}</span>
          <span style={{ background:"rgba(34,197,94,0.12)", color:"#22c55e", fontSize:"0.72rem", fontWeight:700, padding:"3px 10px", borderRadius:20 }}>READ ONLY</span>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        {/* Industry + Summary */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          {analysis.industry && <span className="industry-badge">{analysis.industry}</span>}
          <span style={{ fontSize:"0.82rem", color:"var(--muted,#64748b)" }}>
            {analysis.shape?.rows?.toLocaleString()} rows · {analysis.shape?.columns} columns
          </span>
        </div>

        {/* KPIs */}
        <SectionCard title="Key Metrics">
          <KPICards data={analysis.numeric_summary} />
        </SectionCard>

        {/* Charts */}
        <SectionCard title="Business Charts">
          <Charts data={analysis.chart_data} />
        </SectionCard>

        {/* Insights */}
        <SectionCard title="Actionable Insights">
          <Insights analysis={analysis} filename={data.filename} fileId={data.file_id} />
        </SectionCard>

        <p style={{ textAlign:"center", color:"var(--muted,#64748b)", fontSize:"0.78rem", marginTop:32 }}>
          Powered by <strong>BizInsight AI</strong> · Read-only shared view
        </p>
      </div>
    </div>
  );
}
