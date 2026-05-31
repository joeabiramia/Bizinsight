import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  LayoutDashboard, Upload, Database, Bot, LayoutTemplate,
  GitCompare, Target, Plug, FileSpreadsheet, ShoppingBag,
  Settings, Map, Shield, ClipboardList,
  BarChart2, FileText, TrendingUp, Wand2, Sparkles,
  Globe, LogOut, ChevronRight, Users, Palette,
  TrendingDown, BookOpen, Clock,
} from "lucide-react";

type NavLink = { to: string; label: string; icon: React.ReactNode; section?: string; comingSoon?: boolean };

const staticLinks: NavLink[] = [
  { to: "/dashboard",         label: "Overview",          icon: <LayoutDashboard size={16} /> },
  { to: "/upload",            label: "Upload",            icon: <Upload size={16} /> },
  { to: "/datasets",          label: "Datasets",          icon: <Database size={16} /> },
  { to: "/ai-chat",           label: "AI Copilot",        icon: <Bot size={16} /> },
  { to: "/dashboard-builder", label: "Dashboard Builder", icon: <LayoutTemplate size={16} />, section: "Analytics" },
  { to: "/compare",           label: "Compare Datasets",  icon: <GitCompare size={16} /> },
  { to: "/benchmark",         label: "Benchmarks",        icon: <TrendingDown size={16} /> },
  { to: "/goal-forecast",     label: "Goal Forecast",     icon: <Target size={16} /> },
  { to: "/integrations",      label: "Integrations",      icon: <Plug size={16} />, section: "Live Data", comingSoon: true },
  { to: "/google-sheets",     label: "Google Sheets",     icon: <FileSpreadsheet size={16} />, comingSoon: true },
  { to: "/excel-online",      label: "Excel Online",      icon: <FileSpreadsheet size={16} />, comingSoon: true },
  { to: "/shopify",           label: "Shopify",           icon: <ShoppingBag size={16} />, comingSoon: true },
  { to: "/digest",            label: "Weekly Digest",     icon: <BookOpen size={16} />, section: "Automation" },
  { to: "/goals",             label: "Goals",             icon: <Target size={16} /> },
  { to: "/automation",        label: "Automation Rules",  icon: <Settings size={16} /> },
  { to: "/strategy",          label: "Strategy",          icon: <Map size={16} /> },
  { to: "/fraud",             label: "Fraud Detection",   icon: <Shield size={16} /> },
  { to: "/audit",             label: "Audit Logs",        icon: <ClipboardList size={16} /> },
  { to: "/workspace",         label: "Team",              icon: <Users size={16} />, section: "Workspace" },
  { to: "/settings",          label: "Account Settings",  icon: <ClipboardList size={16} /> },
];

const contextualIconMap: Record<string, React.ReactNode> = {
  analysis:      <BarChart2 size={16} />,
  reports:       <FileText size={16} />,
  predictions:   <TrendingUp size={16} />,
  scenarios:     <Wand2 size={16} />,
  "ai-chat":     <Bot size={16} />,
  "data-cleaning": <Sparkles size={16} />,
  fraud:         <Shield size={16} />,
  goals:         <Target size={16} />,
  strategy:      <Map size={16} />,
  "market-intel": <Globe size={16} />,
};

function useFileId(): string | null {
  const params = useParams<{ fileId: string }>();
  return params.fileId ?? null;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const fileId = useFileId();
  const { theme, toggleTheme } = useTheme();
  const { workspace, role, isInWorkspace, can } = useWorkspace();
  const isSolo = user?.onboarding_data?.company_size === "solo";

  const isActive = (to: string) => {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const contextualLinks: NavLink[] = fileId
    ? [
        { to: `/analysis/${fileId}`,       label: "Analysis",        icon: contextualIconMap["analysis"] },
        { to: `/reports/${fileId}`,         label: "Reports",         icon: contextualIconMap["reports"] },
        { to: `/predictions/${fileId}`,     label: "Predictions",     icon: contextualIconMap["predictions"] },
        { to: `/scenarios/${fileId}`,       label: "Scenarios",       icon: contextualIconMap["scenarios"] },
        { to: `/ai-chat/${fileId}`,         label: "AI Copilot",      icon: contextualIconMap["ai-chat"] },
        { to: `/data-cleaning/${fileId}`,   label: "Data Cleaning",   icon: contextualIconMap["data-cleaning"] },
        { to: `/fraud/${fileId}`,           label: "Fraud Scan",      icon: contextualIconMap["fraud"] },
        { to: `/goals/${fileId}`,           label: "Goals Progress",  icon: contextualIconMap["goals"] },
        { to: `/strategy/${fileId}`,        label: "Strategy",        icon: contextualIconMap["strategy"] },
        { to: `/market-intel/${fileId}`,    label: "Market Intel",    icon: contextualIconMap["market-intel"] },
      ]
    : [];

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  return (
    <aside className="sidebar-shell">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-mark">BI</div>
        <div>
          <p className="brand-title">BizInsight</p>
          <p className="brand-subtitle">AI Analytics</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {staticLinks
          .filter((l) => {
            // Hide upload for viewers
            if (l.to === "/upload" && !can("upload")) return false;
            // Hide Team for solo users — they have no one to invite
            if (isSolo && l.to === "/workspace") return false;
            if (!fileId) return true;
            const contextualPaths = ["/fraud", "/strategy"];
            return !contextualPaths.some((p) => l.to.startsWith(p));
          })
          .map((link) => (
            <span key={link.to}>
              {link.section && (
                <div className="sidebar-section-label">{link.section}</div>
              )}
              <Link
                to={link.to}
                className={`sidebar-link${isActive(link.to) ? " sidebar-link--active" : ""}${link.comingSoon ? " sidebar-link--disabled" : ""}`}
                style={link.comingSoon ? { opacity: 0.6 } : undefined}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                <span style={{ flex: 1 }}>{link.label}</span>
                {link.comingSoon && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "9px", fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" }}>
                    <Clock size={8} />SOON
                  </span>
                )}
              </Link>
            </span>
          ))}

        {contextualLinks.length > 0 && (
          <>
            <div className="sidebar-section-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Current Dataset</span>
              <ChevronRight size={10} style={{ opacity: 0.5 }} />
            </div>
            {contextualLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`sidebar-link${location.pathname === link.to ? " sidebar-link--active" : ""}`}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Workspace membership banner */}
      {isInWorkspace && workspace && (
        <div style={{
          margin: "8px 12px",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(99,102,241,0.10)",
          border: "1px solid rgba(99,102,241,0.25)",
          fontSize: "0.72rem",
        }}>
          <p style={{ margin: "0 0 2px", fontWeight: 700, color: "var(--primary-light)" }}>
            👥 In {workspace.owner_name}'s workspace
          </p>
          <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "capitalize" }}>
            Role: {role}
          </p>
        </div>
      )}

      {user && (
        <div className="sidebar-user-panel">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">{firstName[0].toUpperCase()}</div>
            <div className="sidebar-user-details">
              <p className="sidebar-user-name">{user.name || firstName}</p>
              <p className="sidebar-user-email">{user.email}</p>
            </div>
          </div>

          {user.onboarding_data?.business_type && (
            <div className="sidebar-industry-badge">{user.onboarding_data.business_type}</div>
          )}

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={toggleTheme}
            style={{ marginBottom: 4 }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀️" : "🌙"}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
