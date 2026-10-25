import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Sends logged-out visitors to /login. Pass roles={["student"]} to limit a page to a role.
function ProtectedRoute({ roles }) {
  const { token, user } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
