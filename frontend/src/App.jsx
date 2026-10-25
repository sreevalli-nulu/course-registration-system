
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Courses from "./pages/Courses";
import RoleDashboard from "./pages/RoleDashboard";
import CourseDetails from "./pages/CourseDetails";
import Schedule from "./pages/Schedule";
import Transcript from "./pages/Transcript";
import Notifications from "./pages/Notifications";
import SectionManage from "./pages/SectionManage";
import ManageCourses from "./pages/ManageCourses";
import ManageSections from "./pages/ManageSections";
import CreateAccount from "./pages/CreateAccount";

function MainLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<RoleDashboard />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:courseId" element={<CourseDetails />} />
              <Route path="/notifications" element={<Notifications />} />

              <Route element={<ProtectedRoute roles={["student"]} />}>
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/transcript" element={<Transcript />} />
              </Route>

              <Route element={<ProtectedRoute roles={["instructor", "registrar"]} />}>
                <Route path="/sections/:sectionId" element={<SectionManage />} />
              </Route>

              <Route element={<ProtectedRoute roles={["registrar"]} />}>
                <Route path="/admin/courses" element={<ManageCourses />} />
                <Route path="/admin/sections" element={<ManageSections />} />
                <Route path="/admin/accounts" element={<CreateAccount />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
