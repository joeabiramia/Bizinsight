import { Link } from "react-router-dom";

const features = [
  {
    icon: "📤",
    title: "Upload Your Data",
    description:
      "Drag and drop any CSV or Excel file. No SQL, no setup, no technical skills required.",
  },
  {
    icon: "⚡",
    title: "Automatic Analysis",
    description:
      "Our engine instantly detects your industry, identifies key columns, and runs comprehensive statistics.",
  },
  {
    icon: "📊",
    title: "KPI Dashboards",
    description:
      "Revenue totals, regional breakdowns, product performance — all rendered as interactive charts.",
  },
  {
    icon: "💡",
    title: "Actionable Insights",
    description:
      "Each insight includes an observation, interpretation, and a concrete recommended action.",
  },
  {
    icon: "🤖",
    title: "AI Chat With Your Data",
    description:
      'Ask plain-English questions like "Who is my best salesperson?" and get instant answers.',
  },
  {
    icon: "🏭",
    title: "Industry Detection",
    description:
      "Automatically recognises Retail, Finance, HR, Logistics, and more — tailoring insights to your sector.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Upload your CSV or Excel file in seconds.",
  },
  {
    number: "02",
    title: "Analyze",
    description: "Our engine runs full statistical analysis and detects your industry.",
  },
  {
    number: "03",
    title: "Get Insights",
    description: "Receive a complete KPI dashboard, charts, and prioritised business actions.",
  },
];

const comparisons = [
  {
    feature: "Structured KPI dashboards",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Persistent datasets across sessions",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Business-specific insight logic",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Repeatable, consistent analysis",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Interactive visual charts",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "No prompt engineering required",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Industry detection & tailoring",
    bizinsight: true,
    chatgpt: false,
  },
  {
    feature: "Onboarding-driven personalisation",
    bizinsight: true,
    chatgpt: false,
  },
];

const testimonials = [
  {
    quote:
      "I uploaded our quarterly sales data and had a full executive report in under two minutes. This would have taken my team an entire day.",
    author: "Sarah M.",
    role: "Retail Operations Manager",
  },
  {
    quote:
      "The insight cards are genuinely actionable — not just data summaries. It told me which salesperson needed coaching and exactly why.",
    author: "David K.",
    role: "Sales Director, SME",
  },
  {
    quote:
      "Finally a BI tool that doesn't require a data science degree. My whole team uses it without any training.",
    author: "Priya L.",
    role: "Finance Business Partner",
  },
];

export default function LandingPage() {
  return (
    <div className="landing-root">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="landing-logo-mark">BI</div>
            <span className="landing-logo-text">BizInsight AI</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
            <a href="#compare" className="landing-nav-link">Why not ChatGPT</a>
            <Link to="/login" className="landing-nav-link">Sign in</Link>
            <Link to="/register" className="landing-cta-btn landing-cta-btn--sm">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            Trusted by business owners worldwide
          </div>
          <h1 className="landing-hero-headline">
            Turn Your Business Data Into
            <br />
            <span className="landing-gradient-text">Actionable Insights</span> Instantly
          </h1>
          <p className="landing-hero-subtext">
            Upload a spreadsheet, get a full KPI dashboard, visual analytics, and prioritised
            business recommendations — in under 60 seconds. No SQL. No Python. No data team.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-cta-btn landing-cta-btn--lg">
              Get Started Free →
            </Link>
            <Link to="/login" className="landing-outline-btn">
              Try Demo
            </Link>
          </div>
          <p className="landing-hero-note">Free to use · No credit card · No setup</p>
        </div>

        {/* Dashboard preview mockup */}
        <div className="landing-hero-mockup">
          <div className="mockup-bar">
            <span className="mockup-dot mockup-dot--red" />
            <span className="mockup-dot mockup-dot--yellow" />
            <span className="mockup-dot mockup-dot--green" />
            <span className="mockup-bar-title">BizInsight AI — Dashboard</span>
          </div>
          <div className="mockup-body">
            <div className="mockup-kpis">
              {[
                { label: "Total Revenue", value: "$2.4M", delta: "+12%" },
                { label: "Top Region", value: "North", delta: "42%" },
                { label: "Best Product", value: "Widget A", delta: "#1" },
                { label: "Avg Quantity", value: "847", delta: "+5%" },
              ].map((kpi) => (
                <div key={kpi.label} className="mockup-kpi-card">
                  <span className="mockup-kpi-label">{kpi.label}</span>
                  <span className="mockup-kpi-value">{kpi.value}</span>
                  <span className="mockup-kpi-delta">{kpi.delta}</span>
                </div>
              ))}
            </div>
            <div className="mockup-charts">
              <div className="mockup-chart-card">
                <div className="mockup-chart-title">Revenue by Region</div>
                <div className="mockup-bars">
                  {[80, 60, 45, 35, 20].map((h, i) => (
                    <div key={i} className="mockup-bar-wrap">
                      <div className="mockup-bar-fill" style={{ height: `${h}%` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mockup-chart-card">
                <div className="mockup-chart-title">Product Mix</div>
                <div className="mockup-pie-placeholder">
                  <div className="mockup-pie" />
                  <div className="mockup-pie-legend">
                    {["Widget A", "Widget B", "Widget C"].map((l) => (
                      <div key={l} className="mockup-pie-item">
                        <div className="mockup-pie-dot" />
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mockup-insight-strip">
              <div className="mockup-insight mockup-insight--green">
                💡 <strong>Opportunity:</strong> Widget A is underpriced — test a 12% price increase
              </div>
              <div className="mockup-insight mockup-insight--red">
                ⚠ <strong>Risk:</strong> South region revenue down 18% — investigate immediately
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="landing-section">
        <div className="landing-section-inner">
          <p className="landing-eyebrow">Everything you need</p>
          <h2 className="landing-section-title">
            Business intelligence, without the complexity
          </h2>
          <p className="landing-section-subtitle">
            BizInsight AI handles every step of the analysis pipeline so you can focus on
            making decisions, not wrestling with spreadsheets.
          </p>
          <div className="landing-features-grid">
            {features.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="landing-section landing-section--alt">
        <div className="landing-section-inner">
          <p className="landing-eyebrow">Simple by design</p>
          <h2 className="landing-section-title">From data to decision in three steps</h2>
          <div className="landing-steps">
            {steps.map((step, idx) => (
              <div key={step.number} className="landing-step">
                <div className="landing-step-number">{step.number}</div>
                {idx < steps.length - 1 && <div className="landing-step-connector" />}
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────────────────────────────────── */}
      <section id="compare" className="landing-section">
        <div className="landing-section-inner">
          <p className="landing-eyebrow">Why not just use ChatGPT?</p>
          <h2 className="landing-section-title">
            Built for business, not general conversation
          </h2>
          <p className="landing-section-subtitle">
            ChatGPT is a brilliant general assistant. BizInsight AI is a dedicated business
            intelligence platform. They solve different problems.
          </p>
          <div className="landing-compare-table">
            <div className="landing-compare-header">
              <div className="landing-compare-feature-col">Feature</div>
              <div className="landing-compare-col landing-compare-col--highlight">
                BizInsight AI
              </div>
              <div className="landing-compare-col">ChatGPT</div>
            </div>
            {comparisons.map((row) => (
              <div key={row.feature} className="landing-compare-row">
                <div className="landing-compare-feature-col">{row.feature}</div>
                <div className="landing-compare-col landing-compare-col--highlight">
                  {row.bizinsight ? (
                    <span className="landing-check">✓</span>
                  ) : (
                    <span className="landing-cross">✗</span>
                  )}
                </div>
                <div className="landing-compare-col">
                  {row.chatgpt ? (
                    <span className="landing-check">✓</span>
                  ) : (
                    <span className="landing-cross">✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section-inner">
          <p className="landing-eyebrow">What users say</p>
          <h2 className="landing-section-title">Trusted by business leaders</h2>
          <div className="landing-testimonials">
            {testimonials.map((t) => (
              <div key={t.author} className="landing-testimonial-card">
                <div className="landing-testimonial-stars">★★★★★</div>
                <p className="landing-testimonial-quote">"{t.quote}"</p>
                <div className="landing-testimonial-author">
                  <strong>{t.author}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="landing-cta-section">
        <div className="landing-cta-glow" />
        <div className="landing-section-inner landing-cta-inner">
          <h2 className="landing-cta-headline">
            Start analysing your business today
          </h2>
          <p className="landing-cta-subtext">
            Join thousands of business owners who get instant, actionable insights from
            their data — no technical skills required.
          </p>
          <div className="landing-cta-actions">
            <Link to="/register" className="landing-cta-btn landing-cta-btn--lg">
              Create Free Account →
            </Link>
            <Link to="/login" className="landing-outline-btn">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-logo">
              <div className="landing-logo-mark">BI</div>
              <span className="landing-logo-text">BizInsight AI</span>
            </div>
            <p className="landing-footer-tagline">
              Business intelligence for everyone.
            </p>
          </div>
          <div className="landing-footer-links">
            <Link to="/register">Get started</Link>
            <Link to="/login">Sign in</Link>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#compare">Compare</a>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} BizInsight AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
