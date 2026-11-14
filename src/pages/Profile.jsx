import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AdminUsersPanel from "../components/AdminUsersPanel";
import { useAuth } from "../auth/AuthContext";
import "./Login.css";

function Profile() {
  const { user, logout, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        "Password updated. Other sessions have been signed out."
      );
    } catch (err) {
      setMessage(err.message || "Unable to change the password.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "Not recorded";

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        <div
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #008fd1, #00bfff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            fontWeight: "700",
            color: "white",
            boxShadow: "0 0 30px rgba(0, 191, 255, 0.3)",
          }}
        >
          👤
        </div>

        <h1>My Profile</h1>

        <p className="auth-subtitle">
          Manage your industrial intelligence platform account
        </p>

        {user?.must_change_password === 1 && (
          <div className="alert-box critical" role="status">
            <strong>Action required:</strong> this account is using a bootstrap
            password. Please set a new password below.
          </div>
        )}

        <div className="input-group">
          <label htmlFor="profile-name">Full Name</label>

          <input
            id="profile-name"
            type="text"
            value={user?.name || ""}
            readOnly
          />
        </div>

        <div className="input-group">
          <label htmlFor="profile-email">Email</label>

          <input
            id="profile-email"
            type="email"
            value={user?.email || ""}
            readOnly
          />
        </div>

        <div className="input-group">
          <label htmlFor="profile-role">Role</label>

          <input
            id="profile-role"
            type="text"
            value={user?.role || ""}
            readOnly
          />
        </div>

        <div className="input-group">
          <label htmlFor="profile-status">Account Status</label>

          <input
            id="profile-status"
            type="text"
            value={user?.is_active === 1 ? "Active" : "Disabled"}
            readOnly
          />
        </div>

        <div className="input-group">
          <label htmlFor="profile-last-login">Last Sign-in</label>

          <input
            id="profile-last-login"
            type="text"
            value={formatDate(user?.last_login)}
            readOnly
          />
        </div>

        <form onSubmit={handlePasswordChange}>

          <h2 style={{ fontSize: "18px", margin: "24px 0 12px" }}>
            Change Password
          </h2>

          <div className="input-group">
            <label htmlFor="current-password">Current Password</label>

            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="new-password">New Password</label>

            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirm-new-password">Confirm New Password</label>

            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Password"}
          </button>

        </form>

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        {user?.role === "Admin" && (
          <AdminUsersPanel currentUserId={user.id} />
        )}

        <Link
          to="/dashboard"
          className="auth-button"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            boxSizing: "border-box",
            marginTop: "16px",
          }}
        >
          Go to Dashboard
        </Link>

        <button
          type="button"
          className="auth-button"
          onClick={handleLogout}
          style={{
            marginTop: "12px",
            background: "linear-gradient(90deg, #075985, #0284c7)",
          }}
        >
          Logout
        </button>

        <p className="auth-footer">
          <Link to="/" className="auth-link">
            Back to Home
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Profile;
