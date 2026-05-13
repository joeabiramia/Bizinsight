import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import {
  getExcelAuthUrl,
  listOneDriveFiles,
  connectExcelOnline,
  syncExcel,
  listSources,
  refreshSource,
} from "../services/api";

interface OneDriveFile {
  item_id: string;
  name: string;
  web_url: string;
  last_modified: string;
  size_bytes: number;
}

interface Source {
  source_id: string;
  source_name: string;
  status: string;
  last_synced_at: string | null;
  row_count: number;
  file_id?: string;
  error?: string | null;
}

type Step = "intro" | "auth" | "files" | "connecting" | "done";

export default function ExcelOnlinePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [authUrl, setAuthUrl] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [setupGuide, setSetupGuide] = useState("");

  // After OAuth callback tokens come back via URL or state
  const [tokens, setTokens] = useState<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
  } | null>(null);

  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [sources, setSources] = useState<Source[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const loadSources = () => {
    listSources()
      .then((r) => setSources((r.data.sources ?? []).filter((s: Source & { source_type: string }) => s.source_type === "excel_online")))
      .catch(() => {});
  };

  useEffect(() => {
    loadSources();
    // Check if OAuth is configured
    getExcelAuthUrl()
      .then((r) => {
        setIsConfigured(r.data.configured);
        setAuthUrl(r.data.auth_url || "");
        setSetupGuide(r.data.setup_guide || "");
      })
      .catch(() => {});

    // Check if returning from OAuth callback with tokens in localStorage
    const stored = localStorage.getItem("excel_tokens");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTokens(parsed);
        setStep("files");
        localStorage.removeItem("excel_tokens");
        fetchFiles(parsed);
      } catch {
        localStorage.removeItem("excel_tokens");
      }
    }
  }, []);

  const fetchFiles = async (t: typeof tokens) => {
    if (!t) return;
    setLoadingFiles(true);
    setError("");
    try {
      const r = await listOneDriveFiles(t);
      setFiles(r.data.files ?? []);
      setStep("files");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load OneDrive files.";
      setError(msg);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleOAuthClick = () => {
    if (!authUrl) return;
    // Open Microsoft login in the same tab; callback page stores tokens in localStorage
    window.location.href = authUrl;
  };

  const handleConnect = async () => {
    if (!selectedFile || !tokens) return;
    setConnecting(true);
    setError("");
    try {
      const r = await connectExcelOnline({
        item_id: selectedFile.item_id,
        file_name: selectedFile.name,
        source_name: sourceName.trim() || selectedFile.name.replace(".xlsx", ""),
        ...tokens,
        refresh_interval: refreshInterval,
      });
      setSuccess(r.data.message);
      setStep("done");
      loadSources();
      setTimeout(() => {
        if (r.data.file_id) navigate(`/analysis/${r.data.file_id}`);
      }, 1800);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to connect file.";
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

  const fmtSize = (bytes: number) =>
    bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Live Data · Microsoft</p>
          <h1>
            <span style={{ marginRight: 10 }}>📗</span>
            Excel Online / OneDrive
          </h1>
          <p className="section-description">
            Sync Excel spreadsheets from your Microsoft OneDrive. Dashboards
            update automatically with the latest data.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate("/integrations")}>
            ← Integrations
          </button>
        </div>
      </div>

      {/* Connected sources */}
      {sources.length > 0 && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 14px" }}>Connected Excel Sources</h3>
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
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📗</span>
                    <span style={{ fontWeight: 600, fontSize: "0.93rem" }}>{src.source_name}</span>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: src.status === "synced" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: src.status === "synced" ? "#22c55e" : "#ef4444",
                    }}>{src.status}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {src.row_count.toLocaleString()} rows
                    {src.last_synced_at ? ` · ${new Date(src.last_synced_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="button button-secondary"
                    style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    onClick={() => handleRefresh(src.source_id)}
                    disabled={refreshing === src.source_id}>
                    {refreshing === src.source_id ? "Syncing..." : "↻ Sync"}
                  </button>
                  {src.file_id && (
                    <button type="button" className="button button-primary"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                      onClick={() => navigate(`/analysis/${src.file_id}`)}>
                      Dashboard →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup guide if not configured */}
      {!isConfigured && step === "intro" && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: "1.6rem" }}>⚙️</span>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Azure Setup Required</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                Microsoft OAuth requires an Azure App Registration. Complete this one-time setup to enable Excel Online sync.
              </p>
            </div>
          </div>
          {setupGuide && (
            <pre style={{
              background: "var(--bg, #0d0d1a)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
              fontSize: "0.82rem",
              color: "var(--text)",
              margin: "0 0 16px",
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
            }}>
              {setupGuide}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="button button-secondary"
              onClick={() => { setIsConfigured(true); setStep("auth"); }}>
              I've set it up →
            </button>
            <button type="button" className="button button-secondary"
              onClick={() => navigate("/google-sheets")}>
              Use Google Sheets instead
            </button>
          </div>
        </div>
      )}

      {/* Step: Auth */}
      {(isConfigured || step !== "intro") && step !== "files" && step !== "done" && (
        <div className="section-card">
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>📗</div>
            <h3 style={{ margin: "0 0 8px" }}>Connect your Microsoft Account</h3>
            <p style={{ margin: "0 0 24px", fontSize: "0.88rem", color: "var(--muted)", maxWidth: 400, marginInline: "auto" }}>
              Sign in with Microsoft to access your OneDrive Excel files. BizInsight only requests read access.
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            <button
              type="button"
              className="button button-primary"
              onClick={handleOAuthClick}
              disabled={!authUrl}
              style={{ padding: "12px 32px", fontSize: "1rem" }}
            >
              <span style={{ marginRight: 8 }}>🔑</span>
              Sign in with Microsoft
            </button>
            <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--muted)" }}>
              Redirects to Microsoft login. Read-only access to your files.
            </p>
          </div>
        </div>
      )}

      {/* Step: File picker */}
      {step === "files" && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 16px" }}>
            {loadingFiles ? "Loading your OneDrive files..." : `Select an Excel File (${files.length} found)`}
          </h3>

          {loadingFiles && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
              Connecting to OneDrive...
            </div>
          )}

          {!loadingFiles && files.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
              No Excel files found in your OneDrive. Make sure you have .xlsx files saved there.
            </p>
          )}

          {!loadingFiles && files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {files.map((f) => (
                <div
                  key={f.item_id}
                  onClick={() => { setSelectedFile(f); setSourceName(f.name.replace(/\.xlsx?$/i, "")); }}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: `1px solid ${selectedFile?.item_id === f.item_id ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                    background: selectedFile?.item_id === f.item_id ? "rgba(99,102,241,0.08)" : "var(--surface)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "border-color 0.15s",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>📗</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>{f.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                      {fmtSize(f.size_bytes)} · Modified {new Date(f.last_modified).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedFile?.item_id === f.item_id && (
                    <span style={{ color: "#6366f1", fontWeight: 700 }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedFile && (
            <div style={{ display: "grid", gap: 14, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                  <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--input-bg, #0d0d1a)",
                      color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box",
                    }}>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <button type="button" className="button button-primary"
                onClick={handleConnect} disabled={connecting}
                style={{ width: "fit-content" }}>
                {connecting ? "Connecting..." : "Connect & Analyze →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {step === "done" && success && (
        <div style={{
          padding: "24px", borderRadius: 12,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Connected!</p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>{success}</p>
          <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>Redirecting to dashboard...</p>
        </div>
      )}
    </MainLayout>
  );
}
