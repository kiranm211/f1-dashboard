type MetricCardProps = {
  label: string;
  value: string;
  accent?: string;
};

export function MetricCard({ label, value, accent = "#f7b731" }: MetricCardProps) {
  return (
    <article className="metric-card" style={{ borderColor: accent }}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  );
}