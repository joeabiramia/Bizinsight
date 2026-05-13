import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../services/api";
import type { User } from "../types";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim())  { setError("Please enter your email address."); return; }
    if (!password)      { setError("Please enter your password."); return; }

    setLoading(true);
    try {
      const res = await loginUser(email.trim().toLowerCase(), password);
      const { token, user } = res.data as { token: string; user: User };
      login(token, user);
      navigate(user.onboarding_complete ? "/dashboard" : "/onboarding", { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Invalid email or password. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "var(--bg)",
      color: "var(--text)",
    }}>
      {/* Left panel — branding */}
      <div style={{
        width: "44%",
        background: "linear-gradient(160deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 40%, var(--surface) 100%)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "48px 56px",
        position: "relative",
        overflow: "hidden",
      }} className="auth-left-panel">
        {/* Glow blob */}
        <div style={{
          position: "absolute", top: -80, right: -80, width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Brand */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginBottom: "auto" }}>
          <div className="brand-mark">BI</div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text)" }}>BizInsight AI</span>
        </Link>

        {/* Value props */}
        <div style={{ marginBottom: "auto", paddingTop: 48 }}>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.2, margin: "0 0 16px", letterSpacing: "-0.03em" }}>
            Turn your data into<br />
            <span style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business decisions
            </span>
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 36px" }}>
            Upload a spreadsheet, get a full KPI dashboard, AI insights, and forecasts — in under 60 seconds.
          </p>

          {[
            { icon: "📊", text: "Instant KPI dashboards from any CSV or Excel file" },
            { icon: "🤖", text: "AI Copilot answers plain-English business questions" },
            { icon: "🔮", text: "ML forecasting and predictive alerts built-in" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}
            >
              <span style={{ fontSize: "1.2rem", marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
          Free to use · No credit card required
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 40px",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: "100%", maxWidth: 420 }}
        >
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Welcome back
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Sign in to your BizInsight AI account
            </p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 16px", borderRadius: 12,
                  background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5", fontSize: "0.875rem", lineHeight: 1.5,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  style={{ paddingLeft: 40, height: 46, borderRadius: 12, fontSize: "0.9rem" }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <label htmlFor="password" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Password
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  style={{ paddingLeft: 40, paddingRight: 44, height: 46, borderRadius: 12, fontSize: "0.9rem" }}
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? {} : { translateY: -1 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              style={{
                width: "100%", height: 48, borderRadius: 12,
                background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.95rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={17} style={{ animation: "spin 0.7s linear infinite" }} />
                  Signing in…
                </>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Register link */}
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Don't have an account?{" "}
              <Link to="/register" style={{ color: "var(--primary-light)", fontWeight: 600, textDecoration: "none" }}>
                Create one free →
              </Link>
            </p>
          </div>

          {/* Trust row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 32 }}>
            {[
              { icon: "🔒", label: "Secure" },
              { icon: "⚡", label: "Instant" },
              { icon: "🆓", label: "Free" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--muted)" }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Back link */}
        <Link to="/" style={{ position: "absolute", top: 24, right: 32, fontSize: "0.82rem", color: "var(--muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          ← Back to home
        </Link>
      </div>

      <style>{`
        .auth-left-panel { display: flex; }
        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
