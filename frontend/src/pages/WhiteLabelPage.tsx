import { useState } from "react";
import { Palette, Eye, CheckCircle2, Globe } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../services/api";

interface BrandSettings {
  company_name: string;
  accent_color: string;
  logo_url: string;
  powered_by_visible: boolean;
  custom_domain: string;
  report_footer: string;
}

const DEFAULT: BrandSettings = {
  company_name: "",
  accent_color: "#6366f1",
  logo_url: "",
  powered_by_visible: true,
  custom_domain: "",
  report_footer: "",
};

const PRESET_COLORS = ["#6366f1","#0ea5e9","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];

export default function WhiteLabelPage() {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/workspace/branding", settings);
    } catch { /* demo */ }
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const displayName = settings.company_name || "BizInsight AI";

  return (
    <MainLayout>
      <PageHeader
        eyebrow="White Label"
        title="Brand Customization"
        description="Customize the look and feel for client-facing dashboards and shared reports."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        {/* Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700 }}>Brand Identity</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label">Company / Brand Name</label>
                <input className="form-input" placeholder="e.g. Acme Analytics" value={settings.company_name} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Logo URL (optional)</label>
                <input className="form-input" placeholder="https://your-cdn.com/logo.png" value={settings.logo_url} onChange={e => setSettings(s => ({ ...s, logo_url: e.target.value }))} />
                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>PNG or SVG recommended · transparent background</p>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Palette size={15} style={{ color: "var(--primary-light)" }} /> Accent Color
            </h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {PRESET_COLORS.map(color => (
                <button key={color} type="button"
                  aria-label={`Set accent color to ${color}`}
                  title={color}
                  onClick={() => setSettings(s => ({ ...s, accent_color: color }))}
                  style={{
                    width: 36, height: 36, borderRadius: 10, background: color,
                    border: settings.accent_color === color ? `3px solid white` : "3px solid transparent",
                    cursor: "pointer", boxShadow: settings.accent_color === color ? `0 0 0 2px ${color}` : "none",
                    transition: "all 0.15s",
                  }}
                />
              ))}
              <input type="color" value={settings.accent_color} onChange={e => setSettings(s => ({ ...s, accent_color: e.target.value }))}
                style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", padding: 2, background: "var(--surface-alt)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: `${settings.accent_color}15`, border: `1px solid ${settings.accent_color}30` }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: settings.accent_color }} />
              <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: settings.accent_color }}>{settings.accent_color}</span>
            </div>
          </div>

          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={15} style={{ color: "var(--primary-light)" }} /> Client Sharing
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Custom Domain (optional)</label>
                <input className="form-input" placeholder="analytics.yourcompany.com" value={settings.custom_domain} onChange={e => setSettings(s => ({ ...s, custom_domain: e.target.value }))} />
                <p style={{ margin: "5px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>Requires DNS CNAME setup pointing to bizinsight.ai</p>
              </div>
              <div>
                <label className="form-label">Report Footer Text</label>
                <input className="form-input" placeholder="Prepared by Acme Analytics · Confidential" value={settings.report_footer} onChange={e => setSettings(s => ({ ...s, report_footer: e.target.value }))} />
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => setSettings(s => ({ ...s, powered_by_visible: !s.powered_by_visible }))}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>Show "Powered by BizInsight"</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>Visible on shared dashboards and exported reports</p>
                </div>
                <div style={{
                  width: 44, height: 24, borderRadius: 12, background: settings.powered_by_visible ? "var(--primary)" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{ position: "absolute", top: 2, left: settings.powered_by_visible ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="button button-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Branding"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setPreviewMode(!previewMode)}>
              <Eye size={14} /> {previewMode ? "Hide Preview" : "Preview"}
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <div className="section-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700 }}>Live Preview</h3>

            {/* Navbar preview */}
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 12 }}>
              <div style={{ padding: "10px 16px", background: "var(--surface-raised)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="logo" style={{ height: 24, borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: settings.accent_color, display: "grid", placeItems: "center", color: "white", fontSize: "0.65rem", fontWeight: 800 }}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>{displayName}</span>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["Revenue", "Growth", "Deals", "MRR"].map(k => (
                    <div key={k} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase" }}>{k}</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: settings.accent_color }}>—</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Report preview */}
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <div style={{ height: 4, background: settings.accent_color }} />
              <div style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem" }}>Q4 Business Report</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>Generated {new Date().toLocaleDateString()}</p>
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: settings.accent_color, display: "grid", placeItems: "center", color: "white", fontSize: "0.55rem", fontWeight: 800 }}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div style={{ height: 1, background: "var(--border)", marginBottom: 10 }} />
                {settings.report_footer && (
                  <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--muted)", fontStyle: "italic" }}>{settings.report_footer}</p>
                )}
                {settings.powered_by_visible && (
                  <p style={{ margin: settings.report_footer ? "4px 0 0" : 0, fontSize: "0.65rem", color: "var(--muted)" }}>Powered by BizInsight AI</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
