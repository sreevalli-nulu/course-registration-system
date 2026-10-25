import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import useTerms from "../hooks/useTerms";
import { useAuth } from "../context/AuthContext";
import { errorText, formatTerm } from "../utils/format";
import "../staff.css";

function RegistrarDashboard() {
  const { user } = useAuth();
  const { currentTerm, ready, error: termError } = useTerms();

  const [result, setResult] = useState({ term: null, courses: [], instructors: [], sections: [], error: "" });
  const loading = Boolean(currentTerm) && result.term !== currentTerm;

  useEffect(() => {
    if (!currentTerm) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [courses, instructors, sections] = await Promise.all([
          api.get("/courses"),
          api.get("/instructors"),
          api.get("/sections", { params: { term: currentTerm } }),
        ]);
        if (!cancelled) {
          setResult({
            term: currentTerm,
            courses: courses.data,
            instructors: instructors.data,
            sections: sections.data,
            error: "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            term: currentTerm,
            courses: [],
            instructors: [],
            sections: [],
            error: errorText(err, "Unable to load the overview."),
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentTerm]);

  const { courses, instructors, sections } = result;
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));
  const totalSeats = sections.reduce((sum, s) => sum + s.capacity, 0);
  const takenSeats = sections.reduce((sum, s) => sum + s.seats_taken, 0);
  const fullSections = sections.filter((s) => s.seats_taken >= s.capacity);
  const noInstructor = sections.filter((s) => s.instructor_id == null);
  const name = user?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">REGISTRAR PORTAL</p>
          <h1>Welcome back, {name}.</h1>
          <p>
            Overview for {formatTerm(currentTerm) || "the current term"}, the term open for
            enrollment.
          </p>
        </div>

        <div className="staff-actions">
          <Link to="/admin/sections" className="staff-btn">
            Manage sections
          </Link>
          <Link to="/admin/courses" className="staff-btn secondary">
            Manage courses
          </Link>
          <Link to="/admin/accounts" className="staff-btn secondary">
            Create account
          </Link>
        </div>
      </header>

      {(termError || result.error) && (
        <div className="staff-notice error" role="alert">
          {termError || result.error}
        </div>
      )}

      <section className="staff-stats">
        <article className="staff-stat">
          <p>Courses in catalog</p>
          <strong>{courses.length}</strong>
        </article>
        <article className="staff-stat">
          <p>Instructors</p>
          <strong>{instructors.length}</strong>
        </article>
        <article className="staff-stat">
          <p>Sections this term</p>
          <strong>{sections.length}</strong>
        </article>
        <article className="staff-stat">
          <p>Seats filled</p>
          <strong>
            {takenSeats} / {totalSeats}
          </strong>
        </article>
      </section>

      {loading || !ready ? (
        <p>Loading overview...</p>
      ) : (
        <>
          <section className="staff-card">
            <h2>Full sections</h2>
            <p className="staff-sub">
              Students trying to enroll in these are placed on a waitlist. Open one to see the
              waitlist, or add capacity from Manage sections to let waitlisted students in.
            </p>

            {fullSections.length === 0 ? (
              <div className="staff-empty">No section is full right now.</div>
            ) : (
              <div className="staff-table-wrap">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Section</th>
                      <th>Seats</th>
                      <th className="right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullSections.map((section) => (
                      <tr key={section.id}>
                        <td>
                          {courseById[section.course_id]?.code}{" "}
                          {courseById[section.course_id]?.title}
                        </td>
                        <td>{section.section_number}</td>
                        <td>
                          <span className="staff-badge full">
                            {section.seats_taken}/{section.capacity}
                          </span>
                        </td>
                        <td className="right">
                          <Link to={`/sections/${section.id}`} className="staff-btn small secondary">
                            Roster &amp; waitlist
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {noInstructor.length > 0 && (
            <section className="staff-card">
              <h2>Sections without an instructor</h2>
              <p className="staff-sub">Assign an instructor from Manage sections.</p>
              <ul>
                {noInstructor.map((section) => (
                  <li key={section.id}>
                    {courseById[section.course_id]?.code} — Section {section.section_number}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default RegistrarDashboard;
