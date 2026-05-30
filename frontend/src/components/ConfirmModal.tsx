import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open, title, message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm, onCancel,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)", zIndex: 999,
            }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -12 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, calc(100vw - 32px))",
              background: "var(--surface)", border: "1px solid var(--border-strong)",
              borderRadius: 20, padding: "28px 28px 24px",
              zIndex: 1000, boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: danger ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : "rgba(99,102,241,0.25)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle size={18} style={{ color: danger ? "#ef4444" : "#818cf8" }} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700 }}>{title}</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {message}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="button button-secondary" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className="button button-primary"
                style={danger ? { background: "#ef4444", boxShadow: "0 0 12px rgba(239,68,68,0.25)" } : undefined}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
