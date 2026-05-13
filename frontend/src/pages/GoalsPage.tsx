import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Target, Plus, Trash2, TrendingUp, Database, Calendar, CheckCircle2 } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import {
  createGoal, deleteGoal, fetchAllGoalsProgress, fetchGoalTypes, fetchGoals,
} from "../services/api";
import type { GoalProgress, GoalType, GoalWithProgress } from "../types";

const STATUS_META: Record<string, { color: string; label: string; badgeClass: string }> = {
  achieved:  { color: "#4ade80", label: "Achieved",  badgeClass: "badge badge-success" },
  on_track:  { color: "#60a5fa", label: "On Track",  badgeClass: "badge badge-info" },
  at_risk:   { color: "#fbbf24", label: "At Risk",   badgeClass: "badge badge-warning" },
  behind:    { color: "#f87171", label: "Behind",    badgeClass: "badge badge-danger" },
  no_target: { color: "var(--muted)", label: "No Target", badgeClass: "badge badge-neutral" },
};

export default function GoalsPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [goals, setGoals]         = useState<GoalWithProgress[]>([]);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({
    name: "", goal_type: "revenue", target_value: "", description: "", deadline: "",
  });

  useEffect(() => {
    fetchGoalTypes().then(r => setGoalTypes(r.data.goal_types || [])).catch(() => {});
    loadGoals();
  }, [fileId]);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const res = fileId ? await fetchAllGoalsProgress(fileId) : await fetchGoals();
      setGoals(res.data.goals || []);
    } catch {
      setError("Failed to load goals.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.target_value) { setError("Name and target value are required."); return; }
    setError("");
    try {
      await createGoal({
        name: form.name, goal_type: form.goal_type,
        target_value: parseFloat(form.target_value),
        description: form.description, deadline: form.deadline,
      });
      setForm({ name: "", goal_type: "revenue", target_value: "", description: "", deadline: "" });
      setShowForm(false);
      loadGoals();
    } catch {
      setError("Failed to create goal.");
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      setGoals(prev => prev.filter(g => g.goal_id !== goalId));
    } catch {
      setError("Failed to delete goal.");
    }
  };

  const selectedType = goalTypes.find(t => t.id === form.goal_type);

  return (
    <MainLayout>
      <PageHeader
        eyebrow="AI Goal Tracking"
        title="Business Goals"
        description="Set revenue, sales, and performance targets. AI tracks real progress from your data."
        actions={
          <>
            <button type="button" className="button button-secondary" onClick={() => setShowForm(s => !s)}>
              {showForm ? "Cancel" : <><Plus size={15} /> New Goal</>}
            </button>
            {!fileId && (
              <button type="button" className="button button-primary" onClick={() => navigate("/datasets")}>
                <Database size={15} /> Select Dataset
              </button>
            )}
          </>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {!fileId && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          Select a dataset to see real AI-tracked progress against your goals.
        </div>
      )}

      {/* Create goal form */}
      {showForm && (
        <motion.div
          className="section-card"
          style={{ marginBottom: 24 }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="section-card-header">
            <h2>Create New Goal</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Goal Name</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Q1 Revenue Target" />
            </div>
            <div>
              <label className="form-label">Goal Type</label>
              <select title="Goal type" aria-label="Goal type" className="form-input" value={form.goal_type}
                onChange={e => setForm({ ...form, goal_type: e.target.value })}>
                {goalTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">
                Target Value {selectedType?.unit ? `(${selectedType.unit})` : ""}
              </label>
              <input type="number" className="form-input" value={form.target_value}
                onChange={e => setForm({ ...form, target_value: e.target.value })}
                placeholder="e.g. 100000" />
            </div>
            <div>
              <label className="form-label">Deadline (optional)</label>
              <input type="date" className="form-input" value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe this goal…" />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button type="button" className="button button-primary" onClick={handleCreate}>
              <CheckCircle2 size={15} /> Create Goal
            </button>
            <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Goals list */}
      {loading ? (
        <LoadingSkeleton variant="cards" rows={3} cols={2} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={<Target size={24} />}
          title="No goals set yet"
          description="Create your first business goal to track AI-powered progress against your targets."
          action={
            <button type="button" className="button button-primary" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Create First Goal
            </button>
          }
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {goals.map((goal, i) => {
            const progress: GoalProgress | null | undefined = goal.progress;
            const status = progress?.status || "no_target";
            const meta   = STATUS_META[status] || STATUS_META.no_target;
            const pct    = Math.min(progress?.progress_pct || 0, 100);
            const type   = goalTypes.find(t => t.id === goal.goal_type);

            return (
              <motion.div
                key={goal.goal_id}
                className="section-card"
                style={{ position: "relative" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                {/* Delete button */}
                <button
                  type="button"
                  className="button button-ghost button-sm"
                  onClick={() => handleDelete(goal.goal_id)}
                  style={{ position: "absolute", top: 14, right: 14, padding: "5px 7px", color: "var(--muted)" }}
                  title="Delete goal"
                >
                  <Trash2 size={13} />
                </button>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, paddingRight: 36 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "var(--primary-dim)", border: "1px solid rgba(99,102,241,0.2)",
                    display: "grid", placeItems: "center", fontSize: "1.3rem", flexShrink: 0,
                  }}>
                    {type?.icon || "🎯"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{goal.name}</strong>
                      <span className={meta.badgeClass}>{meta.label}</span>
                    </div>
                    {type?.label && (
                      <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{type.label}</p>
                    )}
                  </div>
                </div>

                {progress ? (
                  <>
                    {/* Progress bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 6 }}>
                        <span style={{ color: "var(--text-secondary)" }}>Progress</span>
                        <strong style={{ color: meta.color }}>{progress.progress_pct?.toFixed(1)}%</strong>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          style={{ background: meta.color, height: "100%", borderRadius: 999 }}
                        />
                      </div>
                    </div>

                    {/* Current vs Target */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "Current", value: progress.current_value, colored: true },
                        { label: "Target",  value: progress.target_value,  colored: false },
                      ].map(item => (
                        <div key={item.label} style={{
                          padding: "10px 14px", borderRadius: 10,
                          background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                        }}>
                          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {item.label}
                          </p>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: item.colored ? meta.color : "var(--text)" }}>
                            {type?.unit === "$"
                              ? `$${item.value.toLocaleString()}`
                              : item.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    {progress.ai_recommendation && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5, padding: "10px 12px", borderRadius: 8, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
                        💡 {progress.ai_recommendation}
                      </p>
                    )}
                  </>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", margin: "0 0 4px" }}>
                      Target:{" "}
                      <strong>
                        {type?.unit === "$"
                          ? `$${goal.target_value.toLocaleString()}`
                          : `${goal.target_value.toLocaleString()} ${type?.unit || ""}`}
                      </strong>
                    </p>
                    {goal.description && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>{goal.description}</p>
                    )}
                    {!fileId && (
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                        <Database size={11} /> Connect a dataset to track real progress
                      </p>
                    )}
                  </div>
                )}

                {goal.deadline && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: "0.75rem", color: "var(--muted)" }}>
                    <Calendar size={11} />
                    Deadline: {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
