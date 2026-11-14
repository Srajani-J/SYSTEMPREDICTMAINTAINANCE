import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../auth/roles";

// /dashboard stays as the entry point and forwards each role to the dashboard
// built for it. Roles without one yet keep using the classic dashboard.
function DashboardRedirect() {
  const { user } = useAuth();

  return <Navigate to={roleHome(user?.role)} replace />;
}

export default DashboardRedirect;
