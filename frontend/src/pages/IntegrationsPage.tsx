import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import ConnectorCard from "../components/ConnectorCard";
import { listSources, refreshSource } from "../services/api";

interface Source {
  source_id: string;
  source_name: string;
  source_type: string;
  status: string;
  last_synced_at: string | null;
  row_count: number;
  column_count: number;
  file_id?: string;
  error?: string | null;
  shop_domain?: string;
  store_info?: { name?: string; currency?: string };
  order_count?: number;
}

const CONNECTOR_META: Record<
  string,
  { logo: string; name: string; route: string }
> = {
  google_sheets: {
    logo: "📊",
    name: "Google Sheets",
    route: "/google-sheets",
  },
  excel_online: {
    logo: "📗",
    name: "Excel Online / OneDrive",
    route: "/excel-online",
  },
  shopify: {
    logo: "🛍",
    name: "Shopify",
    route: "/shopify",
  },
};

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [sources, setSources] = useState<Source[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSources = () => {
    listSources()
      .then((r) => setSources(r.data.sources ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleRefresh = async (sourceId: string) => {
    setRefreshing(sourceId);
    try {
      await refreshSource(sourceId);
      loadSources();
    } catch {
      // silent
    } finally {
      setRefreshing(null);
    }
  };

  const connectedByType = sources.reduce<Record<string, Source[]>>(
    (acc, src) => {
      const t = src.source_type;
      if (!acc[t]) acc[t] = [];
      acc[t].push(src);
      return acc;
    },
    {}
  );

  const totalRows = sources.reduce((s, src) => s + (src.row_count || 0), 0);
  const connectedCount = sources.filter((s) => s.status === "synced").length;

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Live Data</p>
          <h1>Integrations Hub</h1>
          <p className="section-description">
            Connect your business data sources for real-time AI analysis and
            automatic dashboard updates.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate("/upload")}
          >
            ↑ Manual Upload
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {sources.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Connected Sources", value: connectedCount, color: "#22c55e" },
            { label: "Total Rows Synced", value: totalRows.toLocaleString(), color: "#3b82f6" },
            { label: "Source Types", value: Object.keys(connectedByType).length, color: "#8b5cf6" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: stat.color,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Connected sources */}
      {sources.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Active Sources
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {sources.map((src) => {
              const meta = CONNECTOR_META[src.source_type] ?? {
                logo: "🔗",
                name: src.source_type,
                route: "/integrations",
              };
              return (
                <ConnectorCard
                  key={src.source_id}
                  logo={meta.logo}
                  name={src.source_name}
                  description={
                    src.source_type === "shopify"
                      ? `${src.shop_domain ?? ""} · ${src.order_count ?? 0} orders · ${src.store_info?.currency ?? ""}`
                      : `${src.row_count.toLocaleString()} rows · ${src.column_count} columns`
                  }
                  status={src.status === "synced" ? "connected" : "available"}
                  lastSynced={src.last_synced_at}
                  rowCount={src.row_count}
                  onViewDashboard={
                    src.file_id
                      ? () => navigate(`/analysis/${src.file_id}`)
                      : undefined
                  }
                  onRefresh={() => handleRefresh(src.source_id)}
                  refreshing={refreshing === src.source_id}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Available connectors */}
      <div>
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {sources.length > 0 ? "Add Another Source" : "Connect a Data Source"}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <ConnectorCard
            logo="📊"
            name="Google Sheets"
            description="Connect any public Google Sheet. Data syncs automatically every 15–60 seconds."
            status="available"
            badge="FREE"
            onClick={() => navigate("/google-sheets")}
          />
          <ConnectorCard
            logo="📗"
            name="Excel Online / OneDrive"
            description="Sync Excel spreadsheets from your Microsoft OneDrive in real time."
            status="available"
            badge="OAUTH"
            onClick={() => navigate("/excel-online")}
          />
          <ConnectorCard
            logo="🛍"
            name="Shopify"
            description="Live orders, products, inventory, and customer data from your Shopify store."
            status="available"
            badge="LIVE"
            onClick={() => navigate("/shopify")}
          />
          <ConnectorCard
            logo="📦"
            name="WooCommerce"
            description="Connect your WordPress WooCommerce store for live e-commerce analytics."
            status="coming_soon"
          />
          <ConnectorCard
            logo="💳"
            name="Stripe"
            description="Real-time revenue, subscriptions, and payment analytics."
            status="coming_soon"
          />
          <ConnectorCard
            logo="🔄"
            name="HubSpot CRM"
            description="Sync deals, contacts, and pipeline data for AI-powered sales insights."
            status="coming_soon"
          />
        </div>
      </div>

      {/* Upload fallback CTA */}
      {sources.length === 0 && !loading && (
        <div
          style={{
            marginTop: 32,
            padding: "24px",
            borderRadius: 14,
            border: "1px dashed var(--border)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "0.9rem",
              color: "var(--muted)",
            }}
          >
            Not ready for live connectors?
          </p>
          <button
            type="button"
            className="button button-secondary"
            style={{ fontSize: "0.85rem" }}
            onClick={() => navigate("/upload")}
          >
            Upload a CSV or Excel file manually
          </button>
        </div>
      )}
    </MainLayout>
  );
}
