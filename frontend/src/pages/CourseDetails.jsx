
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useEnrollments } from "../context/EnrollmentContext";

const sampleCourses = [
  {
    id: 1,
    code: "CS101",
    title: "Introduction to Programming",
    credits: 3,
    description: "Learn programming fundamentals and problem-solving.",
  },
  {
    id: 2,
    code: "CS201",
    title: "Data Structures",
    credits: 4,
    description:
      "Explore data structures, algorithms, and efficient problem-solving.",
  },
  {
    id: 3,
    code: "CS202",
    title: "Database Management Systems",
    credits: 3,
    description:
      "Learn database design, SQL, normalization, and transactions.",
  },
  {
    id: 4,
    code: "CS401",
    title: "Advanced Database Systems",
    credits: 4,
    description:
      "Study advanced database concepts and database system design.",
  },
];

const samplePrerequisites = {
  1: [],
  2: [{ id: 1, code: "CS101", title: "Introduction to Programming" }],
  3: [{ id: 1, code: "CS101", title: "Introduction to Programming" }],
  4: [{ id: 3, code: "CS202", title: "Database Management Systems" }],
};

const sampleSections = [
  {
    id: "demo-1",
    section_number: "01",
    term: "Fall 2026",
    meeting_time: "Tuesday & Thursday",
    room: "Room 101",
    capacity: 30,
    seats_taken: 18,
  },
  {
    id: "demo-2",
    section_number: "02",
    term: "Fall 2026",
    meeting_time: "Tuesday & Thursday",
    room: "Room 204",
    capacity: 30,
    seats_taken: 30,
  },
];

function CourseDetails() {
  const { courseId } = useParams();
  const { demoEnrollments, enrollDemo } = useEnrollments();

  const [course, setCourse] = useState(null);
  const [prerequisites, setPrerequisites] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchCourseDetails = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setUsingSampleData(false);

      try {
        const [
          courseResponse,
          prerequisiteResponse,
          sectionResponse,
        ] = await Promise.all([
          api.get(`/courses/${courseId}`),
          api.get(`/courses/${courseId}/prerequisites`),
          api.get("/sections", {
            params: { course_id: courseId },
          }),
        ]);

        if (cancelled) return;

        setCourse(courseResponse.data);
        setPrerequisites(prerequisiteResponse.data);
        setSections(sectionResponse.data);
      } catch (err) {
        if (cancelled) return;

        console.error("Unable to fetch course details:", err);

        const sampleCourse = sampleCourses.find(
          (item) => String(item.id) === String(courseId)
        );

        if (sampleCourse) {
          setCourse(sampleCourse);
          setPrerequisites(
            samplePrerequisites[sampleCourse.id] || []
          );

          setSections(
            sampleCourse.id === 1
              ? [sampleSections[0]]
              : sampleSections
          );

          setUsingSampleData(true);
        } else {
          setError("This course could not be found.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCourseDetails();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleEnroll = async (section) => {
    const isDemo =
      usingSampleData ||
      String(section.id).startsWith("demo-");

    if (isDemo) {
      const alreadyEnrolled = demoEnrollments.some(
        (item) =>
          String(item.courseId) === String(course.id) &&
          String(item.originalSectionId) === String(section.id)
      );

      if (alreadyEnrolled) {
        setMessage("You are already enrolled in this demo section.");
        return;
      }

      enrollDemo({
        courseId: course.id,
        sectionId: `${course.id}-${section.id}`,
        originalSectionId: section.id,
        course,
        section: { ...section },
      });

      setMessage(
        "Demo enrollment added! No real server registration has been made."
      );
      return;
    }

    try {
      await api.post("/enrollments", {
        section_id: section.id,
      });

      setMessage("Enrollment successful! Refresh your schedule to see updated server data.");
    } catch (err) {
      setMessage(
        err.response?.data?.detail ||
          "Enrollment failed. Please check your eligibility and try again."
      );
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
        <h2>Course not found</h2>
        <p>{error || "This course is unavailable."}</p>
      </div>
    );
  }

  return (
    <div className="course-details-page">
      <Link to="/courses">← Back to Course Catalog</Link>

      {usingSampleData && (
        <p className="demo-notice">
          Demo mode: this page displays sample course information,
          not live database records. Demo enrollments are saved locally,
          not to the server.
        </p>
      )}

      <header>
        <p>{course.code || course.course_code}</p>
        <h1>{course.title || course.name}</h1>
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
                {prerequisite.code || prerequisite.course_code}:{" "}
                {prerequisite.title || prerequisite.name}
              </li>
            ))}
          </ul>
        ) : (
          <p>This course has no prerequisites.</p>
        )}
      </section>

      <section>
        <h2>Available Sections</h2>

        {sections.length > 0 ? (
          <div className="sections-list">
            {sections.map((section) => {
              const capacity = Number(section.capacity) || 0;
              const seatsTaken = Number(section.seats_taken) || 0;
              const seatsAvailable = Math.max(
                0,
                capacity - seatsTaken
              );
              const isFull = seatsAvailable === 0;

              const alreadyEnrolled = demoEnrollments.some(
                (item) =>
                  String(item.courseId) === String(course.id) &&
                  String(item.originalSectionId) === String(section.id)
              );

              return (
                <article
                  key={section.id}
                  className="section-card"
                >
                  <h3>Section {section.section_number || section.section || "01"}</h3>

                  <p>
                    <strong>Term:</strong>{" "}
                    {section.term || "Fall 2026"}
                  </p>

                  <p>
                    <strong>Meeting time:</strong>{" "}
                    {section.meeting_time || "Not announced"}
                  </p>

                  <p>
                    <strong>Room:</strong>{" "}
                    {section.room || "Not announced"}
                  </p>

                  <p>
                    <strong>Seats available:</strong>{" "}
                    {seatsAvailable} / {capacity}
                  </p>

                  {isFull ? (
                    <p className="section-full">
                      Full — waitlist may be available
                    </p>
                  ) : (
                    <p className="section-available">
                      Seats available
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleEnroll(section)}
                    disabled={isFull || alreadyEnrolled}
                  >
                    {alreadyEnrolled
                      ? "Already Enrolled (Demo)"
                      : isFull
                        ? "Section Full"
                        : "Enroll"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p>No sections are currently listed for this course.</p>
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