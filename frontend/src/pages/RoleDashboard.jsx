import { useAuth } from "../context/AuthContext";
import Dashboard from "./Dashboard";
import InstructorDashboard from "./InstructorDashboard";
import RegistrarDashboard from "./RegistrarDashboard";

// /dashboard shows a different home page for each role.
function RoleDashboard() {
  const { user } = useAuth();

  if (user?.role === "instructor") return <InstructorDashboard />;
  if (user?.role === "registrar") return <RegistrarDashboard />;

  return <Dashboard />;
}

export default RoleDashboard;
