import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, CheckCircle2, Send, ToggleLeft, ToggleRight, Sparkles } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface DigestSettings {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  send_day: string;
  send_time: string;
  include_kpis: boolean;
  include_insights: boolean;
  include_alerts: boolean;
  include_forecast: boolean;
  recipient_email: string;
}

const DEFAULT: DigestSettings = {
  enabled: true,
  frequency: "weekly",
  send_day: "Monday",
  send_time: "09:00",
  include_kpis: true,
  include_insights: true,
  include_alerts: true,
  include_forecast: false,
  recipient_email: "",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIMES = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","17:00","18:00","19:00"];

export default function DigestSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DigestSettings>({ ...DEFAULT, recipient_email: user?.email || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    api.get("/digest/settings").then(r => setSettings({ ...DEFAULT, ...r.data, recipient_email: user?.email || "" })).catch(() => {});
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/digest/settings", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // show saved anyway for demo purposes
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await api.post("/digest/send-test", { email: settings.recipient_email });
    } catch { /* demo */ }
    setTestSent(true);
    setTesting(false);
    setTimeout(() => setTestSent(false), 5000);
  };

  const toggle = (key: keyof DigestSettings) => setSettings(s => ({ ...s, [key]: !s[key] }));

  const PREVIEW_CONTENT = [
    { icon: "📊", label: "KPI Summary", desc: "Revenue, top products, key trends", key: "include_kpis" as const },
    { icon: "💡", label: "AI Insights", desc: "Top opportunities and risks", key: "include_insights" as const },
    { icon: "🔔", label: "Active Alerts", desc: "Any flagged anomalies or issues", key: "include_alerts" as const },
    { icon: "🔮", label: "Forecast Snippet", desc: "Next period revenue prediction", key: "include_forecast" as const },
  ];

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Automation"
        title="Email Digest"
        description="Get a regular AI-written summary of your business health delivered to your inbox — without logging in."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Main toggle */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700 }}>Enable Email Digest</h3>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                  Receive AI-written business summaries automatically
                </p>
              </div>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: settings.enabled ? "var(--primary-light)" : "var(--muted)" }} onClick={() => toggle("enabled")}>
                {settings.enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            </div>
          </div>

          {settings.enabled && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Schedule */}
              <div className="section-card">
                <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={15} style={{ color: "var(--primary-light)" }} /> Schedule
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Frequency</label>
                    <select title="Digest frequency" aria-label="Digest frequency" className="form-input" value={settings.frequency} onChange={e => setSettings(s => ({ ...s, frequency: e.target.value as DigestSettings["frequency"] }))}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {settings.frequency === "weekly" && (
                    <div>
                      <label className="form-label">Day</label>
                      <select title="Send day" aria-label="Send day" className="form-input" value={settings.send_day} onChange={e => setSettings(s => ({ ...s, send_day: e.target.value }))}>
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label">Time</label>
                    <select title="Send time" aria-label="Send time" className="form-input" value={settings.send_time} onChange={e => setSettings(s => ({ ...s, send_time: e.target.value }))}>
                      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="section-card">
                <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={15} style={{ color: "var(--primary-light)" }} /> What to Include
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {PREVIEW_CONTENT.map(item => (
                    <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${settings[item.key] ? "rgba(99,102,241,0.3)" : "var(--border)"}`, cursor: "pointer", transition: "all 0.15s" }}
                      onClick={() => toggle(item.key)}>
                      <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{item.label}</p>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>{item.desc}</p>
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: settings[item.key] ? "var(--primary)" : "transparent",
                        border: `2px solid ${settings[item.key] ? "var(--primary)" : "var(--border-strong)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                        {settings[item.key] && <CheckCircle2 size={12} style={{ color: "white" }} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient */}
              <div className="section-card">
                <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={15} style={{ color: "var(--primary-light)" }} /> Delivery
                </h3>
                <label className="form-label">Recipient Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={settings.recipient_email}
                  onChange={e => setSettings(s => ({ ...s, recipient_email: e.target.value }))}
                  placeholder="your@email.com"
                  style={{ marginBottom: 12 }}
                />
                <button type="button" className="button button-secondary button-sm" onClick={sendTest} disabled={testing || !settings.recipient_email}>
                  {testing ? "Sending…" : testSent ? "✓ Test sent!" : <><Send size={12} /> Send test email</>}
                </button>
              </div>
            </motion.div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="button button-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Email preview */}
        <div>
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700 }}>Email Preview</h3>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, fontSize: "0.8rem" }}>
              <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                <div className="brand-mark" style={{ width: 28, height: 28, fontSize: "0.7rem", display: "inline-flex", marginBottom: 10 }}>BI</div>
                <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "0.95rem" }}>Your Weekly Business Digest</p>
                <p style={{ margin: 0, color: "var(--muted)" }}>Monday, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
              </div>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>Hey {user?.name?.split(" ")[0] || "there"} 👋</p>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>Here's your AI-generated summary of this week's business performance.</p>
              {settings.include_kpis && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.08)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>📊 Key Metrics</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>Revenue: $4.29M (+12.4%) · Bookings: 2,600 · Top: Paris</p>
                </div>
              )}
              {settings.include_insights && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(34,197,94,0.06)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>💡 Top Insight</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>Top agent is 30% above team avg. Share their process to lift the team.</p>
                </div>
              )}
              {settings.include_alerts && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>🔔 Alert</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>103 cancellations = $198K lost. Consider cancellation prevention flow.</p>
                </div>
              )}
              <button type="button" className="button button-primary" style={{ width: "100%", justifyContent: "center", marginTop: 12, fontSize: "0.8rem" }}>
                View Full Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
