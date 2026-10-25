import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        {displayName && <span>{displayName}</span>}
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
