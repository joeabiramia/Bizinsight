interface ConnectorCardProps {
  logo: string;
  name: string;
  description: string;
  status: "connected" | "available" | "coming_soon";
  badge?: string;
  lastSynced?: string | null;
  rowCount?: number;
  onClick?: () => void;
  onViewDashboard?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const STATUS_STYLES = {
  connected: {
    dot: "#22c55e",
    label: "Connected",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
    color: "#22c55e",
  },
  available: {
    dot: "#3b82f6",
    label: "Available",
    bg: "rgba(59,130,246,0.06)",
    border: "rgba(59,130,246,0.18)",
    color: "#3b82f6",
  },
  coming_soon: {
    dot: "#6b7280",
    label: "Coming Soon",
    bg: "rgba(107,114,128,0.06)",
    border: "rgba(107,114,128,0.15)",
    color: "#6b7280",
  },
};

export default function ConnectorCard({
  logo,
  name,
  description,
  status,
  badge,
  lastSynced,
  rowCount,
  onClick,
  onViewDashboard,
  onRefresh,
  refreshing,
}: ConnectorCardProps) {
  const s = STATUS_STYLES[status];
  const isDisabled = status === "coming_soon";

  return (
    <div
      style={{
        background: "var(--surface, #1e1e2e)",
        border: `1px solid ${s.border}`,
        borderRadius: 16,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        opacity: isDisabled ? 0.65 : 1,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${s.border}`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: "0.65rem",
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 20,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </span>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: s.bg,
            border: `1px solid ${s.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.6rem",
            flexShrink: 0,
          }}
        >
          {logo}
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {name}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: s.dot,
                flexShrink: 0,
                animation: status === "connected" ? "livePulse 2s infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: s.color,
              }}
            >
              {s.label}
            </span>
            {status === "connected" && rowCount !== undefined && (
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                · {rowCount.toLocaleString()} rows
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: "0.84rem",
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      {/* Last synced */}
      {lastSynced && status === "connected" && (
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{ color: "#22c55e" }}>✓</span>
          Synced {new Date(lastSynced).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        {status === "connected" && onViewDashboard && (
          <button
            type="button"
            onClick={onViewDashboard}
            className="button button-primary"
            style={{ flex: 1, fontSize: "0.82rem", padding: "8px 14px" }}
          >
            View Dashboard →
          </button>
        )}
        {status === "connected" && onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="button button-secondary"
            style={{ fontSize: "0.82rem", padding: "8px 14px" }}
          >
            {refreshing ? "..." : "↻"}
          </button>
        )}
        {status === "available" && onClick && (
          <button
            type="button"
            onClick={onClick}
            className="button button-secondary"
            style={{ flex: 1, fontSize: "0.82rem", padding: "8px 14px" }}
          >
            Connect →
          </button>
        )}
        {status === "coming_soon" && (
          <button
            type="button"
            disabled
            className="button button-secondary"
            style={{ flex: 1, fontSize: "0.82rem", padding: "8px 14px", opacity: 0.5 }}
          >
            Coming Soon
          </button>
        )}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
