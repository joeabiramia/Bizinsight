import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accent?: string;
  index?: number;
}

export default function MetricCard({
  label, value, sub, icon, trend, trendValue, accent, index = 0,
}: MetricCardProps) {
  const trendColor = trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "var(--muted)";
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <motion.div
      className="metric-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      style={accent ? { borderTop: `2px solid ${accent}` } : undefined}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <p className="metric-label" style={{ margin: 0 }}>{label}</p>
        {icon && (
          <span style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "var(--primary-light)",
          }}>
            {icon}
          </span>
        )}
      </div>
      <p className="metric-value">{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {trendValue && trend && (
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: trendColor }}>
            {trendArrow} {trendValue}
          </span>
        )}
        {sub && <span className="kpi-sub" style={{ margin: 0 }}>{sub}</span>}
      </div>
    </motion.div>
  );
}
