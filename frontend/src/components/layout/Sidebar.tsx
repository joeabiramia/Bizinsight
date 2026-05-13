import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const staticLinks = [
  { to: "/dashboard",  label: "Overview",        icon: "⬛" },
  { to: "/upload",     label: "Upload",          icon: "📤" },
  { to: "/datasets",   label: "Datasets",        icon: "🗂️" },
  { to: "/ai-chat",    label: "AI Copilot",      icon: "🤖" },
  { to: "/goals",      label: "Goals",           icon: "🎯" },
  { to: "/automation", label: "Automation",      icon: "⚙️" },
  { to: "/strategy",   label: "Strategy",        icon: "🗺️" },
  { to: "/fraud",      label: "Fraud Detection", icon: "🔍" },
  { to: "/audit",      label: "Audit Logs",      icon: "📋" },
];

function useFileId(): string | null {
  const params = useParams<{ fileId: string }>();
  return params.fileId ?? null;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const fileId = useFileId();

  const isActive = (to: string) => {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const contextualLinks = fileId
    ? [
        { to: `/analysis/${fileId}`,       label: "Analysis",       icon: "📊" },
        { to: `/reports/${fileId}`,         label: "Reports",        icon: "📄" },
        { to: `/predictions/${fileId}`,     label: "Predictions",    icon: "🔮" },
        { to: `/scenarios/${fileId}`,       label: "Scenarios",      icon: "🎯" },
        { to: `/ai-chat/${fileId}`,         label: "AI Copilot",     icon: "🤖" },
        { to: `/data-cleaning/${fileId}`,   label: "Data Cleaning",  icon: "🧹" },
        { to: `/fraud/${fileId}`,           label: "Fraud Scan",     icon: "🔍" },
        { to: `/goals/${fileId}`,           label: "Goals Progress", icon: "📈" },
        { to: `/strategy/${fileId}`,        label: "Strategy",       icon: "🗺️" },
        { to: `/market-intel/${fileId}`,    label: "Market Intel",   icon: "🌐" },
      ]
    : [];

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="brand-mark">BI</div>
        <div>
          <p className="brand-title">BizInsight</p>
          <p className="brand-subtitle">AI Analytics</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Static links — hide file-level duplicates when in file context */}
        {staticLinks
          .filter((l) => {
            if (!fileId) return true;
            // Hide global links that are replaced by contextual ones
            const contextualPaths = ["/ai-chat", "/fraud", "/strategy"];
            return !contextualPaths.some((p) => l.to.startsWith(p));
          })
          .map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link${isActive(link.to) ? " sidebar-link--active" : ""}`}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}

        {/* Dataset-contextual links */}
        {contextualLinks.length > 0 && (
          <>
            <div className="sidebar-section-label">Current Dataset</div>
            {contextualLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`sidebar-link${location.pathname === link.to ? " sidebar-link--active" : ""}`}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {user && (
        <div className="sidebar-user-panel">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="sidebar-user-details">
              <p className="sidebar-user-name">{user.name || "User"}</p>
              <p className="sidebar-user-email">{user.email}</p>
            </div>
          </div>
          {user.onboarding_data?.business_type && (
            <div className="sidebar-industry-badge">{user.onboarding_data.business_type}</div>
          )}
          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
