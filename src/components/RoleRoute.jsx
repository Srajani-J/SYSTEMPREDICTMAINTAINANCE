import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../auth/roles";

// Renders children only when the signed-in user holds one of the allowed
// roles. The API enforces the same rules, so this is navigation convenience
// rather than the security boundary.
function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="dash-content">
        <div className="empty-state">
          <strong>This dashboard is not available for your role.</strong>
          <p>
            Your account is signed in as {user.role}. Use the dashboard that
            matches your role, or ask an administrator for access.
          </p>
          <div className="empty-action">
            <a className="button ghost" href={roleHome(user.role)}>
              Go to my dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default RoleRoute;
