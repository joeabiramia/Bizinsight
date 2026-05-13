import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import MainLayout from "../components/layout/MainLayout";
import { analyzeDataQuality, applyDataFixes } from "../services/api";
import type { DataQualityIssue, DataQualityReport } from "../types";

// ─── Design tokens ────────────────────────────────────────────────────────────

const SEV = {
  high: {
    label: "Critical",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.3)",
    glow: "0 0 16px rgba(239,68,68,0.25)",
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
    ring: "#ef4444",
    icon: "⛔",
  },
  medium: {
    label: "Warning",
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    border: "rgba(249,115,22,0.3)",
    glow: "0 0 16px rgba(249,115,22,0.25)",
    gradient: "linear-gradient(135deg,#f97316,#ea580c)",
    ring: "#f97316",
    icon: "⚠️",
  },
  low: {
    label: "Info",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.3)",
    glow: "0 0 16px rgba(59,130,246,0.2)",
    gradient: "linear-gradient(135deg,#3b82f6,#2563eb)",
    ring: "#3b82f6",
    icon: "ℹ️",
  },
} as const;

const TYPE_META: Record<string, { icon: string; label: string }> = {
  missing_values:              { icon: "◻", label: "Missing Values" },
  duplicates:                  { icon: "⊕", label: "Duplicate Rows" },
  wrong_data_type:             { icon: "⟳", label: "Wrong Type" },
  date_format_inconsistency:   { icon: "📅", label: "Date Format" },
  currency_formatting:         { icon: "💲", label: "Currency Format" },
  outliers:                    { icon: "◎", label: "Outliers" },
  inconsistent_categories:     { icon: "⊞", label: "Inconsistent Labels" },
};

const PIE_COLORS = ["#ef4444", "#f97316", "#3b82f6", "#8b5cf6", "#22c55e", "#eab308", "#06b6d4"];

// ─── Motion variants ──────────────────────────────────────────────────────────

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
};

const STAGGER = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

const CARD_HOVER = {
  rest:  { scale: 1,    boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)" },
  hover: { scale: 1.015, boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.3)" },
};

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <span>{display}</span>;
}

// ─── Quality score ring (SVG) ─────────────────────────────────────────────────

function QualityRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const color =
    score >= 90 ? "#22c55e" :
    score >= 75 ? "#3b82f6" :
    score >= 60 ? "#f97316" : "#ef4444";
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";

  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  useEffect(() => {
    const target = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => setAnimatedOffset(target), 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div className="tw-relative tw-flex tw-flex-col tw-items-center tw-justify-center">
      <svg width="136" height="136" className="tw--rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="68" cy="68" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)",
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="tw-absolute tw-flex tw-flex-col tw-items-center">
        <span className="tw-text-3xl tw-font-black tw-tracking-tight" style={{ color }}>
          <AnimatedNumber value={score} />
        </span>
        <span className="tw-text-xs tw-font-bold tw-tracking-widest tw-uppercase tw-opacity-60 tw-mt-0.5">Score</span>
        <span className="tw-text-sm tw-font-black tw-mt-0.5" style={{ color }}>
          Grade {grade}
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, gradient, icon, delay = 0,
}: {
  label: string; value: number; sub?: string;
  gradient: string; icon: string; delay?: number;
}) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      animate="show"
      transition={{ delay, type: "spring", stiffness: 180, damping: 18 }}
      whileHover={CARD_HOVER.hover}
      style={{
        background: "linear-gradient(145deg,rgba(30,41,59,0.85),rgba(15,23,42,0.9))",
        border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: 16,
        padding: "20px 24px",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Gradient accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gradient, borderRadius: "16px 16px 0 0" }} />
      {/* Glow blob */}
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        borderRadius: "50%", background: gradient, opacity: 0.08, filter: "blur(20px)",
      }} />
      <div className="tw-flex tw-items-start tw-justify-between">
        <div>
          <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-widest tw-opacity-50 tw-mb-2">{label}</p>
          <p className="tw-text-4xl tw-font-black tw-tracking-tight tw-leading-none">
            <AnimatedNumber value={value} />
          </p>
          {sub && <p className="tw-text-xs tw-opacity-50 tw-mt-1.5">{sub}</p>}
        </div>
        <span style={{ fontSize: 28, opacity: 0.7 }}>{icon}</span>
      </div>
    </motion.div>
  );
}

// ─── AI Insight banner ────────────────────────────────────────────────────────

function AIInsightBanner({ report }: { report: DataQualityReport }) {
  const topType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of report.issues) counts[issue.issue_type] = (counts[issue.issue_type] || 0) + issue.count;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "missing_values";
  }, [report]);

  const topTypeMeta = TYPE_META[topType] || { icon: "⚠️", label: "Data Issues" };
  const improvementEst = Math.min(28, Math.round(report.high_severity * 8 + report.medium_severity * 4));
  const riskLevel = report.quality_score >= 80 ? "Low" : report.quality_score >= 60 ? "Medium" : "High";
  const riskColor = riskLevel === "Low" ? "#22c55e" : riskLevel === "Medium" ? "#f97316" : "#ef4444";

  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      animate="show"
      transition={{ delay: 0.3 }}
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(59,130,246,0.06) 100%)",
        border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: 16,
        padding: "20px 24px",
        backdropFilter: "blur(12px)",
        marginBottom: 20,
      }}
    >
      <div className="tw-flex tw-flex-wrap tw-items-start tw-gap-4">
        {/* Brain icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, boxShadow: "0 0 20px rgba(99,102,241,0.4)",
        }}>
          🤖
        </div>

        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
            <span className="tw-text-xs tw-font-bold tw-uppercase tw-tracking-widest tw-text-indigo-400">
              AI Quality Analysis
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px",
              borderRadius: 99, background: "rgba(99,102,241,0.15)",
              color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)",
            }}>
              GROUNDED
            </span>
          </div>
          <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Most issues are concentrated in{" "}
            <strong style={{ color: "#a5b4fc" }}>{topTypeMeta.icon} {topTypeMeta.label}</strong>
            {" "}across {report.columns} columns. Applying all critical fixes could improve data reliability by up to{" "}
            <strong style={{ color: "#22c55e" }}>~{improvementEst}%</strong>
            , reducing downstream model errors and forecast variance.
          </p>
        </div>

        {/* Metrics */}
        <div className="tw-flex tw-gap-4 tw-flex-shrink-0 tw-flex-wrap">
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Est. Improvement</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#22c55e", margin: 0 }}>+{improvementEst}%</p>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Risk Level</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: riskColor, margin: 0 }}>{riskLevel}</p>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Fixable</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#818cf8", margin: 0 }}>{report.total_issues}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Charts row ───────────────────────────────────────────────────────────────

function ChartsRow({ report }: { report: DataQualityReport }) {
  // Donut data: by issue type
  const donutData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of report.issues) {
      const label = TYPE_META[issue.issue_type]?.label || issue.issue_type;
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [report]);

  // Bar data: top columns by issue count
  const barData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of report.issues) {
      if (issue.column === "__all__") continue;
      counts[issue.column] = (counts[issue.column] || 0) + issue.count;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 12) + "…" : name, value }));
  }, [report]);

  const CARD_STYLE = {
    background: "linear-gradient(145deg,rgba(30,41,59,0.85),rgba(15,23,42,0.9))",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 16,
    padding: "24px",
    backdropFilter: "blur(12px)",
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(12px)",
      }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{payload[0].name}</p>
        <p style={{ margin: "4px 0 0", color: "#818cf8", fontSize: 13 }}>Count: <strong>{payload[0].value}</strong></p>
      </div>
    );
  };

  if (report.total_issues === 0) return null;

  return (
    <motion.div
      variants={STAGGER}
      initial="hidden"
      animate="show"
      className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-mb-5"
    >
      {/* Donut */}
      <motion.div variants={FADE_UP} style={CARD_STYLE}>
        <p className="tw-text-xs tw-font-bold tw-uppercase tw-tracking-widest tw-opacity-50 tw-mb-4">Issue Distribution</p>
        <div className="tw-flex tw-items-center tw-gap-6">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} dataKey="value">
                {donutData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                ))}
              </Pie>
              <ReTooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="tw-flex tw-flex-col tw-gap-2 tw-flex-1 tw-min-w-0">
            {donutData.map((d, idx) => (
              <div key={d.name} className="tw-flex tw-items-center tw-gap-2">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                <span className="tw-text-xs tw-opacity-70 tw-truncate tw-flex-1">{d.name}</span>
                <span className="tw-text-xs tw-font-bold tw-opacity-80">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bar — affected columns */}
      <motion.div variants={FADE_UP} style={CARD_STYLE}>
        <p className="tw-text-xs tw-font-bold tw-uppercase tw-tracking-widest tw-opacity-50 tw-mb-4">Affected Columns (by row count)</p>
        {barData.length === 0 ? (
          <p className="tw-text-sm tw-opacity-40 tw-text-center tw-pt-10">No column-level data</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 0, right: 4, left: -24, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <ReTooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#barGrad)">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ sev }: { sev: keyof typeof SEV }) {
  const s = SEV[sev];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

// ─── Confidence meter ─────────────────────────────────────────────────────────

const CONFIDENCE_MAP: Record<string, { label: string; value: number; color: string }> = {
  missing_values:            { label: "Very High", value: 98, color: "#22c55e" },
  duplicates:                { label: "Certain", value: 100, color: "#22c55e" },
  wrong_data_type:           { label: "High", value: 88, color: "#3b82f6" },
  date_format_inconsistency: { label: "High", value: 85, color: "#3b82f6" },
  currency_formatting:       { label: "High", value: 90, color: "#3b82f6" },
  outliers:                  { label: "Medium", value: 72, color: "#f97316" },
  inconsistent_categories:   { label: "Medium", value: 75, color: "#f97316" },
};

function ConfidenceMeter({ issueType }: { issueType: string }) {
  const conf = CONFIDENCE_MAP[issueType] || { label: "Medium", value: 70, color: "#f97316" };
  return (
    <div className="tw-flex tw-items-center tw-gap-3">
      <span style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>Confidence</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${conf.value}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ height: "100%", background: conf.color, borderRadius: 99 }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: conf.color, whiteSpace: "nowrap" }}>
        {conf.label}
      </span>
    </div>
  );
}

// ─── Issue card ───────────────────────────────────────────────────────────────

interface IssueCardProps {
  issue: DataQualityIssue;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onIgnore: () => void;
}

function IssueCard({ issue, index, selected, onToggle, onIgnore }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sev = (issue.severity as keyof typeof SEV) in SEV ? (issue.severity as keyof typeof SEV) : "low";
  const s = SEV[sev];
  const meta = TYPE_META[issue.issue_type] || { icon: "⚠️", label: issue.issue_type };

  return (
    <motion.div
      variants={FADE_UP}
      transition={{ delay: index * 0.04 }}
      layout
      whileHover={{ borderColor: "rgba(99,102,241,0.35)", boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)" }}
      style={{
        background: selected
          ? "linear-gradient(145deg,rgba(99,102,241,0.08),rgba(15,23,42,0.95))"
          : "linear-gradient(145deg,rgba(22,33,58,0.85),rgba(15,23,42,0.9))",
        border: selected
          ? "1px solid rgba(99,102,241,0.4)"
          : `1px solid rgba(148,163,184,0.1)`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: 14,
        overflow: "hidden",
        backdropFilter: "blur(10px)",
        transition: "all 0.2s ease",
        cursor: "default",
      }}
    >
      {/* Card header */}
      <div
        className="tw-flex tw-items-start tw-gap-3 tw-p-4 tw-cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? "#6366f1" : "rgba(148,163,184,0.3)"}`,
            background: selected ? "#6366f1" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, marginTop: 2, transition: "all 0.15s",
          }}
        >
          {selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
        </div>

        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
        }}>
          {meta.icon}
        </div>

        {/* Main content */}
        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-1">
            <SeverityBadge sev={sev} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{meta.label}</span>
            {issue.column !== "__all__" && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                background: "rgba(99,102,241,0.12)", color: "#818cf8",
                border: "1px solid rgba(99,102,241,0.2)", fontFamily: "monospace",
              }}>
                {issue.column}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
            {issue.description}
          </p>
        </div>

        {/* Stats */}
        <div className="tw-flex tw-gap-3 tw-items-center tw-flex-shrink-0">
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>
              {issue.count.toLocaleString()}
            </p>
            <p style={{ fontSize: 10, opacity: 0.45, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>rows</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#94a3b8", margin: 0, lineHeight: 1 }}>
              {issue.percentage.toFixed(1)}%
            </p>
            <p style={{ fontSize: 10, opacity: 0.45, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>affected</p>
          </div>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            style={{ color: "#6366f1", fontSize: 18, opacity: 0.7, cursor: "pointer" }}
          >
            ⌄
          </motion.span>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "16px 20px 20px 20px",
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              {/* AI Explanation */}
              <div style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#818cf8", marginBottom: 6 }}>
                  🤖 AI Explanation
                </p>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                  {issue.description}{" "}
                  {issue.issue_type === "outliers" && issue.bounds &&
                    `Values outside the IQR boundary [${issue.bounds.lower}, ${issue.bounds.upper}] are statistically anomalous and may indicate data entry errors, measurement issues, or genuine extreme events.`
                  }
                  {issue.issue_type === "missing_values" &&
                    " Missing data reduces statistical reliability and can introduce bias in aggregations and AI models that depend on this field."}
                  {issue.issue_type === "duplicates" &&
                    " Duplicate rows inflate totals and distort averages. Removing them ensures each transaction is counted exactly once."}
                  {issue.issue_type === "inconsistent_categories" &&
                    " Case and whitespace variants cause the same category to appear as multiple values, fragmenting segmentation and grouping analysis."}
                </p>
              </div>

              {/* Suggested Fix */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                }}>
                  ✨
                </div>
                <div className="tw-flex-1">
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80", marginBottom: 4 }}>
                    Suggested Fix
                  </p>
                  <p style={{ fontSize: 13, color: "#86efac", margin: 0, lineHeight: 1.5 }}>
                    {issue.fix_label}
                  </p>
                </div>
              </div>

              {/* Confidence */}
              <ConfidenceMeter issueType={issue.issue_type} />

              {/* Action buttons */}
              <div className="tw-flex tw-flex-wrap tw-gap-2 tw-pt-1">
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); onToggle(); }}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: selected ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color: "#fff", border: "none", cursor: "pointer",
                    boxShadow: "0 0 12px rgba(99,102,241,0.3)",
                  }}
                >
                  {selected ? "✓ Selected" : "Auto Fix"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); onIgnore(); }}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "transparent", color: "#94a3b8",
                    border: "1px solid rgba(148,163,184,0.2)", cursor: "pointer",
                  }}
                >
                  Ignore
                </motion.button>
                {issue.percentage > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(59,130,246,0.1)", color: "#60a5fa",
                      border: "1px solid rgba(59,130,246,0.2)", cursor: "pointer",
                    }}
                  >
                    View Rows
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: "linear-gradient(145deg,rgba(22,33,58,0.6),rgba(15,23,42,0.8))",
      border: "1px solid rgba(148,163,184,0.08)",
      borderRadius: 14, padding: "20px", height: 96,
      overflow: "hidden", position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmerAnim 1.6s ease-in-out infinite",
      }} />
    </div>
  );
}

// ─── Apply bar (floating sticky bottom) ──────────────────────────────────────

function ApplyBar({
  count, total, onApply, onClear, applying,
}: { count: number; total: number; onApply: () => void; onClear: () => void; applying: boolean }) {
  const improvement = Math.round((count / Math.max(total, 1)) * 28);
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        background: "linear-gradient(135deg,rgba(15,23,42,0.97),rgba(30,41,59,0.97))",
        border: "1px solid rgba(99,102,241,0.4)",
        borderRadius: 18, padding: "14px 24px",
        backdropFilter: "blur(24px)",
        boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.2)",
        display: "flex", alignItems: "center", gap: 20, zIndex: 999,
        minWidth: 480,
      }}
    >
      <div style={{ fontSize: 20 }}>✨</div>
      <div className="tw-flex-1 tw-min-w-0">
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>
          {count} fix{count !== 1 ? "es" : ""} selected
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#818cf8" }}>
          Estimated quality improvement: <strong style={{ color: "#22c55e" }}>+{improvement}%</strong>
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          background: "transparent", border: "1px solid rgba(148,163,184,0.2)",
          color: "#94a3b8", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13,
        }}
      >
        Clear
      </button>
      <motion.button
        whileHover={{ scale: 1.04, boxShadow: "0 0 24px rgba(99,102,241,0.5)" }}
        whileTap={{ scale: 0.97 }}
        onClick={onApply}
        disabled={applying}
        style={{
          background: applying ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px",
          cursor: applying ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700,
          boxShadow: "0 0 16px rgba(99,102,241,0.4)",
        }}
      >
        {applying ? (
          <span className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-animate-spin">⟳</span> Applying…
          </span>
        ) : "Apply All Fixes"}
      </motion.button>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DataCleaningPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const fileId = paramFileId || localStorage.getItem("lastDatasetId") || "";

  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedFixes, setSelectedFixes] = useState<Set<number>>(new Set());
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [appliedMsg, setAppliedMsg] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<Set<string>>(new Set(["high", "medium", "low"]));
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  const runAnalysis = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setError("");
    setAppliedMsg([]);
    setSelectedFixes(new Set());
    setIgnored(new Set());
    try {
      const res = await analyzeDataQuality(fileId);
      setReport(res.data);
    } catch {
      setError("Failed to analyze data quality. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { if (fileId) runAnalysis(); }, [fileId, runAnalysis]);

  const visibleIssues = useMemo(() => {
    if (!report) return [];
    return report.issues
      .map((issue, originalIndex) => ({ issue, originalIndex }))
      .filter(({ issue, originalIndex }) => {
        if (ignored.has(originalIndex)) return false;
        if (!sevFilter.has(issue.severity)) return false;
        if (typeFilter.size > 0 && !typeFilter.has(issue.issue_type)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !issue.column.toLowerCase().includes(q) &&
            !issue.description.toLowerCase().includes(q) &&
            !(TYPE_META[issue.issue_type]?.label || "").toLowerCase().includes(q)
          ) return false;
        }
        return true;
      });
  }, [report, ignored, sevFilter, typeFilter, search]);

  const toggleFix = useCallback((idx: number) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const ignoreIssue = useCallback((idx: number) => {
    setIgnored((prev) => new Set([...prev, idx]));
    setSelectedFixes((prev) => { const next = new Set(prev); next.delete(idx); return next; });
  }, []);

  const applySelected = async () => {
    if (!report || selectedFixes.size === 0) return;
    setApplying(true);
    setError("");
    const fixes = Array.from(selectedFixes).map((i) => report.issues[i]);
    try {
      const res = await applyDataFixes(fileId, fixes);
      setAppliedMsg(res.data.descriptions || []);
      setReport(res.data.new_quality);
      setSelectedFixes(new Set());
    } catch {
      setError("Failed to apply fixes. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const toggleSevFilter = (sev: string) => {
    setSevFilter((prev) => {
      const next = new Set(prev);
      next.has(sev) ? next.delete(sev) : next.add(sev);
      return next;
    });
  };

  const allTypes = useMemo(() =>
    report ? [...new Set(report.issues.map((i) => i.issue_type))] : [], [report]);

  const toggleTypeFilter = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  if (!fileId) {
    return (
      <MainLayout>
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-min-h-64 tw-gap-6" style={{ marginTop: 48 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
            boxShadow: "0 0 32px rgba(99,102,241,0.4)",
          }}>
            🧹
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>No Dataset Selected</h2>
            <p style={{ color: "#64748b", margin: "0 0 24px" }}>Select a dataset to run the AI data quality analysis.</p>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/datasets")}
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", border: "none", borderRadius: 12,
                padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 20px rgba(99,102,241,0.35)",
              }}
            >
              Browse Datasets
            </motion.button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <style>{`
        @keyframes shimmerAnim {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4 tw-mb-6"
      >
        <div>
          <div className="tw-flex tw-items-center tw-gap-3 tw-mb-1">
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              boxShadow: "0 0 16px rgba(99,102,241,0.4)",
            }}>
              🧹
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", margin: 0 }}>
                AI Data Cleaning
              </p>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>Data Quality Analysis</h1>
            </div>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0, paddingLeft: 50 }}>
            Detect, understand, and fix data issues — powered by real statistical analysis
          </p>
        </div>

        <div className="tw-flex tw-gap-3">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={runAnalysis}
            disabled={loading}
            style={{
              padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: "rgba(255,255,255,0.05)", color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.15)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {loading ? <span className="tw-animate-spin">⟳</span> : "⟳"} Re-analyze
          </motion.button>
          {report && report.total_issues > 0 && (
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(99,102,241,0.45)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!report) return;
                setSelectedFixes(new Set(report.issues.map((_, i) => i)));
              }}
              style={{
                padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", border: "none", cursor: "pointer",
                boxShadow: "0 0 12px rgba(99,102,241,0.35)",
              }}
            >
              Select All Fixes
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── Error / Success banners ───────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 16, color: "#fca5a5", fontSize: 13,
            }}
          >
            {error}
          </motion.div>
        )}
        {appliedMsg.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 12, padding: "14px 18px", marginBottom: 16,
            }}
          >
            <p style={{ fontWeight: 700, color: "#86efac", margin: "0 0 8px" }}>✅ {appliedMsg.length} fix{appliedMsg.length !== 1 ? "es" : ""} applied successfully</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#4ade80", fontSize: 12, lineHeight: 1.8 }}>
              {appliedMsg.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading skeletons ────────────────────────────────────── */}
      {loading && (
        <div>
          <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-4 tw-mb-5">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="tw-flex tw-flex-col tw-gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {report && !loading && (
        <motion.div initial="hidden" animate="show" variants={STAGGER}>

          {/* ── Stats overview row ─────────────────────────────── */}
          <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-5 tw-gap-4 tw-mb-5 tw-items-center">
            {/* Quality ring */}
            <motion.div
              variants={FADE_UP}
              style={{
                background: "linear-gradient(145deg,rgba(30,41,59,0.85),rgba(15,23,42,0.9))",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: 16, backdropFilter: "blur(12px)",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "16px 12px",
                gridColumn: "span 1",
              }}
            >
              <QualityRing score={report.quality_score} />
            </motion.div>

            <StatCard label="Total Issues"  value={report.total_issues}    gradient="linear-gradient(135deg,#6366f1,#8b5cf6)" icon="🔎" delay={0.05} sub={`${report.rows.toLocaleString()} rows · ${report.columns} columns`} />
            <StatCard label="Critical"      value={report.high_severity}   gradient="linear-gradient(135deg,#ef4444,#dc2626)" icon="⛔" delay={0.10} sub="Immediate attention needed" />
            <StatCard label="Warnings"      value={report.medium_severity} gradient="linear-gradient(135deg,#f97316,#ea580c)" icon="⚠️"  delay={0.15} sub="Should be addressed" />
            <StatCard label="Informational" value={report.low_severity}    gradient="linear-gradient(135deg,#3b82f6,#2563eb)" icon="ℹ️"  delay={0.20} sub="Optional improvements" />
          </div>

          {/* ── Health progress bar ─────────────────────────────── */}
          <motion.div
            variants={FADE_UP}
            style={{
              background: "linear-gradient(145deg,rgba(30,41,59,0.7),rgba(15,23,42,0.8))",
              border: "1px solid rgba(148,163,184,0.1)",
              borderRadius: 12, padding: "14px 20px",
              marginBottom: 20, backdropFilter: "blur(8px)",
            }}
          >
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-2">
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.5 }}>
                Dataset Health
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
                {report.quality_score}% · Grade {report.quality_grade}
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${report.quality_score}%` }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  height: "100%", borderRadius: 99,
                  background: report.quality_score >= 90 ? "#22c55e"
                    : report.quality_score >= 75 ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
                    : report.quality_score >= 60 ? "#f97316" : "#ef4444",
                }}
              />
            </div>
          </motion.div>

          {/* ── AI Insight Banner ────────────────────────────────── */}
          {report.total_issues > 0 && <AIInsightBanner report={report} />}

          {/* ── Charts ──────────────────────────────────────────── */}
          <ChartsRow report={report} />

          {/* ── Filter sidebar + issue list ──────────────────────── */}
          {report.total_issues === 0 ? (
            <motion.div
              variants={FADE_UP}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "64px 24px", textAlign: "center",
                background: "linear-gradient(145deg,rgba(22,33,58,0.6),rgba(15,23,42,0.8))",
                border: "1px solid rgba(148,163,184,0.1)", borderRadius: 20,
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Perfect Data Quality</h3>
              <p style={{ color: "#64748b", margin: 0, maxWidth: 360 }}>
                No data quality issues detected. Your dataset is clean and ready for analysis.
              </p>
            </motion.div>
          ) : (
            <div className="tw-flex tw-gap-5">
              {/* Filter sidebar */}
              <motion.aside
                variants={FADE_UP}
                style={{
                  width: 220, flexShrink: 0,
                  background: "linear-gradient(145deg,rgba(22,33,58,0.8),rgba(15,23,42,0.9))",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: 16, padding: "20px 16px",
                  backdropFilter: "blur(12px)",
                  position: "sticky", top: 16, alignSelf: "flex-start",
                  maxHeight: "calc(100vh - 120px)", overflowY: "auto",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.45, marginBottom: 16 }}>
                  Filters
                </p>

                {/* Search */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Search</p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4, fontSize: 14 }}>🔍</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Column or issue…"
                      style={{
                        width: "100%", padding: "8px 10px 8px 30px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.15)",
                        borderRadius: 8, color: "#e2e8f0", fontSize: 12, outline: "none",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.15)"; }}
                    />
                  </div>
                </div>

                {/* Severity filter */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity</p>
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const s = SEV[sev];
                    const count = report.issues.filter((i) => i.severity === sev && !ignored.has(report.issues.indexOf(i))).length;
                    const active = sevFilter.has(sev);
                    return (
                      <motion.button
                        key={sev}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSevFilter(sev)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "7px 10px", borderRadius: 8, marginBottom: 4,
                          background: active ? s.bg : "transparent",
                          border: active ? `1px solid ${s.border}` : "1px solid transparent",
                          color: active ? s.color : "#64748b",
                          cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                        }}
                      >
                        <span>{s.icon} {s.label}</span>
                        <span style={{
                          padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                          background: active ? s.color : "rgba(255,255,255,0.06)", color: active ? "#fff" : "#64748b",
                        }}>
                          {count}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Type filter */}
                {allTypes.length > 1 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Issue Type</p>
                    {allTypes.map((type) => {
                      const meta = TYPE_META[type] || { icon: "◎", label: type };
                      const active = typeFilter.has(type);
                      return (
                        <motion.button
                          key={type}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => toggleTypeFilter(type)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            width: "100%", padding: "7px 10px", borderRadius: 8, marginBottom: 4,
                            background: active ? "rgba(99,102,241,0.12)" : "transparent",
                            border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                            color: active ? "#818cf8" : "#64748b",
                            cursor: "pointer", fontSize: 12, fontWeight: 500, textAlign: "left",
                          }}
                        >
                          <span>{meta.icon}</span>
                          <span className="tw-truncate">{meta.label}</span>
                        </motion.button>
                      );
                    })}
                    {typeFilter.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setTypeFilter(new Set())}
                        style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: "4px 10px" }}
                      >
                        Clear type filter
                      </button>
                    )}
                  </div>
                )}
              </motion.aside>

              {/* Issues list */}
              <div className="tw-flex-1 tw-min-w-0">
                {/* List header */}
                <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
                  <div className="tw-flex tw-items-center tw-gap-3">
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                      {visibleIssues.length} issue{visibleIssues.length !== 1 ? "s" : ""}
                    </p>
                    {selectedFixes.size > 0 && (
                      <span style={{
                        padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: "rgba(99,102,241,0.15)", color: "#818cf8",
                        border: "1px solid rgba(99,102,241,0.3)",
                      }}>
                        {selectedFixes.size} selected
                      </span>
                    )}
                  </div>
                  <div className="tw-flex tw-gap-2">
                    {visibleIssues.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allVisible = new Set(visibleIssues.map((v) => v.originalIndex));
                          const allAlreadySelected = visibleIssues.every((v) => selectedFixes.has(v.originalIndex));
                          setSelectedFixes(allAlreadySelected ? new Set() : allVisible);
                        }}
                        style={{
                          fontSize: 12, fontWeight: 600, color: "#818cf8",
                          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                          borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                        }}
                      >
                        {visibleIssues.every((v) => selectedFixes.has(v.originalIndex)) ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>
                </div>

                {visibleIssues.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "48px 24px",
                    background: "rgba(22,33,58,0.5)", borderRadius: 16,
                    border: "1px solid rgba(148,163,184,0.08)",
                  }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>🎉</p>
                    <p style={{ color: "#64748b" }}>No issues match your current filters.</p>
                  </div>
                ) : (
                  <motion.div
                    variants={STAGGER}
                    className="tw-flex tw-flex-col tw-gap-3"
                  >
                    {visibleIssues.map(({ issue, originalIndex }, listIdx) => (
                      <IssueCard
                        key={originalIndex}
                        issue={issue}
                        index={listIdx}
                        selected={selectedFixes.has(originalIndex)}
                        onToggle={() => toggleFix(originalIndex)}
                        onIgnore={() => ignoreIssue(originalIndex)}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Floating apply bar ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedFixes.size > 0 && (
          <ApplyBar
            count={selectedFixes.size}
            total={report?.total_issues || 1}
            onApply={applySelected}
            onClear={() => setSelectedFixes(new Set())}
            applying={applying}
          />
        )}
      </AnimatePresence>

      {/* Bottom padding for the floating bar */}
      {selectedFixes.size > 0 && <div style={{ height: 100 }} />}
    </MainLayout>
  );
}
