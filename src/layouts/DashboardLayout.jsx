import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roles";

function DashboardLayout({ links = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLink = [...links]
    .filter((link) =>
      link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)
    )
    .sort((a, b) => b.to.length - a.to.length)[0];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          SMART<span>PREDICT</span>
        </div>

        <p className="dash-role">{roleLabel(user?.role)}</p>

        <nav className="dash-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <a href="/dashboard/classic">Classic dashboard</a>
          <a href="/profile">My profile</a>
          <button type="button" className="button ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div>
            <h1>{activeLink?.label || "Dashboard"}</h1>
            <p>{roleLabel(user?.role)} dashboard</p>
          </div>

          <div className="dash-user">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
