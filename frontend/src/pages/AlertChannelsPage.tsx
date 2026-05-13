import { useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { api, listDatasets, fetchAlerts } from "../services/api";

interface Channel {
  channel_id: string;
  channel_type: "slack" | "whatsapp";
  label: string;
  webhook_url?: string;
  phone_number?: string;
  active: boolean;
  created_at: string;
}
interface Dataset { file_id: string; filename: string; }

export default function AlertChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [tab, setTab] = useState<"slack" | "whatsapp">("slack");
  const [form, setForm] = useState({ label: "", webhook_url: "", phone_number: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api.get("/alert-channels").then(r => setChannels(r.data.channels ?? [])).catch(() => {});

  useEffect(() => {
    load();
    listDatasets().then(r => {
      const ds = r.data.datasets ?? [];
      setDatasets(ds);
      if (ds.length > 0) setSelectedFile(ds[0].file_id);
    }).catch(() => {});
  }, []);

  const flash = (type: string, text: string) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 3000); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/alert-channels", {
        channel_type: tab,
        label: form.label || (tab === "slack" ? "Slack" : "WhatsApp"),
        webhook_url: tab === "slack" ? form.webhook_url : "",
        phone_number: tab === "whatsapp" ? form.phone_number : "",
      });
      setForm({ label: "", webhook_url: "", phone_number: "" });
      load();
      flash("success", "Channel added.");
    } catch (e: unknown) {
      flash("error", (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to add channel.");
    } finally { setSaving(false); }
  };

  const handleToggle = async (ch: Channel) => {
    await api.put(`/alert-channels/${ch.channel_id}`, { active: !ch.active }).catch(() => {});
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/alert-channels/${id}`).catch(() => {});
    load();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.post(`/alert-channels/test/${id}`);
      const ok = r.data.results?.[0]?.sent;
      flash(ok ? "success" : "error", ok ? "Test alert sent!" : "Send failed — check your configuration.");
    } catch { flash("error", "Test failed."); }
    finally { setTesting(null); }
  };

  const handleDispatch = async () => {
    if (!selectedFile) return;
    setDispatching(true);
    try {
      const r = await api.post(`/alert-channels/dispatch/${selectedFile}`);
      flash("success", `Sent ${r.data.alert_count} alerts to ${r.data.channels_notified} channel(s).`);
    } catch { flash("error", "Dispatch failed."); }
    finally { setDispatching(false); }
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" as const };

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Alert Channels</h1>
          <p className="section-description">Push critical business alerts to Slack or WhatsApp the moment they're detected.</p>
        </div>
      </div>

      {msg.text && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 16,
          background: msg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.type === "success" ? "#22c55e" : "#ef4444", fontSize: "0.88rem" }}>
          {msg.text}
        </div>
      )}

      {/* Connected channels */}
      {channels.length > 0 && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Active Channels</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={selectedFile} onChange={e => setSelectedFile(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.82rem" }}>
                {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
              </select>
              <button type="button" className="button button-primary" style={{ fontSize: "0.82rem", padding: "7px 16px" }} onClick={handleDispatch} disabled={dispatching || !selectedFile}>
                {dispatching ? "Sending…" : "📣 Dispatch Alerts"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {channels.map(ch => (
              <div key={ch.channel_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "1.3rem" }}>{ch.channel_type === "slack" ? "💬" : "📱"}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>{ch.label}</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: ch.active ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
                        color: ch.active ? "#22c55e" : "#6b7280" }}>
                        {ch.active ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--muted)", textTransform: "capitalize" }}>
                      {ch.channel_type}{ch.phone_number ? ` · ${ch.phone_number}` : ""}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="button button-secondary" style={{ fontSize: "0.78rem", padding: "5px 12px" }} onClick={() => handleTest(ch.channel_id)} disabled={testing === ch.channel_id}>
                    {testing === ch.channel_id ? "…" : "Test"}
                  </button>
                  <button type="button" className="button button-secondary" style={{ fontSize: "0.78rem", padding: "5px 12px" }} onClick={() => handleToggle(ch)}>
                    {ch.active ? "Pause" : "Resume"}
                  </button>
                  <button type="button" className="button button-secondary" style={{ fontSize: "0.78rem", padding: "5px 12px", color: "#ef4444" }} onClick={() => handleDelete(ch.channel_id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add channel form */}
      <div className="section-card">
        <h3 style={{ margin: "0 0 16px" }}>Add Alert Channel</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["slack", "whatsapp"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              style={{ padding: "8px 20px", borderRadius: 8, border: `1px solid ${tab === t ? "#6366f1" : "var(--border)"}`, background: tab === t ? "rgba(99,102,241,0.1)" : "var(--surface)", color: tab === t ? "#6366f1" : "var(--text)", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: "0.88rem" }}>
              {t === "slack" ? "💬 Slack" : "📱 WhatsApp"}
            </button>
          ))}
        </div>

        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>Channel Label</label>
              <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={tab === "slack" ? "e.g. #alerts-channel" : "e.g. CEO WhatsApp"} style={inputStyle} />
            </div>

            {tab === "slack" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Slack Webhook URL *</label>
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "#6366f1" }}>How to get this?</a>
                </div>
                <input type="url" required value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/services/T.../B.../..." style={inputStyle} />
              </div>
            )}

            {tab === "whatsapp" && (
              <>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 600 }}>WhatsApp Number *</label>
                  <input type="text" required value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+1234567890" style={inputStyle} />
                </div>
                <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.82rem", color: "var(--text)" }}>
                  <strong style={{ color: "#f59e0b" }}>Twilio required.</strong> Set <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, and <code>TWILIO_WHATSAPP_FROM</code> environment variables.
                </div>
              </>
            )}

            <button type="submit" className="button button-primary" style={{ width: "fit-content" }} disabled={saving}>
              {saving ? "Adding…" : `Add ${tab === "slack" ? "Slack" : "WhatsApp"} Channel`}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
