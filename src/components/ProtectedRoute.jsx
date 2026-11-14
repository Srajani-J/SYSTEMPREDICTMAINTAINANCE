import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            SYSTEM<span>SMART</span>PREDICT
          </div>

          <p className="auth-subtitle">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // A bootstrap account must set its own password before using the app.
  if (user.must_change_password === 1 && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

export default ProtectedRoute;
