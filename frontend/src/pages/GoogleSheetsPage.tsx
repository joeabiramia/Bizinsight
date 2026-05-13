import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { connectGoogleSheet, listSources, refreshSource } from "../services/api";

interface Source {
  source_id: string;
  source_name: string;
  source_type: string;
  status: string;
  last_synced_at: string | null;
  row_count: number;
  column_count: number;
  refresh_interval: number;
  file_id?: string;
  error?: string | null;
}

export default function GoogleSheetsPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [interval, setInterval] = useState(30);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const loadSources = () => {
    listSources()
      .then((res) => setSources(res.data.sources ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setConnecting(true);
    setError("");
    setSuccess("");
    try {
      const res = await connectGoogleSheet({
        sheet_url: url.trim(),
        source_name: name.trim() || undefined,
        refresh_interval: interval,
      });
      setSuccess(res.data.message);
      setUrl("");
      setName("");
      loadSources();
      setTimeout(() => {
        if (res.data.file_id) navigate(`/analysis/${res.data.file_id}`);
      }, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to connect Google Sheet.";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

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

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Live Data</p>
          <h1>Google Sheets Connector</h1>
          <p className="section-description">
            Connect a public Google Sheet as a live data source. Dashboards
            refresh automatically.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate("/upload")}
          >
            ← Upload Instead
          </button>
        </div>
      </div>

      {/* Connect form */}
      <div className="section-card" style={{ marginBottom: 28 }}>
        <h3 style={{ margin: "0 0 6px" }}>Connect a New Sheet</h3>
        <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "var(--muted)" }}>
          The sheet must be shared as "Anyone with the link can view".
        </p>

        <form onSubmit={handleConnect}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Google Sheet URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--input-bg, #0d0d1a)",
                  color: "var(--text)",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  Source Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q2 Sales Data"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--input-bg, #0d0d1a)",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  Auto-refresh (seconds)
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--input-bg, #0d0d1a)",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="alert alert-error" style={{ margin: 0 }}>
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#22c55e",
                  fontSize: "0.88rem",
                }}
              >
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              className="button button-primary"
              disabled={connecting}
              style={{ width: "fit-content" }}
            >
              {connecting ? "Connecting..." : "Connect Sheet"}
            </button>
          </div>
        </form>
      </div>

      {/* Connected sources */}
      {sources.length > 0 && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 16px" }}>Connected Sources</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map((src) => (
              <div
                key={src.source_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1rem" }}>📊</span>
                    <span style={{ fontWeight: 600, fontSize: "0.93rem" }}>
                      {src.source_name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background:
                          src.status === "synced"
                            ? "rgba(34,197,94,0.12)"
                            : src.status === "error"
                            ? "rgba(239,68,68,0.12)"
                            : "rgba(245,158,11,0.12)",
                        color:
                          src.status === "synced"
                            ? "#22c55e"
                            : src.status === "error"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {src.status}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {src.row_count.toLocaleString()} rows · {src.column_count} columns
                    {src.last_synced_at
                      ? ` · Last sync: ${new Date(src.last_synced_at).toLocaleTimeString()}`
                      : ""}
                  </p>
                  {src.error && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#ef4444" }}>
                      {src.error}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    onClick={() => handleRefresh(src.source_id)}
                    disabled={refreshing === src.source_id}
                  >
                    {refreshing === src.source_id ? "Syncing..." : "↻ Refresh"}
                  </button>
                  {src.file_id && (
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                      onClick={() => navigate(`/analysis/${src.file_id}`)}
                    >
                      View Dashboard →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
