import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { ALL_INDUSTRIES, getBenchmarkForIndustry } from "../data/benchmarks";
import { useAuth } from "../context/AuthContext";

export default function BenchmarkPage() {
  const { user } = useAuth();
  const defaultIndustry = user?.onboarding_data?.business_type || "retail";
  const [selected, setSelected] = useState(defaultIndustry);
  const benchmark = getBenchmarkForIndustry(selected);

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Industry Intelligence"
        title="Industry Benchmarks"
        description="See how your key metrics compare to industry averages and top-quartile performers."
      />

      {/* Industry selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
        {ALL_INDUSTRIES.map(ind => (
          <button
            key={ind.industry}
            type="button"
            className={`chip${selected === ind.industry ? " chip--active" : ""}`}
            onClick={() => setSelected(ind.industry)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>{ind.icon}</span> {ind.label}
          </button>
        ))}
      </div>

      {/* Industry header */}
      <motion.div
        key={benchmark.industry}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: "24px", borderRadius: 20, marginBottom: 28,
          background: `linear-gradient(135deg, ${benchmark.color}10, rgba(255,255,255,0.01))`,
          border: `1px solid ${benchmark.color}30`,
          display: "flex", alignItems: "center", gap: 20,
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>{benchmark.icon}</div>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 700 }}>{benchmark.label}</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{benchmark.insight}</p>
        </div>
        <div style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 10, background: `${benchmark.color}15`, color: benchmark.color, fontSize: "0.78rem", fontWeight: 700, flexShrink: 0 }}>
          {benchmark.metrics.length} Metrics
        </div>
      </motion.div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {benchmark.metrics.map((metric, i) => {
          const chartData = [
            { name: "Industry Avg", value: metric.industry_avg, fill: "var(--primary)" },
            { name: "Top Quartile", value: metric.top_quartile, fill: "#22c55e" },
          ];

          const gap = ((metric.top_quartile - metric.industry_avg) / metric.industry_avg * 100).toFixed(0);
          const isPositiveGap = metric.higher_is_better
            ? metric.top_quartile > metric.industry_avg
            : metric.top_quartile < metric.industry_avg;

          return (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="section-card"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>{metric.name}</h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{metric.description}</p>
                </div>
                <span style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                  background: isPositiveGap ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  color: isPositiveGap ? "#4ade80" : "#f87171",
                }}>
                  {isPositiveGap ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {gap}% gap
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Industry Average", value: metric.industry_avg, unit: metric.unit, color: "var(--primary-light)" },
                  { label: "Top Quartile", value: metric.top_quartile, unit: metric.unit, color: "#22c55e" },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</p>
                    <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: stat.color, letterSpacing: "-0.02em" }}>
                      {stat.unit === "$" || stat.unit === "$K" ? stat.unit : ""}
                      {stat.value}
                      {stat.unit !== "$" && stat.unit !== "$K" ? stat.unit : ""}
                    </p>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" domain={[0, metric.top_quartile * 1.15]} hide />
                  <YAxis dataKey="name" type="category" tick={{ fill: "var(--muted)", fontSize: 10 }} width={90} />
                  <Tooltip
                    formatter={(v: unknown) => `${v as number}${metric.unit}`}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, j) => (
                      <motion.rect key={j} style={{ fill: entry.fill }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(99,102,241,0.05)" }}>
                <Info size={12} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  {metric.higher_is_better ? "Higher is better" : "Lower is better"} · Upload your data to see where you rank
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{
          marginTop: 32, padding: "28px 32px", borderRadius: 20,
          background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
          border: "1px solid rgba(99,102,241,0.2)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 6px", fontWeight: 700 }}>How do you compare?</h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>Upload your data to see your actual metrics plotted against these benchmarks.</p>
        </div>
        <a href="/upload" className="button button-primary">Upload Your Data →</a>
      </motion.div>
    </MainLayout>
  );
}
