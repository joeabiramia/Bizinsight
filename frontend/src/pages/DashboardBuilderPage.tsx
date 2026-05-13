import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { listDatasets, fetchAnalysis, fetchAlerts, fetchBusinessMonitor } from "../services/api";

interface Dataset { file_id: string; filename: string; }

type WidgetType = "kpi" | "pulse" | "alerts" | "chart_bar" | "chart_pie" | "insights" | "forecast_hint";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  file_id: string;
  span: 1 | 2 | 3;
}

interface WidgetData {
  analysis?: { numeric_summary?: Record<string, { total: number; mean: number }>; chart_data?: { kpi_means?: Array<{name: string; value: number}>; breakdowns?: Record<string, Record<string, number>> }; industry?: string };
  pulse?: string;
  summary?: string;
  alerts?: Array<{ type: string; title: string; severity: string; recommended_action: string }>;
}

const WIDGET_CATALOG: Array<{ type: WidgetType; label: string; icon: string; description: string; defaultSpan: 1|2|3 }> = [
  { type: "pulse",       label: "Business Pulse",    icon: "📈", description: "AI-generated pulse: positive / stable / negative", defaultSpan: 2 },
  { type: "kpi",         label: "KPI Cards",         icon: "💡", description: "Key metrics from your dataset",                    defaultSpan: 3 },
  { type: "alerts",      label: "Live Alerts",       icon: "⚠",  description: "Active business risk & opportunity alerts",        defaultSpan: 2 },
  { type: "chart_bar",   label: "Bar Chart",         icon: "📊", description: "Top breakdown by category",                       defaultSpan: 2 },
  { type: "chart_pie",   label: "Pie Chart",         icon: "🥧", description: "Revenue/metric share by segment",                  defaultSpan: 1 },
  { type: "insights",    label: "AI Insights",       icon: "🤖", description: "Top 3 actionable business insights",               defaultSpan: 2 },
  { type: "forecast_hint", label: "Forecast Hint",  icon: "🔮", description: "Trend direction and growth indicator",             defaultSpan: 1 },
];

const SEVERITY_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e", opportunity: "#22c55e" };
const PULSE_COLOR: Record<string, string> = { positive: "#22c55e", stable: "#3b82f6", negative: "#ef4444" };

function WidgetRenderer({ widget, data }: { widget: Widget; data: WidgetData | null }) {
  if (!data) return <div style={{ color: "var(--muted)", fontSize: "0.82rem", padding: "20px 0" }}>Loading…</div>;

  if (widget.type === "pulse") {
    const pulse = data.pulse ?? "stable";
    const color = PULSE_COLOR[pulse] ?? "#3b82f6";
    return (
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ fontSize: "2rem" }}>{pulse === "positive" ? "📈" : pulse === "negative" ? "📉" : "📊"}</span>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700, color, fontSize: "1.05rem", textTransform: "capitalize" }}>{pulse}</p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>{data.summary ?? "AI analysis complete."}</p>
        </div>
      </div>
    );
  }

  if (widget.type === "kpi") {
    const kpis = data.analysis?.numeric_summary ?? {};
    const entries = Object.entries(kpis).slice(0, 4);
    if (!entries.length) return <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>No KPI data.</p>;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
        {entries.map(([col, stats]) => (
          <div key={col} style={{ background: "rgba(99,102,241,0.06)", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{col}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem" }}>{stats.total?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === "alerts") {
    const alerts = (data.alerts ?? []).slice(0, 3);
    if (!alerts.length) return <p style={{ color: "#22c55e", fontSize: "0.82rem" }}>✓ No active alerts.</p>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ padding: "8px 12px", borderRadius: 7, borderLeft: `3px solid ${SEVERITY_COLOR[a.severity] ?? "#6b7280"}`, background: `${SEVERITY_COLOR[a.severity] ?? "#6b7280"}10` }}>
            <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: "0.83rem" }}>{a.title}</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{a.recommended_action}</p>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === "chart_bar") {
    const breakdowns = data.analysis?.chart_data?.breakdowns ?? {};
    const [firstKey] = Object.keys(breakdowns);
    const bars = firstKey ? Object.entries(breakdowns[firstKey]).slice(0, 5) : [];
    if (!bars.length) return <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>No chart data.</p>;
    const max = Math.max(...bars.map(([, v]) => v));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{firstKey}</p>
        {bars.map(([label, val]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", width: 80, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{label}</span>
            <div style={{ flex: 1, background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${(val / max) * 100}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: "0.72rem", width: 50, textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === "chart_pie") {
    const kpis = data.analysis?.chart_data?.kpi_means ?? [];
    if (!kpis.length) return <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>No data.</p>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {kpis.slice(0, 4).map((k, i) => {
          const colors = ["#6366f1","#22c55e","#f59e0b","#ef4444"];
          return (
            <div key={k.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], flexShrink: 0 }} />
              <span style={{ fontSize: "0.78rem", flex: 1 }}>{k.name}</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{k.value?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (widget.type === "insights") {
    const industry = data.analysis?.industry ?? "Business";
    return (
      <div>
        <span style={{ display: "inline-block", background: "rgba(99,102,241,0.1)", color: "#6366f1", fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginBottom: 10 }}>{industry}</span>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>AI insights available. Open the full dashboard to explore actionable recommendations for your business.</p>
      </div>
    );
  }

  if (widget.type === "forecast_hint") {
    const pulse = data.pulse ?? "stable";
    const trend = pulse === "positive" ? "Growing ↑" : pulse === "negative" ? "Declining ↓" : "Stable →";
    const color = PULSE_COLOR[pulse] ?? "#3b82f6";
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ margin: "0 0 4px", fontSize: "1.6rem" }}>🔮</p>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem", color }}>{trend}</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>Based on current trajectory</p>
      </div>
    );
  }

  return null;
}

const STORAGE_KEY = "bizinsight_dashboard_layout";

function generateId() { return Math.random().toString(36).slice(2, 9); }

export default function DashboardBuilderPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
  });
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listDatasets().then(r => {
      const ds: Dataset[] = r.data.datasets ?? [];
      setDatasets(ds);
      if (!selectedDataset && ds.length > 0) setSelectedDataset(ds[0].file_id);
    }).catch(() => {});
  }, []);

  // Load data for each unique file_id in widgets
  useEffect(() => {
    const fileIds = [...new Set(widgets.map(w => w.file_id).filter(Boolean))];
    fileIds.forEach(fid => {
      if (widgetData[fid]) return;
      Promise.all([
        fetchAnalysis(fid).catch(() => null),
        fetchAlerts(fid).catch(() => null),
        fetchBusinessMonitor(fid).catch(() => null),
      ]).then(([analysisRes, alertsRes, monitorRes]) => {
        setWidgetData(prev => ({
          ...prev,
          [fid]: {
            analysis: analysisRes?.data?.analysis,
            pulse: monitorRes?.data?.pulse,
            summary: monitorRes?.data?.summary,
            alerts: alertsRes?.data?.alerts ?? [],
          },
        }));
      });
    });
  }, [widgets]);

  const saveLayout = (w: Widget[]) => {
    setWidgets(w);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addWidget = (type: WidgetType, defaultSpan: 1|2|3) => {
    if (!selectedDataset) return;
    const catalog = WIDGET_CATALOG.find(c => c.type === type)!;
    const newWidget: Widget = { id: generateId(), type, title: catalog.label, file_id: selectedDataset, span: defaultSpan };
    saveLayout([...widgets, newWidget]);
    setShowCatalog(false);
  };

  const removeWidget = (id: string) => saveLayout(widgets.filter(w => w.id !== id));

  const updateTitle = (id: string, title: string) => saveLayout(widgets.map(w => w.id === id ? { ...w, title } : w));

  const updateSpan = (id: string, span: 1|2|3) => saveLayout(widgets.map(w => w.id === id ? { ...w, span } : w));

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id); };
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    const reordered = [...widgets];
    const fromIdx = reordered.findIndex(w => w.id === dragging);
    const toIdx = reordered.findIndex(w => w.id === targetId);
    const [item] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);
    saveLayout(reordered);
    setDragging(null); setDragOver(null);
  };

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Dashboards</p>
          <h1>Dashboard Builder</h1>
          <p className="section-description">Drag, drop, and arrange widgets into your personalized executive view.</p>
        </div>
        <div className="hero-actions">
          {saved && <span style={{ fontSize: "0.82rem", color: "#22c55e" }}>✓ Saved</span>}
          <button type="button" className="button button-secondary" onClick={() => { localStorage.removeItem(STORAGE_KEY); setWidgets([]); }}>Reset</button>
          <button type="button" className="button button-primary" onClick={() => setShowCatalog(v => !v)}>+ Add Widget</button>
        </div>
      </div>

      {/* Widget catalog */}
      {showCatalog && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Choose a Widget</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Dataset:</label>
              <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--text)", fontSize: "0.85rem" }}>
                {datasets.map(d => <option key={d.file_id} value={d.file_id}>{d.filename}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {WIDGET_CATALOG.map(c => (
              <button key={c.type} type="button" onClick={() => addWidget(c.type, c.defaultSpan)}
                style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"}>
                <span style={{ fontSize: "1.4rem", display: "block", marginBottom: 6 }}>{c.icon}</span>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.88rem" }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{c.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      {widgets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", border: "2px dashed var(--border)", borderRadius: 16, color: "var(--muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎨</div>
          <h3 style={{ color: "var(--text)" }}>Your canvas is empty</h3>
          <p style={{ fontSize: "0.88rem" }}>Click "+ Add Widget" to start building your personalized dashboard.</p>
          <button type="button" className="button button-primary" style={{ marginTop: 16 }} onClick={() => setShowCatalog(true)}>+ Add First Widget</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {widgets.map(widget => (
            <div key={widget.id}
              draggable
              onDragStart={() => handleDragStart(widget.id)}
              onDragOver={e => handleDragOver(e, widget.id)}
              onDrop={() => handleDrop(widget.id)}
              onDragEnd={() => { setDragging(null); setDragOver(null); }}
              style={{
                gridColumn: `span ${widget.span}`,
                padding: "18px 20px",
                borderRadius: 14,
                border: dragOver === widget.id ? "2px solid #6366f1" : "1px solid var(--border)",
                background: dragging === widget.id ? "rgba(99,102,241,0.06)" : "var(--surface)",
                cursor: "grab",
                transition: "border-color 0.15s",
                opacity: dragging === widget.id ? 0.6 : 1,
              }}>
              {/* Widget header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <input value={widget.title} onChange={e => updateTitle(widget.id, e.target.value)}
                  style={{ background: "none", border: "none", color: "var(--text)", fontWeight: 700, fontSize: "0.92rem", padding: 0, cursor: "text", flex: 1 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <select value={widget.span} onChange={e => updateSpan(widget.id, Number(e.target.value) as 1|2|3)}
                    style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--input-bg,#0d0d1a)", color: "var(--muted)", fontSize: "0.72rem" }}>
                    <option value={1}>1 col</option>
                    <option value={2}>2 col</option>
                    <option value={3}>Full</option>
                  </select>
                  <button type="button" onClick={() => navigate(`/analysis/${widget.file_id}`)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "#6366f1", padding: "2px 6px" }}>↗</button>
                  <button type="button" onClick={() => removeWidget(widget.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", padding: "2px 4px", lineHeight: 1 }}>×</button>
                </div>
              </div>

              {/* Widget content */}
              <WidgetRenderer widget={widget} data={widgetData[widget.file_id] ?? null} />
            </div>
          ))}
        </div>
      )}

      <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.75rem", marginTop: 24 }}>
        Drag widgets to reorder · Click titles to rename · Layout auto-saved locally
      </p>
    </MainLayout>
  );
}
