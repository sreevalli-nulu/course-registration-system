import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../notifications.css";

const POLL_MS = 30000;

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Refresh on every page change, every 30 seconds, and when a page says so.
  useEffect(() => {
    let cancelled = false;

    const refreshUnread = async () => {
      try {
        const response = await api.get("/notifications", { params: { limit: 1 } });
        if (!cancelled) setUnreadCount(response.data.unread_count);
      } catch {
        // The bell is a convenience; ignore failures (a 401 is handled globally).
      }
    };

    refreshUnread();

    const timer = setInterval(refreshUnread, POLL_MS);
    window.addEventListener("notifications-updated", refreshUnread);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("notifications-updated", refreshUnread);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const displayName = user?.full_name || user?.email;
  const isStudent = user?.role === "student";

  return (
    <nav className="app-navbar">
      <NavLink to="/dashboard" className="navbar-brand">
        CourseHub
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/courses">Courses</NavLink>
        {isStudent && <NavLink to="/schedule">Schedule</NavLink>}
        {isStudent && <NavLink to="/transcript">Transcript</NavLink>}
      </div>

      <div className="navbar-account">
        <NavLink
          to="/notifications"
          className="navbar-bell"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          🔔
          {unreadCount > 0 && (
            <span className="navbar-bell-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </NavLink>

        {displayName && <span>{displayName}</span>}
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
