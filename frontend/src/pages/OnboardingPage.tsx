import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { completeOnboarding } from "../services/api";

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail & E-commerce", icon: "🛍️" },
  { value: "finance", label: "Finance & Banking", icon: "💰" },
  { value: "hr", label: "Human Resources", icon: "👥" },
  { value: "logistics", label: "Logistics & Supply Chain", icon: "🚚" },
  { value: "healthcare", label: "Healthcare", icon: "🏥" },
  { value: "technology", label: "Technology / SaaS", icon: "💻" },
  { value: "manufacturing", label: "Manufacturing", icon: "🏭" },
  { value: "other", label: "Other", icon: "🏢" },
];

const COMPANY_SIZES = [
  { value: "solo", label: "Just me", sub: "Solopreneur / Freelancer" },
  { value: "small", label: "2–10 people", sub: "Small team" },
  { value: "medium", label: "11–50 people", sub: "Growing business" },
  { value: "large", label: "51–200 people", sub: "Mid-market" },
  { value: "enterprise", label: "200+ people", sub: "Enterprise" },
];

const GOALS = [
  { value: "revenue", label: "Increase revenue", icon: "📈" },
  { value: "costs", label: "Reduce costs", icon: "📉" },
  { value: "performance", label: "Track team performance", icon: "🎯" },
  { value: "forecast", label: "Forecast & plan ahead", icon: "🔭" },
  { value: "customers", label: "Understand customers better", icon: "🤝" },
  { value: "reporting", label: "Automate reporting", icon: "📋" },
];

const DATA_TYPES = [
  { value: "sales", label: "Sales data" },
  { value: "finance", label: "Financial records" },
  { value: "hr", label: "HR / headcount" },
  { value: "inventory", label: "Inventory / stock" },
  { value: "marketing", label: "Marketing metrics" },
  { value: "operations", label: "Operational data" },
  { value: "customer", label: "Customer data" },
];

const ROLES = [
  { value: "owner", label: "Business Owner / Founder", icon: "👑" },
  { value: "manager", label: "Manager / Team Lead", icon: "🧑‍💼" },
  { value: "analyst", label: "Analyst / Data Specialist", icon: "🔍" },
  { value: "finance", label: "Finance / Accounting", icon: "📊" },
  { value: "other", label: "Other", icon: "👤" },
];

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [businessType, setBusinessType] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [goal, setGoal] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [userRole, setUserRole] = useState("");

  const toggleDataType = (val: string) => {
    setDataTypes((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const canProceed = () => {
    if (step === 1) return !!businessType;
    if (step === 2) return !!companySize;
    if (step === 3) return !!goal;
    if (step === 4) return dataTypes.length > 0;
    if (step === 5) return !!userRole;
    return false;
  };

  const handleNext = () => {
    if (!canProceed()) {
      setError("Please make a selection to continue.");
      return;
    }
    setError("");
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await completeOnboarding({
        business_type: businessType,
        company_size: companySize,
        goal,
        data_types: dataTypes,
        user_role: userRole,
      });
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    "What type of business do you run?",
    "How large is your organisation?",
    "What is your primary goal?",
    "What data do you have available?",
    "What is your role?",
  ];

  const stepSubtitles = [
    "We'll tailor your KPIs and insights to your industry.",
    "This helps us suggest the right benchmarks.",
    "We'll prioritise insights that drive your most important outcome.",
    "Select all that apply — we'll focus on what you have.",
    "We'll customise your dashboard view and recommendations.",
  ];

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="onboarding-page">
      <div className="onboarding-glow" />

      <div className="onboarding-header">
        <div className="landing-logo">
          <div className="landing-logo-mark">BI</div>
          <span className="landing-logo-text">BizInsight AI</span>
        </div>
        {user && (
          <p className="onboarding-welcome">Welcome, {user.name || user.email} 👋</p>
        )}
      </div>

      <div className="onboarding-card">
        {/* Progress bar */}
        <div className="onboarding-progress-bar">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="onboarding-step-meta">
          <span className="onboarding-step-label">Step {step} of {TOTAL_STEPS}</span>
          <span className="onboarding-step-pct">{Math.round(progress)}%</span>
        </div>

        <h2 className="onboarding-title">{stepTitles[step - 1]}</h2>
        <p className="onboarding-subtitle">{stepSubtitles[step - 1]}</p>

        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* ── STEP 1: Business type ── */}
        {step === 1 && (
          <div className="onboarding-grid onboarding-grid--4">
            {BUSINESS_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-option-card${businessType === opt.value ? " onboarding-option-card--active" : ""}`}
                onClick={() => setBusinessType(opt.value)}
              >
                <span className="onboarding-option-icon">{opt.icon}</span>
                <span className="onboarding-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 2: Company size ── */}
        {step === 2 && (
          <div className="onboarding-list">
            {COMPANY_SIZES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-list-item${companySize === opt.value ? " onboarding-list-item--active" : ""}`}
                onClick={() => setCompanySize(opt.value)}
              >
                <div>
                  <strong>{opt.label}</strong>
                  <span className="onboarding-list-sub">{opt.sub}</span>
                </div>
                <div className={`onboarding-radio${companySize === opt.value ? " onboarding-radio--active" : ""}`} />
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 3: Goal ── */}
        {step === 3 && (
          <div className="onboarding-grid onboarding-grid--3">
            {GOALS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-option-card${goal === opt.value ? " onboarding-option-card--active" : ""}`}
                onClick={() => setGoal(opt.value)}
              >
                <span className="onboarding-option-icon">{opt.icon}</span>
                <span className="onboarding-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 4: Data types (multi-select) ── */}
        {step === 4 && (
          <div className="onboarding-tags">
            {DATA_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-tag${dataTypes.includes(opt.value) ? " onboarding-tag--active" : ""}`}
                onClick={() => toggleDataType(opt.value)}
              >
                {dataTypes.includes(opt.value) ? "✓ " : ""}{opt.label}
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 5: User role ── */}
        {step === 5 && (
          <div className="onboarding-grid onboarding-grid--3">
            {ROLES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-option-card${userRole === opt.value ? " onboarding-option-card--active" : ""}`}
                onClick={() => setUserRole(opt.value)}
              >
                <span className="onboarding-option-icon">{opt.icon}</span>
                <span className="onboarding-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="onboarding-nav">
          {step > 1 && (
            <button
              type="button"
              className="onboarding-back-btn"
              onClick={() => { setError(""); setStep((s) => s - 1); }}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            className={`onboarding-next-btn${!canProceed() ? " onboarding-next-btn--disabled" : ""}`}
            onClick={handleNext}
            disabled={loading}
          >
            {loading
              ? "Saving…"
              : step === TOTAL_STEPS
              ? "Complete setup →"
              : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
