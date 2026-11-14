import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../../api/client";
import EmptyState from "../../components/dashboard/EmptyState";
import SectionCard from "../../components/dashboard/SectionCard";
import StatCard from "../../components/dashboard/StatCard";
import { RISK_LABELS, formatNumber, formatPercent } from "../../lib/format";

const EXPORT_LIMIT = 200;

function toCsv(rows) {
  const header = [
    "prediction_id",
    "created_at",
    "machine_id",
    "failure_probability",
    "risk_level",
    "prediction",
    "model_version",
    "decision_threshold",
  ];

  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);

    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return [
    header.join(","),
    ...rows.map((row) =>
      header.map((field) => escape(row[field])).join(",")
    ),
  ].join("\n");
}

function AdminReports() {
  const [overview, setOverview] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [stats, history] = await Promise.all([
        apiRequest("/api/admin/overview"),
        apiRequest(`/api/predictions?limit=${EXPORT_LIMIT}&offset=0`),
      ]);

      setOverview(stats);
      setPredictions(Array.isArray(history.predictions) ? history.predictions : []);
    } catch (err) {
      setError(err.message || "Could not build the report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function download() {
    const blob = new Blob([toCsv(predictions)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `smartpredict-predictions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="dash-muted">Building report...</p>;
  }

  if (error || !overview) {
    return (
      <EmptyState
        title="Report unavailable"
        hint={error || "No data returned."}
        action={
          <button type="button" className="button ghost" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  const distribution = overview.predictions.risk_distribution || {};

  return (
    <div className="dash-stack">
      <div className="dash-grid">
        <StatCard
          label="Dataset machines"
          value={formatNumber(overview.machines.total)}
          hint="Historical records"
        />
        <StatCard
          label="Historical failures"
          value={formatNumber(overview.machines.historical_failures)}
          hint="From the AI4I dataset"
          tone="warning"
        />
        <StatCard
          label="Predictions stored"
          value={formatNumber(overview.predictions.total)}
          hint={`${formatNumber(
            overview.predictions.machines_with_predictions
          )} machines covered`}
        />
        <StatCard
          label="Notifications"
          value={formatNumber(overview.notifications.total)}
          hint={`${formatNumber(
            overview.notifications.by_severity?.CRITICAL || 0
          )} critical severity`}
        />
      </div>

      <SectionCard
        title="Risk distribution"
        description="Stored predictions by band."
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Band</th>
              <th>Predictions</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {["critical", "high", "medium", "low"].map((level) => {
              const count = distribution[level] || 0;
              const share = overview.predictions.total
                ? count / overview.predictions.total
                : 0;

              return (
                <tr key={level}>
                  <td>{RISK_LABELS[level]}</td>
                  <td>{formatNumber(count)}</td>
                  <td>{formatPercent(share)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Prediction export"
        description={`The ${predictions.length} most recent stored predictions are available as CSV.`}
        actions={
          <button
            type="button"
            className="button primary"
            onClick={download}
            disabled={predictions.length === 0}
          >
            Download CSV
          </button>
        }
      >
        {predictions.length === 0 ? (
          <EmptyState title="Nothing to export yet" hint="Run a prediction first." />
        ) : (
          <p className="dash-note">
            Includes probability, risk band, model version, decision threshold
            and machine id for each prediction.
          </p>
        )}
      </SectionCard>

      <p className="dash-note">
        Failure counts are historical dataset labels, not live sensor readings.
      </p>
    </div>
  );
}

export default AdminReports;
