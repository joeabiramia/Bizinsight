import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, BarChart2, Bot, Trash2, Search,
  Upload, Clock, SortAsc, SortDesc, ChevronRight,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import { listDatasets, api } from "../services/api";
import type { DatasetRecord } from "../types";
import { useWorkspace } from "../context/WorkspaceContext";

type SortKey = "name" | "date";
type SortDir = "asc" | "desc";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DatasetsPage() {
  const navigate = useNavigate();
  const { can, isInWorkspace, workspace } = useWorkspace();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listDatasets()
      .then(res => setDatasets(res.data.datasets || []))
      .catch(() => setError("Failed to load datasets. Please refresh."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await api.delete(`/upload/${fileId}`);
    } catch { /* remove from UI regardless */ }
    setDatasets(prev => prev.filter(d => d.file_id !== fileId));
    if (localStorage.getItem("lastDatasetId") === fileId) localStorage.removeItem("lastDatasetId");
    setDeletingId(null);
    setConfirmDelete(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let list = [...datasets];
    if (search) list = list.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.filename.localeCompare(b.filename);
      if (sortKey === "date") cmp = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [datasets, search, sortKey, sortDir]);

  const SortIndicator = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <SortAsc size={12} style={{ opacity: 0.3 }} />;
    return sortDir === "asc"
      ? <SortAsc size={12} style={{ color: "var(--primary-light)" }} />
      : <SortDesc size={12} style={{ color: "var(--primary-light)" }} />;
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Data Library"
        title={isInWorkspace && workspace ? `${workspace.owner_name}'s Datasets` : "Your Datasets"}
        description={
          isInWorkspace && workspace
            ? `Viewing ${workspace.owner_name}'s shared workspace — ${datasets.length} dataset${datasets.length !== 1 ? "s" : ""} available.`
            : `${datasets.length} dataset${datasets.length !== 1 ? "s" : ""} uploaded. Click any row to open the analysis.`
        }
        actions={
          can("upload") ? (
            <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
              <Upload size={15} /> Upload New
            </button>
          ) : undefined
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {!loading && datasets.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              placeholder="Search datasets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38, fontSize: "0.875rem", borderRadius: 10 }}
            />
          </div>
          <button type="button" className={`chip${sortKey === "name" ? " chip--active" : ""}`} onClick={() => toggleSort("name")}>
            Name <SortIndicator k="name" />
          </button>
          <button type="button" className={`chip${sortKey === "date" ? " chip--active" : ""}`} onClick={() => toggleSort("date")}>
            Date <SortIndicator k="date" />
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        search ? (
          <EmptyState
            icon={<Search size={22} />}
            title="No results"
            description={`No datasets match "${search}". Try a different term.`}
            action={<button type="button" className="button button-secondary" onClick={() => setSearch("")}>Clear search</button>}
          />
        ) : (
          <EmptyState
            icon={<Database size={22} />}
            title="No datasets yet"
            description="Upload your first CSV or Excel file to generate AI-powered business insights."
            action={
              <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
                <Upload size={15} /> Upload Dataset
              </button>
            }
          />
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 210px", padding: "6px 14px", gap: 12 }}>
            {["Dataset", "Uploaded", "Actions"].map(h => (
              <span key={h} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>{h}</span>
            ))}
          </div>

          <AnimatePresence>
            {filtered.map((ds, i) => (
              <motion.div
                key={ds.file_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 130px 210px",
                  alignItems: "center", gap: 12, padding: "13px 14px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                  borderRadius: 14, transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(99,102,241,0.3)"; el.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.background = "rgba(255,255,255,0.02)"; }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", minWidth: 0 }}
                  onClick={() => { localStorage.setItem("lastDatasetId", ds.file_id); navigate(`/analysis/${ds.file_id}`); }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "var(--primary-dim)", border: "1px solid rgba(99,102,241,0.2)",
                    display: "grid", placeItems: "center", color: "var(--primary-light)",
                  }}>
                    <Database size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ds.filename}
                    </p>
                    {ds.file_id === localStorage.getItem("lastDatasetId") && (
                      <span style={{ fontSize: "0.68rem", color: "var(--primary-light)", fontWeight: 600 }}>● Last opened</span>
                    )}
                  </div>
                  <ChevronRight size={13} style={{ color: "var(--muted)", marginLeft: "auto", flexShrink: 0 }} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                  <Clock size={12} style={{ color: "var(--muted)" }} />
                  <span style={{ fontSize: "0.8rem" }}>{ds.created_at ? timeAgo(ds.created_at) : "—"}</span>
                </div>

                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <button type="button" className="button button-secondary button-sm" style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => { localStorage.setItem("lastDatasetId", ds.file_id); navigate(`/analysis/${ds.file_id}`); }}>
                    <BarChart2 size={12} /> Analysis
                  </button>
                  <button type="button" className="button button-secondary button-sm" style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => { localStorage.setItem("lastDatasetId", ds.file_id); navigate(`/ai-chat/${ds.file_id}`); }}>
                    <Bot size={12} /> Ask AI
                  </button>

                  {can("delete_dataset") && (
                    confirmDelete === ds.file_id ? (
                      <div style={{ display: "flex", gap: 3 }}>
                        <button type="button" className="button button-sm"
                          style={{ background: "var(--danger-dim)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                          onClick={() => handleDelete(ds.file_id)} disabled={deletingId === ds.file_id}>
                          {deletingId === ds.file_id ? "…" : "Delete"}
                        </button>
                        <button type="button" className="button button-ghost button-sm" onClick={() => setConfirmDelete(null)}>✕</button>
                      </div>
                    ) : (
                      <button type="button" className="button button-ghost button-sm"
                        style={{ color: "var(--muted)", padding: "7px 7px" }}
                        onClick={() => setConfirmDelete(ds.file_id)} title="Delete dataset">
                        <Trash2 size={12} />
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <p style={{ padding: "6px 14px", fontSize: "0.72rem", color: "var(--muted)" }}>
            {filtered.length} dataset{filtered.length !== 1 ? "s" : ""}{search && ` matching "${search}"`}
          </p>
        </div>
      )}
    </MainLayout>
  );
}
