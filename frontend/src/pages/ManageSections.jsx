import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import useTerms from "../hooks/useTerms";
import { errorText, formatTerm, parseMeetingTime } from "../utils/format";
import "../staff.css";

function SectionForm({ editing, term, courses, instructors, onSaved, onCancel }) {
  const [form, setForm] = useState(
    editing
      ? {
          course_id: String(editing.course_id),
          term: editing.term,
          section_number: editing.section_number,
          instructor_id: editing.instructor_id == null ? "" : String(editing.instructor_id),
          meeting_time: editing.meeting_time || "",
          room: editing.room || "",
          capacity: String(editing.capacity),
        }
      : {
          course_id: "",
          term,
          section_number: "01",
          instructor_id: "",
          meeting_time: "",
          room: "",
          capacity: "30",
        }
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setField = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a whole number of at least 1.");
      return;
    }

    const meetingTime = form.meeting_time.trim();
    if (meetingTime && !parseMeetingTime(meetingTime)) {
      setError('Meeting time must look like "MWF 09:00-09:50" or "TTh 14:00-15:15".');
      return;
    }

    const body = {
      term: form.term.trim().replace(/\s+/g, ""),
      section_number: form.section_number.trim(),
      instructor_id: form.instructor_id === "" ? null : Number(form.instructor_id),
      meeting_time: meetingTime || null,
      room: form.room.trim() || null,
      capacity,
    };

    setSubmitting(true);

    try {
      if (editing) {
        await api.put(`/sections/${editing.id}`, body);
        onSaved("Section updated. If seats were added, waitlisted students were enrolled.");
      } else {
        await api.post("/sections", { ...body, course_id: Number(form.course_id) });
        onSaved("Section created.");
      }
    } catch (err) {
      setError(errorText(err, "Unable to save this section."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="staff-card" onSubmit={handleSubmit}>
      <h2>{editing ? "Edit section" : "New section"}</h2>
      <p className="staff-sub">
        {editing
          ? "Raising the capacity automatically enrolls waitlisted students, longest-waiting first."
          : "Create a section of an existing course."}
      </p>

      {error && (
        <div className="staff-notice error" role="alert">
          {error}
        </div>
      )}

      <div className="staff-form-grid">
        <div className="staff-field wide">
          <label htmlFor="sec-course">Course</label>
          <select
            id="sec-course"
            className="staff-select"
            value={form.course_id}
            onChange={setField("course_id")}
            disabled={Boolean(editing)}
            required
          >
            <option value="">Select a course...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>
        </div>

        <div className="staff-field">
          <label htmlFor="sec-term">Term</label>
          <input
            id="sec-term"
            className="staff-input"
            value={form.term}
            onChange={setField("term")}
            placeholder="e.g. Fall2026"
            required
          />
        </div>

        <div className="staff-field">
          <label htmlFor="sec-number">Section number</label>
          <input
            id="sec-number"
            className="staff-input"
            value={form.section_number}
            onChange={setField("section_number")}
            required
          />
        </div>

        <div className="staff-field">
          <label htmlFor="sec-instructor">Instructor</label>
          <select
            id="sec-instructor"
            className="staff-select"
            value={form.instructor_id}
            onChange={setField("instructor_id")}
          >
            <option value="">Unassigned</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.full_name}
                {instructor.department ? ` (${instructor.department})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="staff-field">
          <label htmlFor="sec-capacity">Capacity</label>
          <input
            id="sec-capacity"
            type="number"
            min="1"
            className="staff-input"
            value={form.capacity}
            onChange={setField("capacity")}
            required
          />
        </div>

        <div className="staff-field">
          <label htmlFor="sec-time">Meeting time</label>
          <input
            id="sec-time"
            className="staff-input"
            value={form.meeting_time}
            onChange={setField("meeting_time")}
            placeholder="MWF 09:00-09:50"
          />
          <span className="staff-hint">Shown on student timetables.</span>
        </div>

        <div className="staff-field">
          <label htmlFor="sec-room">Room</label>
          <input
            id="sec-room"
            className="staff-input"
            value={form.room}
            onChange={setField("room")}
            placeholder="e.g. Room 204"
          />
        </div>
      </div>

      <div className="staff-form-actions">
        <button type="button" className="staff-btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="staff-btn" disabled={submitting}>
          {submitting ? "Saving..." : editing ? "Save changes" : "Create section"}
        </button>
      </div>
    </form>
  );
}

function ManageSections() {
  const { terms, currentTerm, ready, error: termError } = useTerms();

  const [chosenTerm, setChosenTerm] = useState("");
  const term = chosenTerm || currentTerm;

  const [lookups, setLookups] = useState({ courses: [], instructors: [], error: "" });
  const [result, setResult] = useState({ term: null, sections: [], error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [panel, setPanel] = useState(null); // null | { mode: "new" } | { mode: "edit", section }
  const [message, setMessage] = useState(null);

  const loading = Boolean(term) && result.term !== term;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [courses, instructors] = await Promise.all([
          api.get("/courses"),
          api.get("/instructors"),
        ]);
        if (!cancelled) {
          setLookups({ courses: courses.data, instructors: instructors.data, error: "" });
        }
      } catch (err) {
        if (!cancelled) {
          setLookups({
            courses: [],
            instructors: [],
            error: errorText(err, "Unable to load courses and instructors."),
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!term) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/sections", { params: { term } });
        if (!cancelled) setResult({ term, sections: response.data, error: "" });
      } catch (err) {
        if (!cancelled) {
          setResult({ term, sections: [], error: errorText(err, "Unable to load sections.") });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [term, reloadKey]);

  const courseById = Object.fromEntries(lookups.courses.map((c) => [c.id, c]));
  const instructorById = Object.fromEntries(lookups.instructors.map((i) => [i.id, i]));
  const sections = result.term === term ? result.sections : [];

  const handleSaved = (text) => {
    setPanel(null);
    setMessage({ type: "success", text });
    setReloadKey((key) => key + 1);
  };

  const termOptions = terms.includes(term) || !term ? terms : [term, ...terms];

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">REGISTRAR PORTAL</p>
          <h1>Manage sections</h1>
          <p>Assign instructors, change capacity and schedule, or add new sections.</p>
        </div>

        <div className="staff-actions">
          <div className="staff-toolbar">
            <label htmlFor="sections-term">Term</label>
            <select
              id="sections-term"
              className="staff-select"
              value={term}
              onChange={(event) => {
                setChosenTerm(event.target.value);
                setPanel(null);
              }}
              disabled={!ready}
            >
              {termOptions.map((item) => (
                <option key={item} value={item}>
                  {formatTerm(item)}
                  {item === currentTerm ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="staff-btn"
            onClick={() => {
              setMessage(null);
              setPanel({ mode: "new" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            + New section
          </button>
        </div>
      </header>

      {(termError || lookups.error || result.error) && (
        <div className="staff-notice error" role="alert">
          {termError || lookups.error || result.error}
        </div>
      )}

      {message && (
        <div
          className={`staff-notice ${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {panel && (
        <SectionForm
          key={panel.mode === "edit" ? `edit-${panel.section.id}` : `new-${term}`}
          editing={panel.mode === "edit" ? panel.section : null}
          term={term}
          courses={lookups.courses}
          instructors={lookups.instructors}
          onSaved={handleSaved}
          onCancel={() => setPanel(null)}
        />
      )}

      {loading || !ready ? (
        <p>Loading sections...</p>
      ) : sections.length === 0 ? (
        <div className="staff-empty">There are no sections in {formatTerm(term)} yet.</div>
      ) : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Sec.</th>
                <th>Instructor</th>
                <th>Time</th>
                <th>Room</th>
                <th>Seats</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const course = courseById[section.course_id];
                const instructor = instructorById[section.instructor_id];
                const isFull = section.seats_taken >= section.capacity;

                return (
                  <tr key={section.id}>
                    <td>
                      <span className="staff-code">{course?.code}</span> {course?.title}
                    </td>
                    <td>{section.section_number}</td>
                    <td>{instructor ? instructor.full_name : <em>Unassigned</em>}</td>
                    <td>{section.meeting_time || "—"}</td>
                    <td>{section.room || "—"}</td>
                    <td>
                      <span className={`staff-badge ${isFull ? "full" : "ok"}`}>
                        {section.seats_taken}/{section.capacity}
                      </span>
                    </td>
                    <td className="right">
                      <div className="staff-row-actions">
                        <Link
                          to={`/sections/${section.id}`}
                          className="staff-btn small secondary"
                        >
                          Roster
                        </Link>
                        <button
                          type="button"
                          className="staff-btn small"
                          onClick={() => {
                            setMessage(null);
                            setPanel({ mode: "edit", section });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default ManageSections;
