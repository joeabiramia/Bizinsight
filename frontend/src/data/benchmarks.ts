// Industry benchmark data for the Benchmarking feature
// Sources: industry averages from public reports (illustrative)

export interface BenchmarkMetric {
  name: string;
  industry_avg: number;
  top_quartile: number;
  unit: string;
  higher_is_better: boolean;
  description: string;
  /** Short instruction telling the user how to find or calculate this value */
  howToFind: string;
}

export interface IndustryBenchmark {
  industry: string;
  label: string;
  icon: string;
  color: string;
  metrics: BenchmarkMetric[];
  insight: string;
}

// Company size tiers used for benchmark peer-group selection
export type SizeTier = "smb" | "mid" | "enterprise";

/** Map onboarding company_size → benchmark tier */
export function getSizeTier(companySize: string): SizeTier {
  if (!companySize || companySize === "solo" || companySize === "small") return "smb";
  if (companySize === "medium") return "mid";
  return "enterprise"; // large / enterprise
}

/**
 * Peer-group multipliers applied to base benchmark numbers.
 *
 * SMBs (1-10 employees) operate on thinner margins and lower absolute volumes
 * than enterprises, so the "industry average" they should be compared against
 * is different.  These factors scale the base metrics accordingly.
 *
 * Format: { metric_name: { smb: factor, mid: factor, enterprise: factor } }
 * A factor of 1.0 means the base number is unchanged.
 *
 * Revenue-based absolute metrics ($ amounts) scale up significantly for
 * enterprise; percentage metrics shift modestly.
 */
const SIZE_ADJUSTMENTS: Record<string, Record<SizeTier, { avg: number; top: number }>> = {
  // Retail
  "Gross Margin":          { smb: { avg: 38, top: 55 }, mid: { avg: 43, top: 62 }, enterprise: { avg: 48, top: 68 } },
  "Customer Return Rate":  { smb: { avg: 22, top: 45 }, mid: { avg: 28, top: 55 }, enterprise: { avg: 35, top: 62 } },
  "Avg Order Value":       { smb: { avg: 55, top: 95  }, mid: { avg: 85, top: 140 }, enterprise: { avg: 120, top: 200 } },
  "Cart Abandonment":      { smb: { avg: 72, top: 55  }, mid: { avg: 70, top: 52  }, enterprise: { avg: 65, top: 48  } },
  "Inventory Turnover":    { smb: { avg: 5,  top: 10  }, mid: { avg: 8,  top: 14  }, enterprise: { avg: 12, top: 20  } },
  "Revenue Growth (YoY)":  { smb: { avg: 18, top: 40  }, mid: { avg: 12, top: 28  }, enterprise: { avg: 8,  top: 18  } },
  // Technology / SaaS
  "Monthly Churn Rate":    { smb: { avg: 8,  top: 3   }, mid: { avg: 5.2, top: 1.8 }, enterprise: { avg: 3,  top: 0.8 } },
  "Net Revenue Retention": { smb: { avg: 95, top: 110 }, mid: { avg: 104, top: 125 }, enterprise: { avg: 110, top: 135 } },
  "CAC Payback Period":    { smb: { avg: 12, top: 6   }, mid: { avg: 18,  top: 9   }, enterprise: { avg: 24, top: 12  } },
  "ARR Growth (YoY)":      { smb: { avg: 80, top: 150 }, mid: { avg: 45,  top: 100 }, enterprise: { avg: 25, top: 60  } },
  // HR
  "Employee Turnover Rate":{ smb: { avg: 22, top: 10  }, mid: { avg: 18,  top: 8   }, enterprise: { avg: 14, top: 6   } },
  "Time-to-Hire":          { smb: { avg: 28, top: 14  }, mid: { avg: 42,  top: 24  }, enterprise: { avg: 55, top: 35  } },
  "Revenue per Employee":  { smb: { avg: 120, top: 220 }, mid: { avg: 180, top: 320 }, enterprise: { avg: 250, top: 450 } },
  "Training Hours/Employee":{ smb: { avg: 20, top: 40 }, mid: { avg: 34,  top: 62  }, enterprise: { avg: 45, top: 80  } },
  // Finance
  "Cost-to-Income Ratio":  { smb: { avg: 70, top: 52  }, mid: { avg: 62,  top: 44  }, enterprise: { avg: 55, top: 38  } },
  "Return on Equity":      { smb: { avg: 8,  top: 14  }, mid: { avg: 11,  top: 18  }, enterprise: { avg: 14, top: 22  } },
  "Customer Acquisition Cost":{ smb: { avg: 220, top: 110 }, mid: { avg: 380, top: 190 }, enterprise: { avg: 550, top: 280 } },
};

/** Apply size-tier adjustments to a benchmark's metrics. */
export function applySize(benchmark: IndustryBenchmark, tier: SizeTier): IndustryBenchmark {
  const adjustedMetrics = benchmark.metrics.map(m => {
    const adj = SIZE_ADJUSTMENTS[m.name]?.[tier];
    if (!adj) return m;
    return { ...m, industry_avg: adj.avg, top_quartile: adj.top };
  });

  const tierLabel = tier === "smb" ? "SMB" : tier === "mid" ? "Mid-Market" : "Enterprise";
  return {
    ...benchmark,
    label: `${benchmark.label} · ${tierLabel}`,
    insight: tier === "smb"
      ? benchmark.insight.replace("Top ", "Top small-business ")
      : tier === "enterprise"
        ? benchmark.insight.replace("Top ", "Top enterprise ")
        : benchmark.insight,
    metrics: adjustedMetrics,
  };
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  retail: {
    industry: "retail",
    label: "Retail & E-commerce",
    icon: "🛍",
    color: "#f97316",
    insight: "Top retail performers focus on reducing CAC while increasing repeat purchase rate.",
    metrics: [
      { name: "Gross Margin", industry_avg: 43, top_quartile: 62, unit: "%", higher_is_better: true, description: "Revenue minus cost of goods sold", howToFind: "Formula: (Total Revenue − Total Cost) ÷ Total Revenue × 100. In your Analysis page find the Revenue and Cost column totals." },
      { name: "Customer Return Rate", industry_avg: 28, top_quartile: 55, unit: "%", higher_is_better: true, description: "% of customers making a second purchase", howToFind: "Count customers who appear more than once ÷ total unique customers × 100. Requires a Customer or Client ID column." },
      { name: "Avg Order Value", industry_avg: 85, top_quartile: 140, unit: "$", higher_is_better: true, description: "Average transaction size", howToFind: "Look at the mean of your Revenue or Amount column in the Analysis page — that is your average order value." },
      { name: "Cart Abandonment", industry_avg: 70, top_quartile: 52, unit: "%", higher_is_better: false, description: "% of shopping carts not completed", howToFind: "Needs cart or session data from your e-commerce platform (Shopify, WooCommerce). Not typically in a sales CSV." },
      { name: "Inventory Turnover", industry_avg: 8, top_quartile: 14, unit: "×/yr", higher_is_better: true, description: "How often inventory is sold per year", howToFind: "Formula: Annual Sales ÷ Average Inventory Value. Needs both a sales column and an inventory value column." },
      { name: "Revenue Growth (YoY)", industry_avg: 12, top_quartile: 28, unit: "%", higher_is_better: true, description: "Year-over-year revenue increase", howToFind: "In your Analysis page, go to Charts — the trend chart shows revenue over time. Compare the last period to the same period last year." },
    ],
  },
  technology: {
    industry: "technology",
    label: "SaaS / Technology",
    icon: "💻",
    color: "#6366f1",
    insight: "SaaS leaders achieve NRR > 120%, meaning existing customers expand faster than new ones are needed.",
    metrics: [
      { name: "Monthly Churn Rate", industry_avg: 5.2, top_quartile: 1.8, unit: "%", higher_is_better: false, description: "% of MRR lost monthly", howToFind: "If your dataset has a Churn column, look at its mean in Analysis. Otherwise: (Customers lost this month ÷ Customers at start of month) × 100." },
      { name: "Net Revenue Retention", industry_avg: 104, top_quartile: 125, unit: "%", higher_is_better: true, description: "Revenue retained + expanded from existing customers", howToFind: "Needs cohort revenue data. Formula: (MRR from existing customers this period) ÷ (MRR from those customers last period) × 100." },
      { name: "Gross Margin", industry_avg: 71, top_quartile: 85, unit: "%", higher_is_better: true, description: "SaaS gross margin after hosting and support", howToFind: "Formula: (Revenue − Hosting & Support Costs) ÷ Revenue × 100. Find Revenue total and Cost total in your Analysis page." },
      { name: "CAC Payback Period", industry_avg: 18, top_quartile: 9, unit: "months", higher_is_better: false, description: "Months to recover customer acquisition cost", howToFind: "Formula: CAC ÷ Monthly Revenue per Customer. CAC comes from your marketing spend data (outside the dataset)." },
      { name: "ARR Growth (YoY)", industry_avg: 45, top_quartile: 100, unit: "%", higher_is_better: true, description: "Annual recurring revenue growth", howToFind: "If your dataset has an ARR or MRR column, the Analysis trend chart shows growth over time. Compare first to last period." },
      { name: "Magic Number", industry_avg: 0.7, top_quartile: 1.2, unit: "×", higher_is_better: true, description: "Sales efficiency: new ARR ÷ S&M spend", howToFind: "Formula: New ARR added ÷ Previous quarter S&M spend. Needs both revenue and marketing spend columns." },
    ],
  },
  finance: {
    industry: "finance",
    label: "Financial Services",
    icon: "🏦",
    color: "#22c55e",
    insight: "Top financial firms maintain cost-to-income ratios below 50% while growing AUM consistently.",
    metrics: [
      { name: "Cost-to-Income Ratio", industry_avg: 62, top_quartile: 44, unit: "%", higher_is_better: false, description: "Operating costs as % of income", howToFind: "Formula: Total Costs ÷ Total Income × 100. Find Cost/Expense total and Revenue/Income total in your Analysis page." },
      { name: "Net Interest Margin", industry_avg: 3.1, top_quartile: 4.8, unit: "%", higher_is_better: true, description: "Net interest income ÷ average earning assets", howToFind: "Formula: (Interest Income − Interest Expense) ÷ Average Earning Assets × 100. Needs interest income, expense, and assets columns." },
      { name: "Return on Equity", industry_avg: 11, top_quartile: 18, unit: "%", higher_is_better: true, description: "Net income ÷ shareholders equity", howToFind: "Formula: Net Income ÷ Shareholders Equity × 100. Typically comes from your annual financial statements, not a transactional dataset." },
      { name: "Loan Default Rate", industry_avg: 2.8, top_quartile: 1.1, unit: "%", higher_is_better: false, description: "% of loans that default", howToFind: "Count defaulted loans ÷ total loans × 100. If your dataset has a Status or Default column, count the defaulted rows in Analysis." },
      { name: "AUM Growth (YoY)", industry_avg: 14, top_quartile: 28, unit: "%", higher_is_better: true, description: "Assets under management growth", howToFind: "If your dataset has an AUM or Assets column over time, use the trend chart in Analysis to find the year-over-year change." },
      { name: "Customer Acquisition Cost", industry_avg: 380, top_quartile: 190, unit: "$", higher_is_better: false, description: "Cost to acquire one customer", howToFind: "Formula: Total Marketing & Sales Spend ÷ New Customers Acquired. Needs marketing spend data and new customer count." },
    ],
  },
  hr: {
    industry: "hr",
    label: "HR & Workforce",
    icon: "👥",
    color: "#8b5cf6",
    insight: "Best-in-class companies maintain turnover below 10% with high eNPS scores above 50.",
    metrics: [
      { name: "Employee Turnover Rate", industry_avg: 18, top_quartile: 8, unit: "%", higher_is_better: false, description: "Annual employee attrition rate", howToFind: "If your dataset has a Status or Attrition column, count inactive/left rows ÷ total rows × 100. Check the Analysis page category breakdown." },
      { name: "Time-to-Hire", industry_avg: 42, top_quartile: 24, unit: "days", higher_is_better: false, description: "Days from job post to offer accepted", howToFind: "If your dataset has posting date and hire date columns, look at the mean of the days-difference in Analysis." },
      { name: "Revenue per Employee", industry_avg: 180, top_quartile: 320, unit: "$K", higher_is_better: true, description: "Annual revenue divided by headcount", howToFind: "Formula: Total Annual Revenue ÷ Total Headcount. Revenue comes from your finance data; headcount is the row count if each row is one employee." },
      { name: "Training Hours/Employee", industry_avg: 34, top_quartile: 62, unit: "hrs/yr", higher_is_better: true, description: "Annual learning & development hours", howToFind: "If your dataset has a Training Hours column, look at its mean in your Analysis page." },
      { name: "eNPS Score", industry_avg: 32, top_quartile: 58, unit: "pts", higher_is_better: true, description: "Employee Net Promoter Score (-100 to 100)", howToFind: "Typically from an employee survey tool (Culture Amp, Lattice). Formula: % Promoters − % Detractors. Not usually in a transactional dataset." },
      { name: "Offer Acceptance Rate", industry_avg: 73, top_quartile: 91, unit: "%", higher_is_better: true, description: "% of job offers accepted", howToFind: "Count 'Accepted' rows ÷ total offer rows × 100. Requires an Offer Status column in your HR dataset." },
    ],
  },
  logistics: {
    industry: "logistics",
    label: "Logistics & Supply Chain",
    icon: "🚚",
    color: "#f59e0b",
    insight: "Top logistics operators achieve on-time delivery above 95% while keeping cost-per-shipment lean.",
    metrics: [
      { name: "On-Time Delivery Rate", industry_avg: 88, top_quartile: 97, unit: "%", higher_is_better: true, description: "Deliveries completed within promised window", howToFind: "Count 'On Time' or 'Delivered' status rows ÷ total rows × 100. Check the Status column breakdown in your Analysis page." },
      { name: "Cost per Shipment", industry_avg: 12.4, top_quartile: 7.8, unit: "$", higher_is_better: false, description: "Average cost to fulfill one shipment", howToFind: "Look at the mean of your Cost or Freight column in the Analysis page — that is your average cost per shipment." },
      { name: "Warehouse Utilization", industry_avg: 72, top_quartile: 88, unit: "%", higher_is_better: true, description: "% of warehouse capacity in use", howToFind: "Formula: Units Stored ÷ Total Capacity × 100. Needs warehouse capacity data, usually from a WMS system." },
      { name: "Order Accuracy Rate", industry_avg: 96.2, top_quartile: 99.4, unit: "%", higher_is_better: true, description: "Orders fulfilled without errors", howToFind: "Count accurate/correct orders ÷ total orders × 100. Requires an Accuracy or Error flag column in your dataset." },
      { name: "Inventory Shrinkage", industry_avg: 1.8, top_quartile: 0.6, unit: "%", higher_is_better: false, description: "Inventory lost to damage/theft", howToFind: "Formula: (Expected Inventory − Actual Inventory) ÷ Expected × 100. Requires inventory count data." },
      { name: "Return Processing Time", industry_avg: 6.2, top_quartile: 2.8, unit: "days", higher_is_better: false, description: "Days to process a customer return", howToFind: "If your dataset has return request date and resolution date, look at the mean days difference in Analysis." },
    ],
  },
  manufacturing: {
    industry: "manufacturing",
    label: "Manufacturing",
    icon: "🏭",
    color: "#ef4444",
    insight: "World-class manufacturers operate at OEE above 85% — most companies average around 60%.",
    metrics: [
      { name: "Overall Equipment Effectiveness", industry_avg: 60, top_quartile: 85, unit: "%", higher_is_better: true, description: "Availability × Performance × Quality", howToFind: "Formula: Availability % × Performance % × Quality %. Requires machine uptime, speed, and defect rate data from your production system." },
      { name: "Defect Rate", industry_avg: 3.4, top_quartile: 0.8, unit: "%", higher_is_better: false, description: "% of units not meeting quality spec", howToFind: "If your dataset has a Defect Count or Defect Rate column, look at its mean in Analysis. Or: Defective Units ÷ Total Units × 100." },
      { name: "Production Cost per Unit", industry_avg: 100, top_quartile: 72, unit: "$", higher_is_better: false, description: "Indexed cost (100 = industry average)", howToFind: "Look at the mean of your Cost per Unit or Unit Cost column in Analysis. This benchmark uses 100 as the industry baseline." },
      { name: "On-Time Delivery (to customer)", industry_avg: 84, top_quartile: 96, unit: "%", higher_is_better: true, description: "% of customer orders shipped on time", howToFind: "Count on-time shipment rows ÷ total order rows × 100. Check the Status or Delivery column breakdown in Analysis." },
      { name: "Gross Margin", industry_avg: 32, top_quartile: 48, unit: "%", higher_is_better: true, description: "Revenue minus direct manufacturing costs", howToFind: "Formula: (Revenue − Manufacturing Costs) ÷ Revenue × 100. Find Revenue total and Cost total in your Analysis page." },
      { name: "Inventory Turns", industry_avg: 7, top_quartile: 14, unit: "×/yr", higher_is_better: true, description: "Annual inventory turnover rate", howToFind: "Formula: Annual Cost of Goods Sold ÷ Average Inventory Value. Needs both sales and inventory columns." },
    ],
  },
  travel: {
    industry: "travel",
    label: "Travel & Hospitality",
    icon: "✈️",
    color: "#06b6d4",
    insight: "Top travel agencies maintain occupancy/booking rates above 75% and average booking values 40% above industry.",
    metrics: [
      { name: "Booking Confirmation Rate", industry_avg: 82, top_quartile: 94, unit: "%", higher_is_better: true, description: "% of inquiries that convert to confirmed booking", howToFind: "Count 'Confirmed' or 'Booked' rows ÷ total rows × 100. Check the Status or Booking Status column breakdown in Analysis." },
      { name: "Cancellation Rate", industry_avg: 7.2, top_quartile: 2.8, unit: "%", higher_is_better: false, description: "% of bookings cancelled after confirmation", howToFind: "Count 'Cancelled' rows ÷ total booking rows × 100. If your dataset has a Status column, the Analysis breakdown shows the percentage." },
      { name: "Avg Booking Value", industry_avg: 1240, top_quartile: 2100, unit: "$", higher_is_better: true, description: "Average revenue per booking", howToFind: "Look at the mean of your Revenue, Amount, or Booking Value column in the Analysis page — that is your average booking value." },
      { name: "Agent Productivity", industry_avg: 95, top_quartile: 210, unit: "bookings/yr", higher_is_better: true, description: "Annual bookings per agent", howToFind: "Total bookings in your dataset ÷ number of unique agents. Find total row count in Analysis and unique agent count in the Agent column breakdown." },
      { name: "Repeat Customer Rate", industry_avg: 34, top_quartile: 58, unit: "%", higher_is_better: true, description: "% of customers who book again within 2 years", howToFind: "Count Customer IDs that appear more than once ÷ total unique customers × 100. Requires a Customer ID column." },
      { name: "Revenue Growth (YoY)", industry_avg: 9, top_quartile: 22, unit: "%", higher_is_better: true, description: "Year-over-year revenue growth", howToFind: "In your Analysis page, go to Charts — the trend chart shows revenue over time. Compare the most recent full year to the previous year." },
    ],
  },
  general: {
    industry: "general",
    label: "General Business",
    icon: "📊",
    color: "#6366f1",
    insight: "Upload a dataset so BizInsight AI can detect your industry and show you relevant benchmarks.",
    metrics: [
      { name: "Revenue Growth (YoY)", industry_avg: 10, top_quartile: 25, unit: "%", higher_is_better: true, description: "Year-over-year revenue growth across industries", howToFind: "In your Analysis page, the Charts tab shows the revenue trend over time. Compare the last period to the same period last year." },
      { name: "Gross Margin", industry_avg: 42, top_quartile: 65, unit: "%", higher_is_better: true, description: "Revenue minus cost of goods sold / services", howToFind: "Formula: (Revenue − Cost) ÷ Revenue × 100. Find the total of your Revenue column and Cost column in the Analysis page." },
      { name: "Customer Retention Rate", industry_avg: 75, top_quartile: 92, unit: "%", higher_is_better: true, description: "% of customers retained year over year", howToFind: "Customers active in both periods ÷ customers at start of period × 100. Requires a Customer ID column and date data." },
      { name: "Customer Acquisition Cost", industry_avg: 220, top_quartile: 90, unit: "$", higher_is_better: false, description: "Cost to acquire one new customer", howToFind: "Total Marketing & Sales Spend ÷ Number of New Customers. Marketing spend typically comes from your accounting system, not a dataset." },
      { name: "Net Promoter Score", industry_avg: 32, top_quartile: 65, unit: "pts", higher_is_better: true, description: "Customer loyalty score (-100 to 100)", howToFind: "From customer surveys. Formula: % who gave 9–10 score (Promoters) − % who gave 0–6 score (Detractors). Not typically in a transactional dataset." },
      { name: "Operating Margin", industry_avg: 14, top_quartile: 28, unit: "%", higher_is_better: true, description: "Operating income as % of revenue", howToFind: "Formula: (Revenue − Operating Costs) ÷ Revenue × 100. Find Revenue total and Expense/Cost total in your Analysis page." },
    ],
  },
};

export function getBenchmarkForIndustry(industry: string): IndustryBenchmark {
  const key = industry.toLowerCase().replace(/[^a-z]/g, "");
  return INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS["general"];
}

export const ALL_INDUSTRIES = Object.values(INDUSTRY_BENCHMARKS);
