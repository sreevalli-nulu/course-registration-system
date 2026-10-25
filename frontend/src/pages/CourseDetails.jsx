import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatTerm } from "../utils/format";

function errorText(err, fallback) {
  if (!err.response) return "Unable to connect to the server.";

  const detail = err.response.data?.detail;

  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  if (typeof detail === "string") return detail;

  return fallback;
}

function CourseDetails() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [course, setCourse] = useState(null);
  const [prerequisites, setPrerequisites] = useState([]);
  const [sections, setSections] = useState([]);
  const [currentTerm, setCurrentTerm] = useState("");
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [waitlistPositions, setWaitlistPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [busySectionId, setBusySectionId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Only sections of the term that is open for enrollment are shown.
  const loadSections = useCallback(async () => {
    const termResponse = await api.get("/terms/current");
    const term = termResponse.data.current_term;
    setCurrentTerm(term);

    const response = await api.get("/sections", {
      params: { course_id: courseId, term },
    });
    setSections(response.data);
  }, [courseId]);

  // Which sections is the logged-in student already enrolled in / waitlisted for?
  const loadMyStatus = useCallback(async () => {
    if (!isStudent) return;

    const response = await api.get("/students/me/schedule");

    setEnrolledIds(
      new Set(response.data.enrolled.map((item) => item.section_id))
    );

    const positions = {};
    response.data.waitlisted.forEach((item) => {
      positions[item.section_id] = item.position;
    });
    setWaitlistPositions(positions);
  }, [isStudent]);

  useEffect(() => {
    let cancelled = false;

    const fetchCourseDetails = async () => {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const [courseResponse, prerequisiteResponse] = await Promise.all([
          api.get(`/courses/${courseId}`),
          api.get(`/courses/${courseId}/prerequisites`),
          loadSections(),
          loadMyStatus(),
        ]);

        if (cancelled) return;

        setCourse(courseResponse.data);
        setPrerequisites(prerequisiteResponse.data);
      } catch (err) {
        if (cancelled) return;

        console.error("Unable to fetch course details:", err);

        setError(
          err.response?.status === 404
            ? "This course could not be found."
            : errorText(err, "Unable to load this course.")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCourseDetails();

    return () => {
      cancelled = true;
    };
  }, [courseId, loadSections, loadMyStatus]);

  const handleEnroll = async (section) => {
    setBusySectionId(section.id);
    setMessage("");

    try {
      const response = await api.post("/enrollments", {
        section_id: section.id,
      });

      if (response.data.outcome === "waitlisted") {
        setMessage(
          `Section is full. You are #${response.data.waitlist_position} on the waitlist.`
        );
      } else {
        setMessage("Enrollment successful!");
      }

      // Re-read from the server so seats and status are always the real numbers.
      await Promise.all([loadSections(), loadMyStatus()]);
    } catch (err) {
      setMessage(errorText(err, "Enrollment failed. Please try again."));
    } finally {
      setBusySectionId(null);
    }
  };

  if (loading) {
    return (
      <div className="course-details-page">
        <p>Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-details-page">
        <Link to="/courses">← Back to Course Catalog</Link>
        <h2>Course unavailable</h2>
        <p>{error || "This course is unavailable."}</p>
      </div>
    );
  }

  return (
    <div className="course-details-page">
      <Link to="/courses">← Back to Course Catalog</Link>

      <header>
        <p>{course.code}</p>
        <h1>{course.title}</h1>
        <p>{course.description || "No description available."}</p>
        <p>
          <strong>Credits:</strong> {course.credits}
        </p>
      </header>

      <section>
        <h2>Prerequisites</h2>

        {prerequisites.length > 0 ? (
          <ul>
            {prerequisites.map((prerequisite) => (
              <li key={prerequisite.id}>
                {prerequisite.code}: {prerequisite.title}
              </li>
            ))}
          </ul>
        ) : (
          <p>This course has no prerequisites.</p>
        )}
      </section>

      <section>
        <h2>Available Sections{currentTerm ? ` — ${formatTerm(currentTerm)}` : ""}</h2>

        {sections.length > 0 ? (
          <div className="sections-list">
            {sections.map((section) => {
              const capacity = Number(section.capacity) || 0;
              const seatsTaken = Number(section.seats_taken) || 0;
              const seatsAvailable = Math.max(0, capacity - seatsTaken);
              const isFull = seatsAvailable === 0;

              const isEnrolled = enrolledIds.has(section.id);
              const waitlistPosition = waitlistPositions[section.id];
              const isWaitlisted = waitlistPosition !== undefined;

              let buttonLabel = "Enroll";
              if (isEnrolled) buttonLabel = "Enrolled";
              else if (isWaitlisted) buttonLabel = `On waitlist (#${waitlistPosition})`;
              else if (isFull) buttonLabel = "Join waitlist";
              if (busySectionId === section.id) buttonLabel = "Please wait...";

              return (
                <article key={section.id} className="section-card">
                  <h3>Section {section.section_number}</h3>

                  <p>
                    <strong>Term:</strong> {section.term}
                  </p>

                  <p>
                    <strong>Meeting time:</strong>{" "}
                    {section.meeting_time || "Not announced"}
                  </p>

                  <p>
                    <strong>Room:</strong> {section.room || "Not announced"}
                  </p>

                  <p>
                    <strong>Seats available:</strong> {seatsAvailable} /{" "}
                    {capacity}
                  </p>

                  {isFull ? (
                    <p className="section-full">
                      Full — you can join the waitlist
                    </p>
                  ) : (
                    <p className="section-available">Seats available</p>
                  )}

                  {isStudent && (
                    <button
                      type="button"
                      onClick={() => handleEnroll(section)}
                      disabled={
                        isEnrolled ||
                        isWaitlisted ||
                        busySectionId === section.id
                      }
                    >
                      {buttonLabel}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p>This course is not offered in {formatTerm(currentTerm) || "the current term"}.</p>
        )}

        {!isStudent && (
          <p>Only student accounts can enroll in sections.</p>
        )}

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
      </section>

      <p>
        <Link to="/dashboard">Go to Dashboard →</Link>
      </p>
    </div>
  );
}

export default CourseDetails;
