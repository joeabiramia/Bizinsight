// Industry benchmark data for the Benchmarking feature
// Sources: industry averages from public reports (illustrative)

export interface BenchmarkMetric {
  name: string;
  industry_avg: number;
  top_quartile: number;
  unit: string;
  higher_is_better: boolean;
  description: string;
}

export interface IndustryBenchmark {
  industry: string;
  label: string;
  icon: string;
  color: string;
  metrics: BenchmarkMetric[];
  insight: string;
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  retail: {
    industry: "retail",
    label: "Retail & E-commerce",
    icon: "🛍",
    color: "#f97316",
    insight: "Top retail performers focus on reducing CAC while increasing repeat purchase rate.",
    metrics: [
      { name: "Gross Margin", industry_avg: 43, top_quartile: 62, unit: "%", higher_is_better: true, description: "Revenue minus cost of goods sold" },
      { name: "Customer Return Rate", industry_avg: 28, top_quartile: 55, unit: "%", higher_is_better: true, description: "% of customers making a second purchase" },
      { name: "Avg Order Value", industry_avg: 85, top_quartile: 140, unit: "$", higher_is_better: true, description: "Average transaction size" },
      { name: "Cart Abandonment", industry_avg: 70, top_quartile: 52, unit: "%", higher_is_better: false, description: "% of shopping carts not completed" },
      { name: "Inventory Turnover", industry_avg: 8, top_quartile: 14, unit: "×/yr", higher_is_better: true, description: "How often inventory is sold per year" },
      { name: "Revenue Growth (YoY)", industry_avg: 12, top_quartile: 28, unit: "%", higher_is_better: true, description: "Year-over-year revenue increase" },
    ],
  },
  technology: {
    industry: "technology",
    label: "SaaS / Technology",
    icon: "💻",
    color: "#6366f1",
    insight: "SaaS leaders achieve NRR > 120%, meaning existing customers expand faster than new ones are needed.",
    metrics: [
      { name: "Monthly Churn Rate", industry_avg: 5.2, top_quartile: 1.8, unit: "%", higher_is_better: false, description: "% of MRR lost monthly" },
      { name: "Net Revenue Retention", industry_avg: 104, top_quartile: 125, unit: "%", higher_is_better: true, description: "Revenue retained + expanded from existing customers" },
      { name: "Gross Margin", industry_avg: 71, top_quartile: 85, unit: "%", higher_is_better: true, description: "SaaS gross margin after hosting and support" },
      { name: "CAC Payback Period", industry_avg: 18, top_quartile: 9, unit: "months", higher_is_better: false, description: "Months to recover customer acquisition cost" },
      { name: "ARR Growth (YoY)", industry_avg: 45, top_quartile: 100, unit: "%", higher_is_better: true, description: "Annual recurring revenue growth" },
      { name: "Magic Number", industry_avg: 0.7, top_quartile: 1.2, unit: "×", higher_is_better: true, description: "Sales efficiency: new ARR ÷ S&M spend" },
    ],
  },
  finance: {
    industry: "finance",
    label: "Financial Services",
    icon: "🏦",
    color: "#22c55e",
    insight: "Top financial firms maintain cost-to-income ratios below 50% while growing AUM consistently.",
    metrics: [
      { name: "Cost-to-Income Ratio", industry_avg: 62, top_quartile: 44, unit: "%", higher_is_better: false, description: "Operating costs as % of income" },
      { name: "Net Interest Margin", industry_avg: 3.1, top_quartile: 4.8, unit: "%", higher_is_better: true, description: "Net interest income ÷ average earning assets" },
      { name: "Return on Equity", industry_avg: 11, top_quartile: 18, unit: "%", higher_is_better: true, description: "Net income ÷ shareholders equity" },
      { name: "Loan Default Rate", industry_avg: 2.8, top_quartile: 1.1, unit: "%", higher_is_better: false, description: "% of loans that default" },
      { name: "AUM Growth (YoY)", industry_avg: 14, top_quartile: 28, unit: "%", higher_is_better: true, description: "Assets under management growth" },
      { name: "Customer Acquisition Cost", industry_avg: 380, top_quartile: 190, unit: "$", higher_is_better: false, description: "Cost to acquire one customer" },
    ],
  },
  hr: {
    industry: "hr",
    label: "HR & Workforce",
    icon: "👥",
    color: "#8b5cf6",
    insight: "Best-in-class companies maintain turnover below 10% with high eNPS scores above 50.",
    metrics: [
      { name: "Employee Turnover Rate", industry_avg: 18, top_quartile: 8, unit: "%", higher_is_better: false, description: "Annual employee attrition rate" },
      { name: "Time-to-Hire", industry_avg: 42, top_quartile: 24, unit: "days", higher_is_better: false, description: "Days from job post to offer accepted" },
      { name: "Revenue per Employee", industry_avg: 180, top_quartile: 320, unit: "$K", higher_is_better: true, description: "Annual revenue divided by headcount" },
      { name: "Training Hours/Employee", industry_avg: 34, top_quartile: 62, unit: "hrs/yr", higher_is_better: true, description: "Annual learning & development hours" },
      { name: "eNPS Score", industry_avg: 32, top_quartile: 58, unit: "pts", higher_is_better: true, description: "Employee Net Promoter Score (-100 to 100)" },
      { name: "Offer Acceptance Rate", industry_avg: 73, top_quartile: 91, unit: "%", higher_is_better: true, description: "% of job offers accepted" },
    ],
  },
  logistics: {
    industry: "logistics",
    label: "Logistics & Supply Chain",
    icon: "🚚",
    color: "#f59e0b",
    insight: "Top logistics operators achieve on-time delivery above 95% while keeping cost-per-shipment lean.",
    metrics: [
      { name: "On-Time Delivery Rate", industry_avg: 88, top_quartile: 97, unit: "%", higher_is_better: true, description: "Deliveries completed within promised window" },
      { name: "Cost per Shipment", industry_avg: 12.4, top_quartile: 7.8, unit: "$", higher_is_better: false, description: "Average cost to fulfill one shipment" },
      { name: "Warehouse Utilization", industry_avg: 72, top_quartile: 88, unit: "%", higher_is_better: true, description: "% of warehouse capacity in use" },
      { name: "Order Accuracy Rate", industry_avg: 96.2, top_quartile: 99.4, unit: "%", higher_is_better: true, description: "Orders fulfilled without errors" },
      { name: "Inventory Shrinkage", industry_avg: 1.8, top_quartile: 0.6, unit: "%", higher_is_better: false, description: "Inventory lost to damage/theft" },
      { name: "Return Processing Time", industry_avg: 6.2, top_quartile: 2.8, unit: "days", higher_is_better: false, description: "Days to process a customer return" },
    ],
  },
  manufacturing: {
    industry: "manufacturing",
    label: "Manufacturing",
    icon: "🏭",
    color: "#ef4444",
    insight: "World-class manufacturers operate at OEE above 85% — most companies average around 60%.",
    metrics: [
      { name: "Overall Equipment Effectiveness", industry_avg: 60, top_quartile: 85, unit: "%", higher_is_better: true, description: "Availability × Performance × Quality" },
      { name: "Defect Rate", industry_avg: 3.4, top_quartile: 0.8, unit: "%", higher_is_better: false, description: "% of units not meeting quality spec" },
      { name: "Production Cost per Unit", industry_avg: 100, top_quartile: 72, unit: "$", higher_is_better: false, description: "Indexed cost (100 = industry average)" },
      { name: "On-Time Delivery (to customer)", industry_avg: 84, top_quartile: 96, unit: "%", higher_is_better: true, description: "% of customer orders shipped on time" },
      { name: "Gross Margin", industry_avg: 32, top_quartile: 48, unit: "%", higher_is_better: true, description: "Revenue minus direct manufacturing costs" },
      { name: "Inventory Turns", industry_avg: 7, top_quartile: 14, unit: "×/yr", higher_is_better: true, description: "Annual inventory turnover rate" },
    ],
  },
  travel: {
    industry: "travel",
    label: "Travel & Hospitality",
    icon: "✈️",
    color: "#06b6d4",
    insight: "Top travel agencies maintain occupancy/booking rates above 75% and average booking values 40% above industry.",
    metrics: [
      { name: "Booking Confirmation Rate", industry_avg: 82, top_quartile: 94, unit: "%", higher_is_better: true, description: "% of inquiries that convert to confirmed booking" },
      { name: "Cancellation Rate", industry_avg: 7.2, top_quartile: 2.8, unit: "%", higher_is_better: false, description: "% of bookings cancelled after confirmation" },
      { name: "Avg Booking Value", industry_avg: 1240, top_quartile: 2100, unit: "$", higher_is_better: true, description: "Average revenue per booking" },
      { name: "Agent Productivity", industry_avg: 95, top_quartile: 210, unit: "bookings/yr", higher_is_better: true, description: "Annual bookings per agent" },
      { name: "Repeat Customer Rate", industry_avg: 34, top_quartile: 58, unit: "%", higher_is_better: true, description: "% of customers who book again within 2 years" },
      { name: "Revenue Growth (YoY)", industry_avg: 9, top_quartile: 22, unit: "%", higher_is_better: true, description: "Year-over-year revenue growth" },
    ],
  },
  general: {
    industry: "general",
    label: "General Business",
    icon: "📊",
    color: "#6366f1",
    insight: "Upload a dataset so BizInsight AI can detect your industry and show you relevant benchmarks.",
    metrics: [
      { name: "Revenue Growth (YoY)", industry_avg: 10, top_quartile: 25, unit: "%", higher_is_better: true, description: "Year-over-year revenue growth across industries" },
      { name: "Gross Margin", industry_avg: 42, top_quartile: 65, unit: "%", higher_is_better: true, description: "Revenue minus cost of goods sold / services" },
      { name: "Customer Retention Rate", industry_avg: 75, top_quartile: 92, unit: "%", higher_is_better: true, description: "% of customers retained year over year" },
      { name: "Customer Acquisition Cost", industry_avg: 220, top_quartile: 90, unit: "$", higher_is_better: false, description: "Cost to acquire one new customer" },
      { name: "Net Promoter Score", industry_avg: 32, top_quartile: 65, unit: "pts", higher_is_better: true, description: "Customer loyalty score (-100 to 100)" },
      { name: "Operating Margin", industry_avg: 14, top_quartile: 28, unit: "%", higher_is_better: true, description: "Operating income as % of revenue" },
    ],
  },
};

export function getBenchmarkForIndustry(industry: string): IndustryBenchmark {
  const key = industry.toLowerCase().replace(/[^a-z]/g, "");
  return INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS["general"];
}

export const ALL_INDUSTRIES = Object.values(INDUSTRY_BENCHMARKS);
