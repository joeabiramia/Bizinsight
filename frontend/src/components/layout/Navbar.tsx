import { Link, useLocation } from "react-router-dom";

function resolveTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/upload")) return "Upload Dataset";
  if (pathname.startsWith("/datasets")) return "Datasets";
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
          <Link to="/">Overview</Link>
          <Link to="/datasets">Datasets</Link>
          <Link to="/upload">Upload</Link>
        </nav>
      </div>
    </header>
  );
}
