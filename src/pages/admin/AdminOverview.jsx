import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../../api/client";
import EmptyState from "../../components/dashboard/EmptyState";
import SectionCard from "../../components/dashboard/SectionCard";
import StatCard from "../../components/dashboard/StatCard";
import { RISK_LABELS, formatDateTime, formatNumber } from "../../lib/format";

const RISK_ORDER = ["critical", "high", "medium", "low"];

function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setOverview(await apiRequest("/api/admin/overview"));
    } catch (err) {
      setError(err.message || "Could not load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="dash-muted">Loading statistics...</p>;
  }

  if (error) {
    return (
      <EmptyState
        title="Statistics unavailable"
        hint={error}
        action={
          <button type="button" className="button ghost" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  if (!overview) {
    return <EmptyState title="No statistics returned" />;
  }

  const machines = overview.machines;
  const distribution = overview.predictions.risk_distribution || {};
  const totalPredicted = RISK_ORDER.reduce(
    (sum, level) => sum + (distribution[level] || 0),
    0
  );

  return (
    <div className="dash-stack">
      <div className="dash-grid">
        <StatCard
          label="Dataset machines"
          value={formatNumber(machines.total)}
          hint="Historical AI4I records"
        />
        <StatCard
          label="Historical failures"
          value={formatNumber(machines.historical_failures)}
          hint={`${formatNumber(machines.no_failure_recorded)} without a failure`}
          tone="warning"
        />
        <StatCard
          label="Registered accounts"
          value={formatNumber(overview.users.total)}
          hint={`${formatNumber(overview.users.active)} active`}
        />
        <StatCard
          label="Machines assigned"
          value={formatNumber(machines.assigned)}
          hint={`${formatNumber(machines.with_predictions)} machine${
            machines.with_predictions === 1 ? "" : "s"
          } with predictions`}
        />
        <StatCard
          label="Predictions stored"
          value={formatNumber(overview.predictions.total)}
          hint="Every model call is recorded"
        />
        <StatCard
          label="Notifications"
          value={formatNumber(overview.notifications.total)}
          hint={`${formatNumber(
            overview.notifications.by_status?.NEW || 0
          )} awaiting acknowledgement`}
        />
        <StatCard
          label="Open work orders"
          value={formatNumber(overview.work_orders.open)}
          hint={`${formatNumber(
            overview.work_orders.total
          )} work orders in total`}
        />
        <StatCard
          label="Issue reports"
          value={formatNumber(overview.issues.total)}
          hint={`${formatNumber(
            overview.issues.by_status?.Open || 0
          )} open`}
        />
      </div>

      <SectionCard
        title="Prediction risk distribution"
        description="Counts of stored predictions per risk band. This describes prediction history, not live sensor telemetry."
      >
        {totalPredicted === 0 ? (
          <EmptyState
            title="No predictions recorded yet"
            hint="Run a prediction from the classic dashboard to populate this chart."
          />
        ) : (
          <div className="bar-chart">
            {RISK_ORDER.map((level) => {
              const value = distribution[level] || 0;
              const width = totalPredicted
                ? Math.round((value / totalPredicted) * 100)
                : 0;

              return (
                <div className="bar-row" key={level}>
                  <span className="bar-label">{RISK_LABELS[level]}</span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill bar-${level}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="bar-value">
                    {formatNumber(value)} ({width}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="dash-two-col">
        <SectionCard title="Accounts by role">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Accounts</th>
              </tr>
            </thead>
            <tbody>
              {["Admin", "Supervisor", "Maintenance", "Operator"].map((role) => (
                <tr key={role}>
                  <td>{role === "Maintenance" ? "Maintenance Engineer" : role}</td>
                  <td>{formatNumber(overview.users.by_role?.[role] || 0)}</td>
                </tr>
              ))}
              <tr>
                <td>Deactivated</td>
                <td>{formatNumber(overview.users.inactive)}</td>
              </tr>
              <tr>
                <td>Password reset pending</td>
                <td>{formatNumber(overview.users.must_change_password)}</td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Open work orders">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(overview.work_orders.by_status || {}).map(
                ([status, count]) => (
                  <tr key={status}>
                    <td>{status}</td>
                    <td>{formatNumber(count)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent administrative activity"
        description="Recorded server-side for real actions only."
      >
        {overview.recent_activity.length === 0 ? (
          <EmptyState
            title="No administrative activity yet"
            hint="Role changes, assignments and account updates will appear here."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {overview.recent_activity.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.actor_email}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>{entry.target_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <p className="dash-note">{overview.note}</p>
    </div>
  );
}

export default AdminOverview;
