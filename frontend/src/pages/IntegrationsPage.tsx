import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";

export default function IntegrationsPage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Live Data</p>
          <h1>Integrations Hub</h1>
          <p className="section-description">
            Connect your business data sources for real-time AI analysis and automatic dashboard updates.
          </p>
        </div>
      </div>

      {/* Coming Soon banner */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "64px 24px", textAlign: "center",
        background: "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05))",
        border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, marginBottom: 32,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(245,158,11,0.12)", border: "2px solid rgba(245,158,11,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2rem", marginBottom: 24,
        }}>
          🔧
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 20, padding: "4px 14px", marginBottom: 16,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.08em" }}>UNDER DEVELOPMENT</span>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.5rem", color: "var(--text)" }}>Live Data Connectors</h2>
        <p style={{ margin: "0 0 8px", color: "var(--text-secondary)", maxWidth: 520, lineHeight: 1.6 }}>
          Live Data functionality is currently under development and will be available in a future release.
          Google Sheets, Excel Online, and Shopify connectors are coming soon.
        </p>
        <p style={{ margin: "0 0 28px", color: "var(--muted)", fontSize: "0.85rem" }}>
          In the meantime, upload your data files to get started with AI analytics.
        </p>
        <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
          Upload Data File →
        </button>
      </div>

      {/* Upcoming connectors preview */}
      <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Planned Integrations
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {[
          { logo: "📊", name: "Google Sheets", desc: "Public spreadsheet live sync" },
          { logo: "📗", name: "Excel Online", desc: "OneDrive Excel integration" },
          { logo: "🛍", name: "Shopify", desc: "Orders, products & revenue" },
          { logo: "📦", name: "WooCommerce", desc: "WordPress store analytics" },
          { logo: "💳", name: "Stripe", desc: "Revenue & subscription data" },
          { logo: "🔄", name: "HubSpot CRM", desc: "Sales pipeline insights" },
        ].map((c) => (
          <div key={c.name} style={{
            padding: "18px 20px", borderRadius: 12,
            background: "var(--surface)", border: "1px solid var(--border)",
            opacity: 0.6, cursor: "not-allowed",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: "1.4rem" }}>{c.logo}</span>
              <span style={{ fontWeight: 700, fontSize: "0.93rem" }}>{c.name}</span>
              <span style={{ marginLeft: "auto", fontSize: "9px", fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                SOON
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}
