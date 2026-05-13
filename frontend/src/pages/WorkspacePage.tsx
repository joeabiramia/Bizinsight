import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus, Trash2, Crown, Shield, Eye, MoreHorizontal, Copy, Mail, CheckCircle2 } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

type Role = "owner" | "admin" | "analyst" | "viewer";
interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  joined_at: string;
  last_active?: string;
  avatar_letter: string;
}

const ROLE_META: Record<Role, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  owner:   { label: "Owner",   icon: <Crown size={12} />,  desc: "Full access, billing, manage members", color: "#f59e0b" },
  admin:   { label: "Admin",   icon: <Shield size={12} />, desc: "Manage datasets, rules, integrations",   color: "#6366f1" },
  analyst: { label: "Analyst", icon: <Users size={12} />,  desc: "Upload data, run analysis, AI chat",     color: "#22c55e" },
  viewer:  { label: "Viewer",  icon: <Eye size={12} />,    desc: "View dashboards and reports only",       color: "#94a3b8" },
};

const MOCK_MEMBERS: Member[] = [
  { id: "1", email: "owner@company.com", name: "You (Owner)", role: "owner", joined_at: "2024-01-15", last_active: "just now", avatar_letter: "O" },
  { id: "2", email: "analyst@company.com", name: "Sarah Mitchell", role: "analyst", joined_at: "2024-02-10", last_active: "2h ago", avatar_letter: "S" },
  { id: "3", email: "view@company.com", name: "David Chen", role: "viewer", joined_at: "2024-03-01", last_active: "Yesterday", avatar_letter: "D" },
];

export default function WorkspacePage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>(MOCK_MEMBERS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("analyst");
  const [sending, setSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    api.get("/workspace/members").then(r => {
      if (r.data?.members?.length) setMembers(r.data.members);
    }).catch(() => {});
    api.get("/workspace/invite-link").then(r => setInviteLink(r.data?.link || "")).catch(() => {
      setInviteLink(`${window.location.origin}/join/workspace-${Math.random().toString(36).slice(2, 8)}`);
    });
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setSending(true);
    try {
      await api.post("/workspace/invite", { email: inviteEmail, role: inviteRole });
    } catch { /* demo */ }
    const newMember: Member = {
      id: Date.now().toString(),
      email: inviteEmail, name: inviteEmail.split("@")[0],
      role: inviteRole, joined_at: new Date().toISOString(),
      last_active: "Invited", avatar_letter: inviteEmail[0].toUpperCase(),
    };
    setMembers(prev => [...prev, newMember]);
    setInviteEmail("");
    setInviteSent(true);
    setSending(false);
    setTimeout(() => setInviteSent(false), 4000);
  };

  const handleRemove = async (id: string) => {
    try { await api.delete(`/workspace/members/${id}`); } catch { /* demo */ }
    setMembers(prev => prev.filter(m => m.id !== id));
    setActiveMenuId(null);
  };

  const handleRoleChange = async (id: string, role: Role) => {
    try { await api.patch(`/workspace/members/${id}`, { role }); } catch { /* demo */ }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    setActiveMenuId(null);
  };

  const copyInviteLink = () => {
    navigator.clipboard?.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Team & Workspace"
        title="Team Management"
        description={`Manage who has access to your workspace. ${members.length} member${members.length !== 1 ? "s" : ""} currently.`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        {/* Members list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <div className="section-card-header">
              <h2>Workspace Members</h2>
              <span className="badge badge-neutral">{members.length} members</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((member, i) => {
                const roleMeta = ROLE_META[member.role];
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 14px", borderRadius: 12,
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                      position: "relative",
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.9rem",
                      color: "white", flexShrink: 0,
                    }}>{member.avatar_letter}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{member.name}</p>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "1px 8px", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700,
                          background: `${roleMeta.color}15`, color: roleMeta.color,
                          border: `1px solid ${roleMeta.color}30`,
                        }}>
                          {roleMeta.icon} {roleMeta.label}
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                        {member.email} · Active {member.last_active}
                      </p>
                    </div>

                    {member.role !== "owner" && (
                      <div style={{ position: "relative" }}>
                        <button type="button" className="button button-ghost button-sm" style={{ padding: "6px 8px" }}
                          onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}>
                          <MoreHorizontal size={14} />
                        </button>
                        {activeMenuId === member.id && (
                          <div style={{
                            position: "absolute", right: 0, top: "calc(100% + 4px)",
                            background: "var(--surface)", border: "1px solid var(--border)",
                            borderRadius: 12, padding: 8, zIndex: 10, minWidth: 200,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                          }}>
                            <p style={{ margin: "0 0 6px", padding: "2px 8px", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>Change Role</p>
                            {(Object.keys(ROLE_META) as Role[]).filter(r => r !== "owner").map(role => (
                              <button key={role} type="button"
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "8px 12px", borderRadius: 8, background: member.role === role ? "var(--primary-dim)" : "transparent",
                                  border: "none", color: member.role === role ? "var(--primary-light)" : "var(--text-secondary)",
                                  cursor: "pointer", fontSize: "0.84rem", textAlign: "left",
                                }}
                                onClick={() => handleRoleChange(member.id, role)}>
                                {ROLE_META[role].icon} {ROLE_META[role].label}
                              </button>
                            ))}
                            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                            <button type="button"
                              style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                padding: "8px 12px", borderRadius: 8, background: "transparent",
                                border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.84rem",
                              }}
                              onClick={() => handleRemove(member.id)}>
                              <Trash2 size={13} /> Remove member
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Roles explanation */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700 }}>Role Permissions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([role, meta]) => (
                <div key={role} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: `${meta.color}15`, color: meta.color, flexShrink: 0 }}>{meta.icon}</span>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: "0.84rem", color: meta.color }}>{meta.label}</p>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>{meta.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Invite sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={15} style={{ color: "var(--primary-light)" }} /> Invite Team Member
            </h3>
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Email address</label>
                <input type="email" className="form-input" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="form-input" value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}>
                  {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).filter(([r]) => r !== "owner").map(([role, meta]) => (
                    <option key={role} value={role}>{meta.label} — {meta.desc.split(",")[0]}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="button button-primary" disabled={sending || !inviteEmail} style={{ width: "100%", justifyContent: "center" }}>
                {sending ? "Sending…" : inviteSent ? <><CheckCircle2 size={14} /> Invitation sent!</> : <><Mail size={14} /> Send Invitation</>}
              </button>
            </form>
          </div>

          {/* Invite link */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700 }}>Shareable Invite Link</h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Share this link to invite anyone to join as an Analyst.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inviteLink || "Generating…"}
              </div>
              <button type="button" className="button button-secondary button-sm" onClick={copyInviteLink}>
                {linkCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
