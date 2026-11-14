import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../../api/client";
import EmptyState from "../../components/dashboard/EmptyState";
import Pagination from "../../components/dashboard/Pagination";
import RiskBadge from "../../components/dashboard/RiskBadge";
import SectionCard from "../../components/dashboard/SectionCard";
import { formatDateTime, formatNumber, formatPercent } from "../../lib/format";

const PAGE_SIZE = 25;
const LEVELS = ["", "low", "medium", "high", "critical"];

function AdminPredictions() {
  const [predictions, setPredictions] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      if (level) {
        params.set("risk", level);
      }

      const data = await apiRequest(`/api/predictions?${params.toString()}`);

      setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      setTotal(Number(data.total_count) || 0);
    } catch (err) {
      setError(err.message || "Could not load prediction history.");
    } finally {
      setLoading(false);
    }
  }, [offset, level]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionCard
      title="Prediction history"
      description="Every model call is stored with its probability, risk band, model version and decision threshold."
      actions={
        <select
          aria-label="Filter by risk band"
          value={level}
          onChange={(event) => {
            setOffset(0);
            setLevel(event.target.value);
          }}
        >
          {LEVELS.map((value) => (
            <option key={value || "all"} value={value}>
              {value ? `${value[0].toUpperCase()}${value.slice(1)} risk` : "All risk bands"}
            </option>
          ))}
        </select>
      }
    >
      {error ? (
        <div className="alert-box critical" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="dash-muted">Loading predictions...</p>
      ) : predictions.length === 0 ? (
        <EmptyState
          title="No predictions recorded"
          hint="Run a prediction from the classic dashboard; it will appear here."
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Machine</th>
                <th>Probability</th>
                <th>Risk</th>
                <th>Decision</th>
                <th>Model</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((prediction) => (
                <tr key={prediction.id}>
                  <td>{formatDateTime(prediction.created_at)}</td>
                  <td>
                    {prediction.machine_id ? (
                      <code>{prediction.machine_id}</code>
                    ) : (
                      <span className="dash-muted">Unlinked</span>
                    )}
                  </td>
                  <td>{formatPercent(prediction.failure_probability)}</td>
                  <td>
                    <RiskBadge level={prediction.risk_level} />
                  </td>
                  <td>{prediction.prediction === 1 ? "Failure" : "No failure"}</td>
                  <td>
                    <code>{prediction.model_version}</code>
                  </td>
                  <td>{prediction.decision_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
        onChange={setOffset}
        busy={loading}
      />

      <p className="dash-note">
        Total stored predictions: {formatNumber(total)}
      </p>
    </SectionCard>
  );
}

export default AdminPredictions;
