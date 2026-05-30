import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
          }}>🔑</div>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 800 }}>
            Forgot your password?
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: "20px 24px", borderRadius: 14, textAlign: "center",
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>📬</div>
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#22c55e" }}>Check your inbox</p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              If <strong>{email}</strong> has an account, you'll receive a reset link shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="you@company.com"
                autoFocus
              />
            </div>

            {error && (
              <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>
            )}

            <button type="submit" className="button button-primary" disabled={loading}
                    style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Sending…" : "Send Reset Link"}
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
