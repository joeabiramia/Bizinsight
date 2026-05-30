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
  updateAutomationRule,
} from "../services/api";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationHistoryEntry,
  AutomationResult,
  AutomationRule,
} from "../types";

type FormState = {
  name: string;
  condition_id: string;
  threshold_pct: number;
  action_id: string;
  action_message: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  condition_id: "",
  threshold_pct: 15,
  action_id: "create_notification",
  action_message: "",
  active: true,
};

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
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");

  // create / edit form
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadAll = () =>
    Promise.all([
      fetchAutomationRules(),
      fetchAutomationConditions(),
      fetchAutomationActions(),
      fetchAutomationHistory(),
    ]).then(([rulesRes, condRes, actRes, histRes]) => {
      setRules(rulesRes.data.rules || []);
      setConditions(condRes.data.conditions || []);
      setActions(actRes.data.actions || []);
      setHistory(histRes.data.history || []);
    }).catch(() => setError("Failed to load automation data"));

  useEffect(() => { loadAll(); }, []);

  // â”€â”€ open create form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingRuleId(null);
    setMode("create");
    setError("");
  };

  // â”€â”€ open edit form pre-filled with existing rule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openEdit = (rule: AutomationRule) => {
    setForm({
      name: rule.name,
      condition_id: rule.condition_id,
      threshold_pct: Number(rule.params?.threshold_pct ?? 15),
      action_id: rule.action_id,
      action_message: rule.action_message || "",
      active: rule.active,
    });
    setEditingRuleId(rule.rule_id);
    setMode("edit");
    setError("");
  };

  const closeForm = () => {
    setMode("idle");
    setEditingRuleId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  // â”€â”€ create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCreate = async () => {
    if (!form.name || !form.condition_id) {
      setError("Rule name and condition are required.");
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
        active: form.active,
      });
      await loadAll();
      closeForm();
    } catch {
      setError("Failed to create rule.");
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ save edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSaveEdit = async () => {
    if (!editingRuleId) return;
    if (!form.name || !form.condition_id) {
      setError("Rule name and condition are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updateAutomationRule(editingRuleId, {
        name: form.name,
        condition_id: form.condition_id,
        params: { threshold_pct: form.threshold_pct },
        action_id: form.action_id,
        action_message: form.action_message,
        active: form.active,
      });
      await loadAll();
      closeForm();
    } catch {
      setError("Failed to update rule.");
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ quick toggle active without opening the form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      await updateAutomationRule(rule.rule_id, { active: !rule.active });
      setRules((prev) =>
        prev.map((r) => r.rule_id === rule.rule_id ? { ...r, active: !r.active } : r)
      );
    } catch {
      setError("Failed to toggle rule.");
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteAutomationRule(ruleId);
      setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
      if (editingRuleId === ruleId) closeForm();
    } catch {
      setError("Failed to delete rule.");
    }
  };

  const handleTrigger = async () => {
    if (!fileId) { setError("No dataset selected. Please open a dataset first."); return; }
    setTriggering(true);
    setError("");
    setTriggerResults([]);
    try {
      const res = await triggerAutomation(fileId);
      setTriggerResults(res.data.results || []);
      const histRes = await fetchAutomationHistory();
      setHistory(histRes.data.history || []);
    } catch {
      setError("Failed to trigger automation.");
    } finally {
      setTriggering(false);
    }
  };

  const selectedCondition = conditions.find((c) => c.id === form.condition_id);
  const isFormOpen = mode !== "idle";

  // â”€â”€ shared form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const RuleForm = () => (
    <div className="section-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
          {mode === "edit" ? "Edit Rule" : "Create Automation Rule"}
        </h3>
        <button type="button" className="button button-secondary" style={{ padding: "4px 14px", fontSize: "0.82rem" }} onClick={closeForm}>
          Cancel
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Name */}
        <div>
          <label className="form-label">Rule Name *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Alert on revenue drop"
          />
        </div>

        {/* Condition */}
        <div>
          <label className="form-label">Condition *</label>
          <select
            className="form-input"
            title="Rule condition"
            value={form.condition_id}
            onChange={(e) => setForm({ ...form, condition_id: e.target.value })}
          >
            <option value="">Select a conditionâ€¦</option>
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Threshold param */}
        {selectedCondition && selectedCondition.params.length > 0 && (
          <div>
            <label className="form-label">{selectedCondition.params[0].label}</label>
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

        {/* Action */}
        <div>
          <label className="form-label">Action</label>
          <select
            className="form-input"
            title="Rule action"
            value={form.action_id}
            onChange={(e) => setForm({ ...form, action_id: e.target.value })}
          >
            {actions.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
            ))}
          </select>
        </div>

        {/* Active toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24 }}>
          <button
            type="button"
            title={form.active ? "Pause rule" : "Activate rule"}
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: form.active ? "#22c55e" : "#475569",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 2,
              left: form.active ? "calc(100% - 22px)" : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s",
            }} />
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            {form.active ? "Active" : "Paused"}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <button
        type="button"
        className="button button-primary"
        onClick={mode === "edit" ? handleSaveEdit : handleCreate}
        disabled={loading}
      >
        {loading ? "Savingâ€¦" : mode === "edit" ? "Save Changes" : "Create Rule"}
      </button>
    </div>
  );

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Workflow Automation Engine</p>
          <h1>Automation Rules</h1>
          <p className="section-description">
            Create rule-based automations that trigger alerts when your data meets defined conditions.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={isFormOpen ? closeForm : openCreate}
          >
            {isFormOpen ? "Cancel" : "+ New Rule"}
          </button>
          {fileId && (
            <button
              type="button"
              className="button button-primary"
              onClick={handleTrigger}
              disabled={triggering || rules.length === 0}
            >
              {triggering ? "Runningâ€¦" : "Run All Rules"}
            </button>
          )}
        </div>
      </div>

      {error && mode === "idle" && <div className="alert alert-error">{error}</div>}

      {/* Form (create or edit) */}
      {isFormOpen && <RuleForm />}

      {/* Trigger results */}
      {triggerResults.length > 0 && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Evaluation Results</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {triggerResults.map((r, i) => (
              <div
                key={i}
                className={`insight-card insight-card--${r.triggered ? "risk" : "performance"}`}
                style={{ borderLeft: `4px solid ${r.triggered ? "#ef4444" : "#22c55e"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{r.rule_name}</strong>
                  <span className={r.triggered ? "badge badge-danger" : "badge badge-success"}>
                    {r.triggered ? "Triggered" : "OK"}
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
            type="button"
            className={`chip${activeTab === tab ? " chip--active" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { background: "var(--accent)", color: "#fff" } : {}}
          >
            {tab === "rules" ? `Rules (${rules.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {activeTab === "rules" && (
        <div className="section-card">
          {rules.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>No automation rules yet. Create your first rule above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rules.map((rule) => {
                const cond = conditions.find((c) => c.id === rule.condition_id);
                const act = actions.find((a) => a.id === rule.action_id);
                const isBeingEdited = editingRuleId === rule.rule_id;

                return (
                  <div
                    key={rule.rule_id}
                    className="insight-card insight-card--performance"
                    style={{
                      borderLeft: `4px solid ${isBeingEdited ? "#6366f1" : rule.active ? "#22c55e" : "#475569"}`,
                      background: isBeingEdited ? "rgba(99,102,241,0.04)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      {/* Rule info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong>{rule.name}</strong>
                          <span className={rule.active ? "badge badge-success" : "badge badge-neutral"}>
                            {rule.active ? "Active" : "Paused"}
                          </span>
                          {isBeingEdited && (
                            <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>EDITING</span>
                          )}
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
                          {cond?.icon} IF: {cond?.label.replace("X%", `${rule.params?.threshold_pct ?? ""}%`)}
                        </p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          {act?.icon} THEN: {act?.label}
                        </p>
                        <p style={{ color: "var(--text-tertiary, #9ca3af)", fontSize: 11, marginTop: 4 }}>
                          Created {new Date(rule.created_at).toLocaleDateString()} Â· Triggered {rule.trigger_count}Ã—
                        </p>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => handleToggleActive(rule)}
                          style={{ padding: "4px 12px", fontSize: 12 }}
                          title={rule.active ? "Pause rule" : "Activate rule"}
                        >
                          {rule.active ? "Pause" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => isBeingEdited ? closeForm() : openEdit(rule)}
                          style={{
                            padding: "4px 12px", fontSize: 12,
                            borderColor: isBeingEdited ? "#6366f1" : undefined,
                            color: isBeingEdited ? "#6366f1" : undefined,
                          }}
                        >
                          {isBeingEdited ? "Cancel Edit" : "Edit"}
                        </button>
                        <button
                          type="button"
                          className="button button-danger-ghost"
                          onClick={() => handleDelete(rule.rule_id)}
                          style={{ padding: "4px 12px", fontSize: 12 }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <div className="section-card">
          {history.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>No automation history yet. Run rules against a dataset to see results.</p>
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
                      <span className={h.triggered ? "badge badge-danger" : "badge badge-success"}>
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
