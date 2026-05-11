import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function MainLayout({ children }: any) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}