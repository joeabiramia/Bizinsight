type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
type Size = "sm" | "md";

interface StatusBadgeProps {
  variant?: Variant;
  label: string;
  dot?: boolean;
  size?: Size;
}

export default function StatusBadge({ variant = "neutral", label, dot = false, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={`badge badge-${variant}`}
      style={{ fontSize: size === "sm" ? "0.65rem" : undefined, padding: size === "sm" ? "1px 7px" : undefined }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "currentColor",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}
