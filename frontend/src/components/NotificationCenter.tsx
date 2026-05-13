import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Notification, NotificationSeverity } from "../types";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../services/api";

const SEVERITY_CONFIG: Record<NotificationSeverity, { icon: string; color: string; badge: string }> = {
  critical: { icon: "🔴", color: "notif-critical", badge: "notif-badge-critical" },
  warning:  { icon: "🟡", color: "notif-warning",  badge: "notif-badge-warning"  },
  info:     { icon: "🔵", color: "notif-info",     badge: "notif-badge-info"     },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* noop */ }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* noop */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      const removed = notifications.find(n => n.notification_id === id);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      if (removed && !removed.read) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* noop */ }
  };

  return (
    <div className="notif-root" ref={panelRef}>
      <button
        className="notif-bell-btn"
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        title="Notifications"
      >
        <span className="notif-bell-icon">🔔</span>
        {unreadCount > 0 && (
          <motion.span
            className="notif-unread-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="notif-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <div className="notif-panel-header">
              <span className="notif-panel-title">Notifications</span>
              {unreadCount > 0 && (
                <button className="notif-read-all-btn" onClick={handleReadAll}>
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="notif-list">
              {loading && notifications.length === 0 && (
                <div className="notif-empty">Loading…</div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="notif-empty">
                  <span style={{ fontSize: "1.6rem" }}>🔔</span>
                  <p>No notifications yet.<br />Run analysis on a dataset to generate alerts.</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {notifications.map(n => {
                  const cfg = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.info;
                  return (
                    <motion.div
                      key={n.notification_id}
                      className={`notif-item ${cfg.color} ${!n.read ? "notif-item--unread" : ""}`}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => !n.read && handleRead(n.notification_id)}
                    >
                      <div className="notif-item-left">
                        <span className="notif-sev-icon">{cfg.icon}</span>
                        <div className="notif-item-body">
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-message">{n.message}</div>
                          <div className="notif-item-meta">
                            <span className={`notif-sev-badge ${cfg.badge}`}>{n.severity}</span>
                            <span className="notif-time">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="notif-delete-btn"
                        onClick={e => { e.stopPropagation(); handleDelete(n.notification_id); }}
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
