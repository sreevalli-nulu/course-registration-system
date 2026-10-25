
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

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
    description: "Explore data structures, algorithms, and efficient problem-solving.",
  },
  {
    id: 3,
    code: "CS202",
    title: "Database Management Systems",
    credits: 3,
    description: "Learn database design, SQL, normalization, and transactions.",
  },
  {
    id: 4,
    code: "CS401",
    title: "Advanced Database Systems",
    credits: 4,
    description: "Study advanced database concepts and database system design.",
  },
];

function Courses() {
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await api.get("/courses");
        setCourses(response.data);
        setUsingSampleData(false);
        setError("");
      } catch (err) {
        console.error("Unable to fetch courses:", err);

        setCourses(sampleCourses);
        setUsingSampleData(true);
        setError("");
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
            {usingSampleData && (
              <p className="demo-notice">
                Demo mode: showing sample courses because the server data
                is currently unavailable. These are not live database records.
              </p>
            )}

            {error && (
              <div className="no-courses">
                <p>{error}</p>
              </div>
            )}

            {filteredCourses.length > 0 ? (
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

