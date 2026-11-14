import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import DashboardRedirect from "./pages/DashboardRedirect";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";

import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMachines from "./pages/admin/AdminMachines";
import AdminPredictions from "./pages/admin/AdminPredictions";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminReports from "./pages/admin/AdminReports";
import AdminAudit from "./pages/admin/AdminAudit";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import DashboardLayout from "./layouts/DashboardLayout";

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/machines", label: "Machines" },
  { to: "/admin/predictions", label: "Predictions" },
  { to: "/admin/notifications", label: "Notifications" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/audit", label: "Audit log" },
];

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Home */}
          <Route path="/" element={<Home />} />

          {/* Authentication */}
          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />

          {/* Protected Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Protected Dashboard: forwards to the role dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRedirect />
              </ProtectedRoute>
            }
          />

          {/* The original dashboard stays reachable for every role */}
          <Route
            path="/dashboard/classic"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleRoute roles={["Admin"]}>
                  <DashboardLayout links={ADMIN_LINKS} />
                </RoleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="machines" element={<AdminMachines />} />
            <Route path="predictions" element={<AdminPredictions />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
