import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { HealthScores, HealthScoreDimension } from "../types";
import { fetchHealthScore } from "../services/api";

interface Props {
  fileId: string;
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

function ScoreRing({ score, color, grade }: { score: number; color: "green" | "yellow" | "red"; grade: string }) {
  const c = COLOR_MAP[color];
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="health-ring-wrapper">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <motion.circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={c.bar}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
      </svg>
      <div className="health-ring-center">
        <span className="health-ring-score" style={{ color: c.text }}>{score}</span>
        <span className="health-ring-grade" style={{ color: c.text }}>{grade}</span>
      </div>
    </div>
  );
}

function DimensionCard({ dim, delay }: { dim: HealthScoreDimension; delay: number }) {
  const c = COLOR_MAP[dim.color];
  return (
    <motion.div
      className="health-dim-card"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="health-dim-header">
        <span className="health-dim-label">{dim.label}</span>
        <span className="health-dim-grade" style={{ color: c.text }}>{dim.grade}</span>
      </div>
      <div className="health-dim-score" style={{ color: c.text }}>{dim.score}/100</div>
      <ScoreBar score={dim.score} color={dim.color} />
      <p className="health-dim-note">{dim.explanation}</p>
    </motion.div>
  );
}

export default function HealthScoreCard({ fileId }: Props) {
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

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Business Health Score</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
            AI-computed composite score based on your data patterns
          </p>
        </div>
      </div>

      <div className="health-overall-row">
        <ScoreRing
          score={scores.overall.score}
          color={scores.overall.color}
          grade={scores.overall.grade}
        />
        <div className="health-overall-text">
          <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>{scores.overall.label}</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.55 }}>
            {scores.overall.explanation}
          </p>
        </div>
      </div>

      <div className="health-dims-grid">
        <DimensionCard dim={scores.revenue_stability} delay={0.1} />
        <DimensionCard dim={scores.growth} delay={0.2} />
        <DimensionCard dim={scores.risk} delay={0.3} />
      </div>
    </div>
  );
}
