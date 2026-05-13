import { Link, useLocation } from "react-router-dom";
import NotificationCenter from "../NotificationCenter";

function resolveTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/upload")) return "Upload Dataset";
  if (pathname.startsWith("/datasets")) return "Datasets";
  if (pathname.startsWith("/reports")) return "Executive Reports";
  if (pathname.startsWith("/predictions")) return "Predictive Analytics";
  if (pathname.startsWith("/scenarios")) return "Scenario Simulation";
  if (pathname.startsWith("/analysis")) return "Analysis";
  if (pathname.startsWith("/ai-chat")) return "AI Copilot";
  return "BizInsight AI";
}

export default function Navbar() {
  const location = useLocation();
  const title = resolveTitle(location.pathname);

  return (
    <header className="navbar-shell">
      <div className="navbar-left">
        <div className="brand-mark">BI</div>
        <div>
          <p className="navbar-brand">BizInsight AI</p>
          <p className="navbar-subtitle">{title}</p>
        </div>
      </div>

      <div className="navbar-right">
        <nav className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/datasets">Datasets</Link>
          <Link to="/upload">Upload</Link>
        </nav>
        <NotificationCenter />
      </div>
    </header>
  );
}
