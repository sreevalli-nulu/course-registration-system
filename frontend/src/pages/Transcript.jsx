
import { Link } from "react-router-dom";
import { useEnrollments } from "../context/EnrollmentContext";

function Transcript() {
  const { demoEnrollments } = useEnrollments();

  const totalCredits = demoEnrollments.reduce(
    (total, enrollment) =>
      total + Number(enrollment.course.credits || 0),
    0
  );

  return (
    <main className="transcript-page">
      <Link to="/dashboard">← Back to Dashboard</Link>

      <header>
        <h1>My Transcript</h1>
        <p>Review your enrolled courses and academic progress.</p>
      </header>

      <p className="demo-notice">
        Demo mode: these are your temporary demo enrollments, not official
        academic records. Grades and completed-course credits are not available.
      </p>

      <section className="transcript-summary">
        <div>
          <p>Enrolled Courses</p>
          <h2>{demoEnrollments.length}</h2>
        </div>

        <div>
          <p>Credits in Enrolled Courses</p>
          <h2>{totalCredits}</h2>
        </div>
      </section>

      <section className="transcript-records">
        <h2>Course Records</h2>

        {demoEnrollments.length === 0 ? (
          <div>
            <p>No enrolled courses to display yet.</p>
            <Link to="/courses">Browse Courses</Link>
          </div>
        ) : (
          <div className="transcript-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Section</th>
                  <th>Credits</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {demoEnrollments.map((enrollment) => {
                  const course = enrollment.course;
                  const section = enrollment.section;

                  return (
                    <tr key={enrollment.sectionId}>
                      <td>
                        {course.course_code || course.code || "N/A"}
                      </td>
                      <td>{course.title || course.name || "Untitled Course"}</td>
                      <td>{section.section_number || "N/A"}</td>
                      <td>{Number(course.credits || 0)}</td>
                      <td>Enrolled (Demo)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default Transcript;
