type MetricCardProps = {
  variant: "service" | "health" | "refresh";
  title: string;
  value: string;
  subtitle: string;
  onClick?: () => void;
};

export function MetricCard({ variant, title, value, subtitle, onClick }: MetricCardProps) {
  if (onClick) {
    return (
      <button type="button" className={`metric-card metric-card-button ${variant}`} onClick={onClick}>
        <div className="metric-card-title">{title}</div>
        <div className="metric-card-value">{value}</div>
        <div className="metric-card-subtitle">{subtitle}</div>
      </button>
    );
  }

  return (
    <div className={`metric-card ${variant}`}>
      <div className="metric-card-title">{title}</div>
      <div className="metric-card-value">{value}</div>
      <div className="metric-card-subtitle">{subtitle}</div>
    </div>
  );
}
