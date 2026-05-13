import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("bizinsight_token");
      delete api.defaults.headers.common["Authorization"];
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginUser = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

export const registerUser = (email: string, password: string, name: string) =>
  api.post("/auth/register", { email, password, name });

export const getMe = () => api.get("/auth/me");

export const completeOnboarding = (data: {
  business_type: string;
  company_size: string;
  goal: string;
  data_types: string[];
  user_role: string;
}) => api.post("/auth/onboarding", data);

// ── Datasets ──────────────────────────────────────────────────────────────────

export const uploadFile = (formData: FormData) =>
  api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const listDatasets = () => api.get("/datasets");

export const fetchDatasetPreview = (fileId: string) =>
  api.get(`/dataset-preview/${fileId}`);

// ── Analysis ──────────────────────────────────────────────────────────────────

export const fetchAnalysis = (fileId: string) => api.get(`/analysis/${fileId}`);
export const triggerAnalysis = (fileId: string) => api.post(`/analyze-file/${fileId}`);

// ── Charts ────────────────────────────────────────────────────────────────────

export const fetchCharts = (fileId: string) => api.get(`/charts/${fileId}`);

// ── Insights ──────────────────────────────────────────────────────────────────

export const fetchInsights = (fileId: string, mode = "") =>
  api.get(`/insights/${fileId}`, { params: mode ? { mode } : {} });

export const explainInsight = (fileId: string, insightIndex: number, mode = "") =>
  api.get(`/insights/${fileId}/explain/${insightIndex}`, { params: mode ? { mode } : {} });

export const listIndustryModes = () => api.get("/industry-modes");

// ── AI Chat ───────────────────────────────────────────────────────────────────

export const askAiQuestion = (fileId: string, question: string) =>
  api.post(`/ai-chat/${fileId}`, { question });

export const fetchAiSuggestions = (fileId: string) =>
  api.get(`/ai-chat/suggestions/${fileId}`);

// ── Reports ───────────────────────────────────────────────────────────────────

export const downloadReportPdf = (fileId: string): string =>
  `${baseURL}/reports/${fileId}/pdf`;

export const downloadReportPptx = (fileId: string): string =>
  `${baseURL}/reports/${fileId}/pptx`;

export const downloadReportExcel = (fileId: string): string =>
  `${baseURL}/reports/${fileId}/excel`;

export const downloadWithAuth = async (url: string, filename: string): Promise<void> => {
  const response = await api.get(url.replace(baseURL, ""), { responseType: "blob" });
  const blob = new Blob([response.data]);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const generateNotifications = (fileId: string) =>
  api.post(`/notifications/generate/${fileId}`);

export const fetchNotifications = () => api.get("/notifications");
export const markNotificationRead = (id: string) => api.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put("/notifications/read-all");
export const deleteNotification = (id: string) => api.delete(`/notifications/${id}`);

// ── Health Score ──────────────────────────────────────────────────────────────

export const fetchHealthScore = (fileId: string) => api.get(`/health-score/${fileId}`);

// ── Predictions ───────────────────────────────────────────────────────────────

export const fetchPredictions = (fileId: string) => api.get(`/predictions/${fileId}`);

// ── Anomalies ─────────────────────────────────────────────────────────────────

export const fetchAnomalies = (fileId: string) => api.get(`/anomalies/${fileId}`);

// ── Scenarios ─────────────────────────────────────────────────────────────────

export const simulateScenario = (
  fileId: string,
  scenario: {
    price_change_pct: number;
    volume_change_pct: number;
    marketing_change_pct: number;
    staff_change_pct: number;
    cost_change_pct: number;
  }
) => api.post(`/scenarios/${fileId}/simulate`, scenario);

// ── Phase 2: Data Cleaning ────────────────────────────────────────────────────

export const analyzeDataQuality = (fileId: string) =>
  api.get(`/data-cleaning/${fileId}/analyze`);

export const applyDataFixes = (fileId: string, fixes: object[]) =>
  api.post(`/data-cleaning/${fileId}/apply`, { fixes });

// ── Phase 2: Automation ───────────────────────────────────────────────────────

export const fetchAutomationConditions = () => api.get("/automation/conditions");
export const fetchAutomationActions = () => api.get("/automation/actions");
export const fetchAutomationRules = () => api.get("/automation/rules");
export const createAutomationRule = (rule: {
  name: string;
  condition_id: string;
  params: Record<string, number>;
  action_id: string;
  action_message?: string;
  active?: boolean;
}) => api.post("/automation/rules", rule);
export const deleteAutomationRule = (ruleId: string) =>
  api.delete(`/automation/rules/${ruleId}`);
export const triggerAutomation = (fileId: string) =>
  api.post(`/automation/trigger/${fileId}`);
export const fetchAutomationHistory = () => api.get("/automation/history");

// ── Phase 2: Strategy ─────────────────────────────────────────────────────────

export const generateStrategy = (fileId: string, question: string) =>
  api.post(`/strategy/${fileId}`, { question });

export const fetchStrategyExamples = () => api.get("/strategy/examples");

// ── Phase 2: Goals ────────────────────────────────────────────────────────────

export const fetchGoalTypes = () => api.get("/goals/types");
export const fetchGoals = () => api.get("/goals");
export const createGoal = (goal: {
  name: string;
  goal_type: string;
  target_value: number;
  description?: string;
  deadline?: string;
}) => api.post("/goals", goal);
export const updateGoal = (
  goalId: string,
  data: { name?: string; target_value?: number; description?: string; deadline?: string }
) => api.put(`/goals/${goalId}`, data);
export const deleteGoal = (goalId: string) => api.delete(`/goals/${goalId}`);
export const fetchGoalProgress = (goalId: string, fileId: string) =>
  api.get(`/goals/${goalId}/progress/${fileId}`);
export const fetchAllGoalsProgress = (fileId: string) =>
  api.get(`/goals/all-progress/${fileId}`);

// ── Phase 2: Fraud Detection ──────────────────────────────────────────────────

export const detectFraud = (fileId: string) => api.get(`/fraud/${fileId}`);

// ── Phase 2: Market Intelligence ──────────────────────────────────────────────

export const fetchMarketIntelligence = (industry = "") =>
  api.get("/market-intel/summary", { params: industry ? { industry } : {} });

export const fetchContextualMarketInsights = (fileId: string) =>
  api.get(`/market-intel/${fileId}/insights`);

// ── Phase 2: Audit Logs ───────────────────────────────────────────────────────

export const fetchAuditLogs = (limit = 100) =>
  api.get("/audit/logs", { params: { limit } });

// ── Phase 2: Real-Time ────────────────────────────────────────────────────────

export const pushRealtimePoint = (data: {
  file_id: string;
  metric: string;
  value: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}) => api.post("/realtime/push", data);

export const fetchLiveKPIs = (fileId: string) => api.get(`/realtime/kpis/${fileId}`);
