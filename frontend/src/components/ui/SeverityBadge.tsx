type Severity = "critical" | "high" | "medium" | "low";

interface SeverityBadgeProps {
  severity: Severity;
}

const labels: Record<Severity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`severity-badge severity-badge--${severity}`}>
      {labels[severity]}
    </span>
  );
}
