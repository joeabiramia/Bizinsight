import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Trash2, Crown, Shield, Eye, MoreHorizontal,
  Copy, Mail, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

type Role   = "owner" | "admin" | "analyst" | "viewer";
type Status = "pending" | "accepted";

interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: Status;
  joined_at: string | null;
  invited_at?: string;
  last_active?: string;
  avatar_letter: string;
}

const ROLE_META: Record<Role, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  owner:   { label: "Owner",   icon: <Crown size={12} />,  desc: "Full access · billing · team management",      color: "#f59e0b" },
  admin:   { label: "Admin",   icon: <Shield size={12} />, desc: "Upload · analyze · invite members",             color: "#6366f1" },
  analyst: { label: "Analyst", icon: <Users size={12} />,  desc: "Upload data · run analysis · AI Copilot",       color: "#22c55e" },
  viewer:  { label: "Viewer",  icon: <Eye size={12} />,    desc: "View dashboards and reports (read-only)",        color: "#94a3b8" },
};

function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700,
      background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30`,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "accepted") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700,
      background: "rgba(245,158,11,0.12)", color: "#f59e0b",
    }}>
      <Clock size={9} /> Pending
    </span>
  );
}

export default function WorkspacePage() {
  const { user } = useAuth();
  const { workspace, role: myRole, isInWorkspace } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("analyst");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/workspace/members")
      .then(r => setMembers(r.data.members ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/workspace/invite-link")
      .then(r => setInviteLink(r.data?.link ?? ""))
      .catch(() => {});
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await api.post("/workspace/invite", { email: inviteEmail, role: inviteRole });
      setMembers(prev => [...prev, res.data.member]);
      setInviteEmail("");
      setSendResult({ success: true, message: `Invitation sent to ${res.data.member.email}` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to send invitation.";
      setSendResult({ success: false, message: msg });
    } finally {
      setSending(false);
    }
  };

  const handleRoleChange = async (id: string, role: Role) => {
    try {
      await api.patch(`/workspace/members/${id}`, { role });
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    } catch { /* noop */ }
    setActiveMenuId(null);
  };

  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/workspace/members/${id}`);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch { /* noop */ }
    setConfirmRemoveId(null);
  };

  const copyInviteLink = () => {
    const full = `${window.location.origin}${inviteLink}`;
    navigator.clipboard?.writeText(full).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const memberToRemove = members.find(m => m.id === confirmRemoveId);

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Team & Workspace"
        title="Team Management"
        description={
          isInWorkspace && workspace
            ? `You are a member of ${workspace.owner_name}'s workspace as ${myRole}.`
            : `Manage who has access to your workspace. ${members.length} member${members.length !== 1 ? "s" : ""} total.`
        }
      />

      {/* Member-of banner — shown when the logged-in user is a workspace member */}
      {isInWorkspace && workspace && (
        <div style={{
          marginBottom: 24, padding: "16px 20px", borderRadius: 14,
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            👥
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.95rem" }}>
              You are a member of <strong>{workspace.owner_name}'s</strong> workspace
            </p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Your role: <strong style={{ color: "var(--primary-light)", textTransform: "capitalize" }}>{myRole}</strong>
              {" · "}You can see {workspace.owner_name}'s datasets and {
                myRole === "viewer" ? "view analysis results." :
                myRole === "analyst" ? "upload data, run analysis, and use AI Copilot." :
                "manage datasets and team members."
              }
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

        {/* ── Members list ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <div className="section-card-header">
              <h2>Workspace Members</h2>
              <span className="badge badge-neutral">{members.length} members</span>
            </div>

            {loading ? (
              <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    height: 56, borderRadius: 12,
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 14px", borderRadius: 12,
                      background: member.status === "pending"
                        ? "rgba(245,158,11,0.04)"
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${member.status === "pending" ? "rgba(245,158,11,0.2)" : "var(--border)"}`,
                      position: "relative",
                      opacity: member.status === "pending" ? 0.85 : 1,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      background: member.role === "owner"
                        ? "linear-gradient(135deg,#f59e0b,#f97316)"
                        : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      display: "grid", placeItems: "center",
                      fontWeight: 700, fontSize: "0.9rem", color: "white",
                    }}>
                      {member.avatar_letter}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>
                          {member.name}
                          {member.email === user?.email ? " (you)" : ""}
                        </p>
                        <RoleBadge role={member.role} />
                        <StatusBadge status={member.status} />
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                        {member.email}
                        {member.status === "pending"
                          ? " · Invitation pending"
                          : member.last_active
                            ? ` · ${member.last_active}`
                            : ""}
                      </p>
                    </div>

                    {/* Actions (not for owner or self) */}
                    {member.role !== "owner" && member.email !== user?.email && (
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          title="Member options"
                          className="button button-ghost button-sm"
                          style={{ padding: "6px 8px" }}
                          onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        <AnimatePresence>
                          {activeMenuId === member.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              style={{
                                position: "absolute", right: 0, top: "calc(100% + 4px)",
                                background: "var(--surface)", border: "1px solid var(--border)",
                                borderRadius: 12, padding: 8, zIndex: 20, minWidth: 200,
                                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                              }}
                            >
                              <p style={{ margin: "0 0 6px", padding: "2px 8px", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                                Change Role
                              </p>
                              {(["admin", "analyst", "viewer"] as Role[]).map(role => (
                                <button
                                  key={role}
                                  type="button"
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                                    padding: "8px 12px", borderRadius: 8, border: "none",
                                    background: member.role === role ? "var(--primary-dim)" : "transparent",
                                    color: member.role === role ? "var(--primary-light)" : "var(--text-secondary)",
                                    cursor: "pointer", fontSize: "0.84rem", textAlign: "left",
                                  }}
                                  onClick={() => handleRoleChange(member.id, role)}
                                >
                                  {ROLE_META[role].icon} {ROLE_META[role].label}
                                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--muted)", maxWidth: 120, textAlign: "right" }}>
                                    {ROLE_META[role].desc.split("·")[0]}
                                  </span>
                                </button>
                              ))}
                              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                              <button
                                type="button"
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "8px 12px", borderRadius: 8, border: "none",
                                  background: "transparent", color: "#f87171",
                                  cursor: "pointer", fontSize: "0.84rem",
                                }}
                                onClick={() => { setConfirmRemoveId(member.id); setActiveMenuId(null); }}
                              >
                                <Trash2 size={13} /> Remove member
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Role permissions table */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700 }}>
              Role Permissions
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 600 }}>Action</th>
                    {(["owner","admin","analyst","viewer"] as Role[]).map(r => (
                      <th key={r} style={{ padding: "6px 10px", color: ROLE_META[r].color, fontWeight: 700, textAlign: "center" }}>
                        {ROLE_META[r].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Upload datasets",        true,  true,  true,  false],
                    ["Run analysis / AI chat", true,  true,  true,  false],
                    ["View dashboards",        true,  true,  true,  true],
                    ["Delete datasets",        true,  true,  false, false],
                    ["Manage team",            true,  true,  false, false],
                    ["Workspace settings",     true,  false, false, false],
                  ].map(([action, ...perms]) => (
                    <tr key={String(action)} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{String(action)}</td>
                      {(perms as boolean[]).map((allowed, idx) => (
                        <td key={idx} style={{ padding: "8px 10px", textAlign: "center" }}>
                          {allowed
                            ? <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                            : <span style={{ color: "var(--muted)" }}>–</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right: invite form + link ──────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700,
                         display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={15} style={{ color: "var(--primary-light)" }} /> Invite Team Member
            </h3>
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Email address</label>
                <input
                  type="email" className="form-input"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setSendResult(null) || setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select
                  title="Member role"
                  className="form-input"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as Role)}
                >
                  {(["admin","analyst","viewer"] as Role[]).map(role => (
                    <option key={role} value={role}>
                      {ROLE_META[role].label} — {ROLE_META[role].desc.split("·")[0].trim()}
                    </option>
                  ))}
                </select>
              </div>

              {sendResult && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                  borderRadius: 8, fontSize: "0.84rem",
                  background: sendResult.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${sendResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  color: sendResult.success ? "#22c55e" : "#ef4444",
                }}>
                  {sendResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {sendResult.message}
                </div>
              )}

              <button
                type="submit"
                className="button button-primary"
                disabled={sending || !inviteEmail}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {sending
                  ? "Sending…"
                  : <><Mail size={14} /> Send Invitation</>}
              </button>
            </form>
          </div>

          {/* Shareable invite link */}
          {inviteLink && (
            <div className="section-card">
              <h3 style={{ margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 700 }}>
                Shareable Invite Link
              </h3>
              <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Anyone with this link can join as an Analyst. Valid for 7 days.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                  fontSize: "0.72rem", color: "var(--muted)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {`${window.location.origin}${inviteLink}`}
                </div>
                <button type="button" className="button button-secondary button-sm" onClick={copyInviteLink}>
                  {linkCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Remove member confirmation */}
      <ConfirmModal
        open={!!confirmRemoveId}
        title="Remove member?"
        message={`${memberToRemove?.name ?? "This member"} (${memberToRemove?.email ?? ""}) will lose access to the workspace immediately.`}
        confirmLabel="Remove"
        onConfirm={() => confirmRemoveId && handleRemove(confirmRemoveId)}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </MainLayout>
  );
}
