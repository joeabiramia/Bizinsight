import { useParams, Link } from "react-router-dom";
import { Wand2, Database, ArrowLeft } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import ScenarioSimulator from "../components/ScenarioSimulator";
import HealthScoreCard from "../components/HealthScoreCard";

export default function ScenarioPage() {
  const { fileId } = useParams<{ fileId: string }>();

  if (!fileId) {
    return (
      <MainLayout>
        <EmptyState
          icon={<Wand2 size={24} />}
          title="No Dataset Selected"
          description="Select a dataset to run what-if scenario simulations and model different business outcomes."
          action={
            <Link to="/datasets" className="button button-primary">
              <Database size={15} /> View Datasets
            </Link>
          }
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        eyebrow="What-If Analysis"
        title="Scenario Simulation"
        description="Model the revenue impact of changing prices, volumes, costs, and staffing."
        actions={
          <Link to={`/analysis/${fileId}`} className="button button-secondary button-sm">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <HealthScoreCard fileId={fileId} />
        <ScenarioSimulator fileId={fileId} />
        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/analysis/${fileId}`} className="button button-secondary">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
          <Link to={`/ai-chat/${fileId}`} className="button button-primary">
            Open AI Copilot
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
