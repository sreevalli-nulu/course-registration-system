import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { errorText, formatTerm } from "../utils/format";

function Dashboard() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [enrolled, setEnrolled] = useState([]);
  const [waitlisted, setWaitlisted] = useState([]);
  const [loading, setLoading] = useState(isStudent);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [droppingId, setDroppingId] = useState(null);

  const loadSchedule = useCallback(async () => {
    const response = await api.get("/students/me/schedule");
    setEnrolled(response.data.enrolled);
    setWaitlisted(response.data.waitlisted);
  }, []);

  useEffect(() => {
    if (!isStudent) return;

    let cancelled = false;

    const load = async () => {
      try {
        await loadSchedule();
        if (!cancelled) setError("");
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err, "Unable to load your courses."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isStudent, loadSchedule]);

  const handleDrop = async (item) => {
    const confirmed = window.confirm(
      `Drop ${item.course_code} (Section ${item.section_number})?`
    );
    if (!confirmed) return;

    setDroppingId(item.enrollment_id);
    setMessage("");

    try {
      const response = await api.delete(`/enrollments/${item.enrollment_id}`);

      setMessage(
        response.data.promoted_student_id
          ? `Dropped ${item.course_code}. A waitlisted student was moved into the freed seat.`
          : `Dropped ${item.course_code}.`
      );

      await loadSchedule();
    } catch (err) {
      setMessage(errorText(err, "Unable to drop this course."));
    } finally {
      setDroppingId(null);
    }
  };

  const studentName =
    user?.full_name || user?.email?.split("@")[0] || "there";

  const totalCredits = enrolled.reduce(
    (total, item) => total + Number(item.credits || 0),
    0
  );

  const currentTerm = enrolled.length > 0 ? formatTerm(enrolled[0].term) : "—";

  return (
    <main className="dashboard-page compact-dashboard">
      <header className="compact-welcome">
        <div>
          <p className="compact-eyebrow">
            {isStudent ? "STUDENT PORTAL" : `${(user?.role || "").toUpperCase()} PORTAL`}
          </p>
          <h1>Welcome back, {studentName}.</h1>
          <p>
            {isStudent
              ? "Here's what's happening with your semester."
              : "Browse the course catalog and its sections."}
          </p>
        </div>
        <Link to="/courses" className="compact-primary-button">
          + Browse courses
        </Link>
      </header>

      {!isStudent && (
        <div className="compact-demo-note">
          Schedules and transcripts are available to student accounts.
        </div>
      )}

      {isStudent && (
        <>
          <section className="compact-stats">
            <article className="compact-stat">
              <span className="compact-stat-icon purple">▤</span>
              <div>
                <p>Enrolled courses</p>
                <strong>{enrolled.length}</strong>
              </div>
            </article>

            <article className="compact-stat">
              <span className="compact-stat-icon green">✓</span>
              <div>
                <p>Total credits</p>
                <strong>{totalCredits}</strong>
              </div>
            </article>

            <article className="compact-stat">
              <span className="compact-stat-icon orange">▦</span>
              <div>
                <p>Current semester</p>
                <strong className="compact-semester">{currentTerm}</strong>
              </div>
            </article>
          </section>

          {message && (
            <div className="compact-demo-note" role="status" aria-live="polite">
              {message}
            </div>
          )}

          <section className="compact-section">
            <div className="compact-section-heading">
              <div>
                <h2>My courses</h2>
                <p>Courses you are currently enrolled in</p>
              </div>
              <Link to="/courses" className="compact-view-link">
                View catalog →
              </Link>
            </div>

            {loading ? (
              <p>Loading your courses...</p>
            ) : error ? (
              <div className="compact-empty">
                <div>
                  <h3>Something went wrong</h3>
                  <p>{error}</p>
                </div>
              </div>
            ) : enrolled.length === 0 ? (
              <div className="compact-empty">
                <span className="compact-empty-symbol">＋</span>
                <div>
                  <h3>No courses yet</h3>
                  <p>Browse the catalog to enroll in your first course.</p>
                </div>
                <Link to="/courses" className="compact-outline-button">
                  Explore courses
                </Link>
              </div>
            ) : (
              <div className="compact-course-list">
                {enrolled.map((item, index) => (
                  <article
                    className="compact-course"
                    key={item.enrollment_id}
                  >
                    <span className={`compact-course-mark mark-${index % 4}`}>
                      {item.course_code.replace(/[0-9]/g, "") || "CS"}
                    </span>

                    <div className="compact-course-info">
                      <span className="compact-course-code">
                        {item.course_code}
                      </span>
                      <h3>{item.course_title}</h3>
                      <p>
                        Section {item.section_number} ·{" "}
                        {item.meeting_time || "Schedule TBA"} ·{" "}
                        {item.credits} credits
                      </p>
                    </div>

                    <div className="compact-course-actions">
                      <button
                        type="button"
                        onClick={() => handleDrop(item)}
                        disabled={droppingId === item.enrollment_id}
                      >
                        {droppingId === item.enrollment_id
                          ? "Dropping..."
                          : "Drop"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {waitlisted.length > 0 && (
            <section className="compact-section">
              <div className="compact-section-heading">
                <div>
                  <h2>Waitlist</h2>
                  <p>You will be enrolled automatically when a seat opens.</p>
                </div>
              </div>

              <div className="compact-course-list">
                {waitlisted.map((item, index) => (
                  <article
                    className="compact-course"
                    key={`${item.section_id}-waitlist`}
                  >
                    <span className={`compact-course-mark mark-${index % 4}`}>
                      #{item.position}
                    </span>

                    <div className="compact-course-info">
                      <span className="compact-course-code">
                        {item.course_code}
                      </span>
                      <h3>{item.course_title}</h3>
                      <p>
                        Section {item.section_number} ·{" "}
                        {formatTerm(item.term)} · Waitlist position{" "}
                        {item.position}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="compact-section">
        <div className="compact-section-heading">
          <div>
            <h2>Quick access</h2>
            <p>Jump straight to what you need.</p>
          </div>
        </div>

        <div className="compact-shortcuts">
          <Link to="/courses" className="compact-shortcut">
            <span className="shortcut-symbol purple">▤</span>
            <span>
              <strong>Course catalog</strong>
              <small>Browse courses and prerequisites</small>
            </span>
            <span className="shortcut-arrow">→</span>
          </Link>

          {isStudent && (
            <Link to="/schedule" className="compact-shortcut">
              <span className="shortcut-symbol green">▦</span>
              <span>
                <strong>My schedule</strong>
                <small>View your weekly timetable</small>
              </span>
              <span className="shortcut-arrow">→</span>
            </Link>
          )}

          {isStudent && (
            <Link to="/transcript" className="compact-shortcut">
              <span className="shortcut-symbol orange">▧</span>
              <span>
                <strong>My transcript</strong>
                <small>Grades, GPA and completed credits</small>
              </span>
              <span className="shortcut-arrow">→</span>
            </Link>
          )}
        </div>
      </section>

    </main>
  );
}

export default Dashboard;