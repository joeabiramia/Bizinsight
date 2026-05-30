import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("Missing reset token. Please use the link from your email.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Reset failed. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🔒</div>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 800 }}>
            Set new password
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Choose a strong password for your account.
          </p>
        </div>

        {done ? (
          <div style={{
            padding: "20px 24px", borderRadius: 14, textAlign: "center",
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>✅</div>
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#22c55e" }}>Password reset!</p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Redirecting you to login…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">New password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="At least 6 characters"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">Confirm new password</label>
              <input
                type="password"
                className="form-input"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(""); }}
                placeholder="Repeat password"
              />
            </div>

            {error && (
              <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>
            )}

            <button type="submit" className="button button-primary" disabled={loading || !token}
                    style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          <Link to="/login" style={{ color: "var(--primary-light)" }}>← Back to login</Link>
        </p>
      </div>
    </div>
  );
}
