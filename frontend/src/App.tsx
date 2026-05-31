import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./newstyles.css";

// Public & Auth
import LandingPage from "./pages/LandingPage";
import DemoPage from "./pages/DemoPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import JoinWorkspacePage from "./pages/JoinWorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";
import SettingsPage from "./pages/SettingsPage";
import ErrorBoundary from "./components/ErrorBoundary";

// Core
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import DatasetsPage from "./pages/DatasetsPage";
import AnalysisPage from "./pages/AnalysisPage";
import AIChatPage from "./pages/AIChatPage";
import ReportsPage from "./pages/ReportsPage";
import PredictionsPage from "./pages/PredictionsPage";
import ScenarioPage from "./pages/ScenarioPage";

// Phase 2
import DataCleaningPage from "./pages/DataCleaningPage";
import AutomationPage from "./pages/AutomationPage";
import StrategyPage from "./pages/StrategyPage";
import GoalsPage from "./pages/GoalsPage";
import FraudPage from "./pages/FraudPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import AuditPage from "./pages/AuditPage";

// Phase 3-4
import GoogleSheetsPage from "./pages/GoogleSheetsPage";
import ExcelOnlinePage from "./pages/ExcelOnlinePage";
import ShopifyPage from "./pages/ShopifyPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SharedDashboardPage from "./pages/SharedDashboardPage";
import ComparisonPage from "./pages/ComparisonPage";
import DashboardBuilderPage from "./pages/DashboardBuilderPage";
import GoalForecastPage from "./pages/GoalForecastPage";

// New feature pages
import BenchmarkPage from "./pages/BenchmarkPage";
import DigestSettingsPage from "./pages/DigestSettingsPage";
import WorkspacePage from "./pages/WorkspacePage";

const P = ProtectedRoute;

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/"      element={<LandingPage />} />
          <Route path="/demo"  element={<DemoPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/verify-email"    element={<VerifyEmailPage />} />
          <Route path="/join"            element={<JoinWorkspacePage />} />

          {/* ── Onboarding ─────────────────────────────────────────── */}
          <Route path="/onboarding" element={<P requireOnboarding={false}><OnboardingPage /></P>} />

          {/* ── Core ───────────────────────────────────────────────── */}
          <Route path="/dashboard"           element={<P><DashboardPage /></P>} />
          <Route path="/upload"              element={<P><UploadPage /></P>} />
          <Route path="/datasets"            element={<P><DatasetsPage /></P>} />
          <Route path="/analysis/:fileId"    element={<P><AnalysisPage /></P>} />

          {/* ── Analysis tools ─────────────────────────────────────── */}
          <Route path="/reports/:fileId"     element={<P><ReportsPage /></P>} />
          <Route path="/reports"             element={<P><ReportsPage /></P>} />
          <Route path="/predictions/:fileId" element={<P><PredictionsPage /></P>} />
          <Route path="/predictions"         element={<P><PredictionsPage /></P>} />
          <Route path="/scenarios/:fileId"   element={<P><ScenarioPage /></P>} />
          <Route path="/scenarios"           element={<P><ScenarioPage /></P>} />
          <Route path="/ai-chat"             element={<P><AIChatPage /></P>} />
          <Route path="/ai-chat/:fileId"     element={<P><AIChatPage /></P>} />

          {/* ── Data tools ─────────────────────────────────────────── */}
          <Route path="/data-cleaning/:fileId" element={<P><DataCleaningPage /></P>} />
          <Route path="/data-cleaning"         element={<P><DataCleaningPage /></P>} />
          <Route path="/automation/:fileId"    element={<P><AutomationPage /></P>} />
          <Route path="/automation"            element={<P><AutomationPage /></P>} />

          {/* ── Strategy & Goals ───────────────────────────────────── */}
          <Route path="/strategy/:fileId"    element={<P><StrategyPage /></P>} />
          <Route path="/strategy"            element={<P><StrategyPage /></P>} />
          <Route path="/goals/:fileId"       element={<P><GoalsPage /></P>} />
          <Route path="/goals"               element={<P><GoalsPage /></P>} />
          <Route path="/goal-forecast"       element={<P><GoalForecastPage /></P>} />
          <Route path="/goal-forecast/:fileId" element={<P><GoalForecastPage /></P>} />

          {/* ── Risk & Intelligence ────────────────────────────────── */}
          <Route path="/fraud/:fileId"       element={<P><FraudPage /></P>} />
          <Route path="/fraud"               element={<P><FraudPage /></P>} />
          <Route path="/market-intel/:fileId" element={<P><MarketIntelPage /></P>} />
          <Route path="/market-intel"        element={<P><MarketIntelPage /></P>} />
          <Route path="/benchmark"           element={<P><BenchmarkPage /></P>} />
          <Route path="/audit"               element={<P><AuditPage /></P>} />

          {/* ── Integrations ───────────────────────────────────────── */}
          <Route path="/integrations"        element={<P><IntegrationsPage /></P>} />
          <Route path="/google-sheets"       element={<P><GoogleSheetsPage /></P>} />
          <Route path="/excel-online"        element={<P><ExcelOnlinePage /></P>} />
          <Route path="/shopify"             element={<P><ShopifyPage /></P>} />

          {/* ── Automation & Alerts ────────────────────────────────── */}
          <Route path="/digest"              element={<P><DigestSettingsPage /></P>} />

          {/* ── Dashboards ─────────────────────────────────────────── */}
          <Route path="/compare"             element={<P><ComparisonPage /></P>} />
          <Route path="/dashboard-builder"   element={<P><DashboardBuilderPage /></P>} />

          {/* ── Team & Settings ────────────────────────────────────── */}
          <Route path="/workspace"           element={<P><WorkspacePage /></P>} />
          <Route path="/settings"            element={<P><SettingsPage /></P>} />

          {/* ── Public/shared ──────────────────────────────────────── */}
          <Route path="/public/dashboard/:token" element={<SharedDashboardPage />} />

          {/* ── Fallback ───────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
