import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle2, Send, AlertCircle, Calendar, XCircle, Loader2, Sparkles,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import {
  sendDigestNow, scheduleDigest,
  getDigestJobs, cancelDigestJob,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DigestJob {
  job_id: string;
  recipient_email: string;
  subject: string;
  scheduled_at: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  created_at: string;
  sent_at: string | null;
}

type SendMode = "now" | "schedule";

// ── Constants ──────────────────────────────────────────────────────────────────

const HOURS   = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = ["00","15","30","45"];

const CONTENT_ITEMS = [
  { icon: "📊", label: "KPI Summary",      desc: "Revenue, top products, key trends",  key: "include_kpis"      },
  { icon: "💡", label: "AI Insights",      desc: "Top opportunities and risks",         key: "include_insights"  },
  { icon: "🔔", label: "Active Alerts",    desc: "Any flagged anomalies or issues",     key: "include_alerts"    },
  { icon: "🔮", label: "Forecast Snippet", desc: "Next period revenue prediction",      key: "include_forecast"  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function toUtcIso(date: string, hour: string, minute: string, ampm: "AM" | "PM"): string {
  let h = parseInt(hour, 10);
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  const localDateStr = `${date}T${String(h).padStart(2, "0")}:${minute}:00`;
  return new Date(localDateStr).toISOString().slice(0, 19);
}

function fmtScheduledTime(utcIso: string): string {
  const d = new Date(utcIso + "Z");
  const datePart = d.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} at ${timePart}`;
}

const STATUS_STYLE: Record<DigestJob["status"], { bg: string; color: string; label: string }> = {
  scheduled: { bg: "rgba(99,102,241,0.12)", color: "#818cf8", label: "Scheduled" },
  sending:   { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", label: "Sending…"  },
  sent:      { bg: "rgba(34,197,94,0.10)",   color: "#22c55e", label: "Sent"      },
  failed:    { bg: "rgba(239,68,68,0.10)",   color: "#ef4444", label: "Failed"    },
  cancelled: { bg: "rgba(100,116,139,0.10)", color: "#64748b", label: "Cancelled" },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function DigestSettingsPage() {
  const { user } = useAuth();

  // Send / Schedule form
  const [sendMode, setSendMode]       = useState<SendMode>("now");
  const [sendEmail, setSendEmail]     = useState(user?.email || "");
  const [sendSubject, setSendSubject] = useState("Your Weekly Business Digest");
  const [sendMessage, setSendMessage] = useState("");
  const [emailError, setEmailError]   = useState("");
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [acting, setActing]           = useState(false);

  // Scheduler picker
  const [schedDate,   setSchedDate]   = useState(todayIso());
  const [schedHour,   setSchedHour]   = useState("9");
  const [schedMinute, setSchedMinute] = useState("00");
  const [schedAmPm,   setSchedAmPm]   = useState<"AM" | "PM">("AM");

  // Content toggles
  const [content, setContent] = useState({
    include_kpis: true, include_insights: true, include_alerts: true, include_forecast: false,
  });
  const toggleContent = (key: keyof typeof content) =>
    setContent(c => ({ ...c, [key]: !c[key] }));

  // Jobs
  const [jobs, setJobs]               = useState<DigestJob[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    getDigestJobs().then(r => setJobs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setSendEmail(user?.email || "");
  }, [user]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const validateSendForm = (): boolean => {
    setEmailError("");
    if (!sendEmail.trim())              { setEmailError("Recipient email is required."); return false; }
    if (!isValidEmail(sendEmail.trim())) { setEmailError("Please enter a valid email address."); return false; }
    if (!sendSubject.trim())            { setEmailError("Subject is required."); return false; }
    return true;
  };

  const handleSendNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSendForm()) return;
    setActing(true);
    setActionResult(null);
    try {
      const res = await sendDigestNow({
        recipient_email: sendEmail.trim(),
        subject: sendSubject.trim(),
        custom_message: sendMessage.trim() || null,
      });
      setActionResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) getDigestJobs().then(r => setJobs(r.data)).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Failed to send digest. Check your SMTP configuration.";
      setActionResult({ success: false, message: msg });
    } finally {
      setActing(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSendForm()) return;

    const utcIso = toUtcIso(schedDate, schedHour, schedMinute, schedAmPm);
    if (new Date(utcIso + "Z") <= new Date()) {
      setEmailError("Scheduled time must be in the future.");
      return;
    }

    setActing(true);
    setActionResult(null);
    try {
      const res = await scheduleDigest({
        recipient_email: sendEmail.trim(),
        subject: sendSubject.trim(),
        custom_message: sendMessage.trim() || null,
        scheduled_at: utcIso,
      });
      setActionResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) getDigestJobs().then(r => setJobs(r.data)).catch(() => {});
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to schedule digest.";
      setActionResult({ success: false, message: msg });
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await cancelDigestJob(jobId);
      setJobs(js => js.map(j => j.job_id === jobId ? { ...j, status: "cancelled" } : j));
    } catch { /* ignore */ } finally {
      setCancellingId(null);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const pendingJobs = jobs.filter(j => j.status === "scheduled");
  const nextJob     = pendingJobs.length
    ? pendingJobs.reduce((a, b) => a.scheduled_at < b.scheduled_at ? a : b)
    : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Automation"
        title="Weekly Digest"
        description="Deliver an AI-written summary of your business performance directly to your inbox."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>

        {/* ── Left column ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* What to Include */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700,
                         display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} style={{ color: "var(--primary-light)" }} /> What to Include
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CONTENT_ITEMS.map(item => (
                <div
                  key={item.key}
                  onClick={() => toggleContent(item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    background: "rgba(255,255,255,0.02)", transition: "all 0.15s",
                    border: `1px solid ${content[item.key] ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>{item.desc}</p>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, transition: "all 0.15s",
                    background: content[item.key] ? "var(--primary)" : "transparent",
                    border: `2px solid ${content[item.key] ? "var(--primary)" : "var(--border-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {content[item.key] && <CheckCircle2 size={12} style={{ color: "white" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Send / Schedule card */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700,
                         display: "flex", alignItems: "center", gap: 8 }}>
              <Send size={15} style={{ color: "var(--primary-light)" }} /> Send Weekly Digest
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              Deliver the digest immediately or schedule it for a future date and time.
            </p>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10,
                          border: "1px solid var(--border)", overflow: "hidden", width: "fit-content" }}>
              {(["now", "schedule"] as SendMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setSendMode(mode); setActionResult(null); setEmailError(""); }}
                  style={{
                    padding: "8px 20px", border: "none", cursor: "pointer",
                    fontWeight: 600, fontSize: "0.85rem", transition: "all 0.15s",
                    background: sendMode === mode ? "var(--primary)" : "transparent",
                    color: sendMode === mode ? "white" : "var(--text-secondary)",
                  }}
                >
                  {mode === "now"
                    ? <><Send size={12} style={{ marginRight: 6 }} />Send Now</>
                    : <><Calendar size={12} style={{ marginRight: 6 }} />Schedule</>}
                </button>
              ))}
            </div>

            <form
              onSubmit={sendMode === "now" ? handleSendNow : handleSchedule}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Recipient */}
              <div>
                <label className="form-label">Recipient Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={sendEmail}
                  onChange={e => { setSendEmail(e.target.value); setEmailError(""); }}
                  placeholder="recipient@company.com"
                  required
                />
              </div>

              {/* Subject */}
              <div>
                <label className="form-label">Subject *</label>
                <input
                  type="text"
                  className="form-input"
                  value={sendSubject}
                  onChange={e => setSendSubject(e.target.value)}
                  placeholder="Your Weekly Business Digest"
                  required
                />
              </div>

              {/* Personal note */}
              <div>
                <label className="form-label">Personal Note (optional)</label>
                <textarea
                  className="form-input"
                  value={sendMessage}
                  onChange={e => setSendMessage(e.target.value)}
                  placeholder="Add a personal note to include in the email…"
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </div>

              {/* Schedule pickers */}
              <AnimatePresence>
                {sendMode === "schedule" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)",
                                  background: "rgba(99,102,241,0.04)",
                                  display: "flex", flexDirection: "column", gap: 14 }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600,
                                  color: "var(--primary-light)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} /> Select delivery date and time
                      </p>

                      <div>
                        <label className="form-label">Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={schedDate}
                          min={todayIso()}
                          onChange={e => setSchedDate(e.target.value)}
                          required={sendMode === "schedule"}
                        />
                      </div>

                      <div>
                        <label className="form-label">Time</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 10 }}>
                          <select title="Hour" className="form-input"
                                  value={schedHour} onChange={e => setSchedHour(e.target.value)}>
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <select title="Minute" className="form-input"
                                  value={schedMinute} onChange={e => setSchedMinute(e.target.value)}>
                            {MINUTES.map(m => <option key={m} value={m}>:{m}</option>)}
                          </select>
                          <select title="AM or PM" className="form-input"
                                  value={schedAmPm} onChange={e => setSchedAmPm(e.target.value as "AM" | "PM")}>
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>

                      {schedDate && (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          Sends:{" "}
                          <strong style={{ color: "var(--text-primary)" }}>
                            {fmtScheduledTime(toUtcIso(schedDate, schedHour, schedMinute, schedAmPm))}
                          </strong>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Validation error */}
              {emailError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                              borderRadius: 8, background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "0.85rem" }}>
                  <AlertCircle size={14} /> {emailError}
                </div>
              )}

              {/* Action result */}
              <AnimatePresence>
                {actionResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "12px 16px", borderRadius: 10, fontSize: "0.88rem",
                      background: actionResult.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${actionResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                      color: actionResult.success ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {actionResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    {actionResult.message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                className="button button-primary"
                disabled={acting || !sendEmail || !sendSubject}
                style={{ width: "fit-content" }}
              >
                {acting ? (
                  <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Processing…</>
                ) : sendMode === "now" ? (
                  <><Send size={14} /> Send Now</>
                ) : (
                  <><Calendar size={14} /> Schedule Digest</>
                )}
              </button>
            </form>
          </div>

          {/* Delivery log */}
          {jobs.length > 0 && (
            <div className="section-card">
              <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700,
                           display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} style={{ color: "var(--primary-light)" }} /> Digest Delivery Log
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {jobs.map(job => {
                  const s = STATUS_STYLE[job.status] ?? STATUS_STYLE.failed;
                  return (
                    <div key={job.job_id} style={{
                      padding: "12px 14px", borderRadius: 12,
                      border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)",
                      display: "flex", alignItems: "flex-start", gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: "0.72rem",
                                         fontWeight: 700, letterSpacing: "0.03em",
                                         background: s.bg, color: s.color }}>
                            {s.label}
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)",
                                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {job.recipient_email}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 2px", fontSize: "0.8rem", fontWeight: 600,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.subject}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                          {job.status === "sent" && job.sent_at
                            ? `Delivered ${fmtScheduledTime(job.sent_at.slice(0, 19))}`
                            : job.status === "scheduled"
                              ? `Scheduled for ${fmtScheduledTime(job.scheduled_at)}`
                              : `Created ${fmtScheduledTime(job.created_at.slice(0, 19))}`}
                        </p>
                      </div>
                      {job.status === "scheduled" && (
                        <button
                          type="button"
                          title="Cancel this scheduled digest"
                          onClick={() => handleCancel(job.job_id)}
                          disabled={cancellingId === job.job_id}
                          style={{ background: "none", border: "none", cursor: "pointer",
                                   color: "var(--muted)", padding: 4, flexShrink: 0,
                                   opacity: cancellingId === job.job_id ? 0.5 : 1 }}
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status summary */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700 }}>Digest Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                            padding: "10px 12px", borderRadius: 10,
                            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Next Send</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, textAlign: "right", maxWidth: 180 }}>
                  {nextJob ? fmtScheduledTime(nextJob.scheduled_at) : "Not scheduled"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between",
                            padding: "10px 12px", borderRadius: 10,
                            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Status</span>
                <span style={{
                  fontSize: "0.78rem", fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                  ...(() => {
                    if (pendingJobs.length > 0) return { background: STATUS_STYLE.scheduled.bg, color: STATUS_STYLE.scheduled.color };
                    if (jobs.find(j => j.status === "sent")) return { background: STATUS_STYLE.sent.bg, color: STATUS_STYLE.sent.color };
                    return { background: "rgba(100,116,139,0.1)", color: "#64748b" };
                  })(),
                }}>
                  {pendingJobs.length > 0 ? "Scheduled" : jobs.find(j => j.status === "sent") ? "Sent" : "Idle"}
                </span>
              </div>
            </div>
          </div>

          {/* Email preview */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700 }}>Email Preview</h3>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)",
                          borderRadius: 12, padding: 20, fontSize: "0.8rem" }}>
              <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                <div className="brand-mark"
                     style={{ width: 28, height: 28, fontSize: "0.7rem", display: "inline-flex", marginBottom: 10 }}>
                  BI
                </div>
                <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "0.95rem" }}>
                  Weekly Business Digest
                </p>
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>
                Hey {user?.name?.split(" ")[0] || "there"} 👋
              </p>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                Here's your AI-generated summary of this week's business performance.
              </p>
              {content.include_kpis && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.08)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>📊 Key Metrics</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                    Revenue: $4.29M (+12.4%) · Bookings: 2,600 · Top: Paris
                  </p>
                </div>
              )}
              {content.include_insights && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(34,197,94,0.06)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>💡 Top Insight</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                    Top agent is 30% above team avg. Share their process to lift the team.
                  </p>
                </div>
              )}
              {content.include_alerts && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>🔔 Alert</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                    103 cancellations = $198K lost. Consider a cancellation prevention flow.
                  </p>
                </div>
              )}
              {content.include_forecast && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(139,92,246,0.06)", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.8rem" }}>🔮 Forecast</p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                    Next period revenue projected at $4.6M (+7.2% growth).
                  </p>
                </div>
              )}
              <button type="button" className="button button-primary"
                      style={{ width: "100%", justifyContent: "center", marginTop: 12, fontSize: "0.8rem" }}>
                View Full Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
