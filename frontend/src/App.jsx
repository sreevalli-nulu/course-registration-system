
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { EnrollmentProvider } from "./context/EnrollmentContext";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Courses from "./pages/Courses";
import Dashboard from "./pages/Dashboard";
import CourseDetails from "./pages/CourseDetails";
import Schedule from "./pages/Schedule";
import Transcript from "./pages/Transcript";

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
        <EnrollmentProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/courses" element={<Courses />} />
              <Route
                path="/courses/:courseId"
                element={<CourseDetails />}
              />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/transcript" element={<Transcript />} />
            </Route>
          </Routes>
        </EnrollmentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
