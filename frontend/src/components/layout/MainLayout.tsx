import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useSessionExpiringSoon } from "../../context/AuthContext";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

function SessionExpiryBanner() {
  const expiringSoon = useSessionExpiringSoon();
  const [dismissed, setDismissed] = useState(false);

  if (!expiringSoon || dismissed) return null;

  return (
    <div style={{
      background: "rgba(245,158,11,0.10)",
      border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 10, margin: "0 0 16px",
      padding: "10px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      fontSize: "0.85rem",
    }}>
      <span style={{ color: "#f59e0b", fontWeight: 600 }}>
        ⚠️ Your session expires soon — you'll be logged out automatically.
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          className="button button-secondary button-sm"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        {(title || subtitle) && (
          <div className="page-hero" style={{ marginBottom: 20 }}>
            <div>
              {subtitle && <p className="eyebrow">{subtitle}</p>}
              {title && <h1 style={{ margin: 0 }}>{title}</h1>}
            </div>
          </div>
        )}
        <main className="page-content">
          <SessionExpiryBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
