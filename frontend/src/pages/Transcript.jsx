import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { errorText, formatTerm } from "../utils/format";

function Transcript() {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/students/me/transcript");
        if (cancelled) return;

        setTranscript(response.data);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err, "Unable to load your transcript."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const courses = transcript?.courses || [];

  return (
    <main className="transcript-page">
      <Link to="/dashboard">← Back to Dashboard</Link>

      <header>
        <h1>My Transcript</h1>
        <p>Your graded courses, GPA and earned credits.</p>
      </header>

      {loading ? (
        <p>Loading your transcript...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          <section className="transcript-summary">
            <div>
              <p>GPA</p>
              <h2>{Number(transcript.gpa).toFixed(2)}</h2>
            </div>

            <div>
              <p>Credits Earned</p>
              <h2>{transcript.total_credits}</h2>
            </div>

            <div>
              <p>Courses Completed</p>
              <h2>{courses.length}</h2>
            </div>
          </section>

          <section className="transcript-records">
            <h2>Course Records</h2>

            {courses.length === 0 ? (
              <div>
                <p>No graded courses yet.</p>
                <Link to="/courses">Browse Courses</Link>
              </div>
            ) : (
              <div className="transcript-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>Term</th>
                      <th>Credits</th>
                      <th>Grade</th>
                    </tr>
                  </thead>

                  <tbody>
                    {courses.map((course) => (
                      <tr key={`${course.course_code}-${course.term}`}>
                        <td>{course.course_code}</td>
                        <td>{course.course_title}</td>
                        <td>{formatTerm(course.term)}</td>
                        <td>{course.credits}</td>
                        <td>{course.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default Transcript;
