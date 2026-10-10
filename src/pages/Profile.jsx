
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Profile() {
  const navigate = useNavigate();

  // Get registered user information
  const userName =
    localStorage.getItem("userName") || "SystemSmart User";

  const userEmail =
    localStorage.getItem("userEmail") ||
    "user@systemsmartpredict.com";

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");

    navigate("/login");
  };

  // Select name/email when clicked
  const selectText = (event) => {
    event.target.select();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        {/* Profile Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto 20px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #008fd1, #00bfff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            fontWeight: "700",
            color: "white",
            boxShadow:
              "0 0 30px rgba(0, 191, 255, 0.3)",
          }}
        >
          👤
        </div>

        {/* Heading */}
        <h1>My Profile</h1>

        <p className="auth-subtitle">
          Manage your industrial intelligence platform account
        </p>

        {/* Full Name */}
        <div className="input-group">
          <label htmlFor="profile-name">
            Full Name
          </label>

          <input
            id="profile-name"
            type="text"
            value={userName}
            readOnly
            onClick={selectText}
            title="Click to select and copy"
          />
        </div>

        {/* Email */}
        <div className="input-group">
          <label htmlFor="profile-email">
            Email
          </label>

          <input
            id="profile-email"
            type="email"
            value={userEmail}
            readOnly
            onClick={selectText}
            title="Click to select and copy"
          />
        </div>

        {/* Account Status */}
        <div className="input-group">
          <label htmlFor="profile-status">
            Account Status
          </label>

          <input
            id="profile-status"
            type="text"
            value="Active"
            readOnly
          />
        </div>

        {/* Dashboard */}
        <Link
          to="/dashboard"
          className="auth-button"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            boxSizing: "border-box",
          }}
        >
          Go to Dashboard
        </Link>

        {/* Logout */}
        <button
          type="button"
          className="auth-button"
          onClick={handleLogout}
          style={{
            marginTop: "12px",
            background:
              "linear-gradient(90deg, #075985, #0284c7)",
          }}
        >
          Logout
        </button>

        {/* Home */}
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

