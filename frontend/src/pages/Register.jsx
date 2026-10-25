import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, loginUser } from "../services/auth";
import { useAuth } from "../context/AuthContext";

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [studentNumber, setStudentNumber] = useState("");
  const [department, setDepartment] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const userData = {
        email,
        password,
        full_name: fullName,
        role,
        student_number: role === "student" ? studentNumber : null,
        department: role === "instructor" ? department : null,
      };

      await registerUser(userData);

      // Registration does not log the user in,
      // so we log them in immediately after registration.
      const loginData = await loginUser(email, password);

      login(
        {
          email,
          full_name: fullName,
          role: loginData.role,
        },
        loginData.access_token
      );

      navigate("/dashboard");
    } catch (err) {
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        if (Array.isArray(detail)) {
          setError(detail.map((item) => item.msg).join(", "));
        } else {
          setError(detail);
        }
      } else {
        setError("Unable to connect to the server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Course Registration System</h1>
        <h2>Register</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="registrar">Registrar</option>
            </select>
          </div>

          {role === "student" && (
            <div className="form-group">
              <label>Student Number</label>
              <input
                type="text"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="Enter your student number"
                required
              />
            </div>
          )}

          {role === "instructor" && (
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Enter your department"
              />
            </div>
          )}

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;