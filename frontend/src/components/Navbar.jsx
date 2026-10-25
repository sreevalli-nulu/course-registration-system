
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (typeof logout === "function") {
      logout();
    }

    navigate("/login");
  };

  return (
    <nav className="app-navbar">
      <NavLink to="/dashboard" className="navbar-brand">
        CourseHub
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/courses">Courses</NavLink>
        <NavLink to="/schedule">Schedule</NavLink>
        <NavLink to="/transcript">Transcript</NavLink>
      </div>

      <div className="navbar-account">
        {user?.name && <span>{user.name}</span>}
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
