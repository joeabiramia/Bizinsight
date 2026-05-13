import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { api, listDatasets } from "../services/api";

interface Schedule {
  schedule_id: string;
  file_id: string;
  filename: string;
  email: string;
  recipient_name: string;
  frequency: string;
  time_of_day: string;
  day_of_week: number;
  day_of_month: number;
  active: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  created_at: string;
}

interface Dataset { file_id: string; filename: string; }

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const FREQ_LABELS: Record<string,string> = { daily: "Every day", weekly: "Every week", monthly: "Every month" };

export default function SchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({
    file_id: "", email: "", recipient_name: "", frequency: "weekly",
    time_of_day: "08:00", day_of_week: 0, day_of_month: 1,
    dashboard_url: window.location.origin + "/dashboard",
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = () => {
    api.get("/schedules").then(r => {
      setSchedules(r.data.schedules ?? []);
      setSmtpConfigured(r.data.smtp_configured ?? false);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    listDatasets().then(r => setDatasets(r.data.datasets ?? [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErrorMsg(""); setSuccessMsg("");
    try {
      await api.post("/schedules", form);
      setSuccessMsg("Schedule created! Reports will be sent automatically.");
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setErrorMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create schedule.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/schedules/${id}`).catch(() => {});
    load();
  };

  const handleToggle = async (s: Schedule) => {
    await api.put(`/schedules/${s.schedule_id}`, { active: !s.active }).catch(() => {});
    load();
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      await api.post(`/schedules/${id}/send-now`);
      setSuccessMsg("Test report sent!");
      load();
    } catch (err: unknown) {
      setErrorMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Send failed.");
    } finally { setSending(null); }
  };

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Automation</p>
          <h1>Scheduled Reports</h1>
          <p className="section-description">Automatically email business reports on your chosen schedule.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-primary" onClick={() => setShowForm(v => !v)}>
            + New Schedule
          </button>
        </div>
      </div>

      {!smtpConfigured && (
        <div style={{ padding:"14px 18px", borderRadius:10, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", marginBottom:20, fontSize:"0.88rem" }}>
          <strong style={{ color:"#f59e0b" }}>⚠ SMTP not configured.</strong> Set <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> environment variables to enable email sending. Schedules will still be saved.
        </div>
      )}

      {successMsg && <div style={{ padding:"12px 16px", borderRadius:8, background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", color:"#22c55e", marginBottom:16 }}>✓ {successMsg}</div>}
      {errorMsg && <div className="alert alert-error" style={{ marginBottom:16 }}>{errorMsg}</div>}

      {showForm && (
        <div className="section-card" style={{ marginBottom:24 }}>
          <h3 style={{ margin:"0 0 18px" }}>Create Email Schedule</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Dataset *</label>
                <select required value={form.file_id} onChange={e => setForm(f => ({ ...f, file_id: e.target.value }))}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }}>
                  <option value="">Select a dataset…</option>
                  {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Recipient Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Recipient Name</label>
                <input type="text" value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                  placeholder="John Smith"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Send Time (UTC)</label>
                <input type="time" value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }} />
              </div>
              {form.frequency === "weekly" && (
                <div>
                  <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Day of Week</label>
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.frequency === "monthly" && (
                <div>
                  <label style={{ display:"block", marginBottom:6, fontSize:"0.85rem", fontWeight:600 }}>Day of Month</label>
                  <input type="number" min={1} max={28} value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: Number(e.target.value) }))}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg,#0d0d1a)", color:"var(--text)", fontSize:"0.9rem", boxSizing:"border-box" }} />
                </div>
              )}
              <div style={{ gridColumn:"1/-1", display:"flex", gap:10, marginTop:4 }}>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Create Schedule"}</button>
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ color:"var(--muted)", padding:24 }}>Loading…</div> :
        schedules.length === 0 ? (
          <div className="section-card" style={{ textAlign:"center", padding:40 }}>
            <div style={{ fontSize:"2.5rem", marginBottom:12 }}>📧</div>
            <h3>No schedules yet</h3>
            <p style={{ color:"var(--muted)", fontSize:"0.88rem" }}>Create your first schedule to receive automated reports.</p>
            <button type="button" className="button button-primary" style={{ marginTop:16 }} onClick={() => setShowForm(true)}>+ New Schedule</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {schedules.map(s => (
              <div key={s.schedule_id} style={{ padding:"18px 20px", borderRadius:12, border:"1px solid var(--border)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:"1.1rem" }}>📧</span>
                    <span style={{ fontWeight:700, fontSize:"0.95rem" }}>{s.email}</span>
                    <span style={{ fontSize:"0.72rem", fontWeight:700, padding:"2px 8px", borderRadius:20,
                      background: s.active ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
                      color: s.active ? "#22c55e" : "#6b7280" }}>
                      {s.active ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>
                  <p style={{ margin:0, fontSize:"0.78rem", color:"var(--muted)" }}>
                    {FREQ_LABELS[s.frequency]} {s.frequency === "weekly" ? `(${DAY_NAMES[s.day_of_week]})` : s.frequency === "monthly" ? `(day ${s.day_of_month})` : ""} at {s.time_of_day} UTC
                    {" · "}{s.filename}
                    {s.last_sent_at && ` · Last sent: ${new Date(s.last_sent_at).toLocaleString()}`}
                  </p>
                  {s.last_status === "failed" && <p style={{ margin:"2px 0 0", fontSize:"0.75rem", color:"#ef4444" }}>Last send failed — check SMTP config</p>}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" className="button button-secondary" style={{ padding:"6px 14px", fontSize:"0.8rem" }} onClick={() => handleToggle(s)}>
                    {s.active ? "Pause" : "Resume"}
                  </button>
                  <button type="button" className="button button-secondary" style={{ padding:"6px 14px", fontSize:"0.8rem" }} onClick={() => handleSendNow(s.schedule_id)} disabled={sending === s.schedule_id}>
                    {sending === s.schedule_id ? "Sending…" : "Send Now"}
                  </button>
                  <button type="button" className="button button-secondary" style={{ padding:"6px 14px", fontSize:"0.8rem", color:"#ef4444" }} onClick={() => handleDelete(s.schedule_id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </MainLayout>
  );
}
