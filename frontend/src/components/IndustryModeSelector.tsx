interface Mode {
  id: string;
  label: string;
  kpis?: string[];
}

const MODES: Mode[] = [
  { id: "",          label: "General",       kpis: [] },
  { id: "retail",    label: "Retail",        kpis: ["Revenue", "Inventory Turnover", "Margin"] },
  { id: "ecommerce", label: "E-commerce",    kpis: ["GMV", "Conversion", "LTV"] },
  { id: "finance",   label: "Finance",       kpis: ["Margin", "ROE", "Cost-Income Ratio"] },
  { id: "sales",     label: "Sales",         kpis: ["Revenue", "Deal Size", "Win Rate"] },
  { id: "travel",    label: "Travel Agency", kpis: ["Bookings", "Occupancy", "ADR"] },
  { id: "inventory", label: "Inventory",     kpis: ["Stock Level", "Turnover", "Dead Stock"] },
];

interface Props {
  value: string;
  onChange: (mode: string) => void;
}

export default function IndustryModeSelector({ value, onChange }: Props) {
  return (
    <div className="industry-mode-selector" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 4 }}>Industry Mode:</span>
      {MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className="chip"
          onClick={() => onChange(mode.id)}
          title={mode.kpis && mode.kpis.length > 0 ? `KPIs: ${mode.kpis.join(", ")}` : "General mode"}
          style={
            value === mode.id
              ? { background: "var(--accent, #6366f1)", color: "#fff", fontWeight: 600 }
              : {}
          }
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
