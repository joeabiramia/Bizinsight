const formatValue = (value: any) => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") {
    return value.name ? `${value.name} (${Number(value.value).toLocaleString()})` : JSON.stringify(value);
  }
  return String(value);
};

export default function KPICards({ data }: any) {
  if (!data) return null;

  const metrics = [
    { label: "Total revenue", value: data.total_revenue },
    { label: "Average quantity", value: data.average_quantity },
    { label: "Best region", value: data.best_region },
    { label: "Top salesperson", value: data.best_salesman },
    { label: "Best-selling product", value: data.best_selling_product },
  ].filter((item) => item.value !== undefined && item.value !== null);

  if (metrics.length === 0) {
    return <p>No KPI data available</p>;
  }

  return (
    <div className="kpi-grid">
      {metrics.map((metric) => (
        <div className="kpi-card" key={metric.label}>
          <p className="kpi-label">{metric.label}</p>
          <h3 className="kpi-value">{formatValue(metric.value)}</h3>
        </div>
      ))}
    </div>
  );
}
