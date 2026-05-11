import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import { uploadFile } from "../services/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV or XLSX file to continue.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    setError("");

    try {
      const uploadRes = await uploadFile(formData);
      const fileId = uploadRes.data.file_id;
      localStorage.setItem("lastDatasetId", fileId);
      navigate(`/analysis/${fileId}`);
    } catch {
      setError("Upload failed. Please try again with a supported dataset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Upload & ingest</p>
          <h1>Smart dataset upload</h1>
          <p className="section-description">
            Upload your file and get instant analytics, charts, and AI chat support.
          </p>
        </div>
      </div>

      <SectionCard title="Upload dataset" description="Supported formats: CSV, XLSX.">
        <div className="upload-panel">
          <label className="file-input-card">
            <span className="file-input-label">Select a dataset</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          {file ? <p className="file-meta">{file.name}</p> : <p className="file-meta">No file selected</p>}

          {error ? <div className="alert alert-error">{error}</div> : null}

          <button type="button" className="button button-primary" onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading…" : "Upload dataset"}
          </button>
        </div>
      </SectionCard>
    </MainLayout>
  );
}
