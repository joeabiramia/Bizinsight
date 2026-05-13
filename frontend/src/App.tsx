import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./newstyles.css";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import DatasetsPage from "./pages/DatasetsPage";
import AnalysisPage from "./pages/AnalysisPage";
import AIChatPage from "./pages/AIChatPage";
import ReportsPage from "./pages/ReportsPage";
import PredictionsPage from "./pages/PredictionsPage";
import ScenarioPage from "./pages/ScenarioPage";

// Phase 2 pages
import DataCleaningPage from "./pages/DataCleaningPage";
import AutomationPage from "./pages/AutomationPage";
import StrategyPage from "./pages/StrategyPage";
import GoalsPage from "./pages/GoalsPage";
import FraudPage from "./pages/FraudPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import AuditPage from "./pages/AuditPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Onboarding ── */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireOnboarding={false}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* ── Core protected ── */}
          <Route path="/dashboard"           element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/upload"              element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/datasets"            element={<ProtectedRoute><DatasetsPage /></ProtectedRoute>} />
          <Route path="/analysis/:fileId"    element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />

          {/* ── Phase 1 enterprise ── */}
          <Route path="/reports/:fileId"     element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports"             element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/predictions/:fileId" element={<ProtectedRoute><PredictionsPage /></ProtectedRoute>} />
          <Route path="/predictions"         element={<ProtectedRoute><PredictionsPage /></ProtectedRoute>} />
          <Route path="/scenarios/:fileId"   element={<ProtectedRoute><ScenarioPage /></ProtectedRoute>} />
          <Route path="/scenarios"           element={<ProtectedRoute><ScenarioPage /></ProtectedRoute>} />
          <Route path="/ai-chat"             element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
          <Route path="/ai-chat/:fileId"     element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />

          {/* ── Phase 2 enterprise ── */}
          <Route path="/data-cleaning/:fileId" element={<ProtectedRoute><DataCleaningPage /></ProtectedRoute>} />
          <Route path="/data-cleaning"         element={<ProtectedRoute><DataCleaningPage /></ProtectedRoute>} />
          <Route path="/automation/:fileId"    element={<ProtectedRoute><AutomationPage /></ProtectedRoute>} />
          <Route path="/automation"            element={<ProtectedRoute><AutomationPage /></ProtectedRoute>} />
          <Route path="/strategy/:fileId"      element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
          <Route path="/strategy"              element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
          <Route path="/goals/:fileId"         element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
          <Route path="/goals"                 element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
          <Route path="/fraud/:fileId"         element={<ProtectedRoute><FraudPage /></ProtectedRoute>} />
          <Route path="/fraud"                 element={<ProtectedRoute><FraudPage /></ProtectedRoute>} />
          <Route path="/market-intel/:fileId"  element={<ProtectedRoute><MarketIntelPage /></ProtectedRoute>} />
          <Route path="/market-intel"          element={<ProtectedRoute><MarketIntelPage /></ProtectedRoute>} />
          <Route path="/audit"                 element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
