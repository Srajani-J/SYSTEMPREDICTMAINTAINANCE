import { RISK_LABELS } from "../../lib/format";

function RiskBadge({ level }) {
  const key = String(level || "").toLowerCase();

  return (
    <span className={`risk-badge risk-badge-${key || "unknown"}`}>
      {RISK_LABELS[key] || "No prediction"}
    </span>
  );
}

export default RiskBadge;
