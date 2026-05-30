import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../services/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Please use the link from your email.");
      return;
    }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? "Verification failed. The link may have expired.";
        setMessage(msg);
        setStatus("error");
      });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>⏳</div>
            <h2 style={{ margin: "0 0 8px", fontWeight: 700 }}>Verifying your email…</h2>
            <p style={{ color: "var(--text-secondary)" }}>Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", fontWeight: 700, color: "#22c55e" }}>
              Email verified!
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
              Your email address has been confirmed. You can now use all features of BizInsight AI.
            </p>
            <Link to="/dashboard" className="button button-primary">
              Go to Dashboard →
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>❌</div>
            <h2 style={{ margin: "0 0 8px", fontWeight: 700, color: "#ef4444" }}>
              Verification failed
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{message}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link to="/settings" className="button button-primary">
                Resend verification
              </Link>
              <Link to="/dashboard" className="button button-secondary">
                Back to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
