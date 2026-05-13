import { useParams, Link } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import PredictionChart from "../components/PredictionChart";
import AnomalyChart from "../components/AnomalyChart";

export default function PredictionsPage() {
  const { fileId } = useParams<{ fileId: string }>();

  if (!fileId) {
    return (
      <MainLayout title="Predictive Analytics" subtitle="ML Forecasting">
        <div className="empty-state-card">
          <div className="no-dataset-state">
            <span style={{ fontSize: "2rem" }}>🤖</span>
            <h3>No Dataset Selected</h3>
            <p>Select a dataset to generate ML forecasts and anomaly detection.</p>
            <Link to="/datasets" className="button button-primary" style={{ marginTop: 8 }}>
              View Datasets
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Predictive Analytics" subtitle="ML Forecasting & Anomaly Detection">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PredictionChart fileId={fileId} />
        <AnomalyChart fileId={fileId} />

        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/analysis/${fileId}`} className="button button-secondary">
            ← Back to Analysis
          </Link>
          <Link to={`/scenarios/${fileId}`} className="button button-primary">
            Run Scenarios →
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
