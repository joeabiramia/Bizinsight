import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navLinks = [
  { to: "/dashboard", label: "Overview", icon: "⬛" },
  { to: "/upload", label: "Upload", icon: "📤" },
  { to: "/datasets", label: "Datasets", icon: "🗂️" },
  { to: "/ai-chat", label: "AI Chat", icon: "🤖" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (to: string) => {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="brand-mark">BI</div>
        <div>
          <p className="brand-title">BizInsight</p>
          <p className="brand-subtitle">Business intelligence</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`sidebar-link${isActive(link.to) ? " sidebar-link--active" : ""}`}
          >
            <span className="sidebar-link-icon">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* User panel at the bottom */}
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
            <div className="sidebar-industry-badge">
              {user.onboarding_data.business_type}
            </div>
          )}
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
