import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import SectionCard from "../components/ui/SectionCard";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { listDatasets } from "../services/api";
import { DatasetRecord } from "../types";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listDatasets()
      .then((response) => setDatasets(response.data.datasets || []))
      .catch(() => setError("Unable to retrieve dataset history."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Dataset history</p>
          <h1>Data assets</h1>
          <p className="section-description">
            Browse uploaded files, review metadata, and reopen deeper analysis.
          </p>
        </div>
      </div>

      <SectionCard title="Dataset history" description="Persistent file metadata and revisit actions.">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : datasets.length === 0 ? (
          <div className="empty-state-card">No datasets available yet.</div>
        ) : (
          <div className="dataset-table-shell">
            <table className="dataset-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.file_id}>
                    <td>{dataset.filename}</td>
                    <td>{dataset.created_at ? new Date(dataset.created_at).toLocaleString() : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => {
                            localStorage.setItem("lastDatasetId", dataset.file_id);
                            navigate(`/analysis/${dataset.file_id}`);
                          }}
                        >
                          Analysis
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => {
                            localStorage.setItem("lastDatasetId", dataset.file_id);
                            navigate(`/ai-chat/${dataset.file_id}`);
                          }}
                        >
                          AI Chat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </MainLayout>
  );
}
