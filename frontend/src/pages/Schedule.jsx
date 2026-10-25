import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { errorText, formatTerm, parseMeetingTime } from "../utils/format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function Schedule() {
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/students/me/schedule");
        if (cancelled) return;

        setEnrolled(response.data.enrolled);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err, "Unable to load your schedule."));
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

  const terms = useMemo(
    () => [...new Set(enrolled.map((item) => item.term))].sort(),
    [enrolled]
  );

  // Default to the latest term unless the student picked another one.
  const activeTerm = terms.includes(selectedTerm)
    ? selectedTerm
    : terms[terms.length - 1] || "";

  const termClasses = enrolled
    .filter((item) => item.term === activeTerm)
    .map((item) => ({ ...item, parsed: parseMeetingTime(item.meeting_time) }));

  const scheduled = termClasses.filter((item) => item.parsed);
  const unscheduled = termClasses.filter((item) => !item.parsed);

  const timeSlots = [...new Set(scheduled.map((item) => item.parsed.time))].sort();

  return (
    <main className="schedule-page">
      <header className="page-header">
        <h1>My Schedule</h1>
        <p>Your weekly class timetable.</p>
      </header>

      {loading ? (
        <p>Loading your schedule...</p>
      ) : error ? (
        <section className="empty-state">
          <h2>Something went wrong</h2>
          <p>{error}</p>
        </section>
      ) : enrolled.length === 0 ? (
        <section className="empty-state">
          <h2>No classes scheduled yet</h2>
          <p>Enroll in a course to see it on your timetable.</p>
          <Link to="/courses">Browse courses</Link>
        </section>
      ) : (
        <>
          <div className="schedule-note">
            {terms.length > 1 ? (
              <label>
                Term:{" "}
                <select
                  value={activeTerm}
                  onChange={(event) => setSelectedTerm(event.target.value)}
                >
                  {terms.map((term) => (
                    <option key={term} value={term}>
                      {formatTerm(term)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>{formatTerm(activeTerm)}</span>
            )}
          </div>

          {scheduled.length > 0 && (
            <div className="timetable-wrapper">
              <table className="timetable">
                <thead>
                  <tr>
                    <th>Time</th>
                    {DAYS.map((day) => (
                      <th key={day}>{day}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {timeSlots.map((slot) => (
                    <tr key={slot}>
                      <th className="timetable-time">{slot}</th>

                      {DAYS.map((day) => {
                        const cellClasses = scheduled.filter(
                          (item) =>
                            item.parsed.days.includes(day) &&
                            item.parsed.time === slot
                        );

                        return (
                          <td key={day}>
                            {cellClasses.map((item) => (
                              <div
                                className="timetable-class"
                                key={item.enrollment_id}
                              >
                                <strong>{item.course_code}</strong>
                                <span>{item.course_title}</span>
                                <small>{item.room || "Room TBA"}</small>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unscheduled.length > 0 && (
            <p className="schedule-footnote">
              No meeting time yet:{" "}
              {unscheduled
                .map((item) => `${item.course_code} (Section ${item.section_number})`)
                .join(", ")}
            </p>
          )}
        </>
      )}
    </main>
  );
}

export default Schedule;
