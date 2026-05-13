import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import NotificationCenter from "../NotificationCenter";

type Crumb = { label: string; to?: string };

function resolveBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard")               return [{ label: "Overview" }];
  if (pathname.startsWith("/upload"))          return [{ label: "Upload Dataset" }];
  if (pathname.startsWith("/datasets"))        return [{ label: "Datasets" }];
  if (pathname.startsWith("/reports"))         return [{ label: "Datasets", to: "/datasets" }, { label: "Reports" }];
  if (pathname.startsWith("/predictions"))     return [{ label: "Datasets", to: "/datasets" }, { label: "Predictions" }];
  if (pathname.startsWith("/scenarios"))       return [{ label: "Datasets", to: "/datasets" }, { label: "Scenarios" }];
  if (pathname.startsWith("/analysis"))        return [{ label: "Datasets", to: "/datasets" }, { label: "Analysis" }];
  if (pathname.startsWith("/data-cleaning"))   return [{ label: "Datasets", to: "/datasets" }, { label: "Data Quality" }];
  if (pathname.startsWith("/ai-chat"))         return [{ label: "AI Copilot" }];
  if (pathname.startsWith("/integrations"))    return [{ label: "Integrations" }];
  if (pathname.startsWith("/google-sheets"))   return [{ label: "Integrations", to: "/integrations" }, { label: "Google Sheets" }];
  if (pathname.startsWith("/excel-online"))    return [{ label: "Integrations", to: "/integrations" }, { label: "Excel Online" }];
  if (pathname.startsWith("/shopify"))         return [{ label: "Integrations", to: "/integrations" }, { label: "Shopify" }];
  if (pathname.startsWith("/schedules"))       return [{ label: "Automation" }, { label: "Email Schedules" }];
  if (pathname.startsWith("/alert-channels"))  return [{ label: "Automation" }, { label: "Alert Channels" }];
  if (pathname.startsWith("/automation"))      return [{ label: "Automation" }, { label: "Rules" }];
  if (pathname.startsWith("/compare"))         return [{ label: "Compare Datasets" }];
  if (pathname.startsWith("/dashboard-builder")) return [{ label: "Dashboard Builder" }];
  if (pathname.startsWith("/goal-forecast"))   return [{ label: "Goal Forecast" }];
  if (pathname.startsWith("/goals"))           return [{ label: "Goals" }];
  if (pathname.startsWith("/strategy"))        return [{ label: "Strategy" }];
  if (pathname.startsWith("/fraud"))           return [{ label: "Fraud Detection" }];
  if (pathname.startsWith("/market-intel"))    return [{ label: "Market Intelligence" }];
  if (pathname.startsWith("/audit"))           return [{ label: "Audit Logs" }];
  if (pathname.startsWith("/public/dashboard")) return [{ label: "Shared Dashboard" }];
  return [{ label: "BizInsight AI" }];
}

export default function Navbar() {
  const location = useLocation();
  const crumbs = resolveBreadcrumbs(location.pathname);

  return (
    <header className="navbar-shell">
      <div className="navbar-left">
        {/* Breadcrumb trail */}
        <nav className="navbar-breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <ChevronRight size={12} style={{ opacity: 0.4 }} />}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    transition: "color 120ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  style={{
                    color: i === crumbs.length - 1 ? "var(--text)" : "var(--muted)",
                    fontSize: i === crumbs.length - 1 ? "0.9rem" : "0.8rem",
                    fontWeight: i === crumbs.length - 1 ? 600 : 500,
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="navbar-right">
        <nav className="navbar-links" aria-label="Quick navigation">
          <Link to="/dashboard" className="navbar-link">Dashboard</Link>
          <Link to="/datasets"  className="navbar-link">Datasets</Link>
          <Link to="/upload"    className="navbar-link">Upload</Link>
        </nav>
        <NotificationCenter />
      </div>
    </header>
  );
}
