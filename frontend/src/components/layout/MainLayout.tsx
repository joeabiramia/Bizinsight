import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
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
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
