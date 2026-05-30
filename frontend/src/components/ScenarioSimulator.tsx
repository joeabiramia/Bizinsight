import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScenarioResponse } from "../types";
import { simulateScenario } from "../services/api";

interface Props {
  fileId: string;
  onResult?: (result: ScenarioResponse) => void;
}

interface SliderInput {
  key: keyof typeof DEFAULT_SCENARIO;
  label: string;
  icon: string;
  description: string;
  min: number;
  max: number;
}

const SLIDERS: SliderInput[] = [
  { key: "price_change_pct",     label: "Price Change",       icon: "💲", description: "Adjust product/service pricing",         min: -50, max: 100 },
  { key: "volume_change_pct",    label: "Volume Change",      icon: "📦", description: "Change sales volume / demand",           min: -50, max: 100 },
  { key: "marketing_change_pct", label: "Marketing Spend",    icon: "📣", description: "Increase or reduce marketing investment", min: -80, max: 200 },
  { key: "staff_change_pct",     label: "Headcount Change",   icon: "👥", description: "Change sales team size",                  min: -50, max: 100 },
  { key: "cost_change_pct",      label: "Cost Change",        icon: "⚙️", description: "Adjust operational costs",               min: -50, max: 50  },
];

const DEFAULT_SCENARIO = {
  price_change_pct: 0,
  volume_change_pct: 0,
  marketing_change_pct: 0,
  staff_change_pct: 0,
  cost_change_pct: 0,
};

export default function ScenarioSimulator({ fileId, onResult }: Props) {
  const [scenario, setScenario] = useState({ ...DEFAULT_SCENARIO });
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSlider = (key: keyof typeof DEFAULT_SCENARIO, value: number) => {
    setScenario(prev => ({ ...prev, [key]: value }));
    setResult(null);
  };

  const handleReset = () => {
    setScenario({ ...DEFAULT_SCENARIO });
    setResult(null);
    setError(null);
    onResult?.(null as unknown as ScenarioResponse);
  };

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await simulateScenario(fileId, scenario);
      setResult(res.data);
      onResult?.(res.data);
    } catch {
      setError("Simulation failed. Ensure your dataset has numeric revenue data.");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = Object.values(scenario).some(v => v !== 0);
  const impactColor = result
    ? result.revenue_delta >= 0 ? "#4ade80" : "#f87171"
    : "var(--text)";

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Scenario Simulation</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
            Adjust business variables and predict revenue impact
          </p>
        </div>
        {hasChanges && (
          <button className="button button-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }} onClick={handleReset}>
            Reset
          </button>
        )}
      </div>

      <div className="scenario-grid">
        {/* Sliders panel */}
        <div className="scenario-sliders">
          {SLIDERS.map(slider => {
            const val = scenario[slider.key];
            const sign = val > 0 ? "+" : "";
            return (
              <div key={slider.key} className="scenario-slider-item">
                <div className="scenario-slider-header">
                  <span className="scenario-slider-icon">{slider.icon}</span>
                  <div>
                    <div className="scenario-slider-label">{slider.label}</div>
                    <div className="scenario-slider-desc">{slider.description}</div>
                  </div>
                  <span
                    className="scenario-slider-value"
                    style={{ color: val > 0 ? "#4ade80" : val < 0 ? "#f87171" : "var(--muted)" }}
                  >
                    {sign}{val}%
                  </span>
                </div>
                <input
                  type="range"
                  className="scenario-range"
                  min={slider.min}
                  max={slider.max}
                  step={1}
                  value={val}
                  onChange={e => handleSlider(slider.key, Number(e.target.value))}
                />
                <div className="scenario-range-labels">
                  <span>{slider.min}%</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>0%</span>
                  <span>{slider.max > 0 ? "+" : ""}{slider.max}%</span>
                </div>
              </div>
            );
          })}

          <button
            className="button button-primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={handleSimulate}
            disabled={loading || !hasChanges}
          >
            {loading ? "Simulating…" : "Run Simulation"}
          </button>
        </div>

        {/* Results panel */}
        <div className="scenario-results">
          <AnimatePresence mode="wait">
            {!result && !error && (
              <motion.div
                key="empty"
                className="scenario-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span style={{ fontSize: "2.5rem" }}>🎯</span>
                <h3>Adjust the sliders</h3>
                <p>Move the controls on the left to model different business scenarios and see the predicted revenue impact.</p>
              </motion.div>
            )}

            {error && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="alert alert-error">{error}</div>
              </motion.div>
            )}

            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* Main impact */}
                <div className="scenario-impact-card" style={{ borderColor: impactColor }}>
                  <div className="scenario-impact-label">Projected Revenue</div>
                  <div className="scenario-impact-value" style={{ color: impactColor }}>
                    ${result.projected_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="scenario-impact-delta" style={{ color: impactColor }}>
                    {result.revenue_delta >= 0 ? "+" : ""}
                    ${result.revenue_delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {" "}({result.total_revenue_impact_pct >= 0 ? "+" : ""}{result.total_revenue_impact_pct}%)
                  </div>
                  <div className="scenario-base-rev">
                    Base: ${result.base_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Explanations */}
                {result.explanations.length > 0 && (
                  <div className="scenario-explanations">
                    {result.explanations.map((exp, i) => (
                      <div key={i} className="scenario-explanation-item">
                        <span className="scenario-exp-dot">→</span>
                        <span>{exp}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="scenario-confidence">
                  Confidence: <strong>{result.confidence}</strong>
                </div>
                <p className="pred-disclaimer" style={{ marginTop: 8 }}>{result.disclaimer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
