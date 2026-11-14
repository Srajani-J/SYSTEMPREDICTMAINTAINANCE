import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../api/client";
import { ALL_ROLES, roleLabel } from "../auth/roles";

function AdminUsersPanel({ currentUserId, showFilters = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState(null);

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Debounce the search field so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const loadUsers = useCallback(async () => {
    try {
      setError("");

      const params = new URLSearchParams();

      if (appliedQuery) {
        params.set("q", appliedQuery);
      }

      if (roleFilter) {
        params.set("role", roleFilter);
      }

      if (statusFilter) {
        params.set("is_active", statusFilter);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/api/auth/users${suffix}`);

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function updateRole(user, role) {
    if (role === user.role) return;

    setBusyUserId(user.id);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/auth/users/${user.id}/role`, {
        method: "PATCH",
        body: { role },
      });

      setMessage(`${user.email} is now ${role}. Their sessions were revoked.`);
      await loadUsers();
    } catch (err) {
      setError(err.message || "Could not change the role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function toggleActive(user) {
    setBusyUserId(user.id);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/auth/users/${user.id}/active`, {
        method: "PATCH",
        body: { is_active: user.is_active !== 1 },
      });

      setMessage(
        `${user.email} was ${user.is_active === 1 ? "deactivated" : "activated"}.`
      );
      await loadUsers();
    } catch (err) {
      setError(err.message || "Could not update the account.");
    } finally {
      setBusyUserId(null);
    }
  }

  const cellStyle = {
    padding: "10px 8px",
    borderBottom: "1px solid rgba(150, 190, 220, 0.18)",
    textAlign: "left",
    fontSize: "13px",
  };

  return (
    <section style={{ marginTop: "28px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>
        Account Management
      </h2>

      <p style={{ fontSize: "13px", opacity: 0.8 }}>
        Administrators only. Role changes and deactivations revoke the affected
        user&apos;s sessions immediately.
      </p>

      {error && (
        <div className="alert-box critical" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert-box healthy" role="status">
          {message}
        </div>
      )}

      {showFilters ? (
        <div className="toolbar">
          <input
            type="search"
            className="toolbar-input"
            aria-label="Search accounts"
            placeholder="Search name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="">All roles</option>
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Any status</option>
            <option value="1">Active</option>
            <option value="0">Deactivated</option>
          </select>

          <button type="button" className="button ghost" onClick={loadUsers}>
            Refresh
          </button>
        </div>
      ) : null}

      {loading ? (
        <p style={{ fontSize: "13px" }}>Loading accounts...</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle}>Name</th>
                <th style={cellStyle}>Email</th>
                <th style={cellStyle}>Role</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyUserId === user.id;

                return (
                  <tr key={user.id}>
                    <td style={cellStyle}>{user.name}</td>
                    <td style={cellStyle}>{user.email}</td>
                    <td style={cellStyle}>
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={user.role}
                        disabled={isSelf || busy}
                        onChange={(event) => updateRole(user, event.target.value)}
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      {user.is_active === 1 ? "Active" : "Disabled"}
                      {user.must_change_password === 1 ? " · password reset pending" : ""}
                    </td>
                    <td style={cellStyle}>
                      <button
                        type="button"
                        disabled={isSelf || busy}
                        onClick={() => toggleActive(user)}
                        title={
                          isSelf
                            ? "You cannot deactivate your own account"
                            : undefined
                        }
                      >
                        {user.is_active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminUsersPanel;
