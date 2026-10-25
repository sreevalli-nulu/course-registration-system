
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEnrollments } from "../context/EnrollmentContext";

function Dashboard() {
  const { user } = useAuth();
  const { demoEnrollments, dropDemo } = useEnrollments();

  const studentName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Student";

  const totalCredits = demoEnrollments.reduce(
    (total, item) => total + Number(item.course?.credits || 0),
    0
  );

  return (
    <main className="dashboard-page compact-dashboard">
      <header className="compact-welcome">
        <div>
          <p className="compact-eyebrow">STUDENT PORTAL / FALL 2026</p>
          <h1>Welcome back, {studentName}.</h1>
          <p>Here's what's happening with your semester.</p>
        </div>
        <Link to="/courses" className="compact-primary-button">
          + Browse courses
        </Link>
      </header>

      <div className="compact-demo-note">
        Demo mode: enrollments are saved in this browser, not on the server.
      </div>

      <section className="compact-stats">
        <article className="compact-stat">
          <span className="compact-stat-icon purple">▤</span>
          <div>
            <p>Enrolled courses</p>
            <strong>{demoEnrollments.length}</strong>
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
            <strong className="compact-semester">Fall 2026</strong>
          </div>
        </article>
      </section>

      <section className="compact-section">
        <div className="compact-section-heading">
          <div>
            <h2>My courses</h2>
            <p>Your current demo enrollments</p>
          </div>
          <Link to="/courses" className="compact-view-link">
            View catalog →
          </Link>
        </div>

        {demoEnrollments.length === 0 ? (
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
            {demoEnrollments.map((item, index) => (
              <article
                className="compact-course"
                key={item.sectionId}
              >
                <span className={`compact-course-mark mark-${index % 4}`}>
                  {item.course?.code?.replace(/[0-9]/g, "") || "CS"}
                </span>

                <div className="compact-course-info">
                  <span className="compact-course-code">
                    {item.course?.code}
                  </span>
                  <h3>{item.course?.title}</h3>
                  <p>
                    Section {item.section?.section_number || "01"} ·{" "}
                    {item.section?.meeting_time || "Schedule TBA"} ·{" "}
                    {item.course?.credits || 0} credits
                  </p>
                </div>

                <div className="compact-course-actions">
                  <Link to={`/courses/${item.courseId}`}>
                    Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => dropDemo(item.sectionId)}
                  >
                    Drop
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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

          <Link to="/schedule" className="compact-shortcut">
            <span className="shortcut-symbol green">▦</span>
            <span>
              <strong>My schedule</strong>
              <small>View your weekly timetable</small>
            </span>
            <span className="shortcut-arrow">→</span>
          </Link>

          <Link to="/transcript" className="compact-shortcut">
            <span className="shortcut-symbol orange">▧</span>
            <span>
              <strong>My transcript</strong>
              <small>Review enrolled courses and credits</small>
            </span>
            <span className="shortcut-arrow">→</span>
          </Link>
        </div>
      </section>
      <footer className="dashboard-credit">
  Frontend — Gayathri
</footer>
    </main>
  );
}

export default Dashboard;