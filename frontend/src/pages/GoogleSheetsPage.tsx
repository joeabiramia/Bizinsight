import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";

export default function GoogleSheetsPage() {
  return (
    <MainLayout>
      <PageHeader
        eyebrow="Live Data"
        title="Google Sheets Connector"
        description="Connect a public Google Sheet as a live data source with automatic refresh."
      />
      <ComingSoonBanner feature="Google Sheets Connector" />
    </MainLayout>
  );
}

function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 24px", textAlign: "center",
        background: "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05))",
        border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16,
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
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.08em" }}>COMING SOON</span>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.5rem", color: "var(--text)" }}>{feature}</h2>
        <p style={{ margin: "0 0 8px", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6 }}>
          Live Data functionality is currently under development and will be available in a future release.
        </p>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
          In the meantime, use the <strong>Upload</strong> feature to analyze your data files.
        </p>
      </div>
    </div>
  );
}
