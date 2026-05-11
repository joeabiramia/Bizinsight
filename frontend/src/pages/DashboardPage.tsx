import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { listDatasets } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { DatasetRecord } from "../types";

const INDUSTRY_KPIS: Record<string, { kpi: string; question: string }[]> = {
  retail: [
    { kpi: "Revenue by product", question: "What is my best-selling product?" },
    { kpi: "Sales by region", question: "Which region has the highest revenue?" },
    { kpi: "Average order value", question: "What is the average transaction value?" },
  ],
  finance: [
    { kpi: "Total revenue vs expenses", question: "What is my net profit margin?" },
    { kpi: "Cash flow trend", question: "Which month had the highest revenue?" },
    { kpi: "Top cost centres", question: "Where are my biggest expenses?" },
  ],
  hr: [
    { kpi: "Headcount by department", question: "Which department has the most employees?" },
    { kpi: "Average salary", question: "What is the average salary across teams?" },
    { kpi: "Turnover rate", question: "Which department has the highest attrition?" },
  ],
  logistics: [
    { kpi: "Delivery performance", question: "What is the average delivery time?" },
    { kpi: "Cost per shipment", question: "Which route is most expensive?" },
    { kpi: "Volume by region", question: "Which region has the most shipments?" },
  ],
  technology: [
    { kpi: "MRR / ARR", question: "What is my monthly recurring revenue?" },
    { kpi: "Churn rate", question: "What is my customer churn rate?" },
    { kpi: "Top revenue accounts", question: "Who are my top paying customers?" },
  ],
  manufacturing: [
    { kpi: "Units produced vs target", question: "Which product line performs best?" },
    { kpi: "Defect rate", question: "What is the defect rate by production line?" },
    { kpi: "Cost per unit", question: "Which product has the highest unit cost?" },
  ],
};

const DEFAULT_KPIS = [
  { kpi: "Total revenue", question: "What is my total revenue?" },
  { kpi: "Top product", question: "What is my best-selling product?" },
  { kpi: "Best region", question: "Which region has the highest sales?" },
];

const GOAL_TIPS: Record<string, string> = {
  revenue: "Upload your sales data to identify your highest-revenue products, regions, and salespeople.",
  costs: "Upload your expense data to pinpoint cost centres and find savings opportunities.",
  performance: "Upload your team or sales data to benchmark individual and regional performance.",
  forecast: "Upload historical data to identify trends and seasonal patterns for forecasting.",
  customers: "Upload your customer transaction data to uncover purchase patterns and lifetime value.",
  reporting: "Upload any business spreadsheet and get an instant executive report with one click.",
};

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const industry = user?.onboarding_data?.business_type || "other";
  const goal = user?.onboarding_data?.goal || "";
  const kpis = INDUSTRY_KPIS[industry] || DEFAULT_KPIS;
  const goalTip = GOAL_TIPS[goal] || "";

  useEffect(() => {
    listDatasets()
      .then((response) => setDatasets(response.data.datasets || []))
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false));
  }, []);

  const latest = datasets[0];
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Executive Dashboard</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="section-description">
            {goalTip || "Upload a dataset to generate your first business intelligence report."}
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate("/upload")}
          >
            Upload dataset
          </button>
          {latest && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => navigate(`/analysis/${latest.file_id}`)}
            >
              Open latest analysis
            </button>
          )}
        </div>
      </div>

      {/* Dataset inventory */}
      <div className="dashboard-grid">
        <SectionCard title="Dataset inventory" description="Your uploaded data files and their status.">
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : (
            <div className="dashboard-cards">
              <div className="metric-card">
                <p className="metric-label">Datasets uploaded</p>
                <p className="metric-value">{datasets.length}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Latest file</p>
                <p className="metric-value" style={{ fontSize: "1.1rem" }}>
                  {latest?.filename || "No dataset yet"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Last updated</p>
                <p className="metric-value">
                  {latest?.created_at
                    ? new Date(latest.created_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick actions">
          <div className="action-grid">
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate("/upload")}
            >
              Upload new dataset
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => navigate("/datasets")}
            >
              View all datasets
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                navigate(latest ? `/analysis/${latest.file_id}` : "/datasets")
              }
            >
              Open latest analysis
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Personalised KPI suggestions */}
      <SectionCard
        title={`Suggested KPIs for your business`}
        description={`Based on your ${industry} industry profile — these are the metrics that matter most.`}
      >
        <div className="dashboard-kpi-suggestions">
          {kpis.map((item) => (
            <div key={item.kpi} className="kpi-suggestion-card">
              <div className="kpi-suggestion-dot" />
              <div>
                <p className="kpi-suggestion-name">{item.kpi}</p>
                <p className="kpi-suggestion-question">
                  Try asking: <em>"{item.question}"</em>
                </p>
              </div>
              {latest && (
                <button
                  type="button"
                  className="button button-secondary kpi-suggestion-btn"
                  onClick={() => navigate(`/ai-chat/${latest.file_id}`)}
                >
                  Ask AI
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Getting started guidance when no data */}
      {!loading && datasets.length === 0 && (
        <SectionCard title="Get started in 3 steps">
          <div className="getting-started-steps">
            <div className="gs-step">
              <div className="gs-step-num">1</div>
              <div>
                <h4>Upload your data</h4>
                <p>Any CSV or Excel file works — sales, finance, HR, inventory.</p>
              </div>
            </div>
            <div className="gs-step-arrow">→</div>
            <div className="gs-step">
              <div className="gs-step-num">2</div>
              <div>
                <h4>Get your analysis</h4>
                <p>KPI dashboard, charts, and business insights generated automatically.</p>
              </div>
            </div>
            <div className="gs-step-arrow">→</div>
            <div className="gs-step">
              <div className="gs-step-num">3</div>
              <div>
                <h4>Chat with your data</h4>
                <p>Ask plain-English questions and get instant, data-backed answers.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="button button-primary"
            style={{ marginTop: 24 }}
            onClick={() => navigate("/upload")}
          >
            Upload your first dataset →
          </button>
        </SectionCard>
      )}
    </MainLayout>
  );
}
