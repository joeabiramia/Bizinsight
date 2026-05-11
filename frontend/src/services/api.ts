import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Redirect to login on expired/invalid token
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
  api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const listDatasets = () => api.get("/datasets");

export const fetchDatasetPreview = (fileId: string) =>
  api.get(`/dataset-preview/${fileId}`);

// ── Analysis ──────────────────────────────────────────────────────────────────

export const fetchAnalysis = (fileId: string) =>
  api.get(`/analysis/${fileId}`);

export const triggerAnalysis = (fileId: string) =>
  api.post(`/analyze-file/${fileId}`);

// ── Charts ───────────────────────────────────────────────────────────────────

export const fetchCharts = (fileId: string) =>
  api.get(`/charts/${fileId}`);

// ── Insights ─────────────────────────────────────────────────────────────────

export const fetchInsights = (fileId: string) =>
  api.get(`/insights/${fileId}`);

// ── AI Chat ───────────────────────────────────────────────────────────────────

export const askAiQuestion = (fileId: string, question: string) =>
  api.post(`/ai-chat/${fileId}`, { question });

export const fetchAiSuggestions = (fileId: string) =>
  api.get(`/ai-chat/suggestions/${fileId}`);
