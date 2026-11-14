import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../../api/client";
import EmptyState from "../../components/dashboard/EmptyState";
import Pagination from "../../components/dashboard/Pagination";
import SectionCard from "../../components/dashboard/SectionCard";
import { formatDateTime, formatNumber } from "../../lib/format";

const PAGE_SIZE = 25;
const ACTIONS = [
  "",
  "user.role_changed",
  "user.activated",
  "user.deactivated",
  "machine.assigned",
  "machine.unassigned",
];

function AdminAudit() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("");
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

      if (action) {
        params.set("action", action);
      }

      const data = await apiRequest(`/api/admin/audit?${params.toString()}`);

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotal(Number(data.total_count) || 0);
    } catch (err) {
      setError(err.message || "Could not load the audit log.");
    } finally {
      setLoading(false);
    }
  }, [offset, action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionCard
      title="Audit log"
      description="Administrative activity recorded by the server: role changes, activations and machine assignments."
      actions={
        <select
          aria-label="Filter by action"
          value={action}
          onChange={(event) => {
            setOffset(0);
            setAction(event.target.value);
          }}
        >
          {ACTIONS.map((value) => (
            <option key={value || "all"} value={value}>
              {value || "All actions"}
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
        <p className="dash-muted">Loading audit entries...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No audit entries"
          hint="Change a role or assign a machine and the entry will appear here."
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.actor_email}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>{entry.target_id || "—"}</td>
                  <td>
                    <code className="details-cell">
                      {JSON.stringify(entry.details)}
                    </code>
                  </td>
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

      <p className="dash-note">{formatNumber(total)} entries recorded.</p>
    </SectionCard>
  );
}

export default AdminAudit;
