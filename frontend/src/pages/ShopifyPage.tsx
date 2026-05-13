import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import {
  connectShopify,
  getShopifyStoreInfo,
  syncShopify,
  listSources,
} from "../services/api";

interface StorePreview {
  name: string;
  domain: string;
  email: string;
  currency: string;
  country: string;
  plan: string;
}

interface Source {
  source_id: string;
  source_name: string;
  status: string;
  last_synced_at: string | null;
  row_count: number;
  order_count?: number;
  product_count?: number;
  shop_domain?: string;
  store_info?: { name?: string; currency?: string; country?: string };
  file_id?: string;
  error?: string | null;
}

export default function ShopifyPage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [previewing, setPreviewing] = useState(false);
  const [storePreview, setStorePreview] = useState<StorePreview | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  const loadSources = () => {
    listSources()
      .then((r) =>
        setSources(
          (r.data.sources ?? []).filter(
            (s: Source & { source_type: string }) => s.source_type === "shopify"
          )
        )
      )
      .catch(() => {});
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || !token.trim()) return;
    setPreviewing(true);
    setError("");
    setStorePreview(null);
    try {
      const r = await getShopifyStoreInfo(domain.trim(), token.trim());
      setStorePreview(r.data);
      setSourceName(r.data.name || domain.trim());
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not connect to store. Check your domain and token.";
      setError(msg);
    } finally {
      setPreviewing(false);
    }
  };

  const handleConnect = async () => {
    if (!storePreview) return;
    setConnecting(true);
    setError("");
    try {
      const r = await connectShopify({
        shop_domain: domain.trim(),
        access_token: token.trim(),
        source_name: sourceName.trim() || storePreview.name,
        refresh_interval: refreshInterval,
      });
      setSuccess(r.data.message);
      loadSources();
      setTimeout(() => {
        if (r.data.file_id) navigate(`/analysis/${r.data.file_id}`);
      }, 1800);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to connect Shopify store.";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      await syncShopify(sourceId);
      loadSources();
    } catch {
      // silent
    } finally {
      setSyncing(null);
    }
  };

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Live Data · E-Commerce</p>
          <h1>
            <span style={{ marginRight: 10 }}>🛍</span>
            Shopify Integration
          </h1>
          <p className="section-description">
            Connect your Shopify store for live orders, products, inventory, and
            customer analytics powered by AI.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate("/integrations")}
          >
            ← Integrations
          </button>
        </div>
      </div>

      {/* Connected stores */}
      {sources.length > 0 && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 14px" }}>Connected Stores</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map((src) => (
              <div
                key={src.source_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: "1.3rem" }}>🛍</span>
                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {src.source_name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: src.status === "synced" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        color: src.status === "synced" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {src.status === "synced" ? "LIVE" : src.status}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                    }}
                  >
                    <span>🛒 {(src.order_count ?? 0).toLocaleString()} orders</span>
                    <span>📦 {(src.product_count ?? 0).toLocaleString()} products</span>
                    <span>📊 {src.row_count.toLocaleString()} rows</span>
                    {src.store_info?.currency && <span>💱 {src.store_info.currency}</span>}
                    {src.last_synced_at && (
                      <span>
                        🕒 {new Date(src.last_synced_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {src.error && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#ef4444" }}>
                      ⚠ {src.error}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                    onClick={() => handleSync(src.source_id)}
                    disabled={syncing === src.source_id}
                  >
                    {syncing === src.source_id ? "Syncing..." : "↻ Sync"}
                  </button>
                  {src.file_id && (
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                      onClick={() => navigate(`/analysis/${src.file_id}`)}
                    >
                      Dashboard →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection form */}
      {!success && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 6px" }}>Connect a Shopify Store</h3>
          <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "var(--muted)" }}>
            Requires a Custom App access token from your Shopify Admin.
          </p>

          <form onSubmit={handlePreview}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label
                  style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}
                >
                  Shopify Store Domain *
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => { setDomain(e.target.value); setStorePreview(null); }}
                  placeholder="mystore.myshopify.com"
                  required
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--input-bg, #0d0d1a)",
                    color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Admin API Access Token *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTokenHelp(!showTokenHelp)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: "0.8rem" }}
                  >
                    How to get this?
                  </button>
                </div>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setStorePreview(null); }}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--input-bg, #0d0d1a)",
                    color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              {showTokenHelp && (
                <div style={{
                  padding: "14px 16px", borderRadius: 8,
                  background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
                  fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text)",
                }}>
                  <strong style={{ color: "#6366f1" }}>Getting your Shopify Access Token:</strong>
                  <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                    <li>Go to your Shopify Admin → Settings → Apps and sales channels</li>
                    <li>Click "Develop apps" → "Create an app"</li>
                    <li>Give it a name (e.g. "BizInsight")</li>
                    <li>Click "Configure Admin API scopes"</li>
                    <li>Enable: <code>read_orders</code>, <code>read_products</code>, <code>read_customers</code>, <code>read_inventory</code></li>
                    <li>Click "Install app" → copy the "Admin API access token"</li>
                  </ol>
                </div>
              )}

              {error && <div className="alert alert-error">{error}</div>}

              <button
                type="submit"
                className="button button-secondary"
                disabled={previewing || !domain.trim() || !token.trim()}
                style={{ width: "fit-content" }}
              >
                {previewing ? "Verifying..." : "Verify Store →"}
              </button>
            </div>
          </form>

          {/* Store preview */}
          {storePreview && (
            <div
              style={{
                marginTop: 20,
                padding: "18px 20px",
                borderRadius: 12,
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: "2rem" }}>🛍</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                    {storePreview.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                    {storePreview.domain}
                    {storePreview.country ? ` · ${storePreview.country}` : ""}
                    {storePreview.currency ? ` · ${storePreview.currency}` : ""}
                  </p>
                </div>
                <span
                  style={{
                    marginLeft: "auto",
                    background: "rgba(34,197,94,0.15)",
                    color: "#22c55e",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}
                >
                  ✓ VERIFIED
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>
                    Source Name
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--input-bg, #0d0d1a)",
                      color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>
                    Auto-refresh
                  </label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--input-bg, #0d0d1a)",
                      color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box",
                    }}
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={handleConnect}
                disabled={connecting}
                style={{ padding: "10px 28px", fontSize: "0.95rem" }}
              >
                {connecting ? "Syncing store data..." : "Connect & Sync Store →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {success && (
        <div style={{
          padding: "28px", borderRadius: 14,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>🎉</div>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "1.1rem" }}>Store Connected!</p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>{success}</p>
          <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            Redirecting to your live dashboard...
          </p>
        </div>
      )}

      {/* What gets synced */}
      {!success && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 16px" }}>What BizInsight Syncs from Shopify</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { icon: "🛒", label: "Orders", desc: "All orders with status, amount, date" },
              { icon: "📦", label: "Products", desc: "Product catalog with prices, inventory" },
              { icon: "👥", label: "Customers", desc: "Customer segments and lifetime value" },
              { icon: "🌍", label: "Regions", desc: "Revenue breakdown by city and country" },
              { icon: "📈", label: "Trends", desc: "Revenue, orders, and growth trends" },
              { icon: "🤖", label: "AI Insights", desc: "Automatic anomaly detection and alerts" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <span style={{ fontSize: "1.4rem", display: "block", marginBottom: 6 }}>
                  {item.icon}
                </span>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.88rem" }}>
                  {item.label}
                </p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
