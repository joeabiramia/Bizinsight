import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24, textAlign: "center",
    }}>
      <div style={{ maxWidth: 480 }}>
        <div style={{
          fontSize: "5rem", fontWeight: 900, lineHeight: 1, marginBottom: 8,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          404
        </div>
        <h2 style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "1.4rem" }}>
          Page not found
        </h2>
        <p style={{ margin: "0 0 32px", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
