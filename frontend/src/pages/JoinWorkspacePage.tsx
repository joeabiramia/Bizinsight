import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

interface InvitePreview {
  valid: boolean;
  email: string;
  role: string;
  owner_name: string;
}

const ROLE_DETAILS: Record<string, { icon: string; desc: string }> = {
  admin:   { icon: "🛡️", desc: "Manage datasets, invite members, use all analytics features" },
  analyst: { icon: "📊", desc: "Upload data, run analysis, use AI Copilot" },
  viewer:  { icon: "👁️",  desc: "View dashboards and analysis results (read-only)" },
};

export default function JoinWorkspacePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { refresh: refreshWorkspace } = useWorkspace();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading");
  const [error, setError] = useState("");

  // Load invite preview (public endpoint — no auth needed)
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No invitation token found in this link.");
      return;
    }
    api.get(`/workspace/join/${token}`)
      .then(r => { setPreview(r.data); setStatus("ready"); })
      .catch(err => {
        const msg = err?.response?.data?.detail ?? "This invitation is invalid or has expired.";
        setError(msg);
        setStatus("error");
      });
  }, [token]);

  const handleJoin = async () => {
    if (!user) return;
    setStatus("joining");
    try {
      const res = await api.post(`/workspace/join/${token}`);
      const { role, owner_name } = res.data;
      setPreview(p => p ? { ...p, role, owner_name } : p);
      setStatus("done");
      // Refresh workspace context so sidebar shows the new membership immediately
      await refreshWorkspace();
      setTimeout(() => navigate("/dashboard"), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to join workspace.";
      setError(msg);
      setStatus("error");
    }
  };

  const roleDeets = ROLE_DETAILS[preview?.role ?? ""] ?? ROLE_DETAILS.viewer;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 460 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
          }}>
            👥
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 800 }}>
            Workspace Invitation
          </h1>
        </div>

        {status === "loading" && (
          <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>Validating invitation…</p>
        )}

        {status === "error" && (
          <div style={{
            padding: "20px 24px", borderRadius: 14, textAlign: "center",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>❌</div>
            <p style={{ margin: "0 0 16px", color: "#ef4444", fontWeight: 600 }}>{error}</p>
            <Link to="/dashboard" className="button button-secondary">Go to Dashboard</Link>
          </div>
        )}

        {status === "done" && (
          <div style={{
            padding: "24px", borderRadius: 14, textAlign: "center",
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", color: "#22c55e" }}>You've joined!</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              You're now a <strong style={{ color: "#22c55e" }}>{preview?.role}</strong> in{" "}
              <strong>{preview?.owner_name}'s</strong> workspace. Redirecting to dashboard…
            </p>
          </div>
        )}

        {(status === "ready" || status === "joining") && preview && (
          <div className="section-card">
            {/* Invite details */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ margin: "0 0 6px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                <strong style={{ color: "var(--text)" }}>{preview.owner_name}</strong> has invited you to their workspace
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "10px 20px", borderRadius: 12, marginTop: 12,
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
              }}>
                <span style={{ fontSize: "1.4rem" }}>{roleDeets.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, textTransform: "capitalize",
                               color: "var(--primary-light)" }}>{preview.role}</p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {roleDeets.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Not logged in */}
            {!user ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>
                  Sign in or create an account to accept this invitation.
                </p>
                <Link
                  to={`/login?redirect=/join%3Ftoken%3D${token}`}
                  className="button button-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Sign in to accept
                </Link>
                <Link
                  to={`/register?redirect=/join%3Ftoken%3D${token}`}
                  className="button button-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Create account
                </Link>
              </div>
            ) : (
              /* Logged in — check email matches */
              preview.email !== "__any__" &&
              user.email.toLowerCase() !== preview.email.toLowerCase() ? (
                <div style={{
                  padding: "14px", borderRadius: 10,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                  textAlign: "center",
                }}>
                  <p style={{ margin: "0 0 8px", color: "#ef4444", fontWeight: 600 }}>
                    Wrong account
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    This invitation was sent to <strong>{preview.email}</strong>,
                    but you're signed in as <strong>{user.email}</strong>.
                  </p>
                  <Link to="/" className="button button-secondary button-sm">Switch account</Link>
                </div>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  style={{ width: "100%", justifyContent: "center", fontSize: "1rem" }}
                  onClick={handleJoin}
                  disabled={status === "joining"}
                >
                  {status === "joining" ? "Joining…" : `Accept as ${preview.role}`}
                </button>
              )
            )}

            <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
              Invitation expires in 48 hours
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
