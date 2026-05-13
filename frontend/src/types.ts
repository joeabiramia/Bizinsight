// ── Auth ──────────────────────────────────────────────────────────────────────

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

// ── Dataset ───────────────────────────────────────────────────────────────────

export interface DatasetRecord {
  file_id: string;
  filename: string;
  created_at?: string;
  updated_at?: string;
}

// ── Charts / Analysis ─────────────────────────────────────────────────────────

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
  shape: { rows: number; columns: number };
  data_types: Record<string, string>;
  missing_values: Record<string, number>;
  statistics: Record<string, unknown>;
  correlations: Record<string, unknown>;
  preview: Record<string, unknown>[];
  industry?: string;
  column_types?: { numeric: string[]; categorical: string[]; datetime: string[] };
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

// ── AI Chat ───────────────────────────────────────────────────────────────────

export interface AIResponse {
  question: string;
  supported: boolean;
  answer: string;
  intent?: string;
  source?: string;
  grounded?: boolean;
  model?: string;
  insights?: string[];
}

// ── Preview ───────────────────────────────────────────────────────────────────

export interface PreviewData {
  file_id: string;
  filename: string;
  shape: { rows: number; columns: number };
  columns: string[];
  preview: Record<string, unknown>[];
}

// ── Insights ──────────────────────────────────────────────────────────────────

export type InsightType = "revenue" | "opportunity" | "risk" | "performance";
export type InsightPriority = "critical" | "high" | "medium" | "low";

export interface BusinessInsight {
  type: InsightType;
  title: string;
  observation: string;
  interpretation: string;
  action: string;
  priority?: InsightPriority;
  priority_score?: number;
  urgency?: string;
  confidence?: string;
}

export interface InsightsReport {
  insights: BusinessInsight[];
  summary: string;
  industry_mode?: string;
  industry_context?: Record<string, unknown>;
  priority_breakdown?: Record<string, number>;
}

export interface ExplainabilityData {
  source_data: Array<{
    column: string;
    total: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    count: number;
  }>;
  row_count: number;
  column_count: number;
  calculations: string[];
  chart_evidence: Array<{
    chart_type: string;
    x_axis: string;
    y_axis: string;
    data: ChartPoint[];
  }>;
  confidence_level: string;
  confidence_explanation: string;
  data_freshness: string;
  reasoning: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationSeverity = "critical" | "warning" | "info";

export interface Notification {
  notification_id: string;
  user_id: string;
  file_id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  type: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

// ── Health Score ──────────────────────────────────────────────────────────────

export interface HealthScoreDimension {
  score: number;
  grade: string;
  color: "green" | "yellow" | "red";
  label: string;
  explanation: string;
}

export interface HealthScores {
  overall: HealthScoreDimension;
  revenue_stability: HealthScoreDimension;
  growth: HealthScoreDimension;
  risk: HealthScoreDimension;
}

// ── Predictions ───────────────────────────────────────────────────────────────

export interface PredictionPoint {
  period: string;
  actual: number;
  fitted: number;
}

export interface ForecastPoint {
  period: string;
  forecast: number;
  ci_lower: number;
  ci_upper: number;
}

export interface ColumnPrediction {
  label: string;
  column: string;
  historical: PredictionPoint[];
  forecast: ForecastPoint[];
  trend_direction: "upward" | "downward";
  trend_pct_per_period: number;
  r2_score: number;
  std_error: number;
  horizon_periods: number;
}

export interface PredictionsResponse {
  predictions: Record<string, ColumnPrediction>;
  date_column: string | null;
  has_time_series: boolean;
  forecast_horizon: number;
  model: string;
  errors: string[];
  summary: string;
}

// ── Anomalies ─────────────────────────────────────────────────────────────────

export interface AnomalyPoint {
  row_index: number;
  value: number;
  deviation_sigma: number;
  severity: "critical" | "warning";
}

export interface ColumnAnomalyInfo {
  count: number;
  percentage: number;
  normal_mean: number | null;
  normal_std: number | null;
  anomaly_points: AnomalyPoint[];
}

export interface ChartSeriesPoint {
  index: number;
  value: number;
  anomaly: boolean;
}

export interface AnomaliesResponse {
  file_id: string;
  total_anomaly_rows: number;
  anomaly_rate_pct: number;
  columns_with_anomalies: number;
  column_anomalies: Record<string, ColumnAnomalyInfo>;
  chart_series: Record<string, ChartSeriesPoint[]>;
  summary: string;
}

// ── Scenario ──────────────────────────────────────────────────────────────────

export interface ScenarioRequest {
  price_change_pct: number;
  volume_change_pct: number;
  marketing_change_pct: number;
  staff_change_pct: number;
  cost_change_pct: number;
}

export interface ScenarioResponse {
  base_revenue: number;
  projected_revenue: number;
  revenue_delta: number;
  total_revenue_impact_pct: number;
  scenario_results: Record<string, Record<string, number>>;
  explanations: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
  disclaimer: string;
}

// ── Phase 2: Data Cleaning ────────────────────────────────────────────────────

export type CleaningIssueSeverity = "high" | "medium" | "low";

export interface DataQualityIssue {
  column: string;
  issue_type: string;
  severity: CleaningIssueSeverity;
  count: number;
  percentage: number;
  description: string;
  suggestion: string;
  fix_label: string;
  bounds?: { lower: number; upper: number };
}

export interface DataQualityReport {
  file_id: string;
  total_issues: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  quality_score: number;
  quality_grade: string;
  issues: DataQualityIssue[];
  rows: number;
  columns: number;
  summary: string;
}

// ── Phase 2: Automation ───────────────────────────────────────────────────────

export interface AutomationCondition {
  id: string;
  label: string;
  params: Array<{ key: string; label: string; default: number }>;
  icon: string;
}

export interface AutomationAction {
  id: string;
  label: string;
  icon: string;
}

export interface AutomationRule {
  rule_id: string;
  user_id: string;
  name: string;
  condition_id: string;
  params: Record<string, number | string>;
  action_id: string;
  action_message?: string;
  active: boolean;
  created_at: string;
  trigger_count: number;
}

export interface AutomationResult {
  rule_id: string;
  rule_name: string;
  condition_id: string;
  action_id?: string;
  triggered: boolean;
  reason: string;
  action_data?: Record<string, unknown>;
}

export interface AutomationHistoryEntry {
  history_id: string;
  user_id: string;
  file_id: string;
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  reason: string;
  triggered_at: string;
}

// ── Phase 2: Strategy ─────────────────────────────────────────────────────────

export interface StrategyPlan {
  file_id: string;
  question: string;
  strategy: string;
  analysis: string;
  priority_actions: string[];
  expected_impact: string;
  risks: string[];
  timeline: string;
  kpis_to_monitor: string[];
  source: "ai_generated" | "rule_based";
  grounded: boolean;
}

// ── Phase 2: Goals ────────────────────────────────────────────────────────────

export interface GoalType {
  id: string;
  label: string;
  unit: string;
  icon: string;
}

export interface Goal {
  goal_id: string;
  user_id: string;
  name: string;
  goal_type: string;
  target_value: number;
  description?: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  current_value: number;
  target_value: number;
  progress_pct: number;
  status: "achieved" | "on_track" | "at_risk" | "behind" | "no_target";
  gap: number;
  column_used: string | null;
  ai_recommendation: string;
}

export interface GoalWithProgress extends Goal {
  progress?: GoalProgress | null;
}

// ── Phase 2: Fraud Detection ──────────────────────────────────────────────────

export type FraudAlertType =
  | "high_discount"
  | "abnormal_amount"
  | "high_frequency_customer"
  | "performance_spike"
  | "off_hours_activity";

export interface FraudAlert {
  type: FraudAlertType;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  row_index?: number;
  column: string;
  value: string | number | null;
  recommendation: string;
  transaction_count?: number;
  total_amount?: number;
  z_score?: number;
}

export interface FraudReport {
  file_id: string;
  total_alerts: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  risk_score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  alerts: FraudAlert[];
  columns_analyzed: Record<string, string | null>;
  summary: string;
}

// ── Phase 2: Market Intelligence ──────────────────────────────────────────────

export interface MarketTrend {
  title: string;
  direction: "positive" | "negative" | "neutral";
  impact: "high" | "medium" | "low";
  summary: string;
  source: string;
}

export interface MarketAlert {
  type: string;
  severity: string;
  title: string;
  message: string;
  action: string;
}

export interface MarketIntelligence {
  industry: string;
  as_of_date: string;
  data_source: string;
  integration_note: string;
  market_trends: MarketTrend[];
  industry_benchmarks: Record<string, number>;
  currency_rates: Record<string, string | number>;
  market_alerts: MarketAlert[];
  contextual_recommendations?: Array<{
    type: string;
    source: string;
    title: string;
    insight: string;
    action: string;
    source_label: string;
  }>;
}

// ── Phase 2: Audit Logs ───────────────────────────────────────────────────────

export interface AuditLogEntry {
  audit_id: string;
  user_id: string;
  action: string;
  action_label: string;
  resource_type: string;
  resource_id: string;
  resource_icon: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

// ── Phase 2: Real-Time ────────────────────────────────────────────────────────

export interface LiveKPI {
  metric: string;
  total: number;
  average: number;
  latest: number;
  trend: "up" | "down";
  change_pct: number;
}

export interface LiveKPISnapshot {
  file_id: string;
  snapshot_at: string;
  kpis: LiveKPI[];
  live_points: Array<{
    point_id: string;
    metric: string;
    value: number;
    timestamp: string;
  }>;
  total_rows: number;
  auto_refresh_interval_seconds: number;
}
