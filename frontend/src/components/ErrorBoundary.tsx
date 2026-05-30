import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", padding: 24, textAlign: "center",
      }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "1.4rem" }}>
            Something went wrong
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            An unexpected error occurred. Refreshing the page usually fixes it.
          </p>
          {this.state.message && (
            <pre style={{
              padding: "10px 14px", borderRadius: 8, fontSize: "0.78rem",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", textAlign: "left", overflowX: "auto", marginBottom: 24,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {this.state.message}
            </pre>
          )}
          <button
            type="button"
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
