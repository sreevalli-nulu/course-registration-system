
import { useEnrollments } from "../context/EnrollmentContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const TIME_SLOTS = [
  "9:00–10:00 AM",
  "10:00–11:00 AM",
  "11:00 AM–12:00 PM",
  "1:00–2:00 PM",
  "2:00–3:00 PM",
];

// Illustrative demo timetable. Change these to match your
// college's actual timetable when you have the official timings.
const COURSE_TIMETABLE = {
  CS101: {
    days: ["Monday", "Wednesday"],
    time: "9:00–10:00 AM",
    room: "Room 101",
  },
  CS201: {
    days: ["Tuesday", "Thursday"],
    time: "10:00–11:00 AM",
    room: "Room 204",
  },
  CS202: {
    days: ["Monday", "Wednesday"],
    time: "11:00 AM–12:00 PM",
    room: "Computer Lab 2",
  },
  CS401: {
    days: ["Tuesday", "Friday"],
    time: "2:00–3:00 PM",
    room: "Room 305",
  },
};

function getCourseCode(course) {
  return course?.course_code || course?.code || course?.courseCode || "";
}

function Schedule() {
  const { demoEnrollments } = useEnrollments();

  const classes = demoEnrollments.map((enrollment) => {
    const course = enrollment.course;
    const code = getCourseCode(course);
    const timetable = COURSE_TIMETABLE[code];

    return {
      id: enrollment.sectionId,
      code,
      title: course?.title || course?.name || code,
      room: timetable?.room || enrollment.section?.room || "Room TBA",
      days: timetable?.days || ["Monday", "Wednesday"],
      time: timetable?.time || "9:00–10:00 AM",
    };
  });

  return (
    <main className="schedule-page">
      <header className="page-header">
        <h1>My Schedule</h1>
        <p>Your weekly class timetable.</p>
      </header>

      {classes.length === 0 ? (
        <section className="empty-state">
          <h2>No classes scheduled yet</h2>
          <p>Enroll in a course to see it on your timetable.</p>
        </section>
      ) : (
        <>
          <div className="schedule-note">
            Demo timetable · Monday–Friday · 9 AM–3 PM
          </div>

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
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <th className="timetable-time">{slot}</th>

                    {DAYS.map((day) => {
                      const scheduledClasses = classes.filter(
                        (item) =>
                          item.days.includes(day) && item.time === slot
                      );

                      return (
                        <td key={day}>
                          {scheduledClasses.map((item) => (
                            <div
                              className="timetable-class"
                              key={item.id}
                            >
                              <strong>{item.code}</strong>
                              <span>{item.title}</span>
                              <small>{item.room}</small>
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

          <p className="schedule-footnote">
            These are sample timings for the frontend demo, not official
            college class timings.
          </p>
        </>
      )}
    </main>
  );
}

export default Schedule;