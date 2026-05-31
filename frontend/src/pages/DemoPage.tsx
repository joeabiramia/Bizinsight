import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart2, TrendingUp, Bot,
  ArrowRight, Sparkles, X, Database, Upload,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  DEMO_ANALYSIS, DEMO_INSIGHTS, DEMO_HEALTH,
  DEMO_PREDICTIONS, DEMO_CHAT_HISTORY, DEMO_KPIS,
} from "../data/sampleData";

const COLORS = ["#6366f1","#8b5cf6","#22c55e","#f59e0b","#ef4444","#06b6d4"];

const DEMO_TABS = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 size={14} /> },
  { id: "insights", label: "AI Insights", icon: <Sparkles size={14} /> },
  { id: "chat", label: "AI Copilot", icon: <Bot size={14} /> },
  { id: "health", label: "Health Score", icon: <TrendingUp size={14} /> },
];

function DemoToast({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        background: "var(--surface)", border: "1px solid rgba(99,102,241,0.35)",
        borderRadius: 16, padding: "14px 20px", zIndex: 1000,
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        maxWidth: 480, width: "calc(100vw - 48px)",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-dim)", color: "var(--primary-light)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Sparkles size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem" }}>You're viewing a live demo</p>
        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>This is real analysis on a travel agency dataset. Sign up to analyze your own data.</p>
      </div>
      <button type="button" aria-label="Dismiss demo notice" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }} onClick={onClose}>
        <X size={16} />
      </button>
    </motion.div>
  );
}

export default function DemoPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showToast, setShowToast] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState(DEMO_CHAT_HISTORY);

  const { analysis } = DEMO_ANALYSIS;

  const handleDemoChat = (q?: string) => {
    const question = q ?? chatInput;
    if (!question.trim()) return;
    setChatInput("");
    const demoAnswer: typeof DEMO_CHAT_HISTORY[0] = {
      question,
      answer: "This is a live demo. Sign up for free to ask unlimited AI questions about your own data — and get real-time, data-backed answers like the ones above.",
      source: "rag_openai",
      grounded: false,
      insights: ["Create a free account to unlock full AI Copilot capabilities"],
    };
    setChatHistory(prev => [...prev, demoAnswer]);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", background: "var(--surface)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark" style={{ width: 34, height: 34, fontSize: "0.8rem" }}>BI</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>BizInsight AI</p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>Live Demo — Travel Agency Dataset</p>
          </div>
          <span className="badge badge-success" style={{ marginLeft: 8 }}>Live Demo</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="button button-secondary button-sm" onClick={() => navigate("/")}>← Back</button>
          <button type="button" className="button button-primary button-sm" onClick={() => navigate("/register")}>
            Sign Up Free <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px" }}>

        {/* Header */}
        <div className="page-hero">
          <div>
            <p className="eyebrow">Live Demo</p>
            <h1>Travel Agency Business Intelligence</h1>
            <p className="section-description">
              Real analysis of 2,600 bookings. Explore KPIs, AI insights, forecasts, and the AI Copilot — then sign up to analyze your own data.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="button button-primary" onClick={() => navigate("/register")}>
              <Upload size={14} /> Analyze Your Data
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
          {DEMO_KPIS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="metric-card"
            >
              <p className="metric-label">{kpi.label}</p>
              <p className="metric-value" style={{ fontSize: "1.6rem" }}>{kpi.value}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: kpi.trend === "up" ? "#4ade80" : kpi.trend === "down" ? "#f87171" : "var(--muted)" }}>
                  {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→"} {kpi.change}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{kpi.sub}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="page-tabs" style={{ marginBottom: 24 }}>
          {DEMO_TABS.map(tab => (
            <button key={tab.id} type="button"
              className={`page-tab${activeTab === tab.id ? " page-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="section-card">
              <div className="section-card-header"><h2>Revenue by Month</h2></div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analysis.chart_data.revenue_by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-alt)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => `$${((v as number)/1000).toFixed(1)}K`} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="section-card">
              <div className="section-card-header"><h2>Top Destinations</h2></div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analysis.chart_data.by_destination.slice(0, 7)} layout="vertical">
                  <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {analysis.chart_data.by_destination.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="section-card">
              <div className="section-card-header"><h2>Bookings by Travel Type</h2></div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={analysis.chart_data.by_travel_type} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                      {analysis.chart_data.by_travel_type.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {analysis.chart_data.by_travel_type.map((item, i) => (
                    <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.84rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i], display: "inline-block" }} />
                        <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header"><h2>Top Agents</h2></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analysis.chart_data.top_agents.map((agent, i) => {
                  const max = analysis.chart_data.top_agents[0].value;
                  return (
                    <div key={agent.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--primary-dim)", color: "var(--primary-light)", display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>{agent.name}</span>
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{agent.value} bookings</span>
                        </div>
                        <div style={{ height: 5, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(agent.value / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 999 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Insights Tab */}
        {activeTab === "insights" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {DEMO_INSIGHTS.map((ins, i) => {
              const colors = { opportunity: "#6366f1", risk: "#ef4444", performance: "#22c55e", revenue: "#f59e0b" };
              const color = colors[ins.type as keyof typeof colors] || "#6366f1";
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, padding: "2px 8px", background: `${color}18`, borderRadius: 999, border: `1px solid ${color}30` }}>{ins.type}</span>
                    <span className={`priority-badge priority-badge--${ins.priority}`}>{ins.priority}</span>
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{ins.title}</h3>
                  <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>{ins.observation}</p>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", fontSize: "0.8rem", color: "var(--primary-light)" }}>
                    <strong>Action: </strong>{ins.action}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>📊 {ins.data_point}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* AI Chat Tab */}
        {activeTab === "chat" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, maxHeight: 420, overflowY: "auto", padding: "4px 0" }}>
                {chatHistory.map((item, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ maxWidth: "70%", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: "0.875rem", lineHeight: 1.5 }}>
                        {item.question}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", display: "grid", placeItems: "center", flexShrink: 0, color: "#a5b4fc" }}>
                        <Bot size={14} />
                      </div>
                      <div style={{ flex: 1, padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: "var(--surface-alt)", border: "1px solid var(--border)", fontSize: "0.875rem", lineHeight: 1.65, color: "var(--text)" }}>
                        <p style={{ margin: 0 }}>{item.answer}</p>
                        {item.insights?.map((ins, j) => (
                          <p key={j} style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>• {ins}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleDemoChat()}
                  placeholder="Ask about revenue, agents, destinations, trends…"
                  style={{ flex: 1, borderRadius: 12, padding: "10px 16px", fontSize: "0.875rem" }}
                />
                <button type="button" className="button button-primary" onClick={() => handleDemoChat()} disabled={!chatInput.trim()}>
                  Send
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["What is total revenue?", "Top performing agent?", "Which month is best?", "Cancellation analysis?"].map(q => (
                  <button key={q} type="button" className="chip" onClick={() => handleDemoChat(q)}>{q}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Health Score Tab */}
        {activeTab === "health" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "20px 0", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", border: "6px solid #f59e0b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>{DEMO_HEALTH.overall_score}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f59e0b" }}>B</span>
                </div>
                <div>
                  <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Business Health Score</h2>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{DEMO_HEALTH.summary}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {DEMO_HEALTH.dimensions.map((dim) => {
                  const colors = { A: "#22c55e", B: "#f59e0b", C: "#f97316", D: "#ef4444" };
                  const color = colors[dim.grade as keyof typeof colors] || "#6366f1";
                  return (
                    <div key={dim.name} style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>{dim.name}</span>
                        <span style={{ fontWeight: 800, color, fontSize: "0.9rem" }}>{dim.grade}</span>
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: "1.5rem", fontWeight: 800, color }}>{dim.score}</p>
                      <div style={{ height: 5, background: "var(--border)", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{ height: "100%", width: `${dim.score}%`, background: color, borderRadius: 999 }} />
                      </div>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{dim.explanation}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Forecast preview */}
            <div className="section-card" style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.06em" }}>Next Month Forecast</p>
                <p style={{ margin: "0 0 6px", fontSize: "2.2rem", fontWeight: 800, color: "#4ade80", letterSpacing: "-0.03em" }}>
                  ${(DEMO_PREDICTIONS.next_month_revenue / 1000).toFixed(0)}K
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {DEMO_PREDICTIONS.confidence * 100}% confidence · {DEMO_PREDICTIONS.trend === "up" ? "↑" : "↓"} trending
                </p>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{DEMO_PREDICTIONS.explanation}</p>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ padding: "16px 24px", borderRadius: 16, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
                  <TrendingUp size={32} style={{ color: "#4ade80", margin: "0 auto 8px", display: "block" }} />
                  <p style={{ margin: 0, fontWeight: 700, color: "#4ade80", fontSize: "0.875rem" }}>On Track</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          style={{
            marginTop: 40, padding: "32px", borderRadius: 20,
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))",
            border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 700 }}>Impressed? Analyze your own business data.</h3>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>Create a free account and upload your own CSV or Excel file in 30 seconds.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="button button-primary" onClick={() => navigate("/register")}>
              <Database size={14} /> Create Free Account
            </button>
            <button type="button" className="button button-secondary" onClick={() => navigate("/login")}>Sign In</button>
          </div>
        </motion.div>
      </div>

      {showToast && <DemoToast onClose={() => setShowToast(false)} />}
    </div>
  );
}
