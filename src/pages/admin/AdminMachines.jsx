import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../../api/client";
import EmptyState from "../../components/dashboard/EmptyState";
import Pagination from "../../components/dashboard/Pagination";
import SectionCard from "../../components/dashboard/SectionCard";
import { formatNumber } from "../../lib/format";

const PAGE_SIZE = 20;

function AdminMachines() {
  const [machines, setMachines] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const [people, setPeople] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selection, setSelection] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMachines = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      if (appliedQuery) {
        params.set("q", appliedQuery);
      }

      const data = await apiRequest(`/api/machines?${params.toString()}`);

      setMachines(Array.isArray(data.machines) ? data.machines : []);
      setTotal(Number(data.total_count) || 0);
    } catch (err) {
      setError(err.message || "Could not load machines.");
    } finally {
      setLoading(false);
    }
  }, [offset, appliedQuery]);

  const loadDirectory = useCallback(async () => {
    try {
      const [engineers, operators, currentAssignments] = await Promise.all([
        apiRequest("/api/auth/users?role=Maintenance&is_active=1"),
        apiRequest("/api/auth/users?role=Operator&is_active=1"),
        apiRequest("/api/admin/assignments"),
      ]);

      setPeople([...(engineers || []), ...(operators || [])]);
      setAssignments(Array.isArray(currentAssignments) ? currentAssignments : []);
    } catch (err) {
      setError(err.message || "Could not load assignment data.");
    }
  }, []);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Debounce the search field.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setAppliedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  const assignmentsByMachine = useMemo(() => {
    const map = new Map();

    for (const assignment of assignments) {
      const list = map.get(assignment.machine_id) || [];
      list.push(assignment);
      map.set(assignment.machine_id, list);
    }

    return map;
  }, [assignments]);

  async function assign(machineId) {
    const userId = selection[machineId];

    if (!userId) {
      setError("Choose an engineer or operator first.");
      return;
    }

    setBusyKey(machineId);
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/admin/assignments", {
        method: "POST",
        body: { machine_id: machineId, user_id: Number(userId) },
      });

      setMessage(`${machineId} was assigned.`);
      setSelection((current) => ({ ...current, [machineId]: "" }));
      await loadDirectory();
    } catch (err) {
      setError(err.message || "Could not assign this machine.");
    } finally {
      setBusyKey("");
    }
  }

  async function unassign(assignment) {
    setBusyKey(assignment.machine_id);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/admin/assignments/${assignment.id}`, {
        method: "DELETE",
      });

      setMessage(
        `${assignment.user_email} no longer has access to ${assignment.machine_id}.`
      );
      await loadDirectory();
    } catch (err) {
      setError(err.message || "Could not remove this assignment.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="dash-stack">
      <SectionCard
        title="Assign machines"
        description="Maintenance Engineers and Operators only see machines assigned to them. Admins and Supervisors already see everything."
        actions={
          <input
            type="search"
            className="toolbar-input"
            placeholder="Search UDI, product or type"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search machines"
          />
        }
      >
        {error ? (
          <div className="alert-box critical" role="alert">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="alert-box healthy" role="status">
            {message}
          </div>
        ) : null}

        {loading ? (
          <p className="dash-muted">Loading machines...</p>
        ) : machines.length === 0 ? (
          <EmptyState
            title="No machines matched"
            hint="Try a different id, product id or product type."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Recorded status</th>
                  <th>Assigned to</th>
                  <th>Assign</th>
                </tr>
              </thead>

              <tbody>
                {machines.map((machine) => {
                  const current = assignmentsByMachine.get(machine.machine_id) || [];

                  return (
                    <tr key={machine.machine_id}>
                      <td>
                        <code>{machine.machine_id}</code>
                      </td>
                      <td>{machine.product_id}</td>
                      <td>{machine.product_type}</td>
                      <td>
                        {machine.failure === 1
                          ? "Failure recorded"
                          : "No failure recorded"}
                      </td>
                      <td>
                        {current.length === 0 ? (
                          <span className="dash-muted">Unassigned</span>
                        ) : (
                          <div className="chip-row">
                            {current.map((assignment) => (
                              <span className="chip" key={assignment.id}>
                                {assignment.user_name}
                                <button
                                  type="button"
                                  aria-label={`Remove ${assignment.user_email} from ${assignment.machine_id}`}
                                  onClick={() => unassign(assignment)}
                                  disabled={busyKey === assignment.machine_id}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="inline-form">
                          <select
                            aria-label={`Assignee for ${machine.machine_id}`}
                            value={selection[machine.machine_id] || ""}
                            onChange={(event) =>
                              setSelection((state) => ({
                                ...state,
                                [machine.machine_id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select person</option>
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name} ({person.role})
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="button primary"
                            onClick={() => assign(machine.machine_id)}
                            disabled={busyKey === machine.machine_id}
                          >
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      </SectionCard>

      <SectionCard
        title="Current assignments"
        description={`${formatNumber(assignments.length)} active assignment${
          assignments.length === 1 ? "" : "s"
        }.`}
      >
        {assignments.length === 0 ? (
          <EmptyState
            title="No machines assigned yet"
            hint="Assign a machine above to give an engineer or operator access."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Assigned</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <code>{assignment.machine_id}</code>
                    </td>
                    <td>{assignment.user_email}</td>
                    <td>{assignment.user_role}</td>
                    <td>{assignment.assigned_at}</td>
                    <td>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => unassign(assignment)}
                        disabled={busyKey === assignment.machine_id}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default AdminMachines;
