import { useParams, Link } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import ScenarioSimulator from "../components/ScenarioSimulator";
import HealthScoreCard from "../components/HealthScoreCard";

export default function ScenarioPage() {
  const { fileId } = useParams<{ fileId: string }>();

  if (!fileId) {
    return (
      <MainLayout title="Scenario Simulation" subtitle="What-If Analysis">
        <div className="empty-state-card">
          <div className="no-dataset-state">
            <span style={{ fontSize: "2rem" }}>🎯</span>
            <h3>No Dataset Selected</h3>
            <p>Select a dataset to run what-if scenario simulations.</p>
            <Link to="/datasets" className="button button-primary" style={{ marginTop: 8 }}>
              View Datasets
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Scenario Simulation" subtitle="What-If Analysis & Business Health">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <HealthScoreCard fileId={fileId} />
        <ScenarioSimulator fileId={fileId} />

        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/predictions/${fileId}`} className="button button-secondary">
            ← Back to Predictions
          </Link>
          <Link to={`/ai-chat/${fileId}`} className="button button-primary">
            Ask AI Copilot →
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
