import { useParams, Link } from "react-router-dom";
import { TrendingUp, Database, ArrowLeft, ArrowRight } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import PredictionChart from "../components/PredictionChart";
import AnomalyChart from "../components/AnomalyChart";

export default function PredictionsPage() {
  const { fileId } = useParams<{ fileId: string }>();

  if (!fileId) {
    return (
      <MainLayout>
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="No Dataset Selected"
          description="Select a dataset to generate ML forecasts and anomaly detection."
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
        eyebrow="ML Forecasting"
        title="Predictive Analytics"
        description="Machine learning forecasts, trend analysis, and anomaly detection from your data."
        actions={
          <Link to={`/analysis/${fileId}`} className="button button-secondary button-sm">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PredictionChart fileId={fileId} />
        <AnomalyChart fileId={fileId} />

        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/analysis/${fileId}`} className="button button-secondary">
            <ArrowLeft size={14} /> Back to Analysis
          </Link>
          <Link to={`/scenarios/${fileId}`} className="button button-primary">
            Run Scenarios <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
