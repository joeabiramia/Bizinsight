import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Upload, Database, Bot, BarChart2, ArrowRight,
  Layers, Zap, MessageSquare, TrendingUp,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import PageHeader from "../components/ui/PageHeader";
import MetricCard from "../components/ui/MetricCard";
import { listDatasets } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { DatasetRecord } from "../types";

const INDUSTRY_KPIS: Record<string, { kpi: string; question: string; icon: React.ReactNode }[]> = {
  retail: [
    { kpi: "Revenue by product",  question: "What is my best-selling product?",        icon: <TrendingUp size={14} /> },
    { kpi: "Sales by region",     question: "Which region has the highest revenue?",    icon: <BarChart2 size={14} /> },
    { kpi: "Average order value", question: "What is the average transaction value?",   icon: <Zap size={14} /> },
  ],
  finance: [
    { kpi: "Revenue vs expenses", question: "What is my net profit margin?",            icon: <TrendingUp size={14} /> },
    { kpi: "Cash flow trend",     question: "Which month had the highest revenue?",     icon: <BarChart2 size={14} /> },
    { kpi: "Top cost centres",    question: "Where are my biggest expenses?",           icon: <Layers size={14} /> },
  ],
  hr: [
    { kpi: "Headcount by dept",   question: "Which department has the most employees?", icon: <Layers size={14} /> },
    { kpi: "Average salary",      question: "What is the average salary across teams?", icon: <TrendingUp size={14} /> },
    { kpi: "Turnover rate",       question: "Which department has the highest attrition?", icon: <Zap size={14} /> },
  ],
  logistics: [
    { kpi: "Delivery performance",question: "What is the average delivery time?",       icon: <TrendingUp size={14} /> },
    { kpi: "Cost per shipment",   question: "Which route is most expensive?",           icon: <BarChart2 size={14} /> },
    { kpi: "Volume by region",    question: "Which region has the most shipments?",     icon: <Layers size={14} /> },
  ],
  technology: [
    { kpi: "MRR / ARR",           question: "What is my monthly recurring revenue?",   icon: <TrendingUp size={14} /> },
    { kpi: "Churn rate",          question: "What is my customer churn rate?",         icon: <BarChart2 size={14} /> },
    { kpi: "Top accounts",        question: "Who are my top paying customers?",        icon: <Layers size={14} /> },
  ],
  manufacturing: [
    { kpi: "Units vs target",     question: "Which product line performs best?",       icon: <TrendingUp size={14} /> },
    { kpi: "Defect rate",         question: "What is the defect rate by line?",        icon: <BarChart2 size={14} /> },
    { kpi: "Cost per unit",       question: "Which product has the highest unit cost?", icon: <Zap size={14} /> },
  ],
};

const DEFAULT_KPIS = [
  { kpi: "Total revenue",   question: "What is my total revenue?",            icon: <TrendingUp size={14} /> },
  { kpi: "Top product",     question: "What is my best-selling product?",     icon: <BarChart2 size={14} /> },
  { kpi: "Best region",     question: "Which region has the highest sales?",  icon: <Layers size={14} /> },
];

const GOAL_TIPS: Record<string, string> = {
  revenue:     "Upload your sales data to identify your highest-revenue products, regions, and salespeople.",
  costs:       "Upload your expense data to pinpoint cost centres and find savings opportunities.",
  performance: "Upload your team or sales data to benchmark individual and regional performance.",
  forecast:    "Upload historical data to identify trends and seasonal patterns for forecasting.",
  customers:   "Upload your customer transaction data to uncover purchase patterns and lifetime value.",
  reporting:   "Upload any business spreadsheet and get an instant executive report with one click.",
};

const QUICK_ACTIONS = [
  { label: "Upload dataset",        icon: <Upload size={16} />,    path: "/upload",    variant: "button-primary" },
  { label: "View all datasets",     icon: <Database size={16} />,  path: "/datasets",  variant: "button-secondary" },
  { label: "Open AI Copilot",       icon: <Bot size={16} />,       path: "/ai-chat",   variant: "button-secondary" },
  { label: "Integrations",          icon: <Layers size={16} />,    path: "/integrations", variant: "button-secondary" },
];

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const industry = user?.onboarding_data?.business_type || "other";
  const goal     = user?.onboarding_data?.goal || "";
  const kpis     = INDUSTRY_KPIS[industry] || DEFAULT_KPIS;
  const goalTip  = GOAL_TIPS[goal] || "";
  const firstName = user?.name?.split(" ")[0] || "there";

  useEffect(() => {
    listDatasets()
      .then((res) => setDatasets(res.data.datasets || []))
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false));
  }, []);

  const latest = datasets[0];

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Executive Dashboard"
        title={`Welcome back, ${firstName}`}
        description={goalTip || "Upload a dataset to generate your first AI-powered business intelligence report."}
        actions={
          <>
            <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
              <Upload size={15} /> Upload dataset
            </button>
            {latest && (
              <button type="button" className="button button-secondary" onClick={() => navigate(`/analysis/${latest.file_id}`)}>
                <BarChart2 size={15} /> Latest analysis
              </button>
            )}
          </>
        }
      />

      {/* Stats row */}
      {loading ? (
        <LoadingSkeleton variant="metric" rows={3} cols={3} />
      ) : (
        <div className="dashboard-cards" style={{ marginBottom: 24 }}>
          <MetricCard
            label="Datasets uploaded"
            value={datasets.length}
            sub="total files"
            icon={<Database size={16} />}
            index={0}
          />
          <MetricCard
            label="Latest file"
            value={latest?.filename
              ? latest.filename.length > 22
                ? latest.filename.slice(0, 22) + "…"
                : latest.filename
              : "No dataset yet"}
            sub={latest ? "most recent upload" : "upload one to get started"}
            icon={<Upload size={16} />}
            index={1}
          />
          <MetricCard
            label="Last updated"
            value={latest?.created_at ? new Date(latest.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            sub={latest?.created_at ? new Date(latest.created_at).toLocaleDateString("en-US", { year: "numeric" }) : "no activity yet"}
            icon={<TrendingUp size={16} />}
            index={2}
          />
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {/* KPI suggestions */}
        <SectionCard
          title={`Suggested KPIs — ${industry.charAt(0).toUpperCase() + industry.slice(1)}`}
          description="Industry-matched metrics to track with your data."
          index={0}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {kpis.map((item, i) => (
              <motion.div
                key={item.kpi}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  transition: "border-color 150ms",
                  cursor: latest ? "pointer" : "default",
                }}
                onClick={() => latest && navigate(`/ai-chat/${latest.file_id}`)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "var(--primary-dim)", color: "var(--primary-light)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{item.kpi}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Try: <em>"{item.question}"</em>
                  </p>
                </div>
                {latest && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--primary-light)", fontWeight: 600, flexShrink: 0 }}>
                    Ask AI <ArrowRight size={12} />
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </SectionCard>

        {/* Quick actions */}
        <SectionCard title="Quick actions" description="Jump to the most-used features." index={1}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {QUICK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.label}
                type="button"
                className={`button ${action.variant}`}
                style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => navigate(latest && action.path === "/ai-chat" ? `/ai-chat/${latest.file_id}` : action.path)}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                {action.icon}
                {action.label}
              </motion.button>
            ))}
          </div>

          {/* Recent datasets list */}
          {!loading && datasets.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                Recent datasets
              </p>
              {datasets.slice(0, 3).map((ds) => (
                <div
                  key={ds.file_id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10,
                    cursor: "pointer", transition: "background 150ms",
                  }}
                  onClick={() => navigate(`/analysis/${ds.file_id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Database size={14} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.84rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                    {ds.filename}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", flexShrink: 0 }}>
                    {ds.created_at ? new Date(ds.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Getting started — only when no datasets */}
      {!loading && datasets.length === 0 && (
        <SectionCard title="Get started in 3 steps" description="You're one upload away from AI-powered business insights." index={2}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { step: 1, icon: <Upload size={22} />, title: "Upload your data", desc: "Any CSV or Excel file — sales, finance, HR, inventory." },
              { step: 2, icon: <BarChart2 size={22} />, title: "Get your analysis", desc: "KPI dashboard, charts, and business insights generated automatically." },
              { step: 3, icon: <MessageSquare size={22} />, title: "Chat with your data", desc: "Ask plain-English questions and get instant, data-backed answers." },
            ].map(({ step, icon, title, desc }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + step * 0.08 }}
                style={{
                  padding: 20, borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: 12,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "var(--primary-dim)", color: "var(--primary-light)",
                  display: "grid", placeItems: "center",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}>
                  {icon}
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
                    <span style={{ color: "var(--primary-light)", marginRight: 6, fontSize: "0.8rem" }}>0{step}.</span>
                    {title}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate("/upload")}
          >
            <Upload size={15} /> Upload your first dataset
          </button>
        </SectionCard>
      )}
    </MainLayout>
  );
}
