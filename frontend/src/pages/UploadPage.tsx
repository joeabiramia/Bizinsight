import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Download, X, CloudUpload, File,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import { uploadFile } from "../services/api";

const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPTED = [".csv", ".xlsx", ".xls"];

const TIPS = [
  "Make sure row 1 contains column headers",
  "Numeric columns (revenue, quantity) work best for KPI analysis",
  "Date columns work best in YYYY-MM-DD or MM/DD/YYYY format",
  "Remove merged cells or special characters from headers",
];

const TEMPLATE_CSV = `Date,Product,Region,Revenue,Quantity,SalesRep,Status
2024-01-05,Product A,North,12400,8,Alice Johnson,Completed
2024-01-08,Product B,South,8750,5,Bob Smith,Completed
2024-01-12,Product A,East,15200,11,Alice Johnson,Completed
2024-01-15,Product C,West,6800,4,Carol White,Pending
2024-01-20,Product B,North,9300,6,David Lee,Completed
2024-01-22,Product A,South,11500,7,Bob Smith,Completed
2024-01-28,Product C,East,7200,3,Alice Johnson,Completed`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bizinsight_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function validateFile(file: File): string | null {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ACCEPTED.includes(ext))
    return `File type "${ext}" is not supported. Please upload a CSV or Excel file.`;
  if (file.size > MAX_BYTES)
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_MB} MB.`;
  if (file.size < 100)
    return "File appears to be empty. Please check the file and try again.";
  return null;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [done, setDone] = useState(false);

  const handleFile = useCallback((f: File) => {
    setUploadError("");
    setDone(false);
    const err = validateFile(f);
    if (err) { setValidationError(err); setFile(null); return; }
    setValidationError("");
    setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setUploadError("");

    const progressInterval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 12 : p);
    }, 300);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadFile(formData);
      clearInterval(progressInterval);
      setProgress(100);
      setDone(true);
      const fileId = res.data.file_id;
      localStorage.setItem("lastDatasetId", fileId);
      setTimeout(() => navigate(`/analysis/${fileId}`), 1100);
    } catch (err: unknown) {
      clearInterval(progressInterval);
      setProgress(0);
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(
        detail ||
        "Upload failed. Make sure your file has column headers in row 1 and is a valid CSV or Excel file."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Data Import"
        title="Upload Your Dataset"
        description="Upload any CSV or Excel file. We'll automatically detect your industry, generate KPIs, charts, and AI insights."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

        {/* Drop zone + upload */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <motion.div
            onClick={() => !file && !uploading && inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            animate={{
              borderColor: dragging ? "var(--primary)" : file ? "#22c55e" : "var(--border-strong)",
              background: dragging ? "rgba(99,102,241,0.06)" : file ? "rgba(34,197,94,0.03)" : "rgba(255,255,255,0.02)",
            }}
            style={{
              border: "2px dashed", borderRadius: 20, padding: "52px 32px",
              textAlign: "center", cursor: file ? "default" : "pointer",
              transition: "all 0.2s",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {!file ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: dragging ? "var(--primary-dim)" : "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)", display: "flex", alignItems: "center",
                  justifyContent: "center",
                  color: dragging ? "var(--primary-light)" : "var(--muted)", transition: "all 0.2s",
                }}>
                  <CloudUpload size={32} />
                </div>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                    {dragging ? "Drop your file here" : "Drag & drop your file here"}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    or <span style={{ color: "var(--primary-light)", fontWeight: 600 }}>browse to upload</span>
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    CSV, Excel (.xlsx, .xls) · Max {MAX_MB} MB
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: done ? "rgba(34,197,94,0.12)" : "var(--primary-dim)",
                  border: `1px solid ${done ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.25)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: done ? "#4ade80" : "var(--primary-light)",
                }}>
                  {done ? <CheckCircle2 size={28} /> : <File size={28} />}
                </div>

                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                    {(file.size / 1024).toFixed(0)} KB · {file.name.split(".").pop()?.toUpperCase()}
                  </p>
                </div>

                {uploading && (
                  <div style={{ width: "100%", maxWidth: 300 }}>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                      <motion.div
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear" }}
                        style={{ height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 999 }}
                      />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--muted)", textAlign: "center" }}>
                      {progress < 100 ? `Uploading… ${Math.round(progress)}%` : "Processing your data…"}
                    </p>
                  </div>
                )}

                {done && (
                  <span className="badge badge-success" style={{ fontSize: "0.78rem" }}>
                    <CheckCircle2 size={11} /> Uploaded — redirecting to analysis…
                  </span>
                )}

                {!uploading && !done && (
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                  >
                    <X size={12} /> Choose a different file
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>

          <AnimatePresence>
            {validationError && (
              <motion.div className="alert alert-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {validationError}
              </motion.div>
            )}
            {uploadError && (
              <motion.div className="alert alert-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {uploadError}
              </motion.div>
            )}
          </AnimatePresence>

          {file && !uploading && !done && (
            <motion.button
              type="button" className="button button-primary"
              style={{ alignSelf: "flex-start", padding: "12px 32px", fontSize: "0.95rem" }}
              onClick={handleUpload}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Upload size={16} /> Analyze Dataset
            </motion.button>
          )}
        </div>

        {/* Sidebar tips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} style={{ color: "var(--primary-light)" }} /> Sample Template
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Not sure about the format? Download our sample CSV with the correct column structure.
            </p>
            <button type="button" className="button button-secondary button-sm" style={{ width: "100%", justifyContent: "center" }} onClick={downloadTemplate}>
              <Download size={13} /> Download Template
            </button>
          </div>

          <div className="section-card">
            <h3 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700 }}>Tips for best results</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TIPS.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: "var(--primary-dim)", color: "var(--primary-light)",
                    display: "grid", placeItems: "center", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700 }}>Supported formats</h3>
            {[
              { ext: "CSV", desc: "Comma-separated values", emoji: "📄" },
              { ext: "XLSX", desc: "Microsoft Excel (modern)", emoji: "📗" },
              { ext: "XLS", desc: "Microsoft Excel (legacy)", emoji: "📗" },
            ].map(f => (
              <div key={f.ext} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{f.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>.{f.ext}</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
            <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>Max file size: {MAX_MB} MB</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
