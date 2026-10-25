
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function Courses() {
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await api.get("/courses");
        setCourses(response.data);
        setError("");
      } catch (err) {
        console.error("Unable to fetch courses:", err);

        setCourses([]);
        setError(
          err.response
            ? "Unable to load courses from the server."
            : "Unable to connect to the server. Is the backend running?"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const filteredCourses = courses.filter((course) => {
    const searchText = search.toLowerCase();

    return (
      (course.code || "").toLowerCase().includes(searchText) ||
      (course.title || "").toLowerCase().includes(searchText) ||
      (course.description || "").toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="courses-page">
      <header className="courses-header">
        <div>
          <h1>Course Registration System</h1>
          <p>Explore courses and plan your semester.</p>
        </div>

        <Link to="/dashboard" className="dashboard-link">
          My Dashboard
        </Link>
      </header>

      <main className="courses-content">
        <div className="courses-heading">
          <div>
            <h2>Course Catalog</h2>
            <p>Browse the courses available for registration.</p>
          </div>

          <span className="course-count">
            {loading ? "Loading..." : `${filteredCourses.length} courses`}
          </span>
        </div>

        <div className="course-search">
          <input
            type="text"
            placeholder="Search by course code, title, or keyword..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search courses"
          />
        </div>

        {loading ? (
          <p>Loading courses...</p>
        ) : (
          <>
            {error && (
              <div className="no-courses">
                <p>{error}</p>
              </div>
            )}

            {error ? null : filteredCourses.length > 0 ? (
              <div className="course-grid">
                {filteredCourses.map((course) => (
                  <article className="course-card" key={course.id}>
                    <div className="course-card-top">
                      <span className="course-code">{course.code}</span>
                      <span className="course-credits">
                        {course.credits} credits
                      </span>
                    </div>

                    <h3>{course.title}</h3>

                    <p className="course-description">
                      {course.description || "No description available."}
                    </p>

                    <Link
                      to={`/courses/${course.id}`}
                      className="course-details-button"
                    >
                      View Details
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="no-courses">
                <h3>No courses found</h3>
                <p>
                  Try searching with a different course code or keyword.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Courses;

