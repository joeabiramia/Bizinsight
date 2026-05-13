import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import {
  createAutomationRule,
  deleteAutomationRule,
  fetchAutomationActions,
  fetchAutomationConditions,
  fetchAutomationHistory,
  fetchAutomationRules,
  triggerAutomation,
} from "../services/api";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationHistoryEntry,
  AutomationResult,
  AutomationRule,
} from "../types";

export default function AutomationPage() {
  const { fileId: paramFileId } = useParams();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [history, setHistory] = useState<AutomationHistoryEntry[]>([]);
  const [triggerResults, setTriggerResults] = useState<AutomationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");

  // Form state
  const [form, setForm] = useState({
    name: "",
    condition_id: "",
    threshold_pct: 15,
    action_id: "create_notification",
    action_message: "",
  });

  useEffect(() => {
    Promise.all([
      fetchAutomationRules(),
      fetchAutomationConditions(),
      fetchAutomationActions(),
      fetchAutomationHistory(),
    ])
      .then(([rulesRes, condRes, actRes, histRes]) => {
        setRules(rulesRes.data.rules || []);
        setConditions(condRes.data.conditions || []);
        setActions(actRes.data.actions || []);
        setHistory(histRes.data.history || []);
      })
      .catch(() => setError("Failed to load automation data"));
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.condition_id) {
      setError("Rule name and condition are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createAutomationRule({
        name: form.name,
        condition_id: form.condition_id,
        params: { threshold_pct: form.threshold_pct },
        action_id: form.action_id,
        action_message: form.action_message,
      });
      const res = await fetchAutomationRules();
      setRules(res.data.rules || []);
      setShowForm(false);
      setForm({ name: "", condition_id: "", threshold_pct: 15, action_id: "create_notification", action_message: "" });
    } catch {
      setError("Failed to create rule");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteAutomationRule(ruleId);
      setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
    } catch {
      setError("Failed to delete rule");
    }
  };

  const handleTrigger = async () => {
    if (!fileId) {
      setError("No dataset selected. Please open a dataset first.");
      return;
    }
    setTriggering(true);
    setError("");
    setTriggerResults([]);
    try {
      const res = await triggerAutomation(fileId);
      setTriggerResults(res.data.results || []);
      const histRes = await fetchAutomationHistory();
      setHistory(histRes.data.history || []);
    } catch {
      setError("Failed to trigger automation");
    } finally {
      setTriggering(false);
    }
  };

  const selectedCondition = conditions.find((c) => c.id === form.condition_id);

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Workflow Automation Engine</p>
          <h1>Automation Rules</h1>
          <p className="section-description">
            Create rule-based automations that trigger alerts and actions when your data meets defined conditions.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Rule"}
          </button>
          {fileId && (
            <button className="button button-primary" onClick={handleTrigger} disabled={triggering || rules.length === 0}>
              {triggering ? "Running…" : "Run All Rules"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* New Rule Form */}
      {showForm && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">Create Automation Rule</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label className="form-label">Rule Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Alert on revenue drop"
              />
            </div>
            <div>
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                value={form.condition_id}
                onChange={(e) => setForm({ ...form, condition_id: e.target.value })}
              >
                <option value="">Select a condition…</option>
                {conditions.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            {selectedCondition && selectedCondition.params.length > 0 && (
              <div>
                <label className="form-label">
                  {selectedCondition.params[0].label}
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={form.threshold_pct}
                  onChange={(e) => setForm({ ...form, threshold_pct: Number(e.target.value) })}
                  min={1}
                  max={100}
                />
              </div>
            )}
            <div>
              <label className="form-label">Action</label>
              <select
                className="form-input"
                value={form.action_id}
                onChange={(e) => setForm({ ...form, action_id: e.target.value })}
              >
                {actions.map((a) => (
                  <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="button button-primary" onClick={handleCreate} disabled={loading}>
            {loading ? "Creating…" : "Create Rule"}
          </button>
        </div>
      )}

      {/* Trigger Results */}
      {triggerResults.length > 0 && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">Evaluation Results</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {triggerResults.map((r, i) => (
              <div
                key={i}
                className={`insight-card insight-card--${r.triggered ? "risk" : "performance"}`}
                style={{ borderLeft: `4px solid ${r.triggered ? "#ef4444" : "#22c55e"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{r.rule_name}</strong>
                  <span className="tag" style={{ background: r.triggered ? "#ef4444" : "#22c55e", color: "#fff" }}>
                    {r.triggered ? "TRIGGERED" : "OK"}
                  </span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["rules", "history"] as const).map((tab) => (
          <button
            key={tab}
            className={`chip${activeTab === tab ? " chip--active" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { background: "var(--accent)", color: "#fff" } : {}}
          >
            {tab === "rules" ? `Rules (${rules.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="section-card">
          {rules.length === 0 ? (
            <div className="empty-state-card">
              <p>No automation rules yet. Create your first rule above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rules.map((rule) => {
                const cond = conditions.find((c) => c.id === rule.condition_id);
                const act = actions.find((a) => a.id === rule.action_id);
                return (
                  <div key={rule.rule_id} className="insight-card insight-card--performance">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong>{rule.name}</strong>
                          <span className="tag" style={{ background: rule.active ? "#22c55e" : "#6b7280", color: "#fff", fontSize: 11 }}>
                            {rule.active ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
                          {cond?.icon} IF: {cond?.label.replace("X%", `${rule.params?.threshold_pct || ""}%`)}
                        </p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          {act?.icon} THEN: {act?.label}
                        </p>
                        <p style={{ color: "var(--text-tertiary, #9ca3af)", fontSize: 11, marginTop: 4 }}>
                          Created {new Date(rule.created_at).toLocaleDateString()} · Triggered {rule.trigger_count}×
                        </p>
                      </div>
                      <button
                        className="button button-danger-ghost"
                        onClick={() => handleDelete(rule.rule_id)}
                        style={{ padding: "4px 12px", fontSize: 13 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="section-card">
          {history.length === 0 ? (
            <div className="empty-state-card">
              <p>No automation history yet. Run rules against a dataset to see results.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.slice(0, 50).map((h) => (
                <div
                  key={h.history_id}
                  className="insight-card insight-card--performance"
                  style={{ borderLeft: `4px solid ${h.triggered ? "#ef4444" : "#22c55e"}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong>{h.rule_name}</strong>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{h.reason}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span className="tag" style={{ background: h.triggered ? "#ef4444" : "#22c55e", color: "#fff" }}>
                        {h.triggered ? "Triggered" : "OK"}
                      </span>
                      <p style={{ color: "var(--text-tertiary, #9ca3af)", fontSize: 11, marginTop: 4 }}>
                        {new Date(h.triggered_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
