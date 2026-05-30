import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, User, Lock, Mail, Trash2 } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { updateProfile, resendVerification, deleteAccount } from "../services/api";

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Profile form
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<{ success: boolean; message: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwResult, setPwResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email verification
  const [sendingVerif, setSendingVerif] = useState(false);
  const [verifResult, setVerifResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setProfileResult({ success: false, message: "Name cannot be empty." }); return; }
    setSavingProfile(true);
    setProfileResult(null);
    try {
      await updateProfile({ name: name.trim() });
      await refreshUser();
      setProfileResult({ success: true, message: "Profile updated successfully." });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to update profile.";
      setProfileResult({ success: false, message: msg });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { setPwResult({ success: false, message: "New password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw) { setPwResult({ success: false, message: "Passwords do not match." }); return; }
    setSavingPw(true);
    setPwResult(null);
    try {
      await updateProfile({ current_password: currentPw, new_password: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwResult({ success: true, message: "Password changed successfully." });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to change password.";
      setPwResult({ success: false, message: msg });
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      navigate("/");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerif(true);
    setVerifResult(null);
    try {
      const res = await resendVerification();
      setVerifResult({ success: res.data.success, message: res.data.message });
    } catch {
      setVerifResult({ success: false, message: "Failed to send verification email." });
    } finally {
      setSendingVerif(false);
    }
  };

  const Result = ({ r }: { r: { success: boolean; message: string } }) => (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 10, fontSize: "0.86rem",
        background: r.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${r.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        color: r.success ? "#22c55e" : "#ef4444",
      }}
    >
      {r.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {r.message}
    </motion.div>
  );

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, password, and account security."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>

        {/* Email verification banner */}
        {user && !user.email_verified && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "14px 18px", borderRadius: 12,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mail size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <div>
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.875rem", color: "#f59e0b" }}>
                  Email not verified
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Verify your email to secure your account.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={handleResendVerification}
              disabled={sendingVerif}
            >
              {sendingVerif ? "Sending…" : "Resend verification"}
            </button>
          </motion.div>
        )}
        {verifResult && <Result r={verifResult} />}

        {/* Profile */}
        <div className="section-card">
          <h3 style={{ margin: "0 0 18px", fontSize: "0.95rem", fontWeight: 700,
                       display: "flex", alignItems: "center", gap: 8 }}>
            <User size={15} style={{ color: "var(--primary-light)" }} /> Profile
          </h3>
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">Display name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={user?.email || ""}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                Email cannot be changed.
              </p>
            </div>
            {profileResult && <Result r={profileResult} />}
            <button type="submit" className="button button-primary"
                    style={{ width: "fit-content" }} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="section-card">
          <h3 style={{ margin: "0 0 18px", fontSize: "0.95rem", fontWeight: 700,
                       display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={15} style={{ color: "var(--primary-light)" }} /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">Current password</label>
              <input type="password" className="form-input" value={currentPw}
                     onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="form-label">New password</label>
              <input type="password" className="form-input" value={newPw}
                     onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <div>
              <label className="form-label">Confirm new password</label>
              <input type="password" className="form-input" value={confirmPw}
                     onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
            </div>
            {pwResult && <Result r={pwResult} />}
            <button type="submit" className="button button-primary"
                    style={{ width: "fit-content" }} disabled={savingPw}>
              {savingPw ? "Updating…" : "Change Password"}
            </button>
          </form>
        </div>
        {/* Danger zone */}
        <div className="section-card" style={{ border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.04)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 700,
                       display: "flex", alignItems: "center", gap: 8, color: "#ef4444" }}>
            <Trash2 size={15} /> Danger Zone
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            type="button"
            className="button button-primary"
            style={{ background: "#ef4444", boxShadow: "0 0 12px rgba(239,68,68,0.2)" }}
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete My Account"}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete your account?"
        message="All your datasets, settings, goals, and history will be permanently deleted. This action cannot be undone."
        confirmLabel="Yes, delete my account"
        cancelLabel="Cancel"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </MainLayout>
  );
}
