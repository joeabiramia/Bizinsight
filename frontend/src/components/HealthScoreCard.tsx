import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { HealthScores, HealthScoreDimension } from "../types";
import { fetchHealthScore } from "../services/api";

interface Props {
  fileId: string;
  projectedScores?: HealthScores | null;
}

const COLOR_MAP = {
  green:  { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  text: "#4ade80", bar: "#22c55e" },
  yellow: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", text: "#fbbf24", bar: "#f59e0b" },
  red:    { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  text: "#f87171", bar: "#ef4444" },
};

function ScoreBar({ score, color }: { score: number; color: "green" | "yellow" | "red" }) {
  const c = COLOR_MAP[color];
  return (
    <div className="health-bar-track">
      <motion.div
        className="health-bar-fill"
        style={{ background: c.bar }}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const positive = delta > 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      padding: "2px 8px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 700,
      background: positive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
      color: positive ? "#4ade80" : "#f87171",
    }}>
      {positive ? "▲" : "▼"} {Math.abs(delta)} pts
    </span>
  );
}

function ScoreRing({
  score, color, grade, projectedScore, projectedColor, projectedGrade,
}: {
  score: number;
  color: "green" | "yellow" | "red";
  grade: string;
  projectedScore?: number;
  projectedColor?: "green" | "yellow" | "red";
  projectedGrade?: string;
}) {
  const c = COLOR_MAP[color];
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const showProjected = projectedScore !== undefined && projectedScore !== score;
  const pc = projectedColor ? COLOR_MAP[projectedColor] : c;
  const projectedOffset = showProjected
    ? circumference - (projectedScore / 100) * circumference
    : null;

  return (
    <div className="health-ring-wrapper">
      <svg width="110" height="110" viewBox="0 0 110 110">
        {/* Track */}
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--surface-alt)" strokeWidth="9" />
        {/* Baseline arc */}
        <motion.circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={showProjected ? "rgba(255,255,255,0.12)" : c.bar}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        {/* Projected arc (drawn on top) */}
        {showProjected && projectedOffset !== null && (
          <motion.circle
            cx="55" cy="55" r={r}
            fill="none"
            stroke={pc.bar}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: projectedOffset }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        )}
      </svg>
      <div className="health-ring-center">
        {showProjected ? (
          <>
            <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: pc.text, lineHeight: 1.1 }}>
              {projectedScore}
            </span>
            <span className="health-ring-grade" style={{ color: pc.text }}>{projectedGrade}</span>
          </>
        ) : (
          <>
            <span className="health-ring-score" style={{ color: c.text }}>{score}</span>
            <span className="health-ring-grade" style={{ color: c.text }}>{grade}</span>
          </>
        )}
      </div>
    </div>
  );
}

function DimensionCard({
  dim,
  projected,
  delay,
}: {
  dim: HealthScoreDimension;
  projected?: HealthScoreDimension;
  delay: number;
}) {
  const active = projected ?? dim;
  const c = COLOR_MAP[active.color];
  const delta = projected?.delta ?? 0;

  return (
    <motion.div
      className="health-dim-card"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="health-dim-header">
        <span className="health-dim-label">
          {projected ? dim.label.replace(" (Projected)", "") : dim.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {projected && <DeltaBadge delta={delta} />}
          <span className="health-dim-grade" style={{ color: c.text }}>{active.grade}</span>
        </div>
      </div>

      {/* Score: show baseline → projected when simulation active */}
      <div className="health-dim-score" style={{ color: c.text, display: "flex", alignItems: "baseline", gap: 8 }}>
        {projected ? (
          <>
            <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)", textDecoration: "line-through" }}>
              {dim.score}
            </span>
            <span>{projected.score}</span>
            <span style={{ fontSize: "0.75rem" }}>/100</span>
          </>
        ) : (
          <>{active.score}/100</>
        )}
      </div>

      <ScoreBar score={active.score} color={active.color} />
      <p className="health-dim-note">{active.explanation}</p>
    </motion.div>
  );
}

export default function HealthScoreCard({ fileId, projectedScores }: Props) {
  const [scores, setScores] = useState<HealthScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchHealthScore(fileId)
      .then(res => setScores(res.data.scores))
      .catch(() => setError("Could not compute health scores."))
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) return (
    <div className="section-card">
      <div className="loading-skeleton">
        <div className="loading-row" />
        <div className="loading-row" />
        <div className="loading-row" />
      </div>
    </div>
  );

  if (error || !scores) return (
    <div className="section-card">
      <p style={{ color: "var(--muted)" }}>{error ?? "No health data."}</p>
    </div>
  );

  const hasProjection = !!projectedScores;
  const overallDelta = projectedScores?.overall?.delta ?? 0;

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Business Health Score</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
            {hasProjection
              ? "Showing projected health impact of your scenario"
              : "AI-computed composite score based on your data patterns"}
          </p>
        </div>
        {hasProjection && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 10,
            background: overallDelta >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${overallDelta >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          }}>
            <span style={{ fontSize: "1rem" }}>{overallDelta >= 0 ? "📈" : "📉"}</span>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: overallDelta >= 0 ? "#4ade80" : "#f87171" }}>
                Scenario Impact
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 800,
                            color: overallDelta >= 0 ? "#4ade80" : "#f87171" }}>
                {overallDelta >= 0 ? "+" : ""}{overallDelta} pts overall
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="health-overall-row">
        <ScoreRing
          score={scores.overall.score}
          color={scores.overall.color}
          grade={scores.overall.grade}
          projectedScore={projectedScores?.overall?.score}
          projectedColor={projectedScores?.overall?.color}
          projectedGrade={projectedScores?.overall?.grade}
        />
        <div className="health-overall-text">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{scores.overall.label}</h3>
            {hasProjection && <DeltaBadge delta={overallDelta} />}
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.55 }}>
            {hasProjection
              ? projectedScores!.overall.explanation
              : scores.overall.explanation}
          </p>
          {hasProjection && (
            <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
              Baseline: {scores.overall.score} → Projected: {projectedScores!.overall.score}
            </p>
          )}
        </div>
      </div>

      <div className="health-dims-grid">
        <DimensionCard dim={scores.revenue_stability} projected={projectedScores?.revenue_stability} delay={0.1} />
        <DimensionCard dim={scores.growth}            projected={projectedScores?.growth}            delay={0.2} />
        <DimensionCard dim={scores.risk}              projected={projectedScores?.risk}              delay={0.3} />
      </div>
    </div>
  );
}
