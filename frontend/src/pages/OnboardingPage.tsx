import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { completeOnboarding } from "../services/api";

/* ─── Data ───────────────────────────────────────────────────────────────── */

const BUSINESS_TYPES = [
  { value: "retail",         label: "Retail & E-commerce",        icon: "🛍️" },
  { value: "finance",        label: "Finance & Banking",           icon: "💰" },
  { value: "hr",             label: "Human Resources",             icon: "👥" },
  { value: "logistics",      label: "Logistics & Supply Chain",    icon: "🚚" },
  { value: "healthcare",     label: "Healthcare",                  icon: "🏥" },
  { value: "technology",     label: "Technology / SaaS",           icon: "💻" },
  { value: "manufacturing",  label: "Manufacturing",               icon: "🏭" },
  { value: "other",          label: "Other",                       icon: "🏢" },
];

const COMPANY_SIZES = [
  { value: "solo",       label: "Just me",        sub: "Solopreneur / Freelancer" },
  { value: "small",      label: "2 – 10",         sub: "Small team" },
  { value: "medium",     label: "11 – 50",        sub: "Growing business" },
  { value: "large",      label: "51 – 200",       sub: "Mid-market" },
  { value: "enterprise", label: "200+",           sub: "Enterprise" },
];

const GOALS = [
  { value: "revenue",     label: "Increase revenue",            icon: "📈" },
  { value: "costs",       label: "Reduce costs",                icon: "📉" },
  { value: "performance", label: "Track team performance",      icon: "🎯" },
  { value: "forecast",    label: "Forecast & plan ahead",       icon: "🔭" },
  { value: "customers",   label: "Understand customers",        icon: "🤝" },
  { value: "reporting",   label: "Automate reporting",          icon: "📋" },
];

const DATA_TYPES = [
  { value: "sales",       label: "Sales data" },
  { value: "finance",     label: "Financial records" },
  { value: "hr",          label: "HR / headcount" },
  { value: "inventory",   label: "Inventory / stock" },
  { value: "marketing",   label: "Marketing metrics" },
  { value: "operations",  label: "Operational data" },
  { value: "customer",    label: "Customer data" },
];

const ROLES = [
  { value: "owner",    label: "Business Owner",     icon: "👑" },
  { value: "manager",  label: "Manager / Lead",     icon: "🧑‍💼" },
  { value: "analyst",  label: "Analyst",            icon: "🔍" },
  { value: "finance",  label: "Finance / Accounting", icon: "📊" },
  { value: "other",    label: "Other",              icon: "👤" },
];

const STEPS = [
  { title: "What type of business do you run?",   sub: "We'll tailor your KPIs and insights to your industry." },
  { title: "How large is your organisation?",     sub: "This helps us suggest the right benchmarks." },
  { title: "What is your primary goal?",          sub: "We'll prioritise insights that drive your most important outcome." },
  { title: "What data do you have available?",    sub: "Select all that apply — we'll focus on what you have." },
  { title: "What is your role?",                  sub: "We'll customise your dashboard and recommendations." },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function OptionCard({
  icon, label, selected, onClick,
}: { icon: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10,
        padding: "20px 12px", borderRadius: 16, cursor: "pointer", border: "none",
        background: selected ? "var(--primary-dim)" : "rgba(255,255,255,0.03)",
        outline: selected ? "2px solid var(--primary)" : "2px solid transparent",
        transition: "all 0.15s",
        position: "relative",
      }}
    >
      {selected && (
        <CheckCircle2
          size={16}
          style={{ position: "absolute", top: 8, right: 8, color: "var(--primary-light)" }}
        />
      )}
      <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: "0.82rem", fontWeight: 600, textAlign: "center", lineHeight: 1.3,
        color: selected ? "var(--primary-light)" : "var(--text-secondary)",
      }}>
        {label}
      </span>
    </motion.button>
  );
}

function SizeCard({
  label, sub, selected, onClick,
}: { label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderRadius: 14, cursor: "pointer", border: "none",
        background: selected ? "var(--primary-dim)" : "rgba(255,255,255,0.03)",
        outline: selected ? "2px solid var(--primary)" : "2px solid transparent",
        transition: "all 0.15s", width: "100%",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: selected ? "var(--primary-light)" : "var(--text)" }}>
          {label}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{sub}</p>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? "var(--primary)" : "var(--border-strong)"}`,
        background: selected ? "var(--primary)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
      </div>
    </motion.button>
  );
}

function TagChip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 16px", borderRadius: 999, cursor: "pointer", border: "none",
        background: selected ? "var(--primary-dim)" : "rgba(255,255,255,0.04)",
        outline: selected ? "1.5px solid var(--primary)" : "1.5px solid var(--border-strong)",
        color: selected ? "var(--primary-light)" : "var(--text-secondary)",
        fontSize: "0.875rem", fontWeight: selected ? 600 : 500,
        transition: "all 0.15s",
      }}
    >
      {selected && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
      {label}
    </motion.button>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]               = useState(1);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [direction, setDirection]     = useState(1);

  const [businessType, setBusinessType] = useState("");
  const [companySize, setCompanySize]   = useState("");
  const [goal, setGoal]                 = useState("");
  const [dataTypes, setDataTypes]       = useState<string[]>([]);
  const [userRole, setUserRole]         = useState("");

  const toggleDataType = (val: string) =>
    setDataTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const canProceed = () => {
    if (step === 1) return !!businessType;
    if (step === 2) return !!companySize;
    if (step === 3) return !!goal;
    if (step === 4) return dataTypes.length > 0;
    if (step === 5) return !!userRole;
    return false;
  };

  const goNext = () => {
    if (!canProceed()) { setError("Please make a selection to continue."); return; }
    setError("");
    if (step < 5) { setDirection(1); setStep(s => s + 1); }
    else handleSubmit();
  };

  const goBack = () => {
    setError(""); setDirection(-1); setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      await completeOnboarding({ business_type: businessType, company_size: companySize, goal, data_types: dataTypes, user_role: userRole });
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter:  (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit:   (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: "32px 16px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
        <div className="brand-mark" style={{ width: 34, height: 34, fontSize: "0.78rem" }}>BI</div>
        <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>BizInsight AI</span>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 620,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 24, padding: "40px 44px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
      }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, alignItems: "center" }}>
          {[1,2,3,4,5].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: n < step ? "var(--primary-light)" : n === step ? "var(--primary)" : "var(--border)",
              transition: "background 0.3s",
            }} />
          ))}
          <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
            {step} / 5
          </span>
        </div>

        {/* Welcome line */}
        {step === 1 && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ margin: "0 0 6px", fontSize: "0.875rem", color: "var(--primary-light)", fontWeight: 600 }}
          >
            Welcome, {firstName} 👋
          </motion.p>
        )}

        {/* Step header */}
        <h2 style={{ margin: "0 0 6px", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
          {STEPS[step - 1].title}
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {STEPS[step - 1].sub}
        </p>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{
                marginBottom: 20, padding: "10px 14px", borderRadius: 10,
                background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5", fontSize: "0.84rem",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step content */}
        <div style={{ position: "relative", minHeight: 220 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
            >

              {/* Step 1 — Business type */}
              {step === 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {BUSINESS_TYPES.map(opt => (
                    <OptionCard key={opt.value} icon={opt.icon} label={opt.label}
                      selected={businessType === opt.value} onClick={() => { setBusinessType(opt.value); setError(""); }} />
                  ))}
                </div>
              )}

              {/* Step 2 — Company size */}
              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {COMPANY_SIZES.map(opt => (
                    <SizeCard key={opt.value} label={opt.label} sub={opt.sub}
                      selected={companySize === opt.value} onClick={() => { setCompanySize(opt.value); setError(""); }} />
                  ))}
                </div>
              )}

              {/* Step 3 — Goal */}
              {step === 3 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {GOALS.map(opt => (
                    <OptionCard key={opt.value} icon={opt.icon} label={opt.label}
                      selected={goal === opt.value} onClick={() => { setGoal(opt.value); setError(""); }} />
                  ))}
                </div>
              )}

              {/* Step 4 — Data types */}
              {step === 4 && (
                <div>
                  <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>
                    SELECT ALL THAT APPLY
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {DATA_TYPES.map(opt => (
                      <TagChip key={opt.value} label={opt.label}
                        selected={dataTypes.includes(opt.value)} onClick={() => { toggleDataType(opt.value); setError(""); }} />
                    ))}
                  </div>
                  {dataTypes.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ margin: "14px 0 0", fontSize: "0.78rem", color: "var(--primary-light)", fontWeight: 600 }}
                    >
                      {dataTypes.length} selected
                    </motion.p>
                  )}
                </div>
              )}

              {/* Step 5 — Role */}
              {step === 5 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {ROLES.map(opt => (
                    <OptionCard key={opt.value} icon={opt.icon} label={opt.label}
                      selected={userRole === opt.value} onClick={() => { setUserRole(opt.value); setError(""); }} />
                  ))}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
          {step > 1 ? (
            <motion.button
              type="button"
              onClick={goBack}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 20px", borderRadius: 12, border: "1px solid var(--border-strong)",
                background: "transparent", color: "var(--text-secondary)",
                fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              <ArrowLeft size={15} /> Back
            </motion.button>
          ) : (
            <div />
          )}

          <motion.button
            type="button"
            onClick={goNext}
            disabled={loading}
            whileHover={loading ? {} : { scale: 1.02 }}
            whileTap={loading ? {} : { scale: 0.98 }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "11px 28px", borderRadius: 12, border: "none",
              background: canProceed()
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : "rgba(99,102,241,0.3)",
              color: "white",
              fontSize: "0.95rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              boxShadow: canProceed() ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
              transition: "all 0.2s",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />
                Saving…
              </>
            ) : step === 5 ? (
              <><CheckCircle2 size={16} /> Complete setup</>
            ) : (
              <>Continue <ArrowRight size={15} /></>
            )}
          </motion.button>
        </div>
      </div>

      {/* Skip */}
      <button
        type="button"
        style={{ marginTop: 20, background: "none", border: "none", color: "var(--muted)", fontSize: "0.82rem", cursor: "pointer" }}
        onClick={() => navigate("/dashboard", { replace: true })}
      >
        Skip for now →
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
