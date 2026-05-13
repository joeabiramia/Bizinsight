import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: "📤", title: "Drag & Drop Upload", description: "Upload any CSV or Excel file. No SQL, no setup, no technical skills required." },
  { icon: "⚡", title: "Instant Auto-Analysis", description: "Industry detection, KPI extraction, charts, and insights generated in under 60 seconds." },
  { icon: "📊", title: "Live KPI Dashboards", description: "Revenue, regions, products, trends — all rendered as interactive, real-time charts." },
  { icon: "🤖", title: "AI Business Copilot", description: 'Ask plain-English questions: "Who is my best salesperson?" and get instant data-backed answers.' },
  { icon: "🎯", title: "Strategy Generator", description: "Ask a strategic question — get an AI plan with real KPIs, priority actions, and forecasts from your data." },
  { icon: "🔔", title: "Predictive Alerts", description: "Get notified before problems happen. AI monitors your data and flags risks and opportunities." },
  { icon: "📈", title: "ML Forecasting", description: "See where your revenue, sales, or key metrics are heading — with confidence intervals." },
  { icon: "🔗", title: "Live Connectors", description: "Connect Google Sheets, Excel Online, or Shopify for automatic, real-time data sync." },
  { icon: "📋", title: "Executive Reports", description: "One click generates a board-ready PDF, PowerPoint, or Excel report with AI commentary." },
];

const STEPS = [
  { num: "01", title: "Upload Your Data", desc: "Drag and drop any CSV or Excel file — sales, finance, HR, inventory." },
  { num: "02", title: "AI Analyzes Everything", desc: "Industry detection, KPI dashboards, charts, insights, and forecasts generated automatically." },
  { num: "03", title: "Ask, Explore, Act", desc: "Chat with your data in plain English. Get strategy plans, export reports, set goals." },
];

const COMPARISONS = [
  { feature: "Structured KPI dashboards", bi: true, gpt: false },
  { feature: "Persistent datasets across sessions", bi: true, gpt: false },
  { feature: "Business-specific insight logic", bi: true, gpt: false },
  { feature: "Interactive visual charts", bi: true, gpt: false },
  { feature: "ML forecasting & predictions", bi: true, gpt: false },
  { feature: "Automated alerts & monitoring", bi: true, gpt: false },
  { feature: "Executive report export (PDF/PPTX)", bi: true, gpt: false },
  { feature: "Industry detection & tailoring", bi: true, gpt: false },
];

const TESTIMONIALS = [
  { quote: "I uploaded our quarterly sales data and had a full executive report in under two minutes. This would have taken my team an entire day.", author: "Sarah M.", role: "Retail Operations Manager" },
  { quote: "The insight cards are genuinely actionable — not just data summaries. It told me which salesperson needed coaching and exactly why.", author: "David K.", role: "Sales Director, SME" },
  { quote: "Finally a BI tool that doesn't require a data science degree. My whole team uses it without any training.", author: "Priya L.", role: "Finance Business Partner" },
];

const STATS = [
  { value: "60s", label: "Average time to first insight" },
  { value: "2,600+", label: "Rows analyzed per report" },
  { value: "15+", label: "Industries supported" },
  { value: "0", label: "Lines of code needed" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 36, height: 36, fontSize: "0.82rem" }}>BI</div>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>BizInsight AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a href="#features" style={{ padding: "7px 12px", fontSize: "0.84rem", color: "var(--text-secondary)", borderRadius: 8, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}>Features</a>
          <a href="#how-it-works" style={{ padding: "7px 12px", fontSize: "0.84rem", color: "var(--text-secondary)", borderRadius: 8, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}>How it works</a>
          <Link to="/login" style={{ padding: "7px 12px", fontSize: "0.84rem", color: "var(--text-secondary)" }}>Sign in</Link>
          <Link to="/register" className="button button-primary button-sm">Get started free</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 40px 80px", textAlign: "center", maxWidth: 920, margin: "0 auto", position: "relative" }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: "relative" }}
        >
          <span className="landing-hero-eyebrow">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            Trusted by business owners worldwide
          </span>

          <h1 style={{
            fontSize: "clamp(2.4rem, 5vw, 4.2rem)", fontWeight: 900, lineHeight: 1.1,
            letterSpacing: "-0.03em", margin: "24px 0 20px",
          }}>
            Turn Your Spreadsheets Into{" "}
            <span style={{ background: "linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Business Intelligence
            </span>
          </h1>

          <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)", maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Upload a CSV or Excel file. Get a full KPI dashboard, AI insights, forecasts, and strategic recommendations — in under 60 seconds. No SQL. No Python. No data team.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <Link to="/register" className="button button-primary" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Get Started Free →
            </Link>
            <button
              type="button"
              className="button button-secondary"
              style={{ padding: "14px 28px", fontSize: "1rem" }}
              onClick={() => navigate("/demo")}
            >
              ▶ Try Live Demo
            </button>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Free · No credit card · No setup · Works in 60 seconds</p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            display: "flex", gap: 0, justifyContent: "center",
            marginTop: 56, borderRadius: 20,
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1, padding: "20px 24px", textAlign: "center",
              borderRight: i < STATS.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>{stat.value}</p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            marginTop: 56, borderRadius: 20, overflow: "hidden",
            background: "var(--surface)", border: "1px solid var(--border)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            {["#ef4444","#f59e0b","#22c55e"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />)}
            <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--muted)" }}>BizInsight AI — Travel Agency Analysis</span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total Revenue", value: "$4.29M", delta: "+12.4%", color: "#4ade80" },
                { label: "Total Bookings", value: "2,600", delta: "+8.2%", color: "#4ade80" },
                { label: "Avg Booking", value: "$1,649", delta: "+4.1%", color: "#4ade80" },
                { label: "Cancellation", value: "4.0%", delta: "-0.8%", color: "#4ade80" },
              ].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</p>
                  <p style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>{k.value}</p>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: k.color }}>{k.delta}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 12px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue by Month</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                  {[58,61,75,82,77,87,100,95,69,65,58,84].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(180deg, #6366f1, #8b5cf6)`, borderRadius: "3px 3px 0 0", opacity: 0.8 }} />
                  ))}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Insights</p>
                {[
                  { type: "🟢", text: "Top agent is 30% above team average" },
                  { type: "🔴", text: "103 cancellations = $198K lost revenue" },
                  { type: "💡", text: "July peak — 72% seasonal revenue swing" },
                ].map((ins, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    <span>{ins.type}</span>
                    <span>{ins.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "80px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>Everything you need</p>
        <h2 className="landing-section-title">Business intelligence, without the complexity</h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto 48px", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Every tool a business analyst needs — built into one platform that anyone on your team can use.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="landing-feature-card"
            >
              <div className="landing-feature-icon">{f.icon}</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "80px 40px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>Simple by design</p>
          <h2 className="landing-section-title">From spreadsheet to strategy in 3 steps</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32, marginTop: 48 }}>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                style={{ textAlign: "center" }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
                  background: "var(--primary-dim)", border: "1px solid rgba(99,102,241,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-light)",
                }}>{step.num}</div>
                <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700 }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────────── */}
      <section id="compare" style={{ padding: "80px 40px", maxWidth: 800, margin: "0 auto" }}>
        <p style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>Why not just use ChatGPT?</p>
        <h2 className="landing-section-title">Built for business, not general conversation</h2>
        <div style={{ marginTop: 40, borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", padding: "12px 20px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary-light)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>BizInsight AI</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>ChatGPT</span>
          </div>
          {COMPARISONS.map((row, i) => (
            <div key={row.feature} style={{
              display: "grid", gridTemplateColumns: "1fr 140px 140px",
              padding: "13px 20px", alignItems: "center",
              borderBottom: i < COMPARISONS.length - 1 ? "1px solid var(--border)" : "none",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>{row.feature}</span>
              <span style={{ textAlign: "center", fontSize: "1rem", color: "#4ade80" }}>{row.bi ? "✓" : "✗"}</span>
              <span style={{ textAlign: "center", fontSize: "1rem", color: row.gpt ? "#4ade80" : "var(--muted)" }}>{row.gpt ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────── */}
      <section style={{ padding: "80px 40px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>What users say</p>
          <h2 className="landing-section-title">Trusted by business leaders</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 48 }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{
                  padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
                  {[...Array(5)].map((_, j) => <span key={j} style={{ color: "#fbbf24", fontSize: "0.9rem" }}>★</span>)}
                </div>
                <p style={{ margin: "0 0 20px", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.65, fontStyle: "italic" }}>"{t.quote}"</p>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--text)" }}>{t.author}</p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────── */}
      <section style={{ padding: "96px 40px", textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
          Start analysing your business today
        </h2>
        <p style={{ fontSize: "1rem", color: "var(--text-secondary)", margin: "0 0 36px", lineHeight: 1.6 }}>
          Join thousands of business owners who get instant, actionable insights from their data — no technical skills required.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" className="button button-primary" style={{ padding: "14px 32px", fontSize: "1rem" }}>
            Create Free Account →
          </Link>
          <button type="button" className="button button-secondary" style={{ padding: "14px 24px", fontSize: "1rem" }} onClick={() => navigate("/demo")}>
            ▶ Try Live Demo
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 30, height: 30, fontSize: "0.72rem" }}>BI</div>
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>BizInsight AI</span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/register" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Get started</Link>
          <Link to="/login" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Sign in</Link>
          <Link to="/demo" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Live Demo</Link>
          <a href="#features" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Features</a>
        </div>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>© {new Date().getFullYear()} BizInsight AI. All rights reserved.</p>
      </footer>

      <style>{`
        .landing-section-title { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 800; text-align: center; letter-spacing: -0.02em; margin: 0 0 12px; }
        .landing-hero-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); text-transform: uppercase; letter-spacing: 0.06em; }
        .landing-feature-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 16px; padding: 24px; transition: border-color 0.2s, box-shadow 0.2s; }
        .landing-feature-card:hover { border-color: rgba(99,102,241,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .landing-feature-icon { font-size: 1.8rem; margin-bottom: 14px; }
        @media (max-width: 768px) {
          nav { padding: 12px 20px !important; }
          section { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (max-width: 640px) {
          div[style*="repeat(3,1fr)"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(4,1fr)"] { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  );
}
