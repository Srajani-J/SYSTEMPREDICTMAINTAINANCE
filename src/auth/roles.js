// Role metadata shared by routing, navigation and labels.
//
// Storage values stay as they are in the database; only the display label
// changes for the Maintenance role.

export const ROLE_LABELS = {
  Admin: "Administrator",
  Supervisor: "Supervisor",
  Maintenance: "Maintenance Engineer",
  Operator: "Operator",
};

// Where each role lands after signing in. Roles whose dashboard has not been
// built yet keep using the original dashboard.
export const ROLE_HOME = {
  Admin: "/admin",
};

export const ALL_ROLES = ["Admin", "Supervisor", "Maintenance", "Operator"];

export const ASSIGNABLE_ROLES = ["Maintenance", "Operator"];

export function roleHome(role) {
  return ROLE_HOME[role] || "/dashboard";
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "Unknown role";
}
