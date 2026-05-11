export interface User {
  user_id: string;
  email: string;
  name: string;
  onboarding_complete: boolean;
  onboarding_data?: OnboardingData;
}

export interface OnboardingData {
  business_type: string;
  company_size: string;
  goal: string;
  data_types: string[];
  user_role: string;
}

export interface DatasetRecord {
  file_id: string;
  filename: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface QuantityBucket {
  range: string;
  count: number;
}

export interface AnalysisData {
  columns: string[];
  shape: {
    rows: number;
    columns: number;
  };
  data_types: Record<string, string>;
  missing_values: Record<string, number>;
  statistics: Record<string, any>;
  correlations: Record<string, any>;
  preview: Record<string, any>[];
  industry?: string;
  top_summary: {
    total_revenue?: number | null;
    average_quantity?: number | null;
    best_region?: { name: string; value: number } | null;
    best_salesman?: { name: string; value: number } | null;
    best_selling_product?: { name: string; value: number } | null;
  };
  chart_data: {
    kpi_means: ChartPoint[];
    product_mix: ChartPoint[];
    sales_by_region: ChartPoint[];
    sales_by_salesman: ChartPoint[];
    quantity_distribution: QuantityBucket[];
  };
  generated_at: string;
}

export interface AnalysisReport {
  file_id: string;
  filename: string;
  uploaded_at?: string;
  analysis: AnalysisData;
}

export interface AIResponse {
  question: string;
  supported: boolean;
  answer: string;
  insights?: string[];
}

export interface PreviewData {
  file_id: string;
  filename: string;
  shape: { rows: number; columns: number };
  columns: string[];
  preview: Record<string, any>[];
}

export type InsightType = "revenue" | "opportunity" | "risk" | "performance";

export interface BusinessInsight {
  type: InsightType;
  title: string;
  observation: string;
  interpretation: string;
  action: string;
}

export interface InsightsReport {
  insights: BusinessInsight[];
  summary: string;
}
