
import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";

function NotificationPanel({ refreshKey = 0 }) {
  const { logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load notifications from the backend.
  const fetchNotifications = useCallback(async () => {
    try {
      setError("");

      const data = await apiRequest(
        "/api/notifications?limit=100&offset=0"
      );

      // Support both a raw array and an object containing notifications.
      const notificationList = Array.isArray(data)
        ? data
        : Array.isArray(data.notifications)
          ? data.notifications
          : [];

      setNotifications(notificationList);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        return;
      }

      setError(err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Initial load, dashboard refresh and automatic 15-second refresh.
  // Polling pauses while the tab is hidden and refreshes when it returns.
  useEffect(() => {
    fetchNotifications();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotifications, refreshKey]);

  // Notification summary counts.
  const newCount = notifications.filter(
    (item) => item.status === "NEW"
  ).length;

  const criticalCount = notifications.filter(
    (item) =>
      item.severity === "CRITICAL" &&
      item.status !== "RESOLVED"
  ).length;

  const acknowledgedCount = notifications.filter(
    (item) => item.status === "ACKNOWLEDGED"
  ).length;

  const resolvedCount = notifications.filter(
    (item) => item.status === "RESOLVED"
  ).length;

  const visibleNotifications =
    filter === "ALL"
      ? notifications
      : notifications.filter(
          (item) => item.status === filter
        );

  // Assign, acknowledge or resolve a notification.
  async function performAction(
    notificationId,
    action,
    body = null
  ) {
    const actionKey = `${notificationId}-${action}`;

    try {
      setError("");
      setMessage("");

      setActionLoading((previous) => ({
        ...previous,
        [actionKey]: true,
      }));

      await apiRequest(
        `/api/notifications/${notificationId}/${action}`,
        {
          method: action === "assign" ? "PATCH" : "POST",
          body: body || undefined,
        }
      );

      setMessage(
        action === "assign"
          ? "Technician assigned successfully."
          : action === "acknowledge"
            ? "Notification acknowledged successfully."
            : "Notification resolved successfully."
      );

      await fetchNotifications();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        return;
      }

      setError(
        err.message || "Notification action failed."
      );
    } finally {
      setActionLoading((previous) => ({
        ...previous,
        [actionKey]: false,
      }));
    }
  }

  // Validate and assign a technician.
  function handleAssign(notificationId) {
    const technician = (
      assignments[notificationId] || ""
    ).trim();

    if (technician.length < 2) {
      setError(
        "Enter a technician name before assigning the alert."
      );
      return;
    }

    performAction(notificationId, "assign", {
      assigned_to: technician,
    });
  }

  // Format notification timestamps.
  function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  const buttonStyle = {
    padding: "9px 13px",
    borderRadius: "7px",
    border: "1px solid rgba(150, 190, 220, 0.25)",
    background: "#102b43",
    color: "#eaf5ff",
    cursor: "pointer",
    fontWeight: 600,
  };

  const inputStyle = {
    padding: "10px",
    minWidth: "180px",
    borderRadius: "7px",
    border: "1px solid rgba(150, 190, 220, 0.3)",
    background: "#0b1b2b",
    color: "#ffffff",
  };

  return (
    <section
      className="dashboard-section"
      id="maintenance-notifications"
    >
      {/* Section heading */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2>Maintenance Notifications</h2>

          <p>
            Intelligent failure-risk alerts, maintenance
            coordination, and technician assignment management.
          </p>
        </div>

        <button
          type="button"
          style={buttonStyle}
          onClick={fetchNotifications}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh Alerts"}
        </button>
      </div>

      {/* Notification summary cards */}
      <div
        className="dashboard-cards"
        style={{ marginTop: "18px" }}
      >
        <div className="dashboard-card">
          <h3>New Alerts</h3>
          <div className="dashboard-value">
            {newCount}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Active Critical Alerts</h3>
          <div className="dashboard-value">
            {criticalCount}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Acknowledged</h3>
          <div className="dashboard-value">
            {acknowledgedCount}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Resolved</h3>
          <div className="dashboard-value">
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* Notification filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          margin: "22px 0",
        }}
      >
        <strong>Filter alerts:</strong>

        {[
          "ALL",
          "NEW",
          "ACKNOWLEDGED",
          "RESOLVED",
        ].map((status) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilter(status)}
            style={{
              ...buttonStyle,
              background:
                filter === status ? "#087da8" : "#102b43",
              borderColor:
                filter === status
                  ? "#16c8ff"
                  : "rgba(150, 190, 220, 0.25)",
            }}
          >
            {status === "ALL"
              ? "All"
              : status.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Error and success messages */}
      {error && (
        <div className="alert-box critical" role="alert">
          <strong>Notification error:</strong> {error}
        </div>
      )}

      {message && (
        <div className="alert-box healthy" role="status">
          {message}
        </div>
      )}

      {/* Notification list */}
      {loading && notifications.length === 0 ? (
        <p>Loading maintenance notifications...</p>
      ) : visibleNotifications.length === 0 ? (
        <div className="dashboard-card">
          <h3>No notifications found</h3>

          <p>
            There are no notifications in this category.
            Run an AI prediction to generate an alert when
            sufficient failure risk is identified.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {visibleNotifications.map((notification) => {
            const isResolved =
              notification.status === "RESOLVED";

            const isCritical =
              notification.severity === "CRITICAL";

            return (
              <article
                key={notification.id}
                className={`alert-box ${
                  isResolved
                    ? "healthy"
                    : isCritical
                      ? "critical"
                      : ""
                }`}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                }}
              >
                {/* Notification title and status */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <h3>{notification.title}</h3>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={`status ${
                        isCritical ? "critical" : "healthy"
                      }`}
                    >
                      {notification.severity}
                    </span>

                    <span
                      className={`status ${
                        isResolved ||
                        notification.status === "ACKNOWLEDGED"
                          ? "healthy"
                          : "critical"
                      }`}
                    >
                      {notification.status}
                    </span>
                  </div>
                </div>

                <p>{notification.message}</p>

                {/* Notification details */}
                <div
                  className="dashboard-cards"
                  style={{ margin: "16px 0" }}
                >
                  <div className="dashboard-card">
                    <h3>Operating Profile</h3>

                    <div className="dashboard-value">
                      {notification.profile_id || "--"}
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Product ID</h3>

                    <div className="dashboard-value">
                      {notification.product_id || "--"}
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Failure Probability</h3>

                    <div className="dashboard-value">
                      {(
                        Number(
                          notification.failure_probability
                        ) * 100
                      ).toFixed(2)}
                      %
                    </div>
                  </div>
                </div>

                <p>
                  <strong>Assigned technician:</strong>{" "}
                  {notification.assigned_to || "Unassigned"}
                </p>

                <p>
                  <strong>Created:</strong>{" "}
                  {formatDate(notification.created_at)}
                </p>

                {notification.acknowledged_at && (
                  <p>
                    <strong>Acknowledged:</strong>{" "}
                    {formatDate(
                      notification.acknowledged_at
                    )}
                  </p>
                )}

                {notification.resolved_at && (
                  <p>
                    <strong>Resolved:</strong>{" "}
                    {formatDate(notification.resolved_at)}
                  </p>
                )}

                {/* Sensor readings and SHAP explanations */}
                <details style={{ margin: "12px 0" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    View sensor readings and SHAP explanation
                  </summary>

                  <div style={{ marginTop: "12px" }}>
                    <h4>Prediction Inputs</h4>

                    {Object.entries(
                      notification.input_data || {}
                    ).map(([name, value]) => (
                      <p key={name}>
                        <strong>{name}:</strong> {value}
                      </p>
                    ))}

                    <h4>SHAP Explanation</h4>

                    {(notification.explanations || []).map(
                      (item, index) => (
                        <p
                          key={`${item.sensor || "sensor"}-${index}`}
                        >
                          <strong>{item.sensor}:</strong>{" "}
                          {item.shap_value} ({item.direction})
                        </p>
                      )
                    )}
                  </div>
                </details>

                {/* Notification management actions */}
                {!isResolved && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      alignItems: "center",
                      marginTop: "16px",
                    }}
                  >
                    <input
                      type="text"
                      aria-label={`Technician for notification ${notification.id}`}
                      placeholder="Technician name"
                      value={
                        assignments[notification.id] ?? ""
                      }
                      onChange={(event) =>
                        setAssignments((previous) => ({
                          ...previous,
                          [notification.id]:
                            event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={Boolean(
                        actionLoading[
                          `${notification.id}-assign`
                        ]
                      )}
                      onClick={() =>
                        handleAssign(notification.id)
                      }
                    >
                      {actionLoading[
                        `${notification.id}-assign`
                      ]
                        ? "Assigning..."
                        : "Assign Technician"}
                    </button>

                    {notification.status === "NEW" && (
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={Boolean(
                          actionLoading[
                            `${notification.id}-acknowledge`
                          ]
                        )}
                        onClick={() =>
                          performAction(
                            notification.id,
                            "acknowledge"
                          )
                        }
                      >
                        {actionLoading[
                          `${notification.id}-acknowledge`
                        ]
                          ? "Updating..."
                          : "Acknowledge"}
                      </button>
                    )}

                    <button
                      type="button"
                      style={{
                        ...buttonStyle,
                        background: "#176b48",
                      }}
                      disabled={Boolean(
                        actionLoading[
                          `${notification.id}-resolve`
                        ]
                      )}
                      onClick={() =>
                        performAction(
                          notification.id,
                          "resolve"
                        )
                      }
                    >
                      {actionLoading[
                        `${notification.id}-resolve`
                      ]
                        ? "Resolving..."
                        : "Resolve Alert"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Refresh information */}
      <p
        style={{
          marginTop: "16px",
          opacity: 0.7,
          fontSize: "13px",
        }}
      >
        Notifications refresh automatically every 15 seconds
        while this dashboard is open. These are AI-generated
        alerts, not live IoT sensor notifications.
      </p>
    </section>
  );
}

export default NotificationPanel;
