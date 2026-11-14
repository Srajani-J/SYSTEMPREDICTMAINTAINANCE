function StatCard({ label, value, hint, tone = "default" }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export default StatCard;
