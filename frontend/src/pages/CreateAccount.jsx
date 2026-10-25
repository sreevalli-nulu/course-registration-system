import { useState } from "react";
import api from "../services/api";
import { errorText } from "../utils/format";
import "../staff.css";

const EMPTY = { full_name: "", email: "", password: "", role: "instructor", department: "" };

function CreateAccount() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [created, setCreated] = useState([]);

  const setField = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (form.password.length < 6) {
      setMessage({ type: "error", text: "The password must be at least 6 characters long." });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };
      if (form.role === "instructor" && form.department.trim()) {
        payload.department = form.department.trim();
      }

      const response = await api.post("/auth/register", payload);

      setCreated((previous) => [response.data, ...previous]);
      setMessage({
        type: "success",
        text: `Created ${form.role} account for ${response.data.full_name}.`,
      });
      setForm({ ...EMPTY, role: form.role });
    } catch (err) {
      setMessage({ type: "error", text: errorText(err, "Unable to create the account.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">REGISTRAR PORTAL</p>
          <h1>Create staff account</h1>
          <p>
            Students sign up on their own. Only a registrar can create instructor or registrar
            accounts.
          </p>
        </div>
      </header>

      {message && (
        <div
          className={`staff-notice ${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      <form className="staff-card" onSubmit={handleSubmit}>
        <div className="staff-form-grid">
          <div className="staff-field">
            <label htmlFor="acc-name">Full name</label>
            <input
              id="acc-name"
              className="staff-input"
              value={form.full_name}
              onChange={setField("full_name")}
              required
            />
          </div>

          <div className="staff-field">
            <label htmlFor="acc-role">Role</label>
            <select
              id="acc-role"
              className="staff-select"
              value={form.role}
              onChange={setField("role")}
            >
              <option value="instructor">Instructor</option>
              <option value="registrar">Registrar</option>
            </select>
          </div>

          <div className="staff-field">
            <label htmlFor="acc-email">Email</label>
            <input
              id="acc-email"
              type="email"
              className="staff-input"
              value={form.email}
              onChange={setField("email")}
              required
            />
          </div>

          <div className="staff-field">
            <label htmlFor="acc-password">Temporary password</label>
            <input
              id="acc-password"
              type="password"
              className="staff-input"
              value={form.password}
              onChange={setField("password")}
              autoComplete="new-password"
              required
            />
          </div>

          {form.role === "instructor" && (
            <div className="staff-field wide">
              <label htmlFor="acc-dept">Department</label>
              <input
                id="acc-dept"
                className="staff-input"
                value={form.department}
                onChange={setField("department")}
                placeholder="e.g. Computer Science"
              />
            </div>
          )}
        </div>

        <div className="staff-form-actions">
          <button type="submit" className="staff-btn" disabled={submitting}>
            {submitting ? "Creating..." : "Create account"}
          </button>
        </div>
      </form>

      {created.length > 0 && (
        <section className="staff-card">
          <h2>Created in this session</h2>
          <p className="staff-sub">
            New instructors can now be assigned to sections from Manage sections.
          </p>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {created.map((account) => (
                  <tr key={account.id}>
                    <td>{account.full_name}</td>
                    <td>{account.email}</td>
                    <td>
                      <span className="staff-badge">{account.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default CreateAccount;
