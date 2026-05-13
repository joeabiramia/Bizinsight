import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import {
  createGoal,
  deleteGoal,
  fetchAllGoalsProgress,
  fetchGoalTypes,
  fetchGoals,
} from "../services/api";
import type { GoalProgress, GoalType, GoalWithProgress } from "../types";

const STATUS_STYLES: Record<string, { color: string; label: string; bg: string }> = {
  achieved:  { color: "#22c55e", label: "Achieved", bg: "#dcfce7" },
  on_track:  { color: "#3b82f6", label: "On Track", bg: "#dbeafe" },
  at_risk:   { color: "#f59e0b", label: "At Risk",  bg: "#fef3c7" },
  behind:    { color: "#ef4444", label: "Behind",   bg: "#fee2e2" },
  no_target: { color: "#6b7280", label: "No Target", bg: "#f3f4f6" },
};

export default function GoalsPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", goal_type: "revenue", target_value: "", description: "", deadline: "" });

  useEffect(() => {
    fetchGoalTypes().then((res) => setGoalTypes(res.data.goal_types || [])).catch(() => {});
    loadGoals();
  }, [fileId]);

  const loadGoals = async () => {
    setLoading(true);
    try {
      if (fileId) {
        const res = await fetchAllGoalsProgress(fileId);
        setGoals(res.data.goals || []);
      } else {
        const res = await fetchGoals();
        setGoals(res.data.goals || []);
      }
    } catch {
      setError("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.target_value) {
      setError("Name and target value are required");
      return;
    }
    try {
      await createGoal({
        name: form.name,
        goal_type: form.goal_type,
        target_value: parseFloat(form.target_value),
        description: form.description,
        deadline: form.deadline,
      });
      setForm({ name: "", goal_type: "revenue", target_value: "", description: "", deadline: "" });
      setShowForm(false);
      loadGoals();
    } catch {
      setError("Failed to create goal");
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.goal_id !== goalId));
    } catch {
      setError("Failed to delete goal");
    }
  };

  const selectedType = goalTypes.find((t) => t.id === form.goal_type);

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">AI Goal Tracking</p>
          <h1>Business Goals</h1>
          <p className="section-description">
            Set revenue, sales, and performance targets. AI tracks real progress from your data.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Goal"}
          </button>
          {!fileId && (
            <button className="button button-primary" onClick={() => navigate("/datasets")}>Select Dataset</button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!fileId && (
        <div className="alert" style={{ marginBottom: 16, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}>
          Select a dataset to see real progress tracking against your goals.
        </div>
      )}

      {showForm && (
        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">Create New Goal</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Goal Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q1 Revenue Target" />
            </div>
            <div>
              <label className="form-label">Goal Type</label>
              <select className="form-input" value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
                {goalTypes.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">
                Target Value {selectedType?.unit ? `(${selectedType.unit})` : ""}
              </label>
              <input type="number" className="form-input" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="e.g. 100000" />
            </div>
            <div>
              <label className="form-label">Deadline (optional)</label>
              <input type="date" className="form-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe this goal…" />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="button button-primary" onClick={handleCreate}>Create Goal</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="section-card"><div className="loading-pulse" style={{ height: 150 }} /></div>
      ) : goals.length === 0 ? (
        <div className="section-card">
          <div className="empty-state-card">
            <p style={{ fontSize: 32, marginBottom: 8 }}>🎯</p>
            <p><strong>No goals set yet.</strong> Create your first business goal above.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {goals.map((goal) => {
            const progress: GoalProgress | null | undefined = goal.progress;
            const status = progress?.status || "no_target";
            const style = STATUS_STYLES[status] || STATUS_STYLES.no_target;
            const pct = progress?.progress_pct || 0;
            const type = goalTypes.find((t) => t.id === goal.goal_type);

            return (
              <div key={goal.goal_id} className="section-card" style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{type?.icon || "🎯"}</span>
                      <strong style={{ fontSize: 16 }}>{goal.name}</strong>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{type?.label}</p>
                  </div>
                  <span
                    className="tag"
                    style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}`, flexShrink: 0 }}
                  >
                    {style.label}
                  </span>
                </div>

                {progress ? (
                  <>
                    {/* Progress bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-secondary)" }}>Progress</span>
                        <strong style={{ color: style.color }}>{pct.toFixed(1)}%</strong>
                      </div>
                      <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden" }}>
                        <div
                          style={{
                            background: style.color,
                            height: "100%",
                            width: `${Math.min(pct, 100)}%`,
                            borderRadius: 8,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Current</p>
                        <p style={{ fontWeight: 700, color: style.color }}>
                          {type?.unit === "$" ? `$${progress.current_value.toLocaleString()}` : progress.current_value.toLocaleString()}
                        </p>
                      </div>
                      <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Target</p>
                        <p style={{ fontWeight: 700 }}>
                          {type?.unit === "$" ? `$${progress.target_value.toLocaleString()}` : progress.target_value.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {progress.ai_recommendation}
                    </p>
                  </>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      Target: {type?.unit === "$" ? `$${goal.target_value.toLocaleString()}` : `${goal.target_value.toLocaleString()} ${type?.unit || ""}`}
                    </p>
                    {goal.description && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{goal.description}</p>}
                  </div>
                )}

                {goal.deadline && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary, #9ca3af)" }}>
                    Deadline: {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                )}

                <button
                  className="button button-danger-ghost"
                  onClick={() => handleDelete(goal.goal_id)}
                  style={{ position: "absolute", top: 12, right: 12, padding: "2px 10px", fontSize: 12 }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
