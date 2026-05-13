import { useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { fetchAuditLogs } from "../services/api";
import type { AuditLogEntry } from "../types";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchAuditLogs(200)
      .then((res) => setLogs(res.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? logs.filter(
        (l) =>
          l.action_label.toLowerCase().includes(filter.toLowerCase()) ||
          l.resource_type.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Compliance & Transparency</p>
          <h1>Audit Logs</h1>
          <p className="section-description">
            Complete history of all user and system actions for compliance and accountability.
          </p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action or resource…"
          style={{ maxWidth: 360 }}
        />
      </div>

      {loading ? (
        <div className="section-card"><div className="loading-pulse" style={{ height: 200 }} /></div>
      ) : (
        <div className="section-card">
          {filtered.length === 0 ? (
            <div className="empty-state-card">
              <p style={{ fontSize: 28, marginBottom: 8 }}>📋</p>
              <p>
                {filter
                  ? "No audit logs match your filter."
                  : "No audit logs yet. Actions will appear here as you use the platform."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="audit-table">
                <thead>
                  <tr>
                    {["When", "Action", "Resource", "Details"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.audit_id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{log.resource_icon}</span>
                          <strong style={{ fontSize: 13 }}>{log.action_label}</strong>
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {log.resource_type}
                        {log.resource_id ? (
                          <span style={{ color: "var(--text-tertiary, #9ca3af)", marginLeft: 4 }}>
                            · {log.resource_id.substring(0, 8)}…
                          </span>
                        ) : null}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {Object.keys(log.metadata || {}).length > 0
                          ? Object.entries(log.metadata)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
