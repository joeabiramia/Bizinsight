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

export interface NumericColumnSummary {
  total: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p90: number;
}

export interface CategoricalColumnSummary {
  unique_count: number;
  top_value: string | null;
  top_count: number;
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
  column_types?: {
    numeric: string[];
    categorical: string[];
    datetime: string[];
  };
  numeric_summary?: Record<string, NumericColumnSummary>;
  categorical_summary?: Record<string, CategoricalColumnSummary>;
  chart_data: {
    kpi_means: ChartPoint[];
    breakdowns?: Record<string, { value_column: string | null; data: ChartPoint[] }>;
    category_counts?: Record<string, ChartPoint[]>;
    distributions?: Record<string, { range: string; count: number }[]>;
    time_series?: { month: string; value: number }[];
    time_series_meta?: { date_column: string; value_column: string };
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
