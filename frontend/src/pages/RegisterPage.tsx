import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { registerUser } from "../services/api";
import type { User as UserType } from "../types";

function PasswordStrength({ password }: { password: string }) {
  const length  = password.length >= 8;
  const upper   = /[A-Z]/.test(password);
  const number  = /[0-9]/.test(password);
  const score   = [length, upper, number].filter(Boolean).length;
  const colors  = ["var(--border)", "#ef4444", "#f59e0b", "#22c55e"];
  const labels  = ["", "Weak", "Fair", "Strong"];

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: score >= i ? colors[score] : "var(--border)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      {score > 0 && (
        <p style={{ margin: 0, fontSize: "0.72rem", color: colors[score], fontWeight: 600 }}>{labels[score]}</p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const validate = (): string | null => {
    if (!name.trim())                     return "Please enter your full name.";
    if (!email.trim() || !email.includes("@")) return "Please enter a valid email address.";
    if (password.length < 6)              return "Password must be at least 6 characters.";
    if (password !== confirm)             return "Passwords do not match. Please try again.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await registerUser(email.trim().toLowerCase(), password, name.trim());
      const { token, user } = res.data as { token: string; user: UserType };
      login(token, user);
      navigate("/onboarding", { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordMatch = confirm.length > 0 && password === confirm;
  const passwordMismatch = confirm.length > 0 && password !== confirm;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "var(--bg)",
      color: "var(--text)",
    }}>
      {/* Left panel */}
      <div style={{
        width: "40%",
        background: "linear-gradient(160deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 40%, var(--surface) 100%)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "48px 52px",
        position: "relative",
        overflow: "hidden",
      }} className="auth-left-panel">
        <div style={{
          position: "absolute", top: -60, right: -60, width: 360, height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.16), transparent 70%)",
          pointerEvents: "none",
        }} />

        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginBottom: "auto" }}>
          <div className="brand-mark">BI</div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text)" }}>BizInsight AI</span>
        </Link>

        <div style={{ marginBottom: "auto", paddingTop: 48 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.2, margin: "0 0 14px", letterSpacing: "-0.03em" }}>
            Join thousands of{" "}
            <span style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business leaders
            </span>
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 32px" }}>
            Get a full AI-powered business intelligence platform — no SQL, no Python, no data team needed.
          </p>

          {/* Social proof */}
          <div style={{
            padding: "18px 20px", borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", marginBottom: 10 }}>
              {[...Array(5)].map((_, i) => <span key={i} style={{ color: "#fbbf24", fontSize: "0.85rem" }}>★</span>)}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, fontStyle: "italic" }}>
              "I uploaded our quarterly sales data and had a full executive report in under two minutes."
            </p>
            <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>
              Sarah M. · Retail Operations Manager
            </p>
          </div>

          {[
            { label: "Free to use", icon: "🆓" },
            { label: "No credit card needed", icon: "💳" },
            { label: "Ready in 60 seconds", icon: "⚡" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "0.95rem" }}>{item.icon}</span>
              <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
          Free forever · No credit card required
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        overflowY: "auto",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: "100%", maxWidth: 440 }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Create your account
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Start turning data into decisions — free forever
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

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full name */}
            <div>
              <label htmlFor="name" style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Full name
              </label>
              <div style={{ position: "relative" }}>
                <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="Jane Smith"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  style={{ paddingLeft: 40, height: 44, borderRadius: 12, fontSize: "0.9rem" }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Work email
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  style={{ paddingLeft: 40, height: 44, borderRadius: 12, fontSize: "0.9rem" }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  style={{ paddingLeft: 40, paddingRight: 44, height: 44, borderRadius: 12, fontSize: "0.9rem" }}
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm" style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Confirm password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  id="confirm"
                  type={showCf ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(""); }}
                  style={{
                    paddingLeft: 40, paddingRight: 44, height: 44, borderRadius: 12, fontSize: "0.9rem",
                    borderColor: passwordMismatch ? "rgba(239,68,68,0.5)" : passwordMatch ? "rgba(34,197,94,0.5)" : undefined,
                  }}
                  disabled={loading}
                />
                {/* Match indicator */}
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6 }}>
                  {passwordMatch && <CheckCircle2 size={15} style={{ color: "#4ade80" }} />}
                  {passwordMismatch && <AlertCircle size={15} style={{ color: "#f87171" }} />}
                  <button
                    type="button"
                    aria-label={showCf ? "Hide password" : "Show password"}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                    onClick={() => setShowCf(!showCf)}
                    tabIndex={-1}
                  >
                    {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {passwordMismatch && (
                <p style={{ margin: "5px 0 0", fontSize: "0.75rem", color: "#f87171" }}>Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? {} : { translateY: -1 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              style={{
                width: "100%", height: 48, borderRadius: 12, marginTop: 4,
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
                  Creating account…
                </>
              ) : (
                <>Create free account <ArrowRight size={16} /></>
              )}
            </motion.button>

            {/* Legal */}
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              By creating an account you agree to our{" "}
              <span style={{ color: "var(--text-secondary)", textDecoration: "underline", cursor: "pointer" }}>Terms of Service</span>
              {" "}and{" "}
              <span style={{ color: "var(--text-secondary)", textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</span>.
            </p>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--primary-light)", fontWeight: 600, textDecoration: "none" }}>
              Sign in →
            </Link>
          </p>
        </motion.div>

        <Link to="/" style={{ position: "absolute", top: 24, right: 32, fontSize: "0.82rem", color: "var(--muted)", textDecoration: "none" }}>
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
