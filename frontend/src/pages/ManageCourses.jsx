import { useEffect, useState } from "react";
import api from "../services/api";
import { errorText } from "../utils/format";
import "../staff.css";

const EMPTY_FORM = { code: "", title: "", credits: "3", description: "" };

function CourseForm({ editing, courses, initialPrereqs, onSaved, onCancel }) {
  const [form, setForm] = useState(
    editing
      ? {
          code: editing.code,
          title: editing.title,
          credits: String(editing.credits),
          description: editing.description || "",
        }
      : EMPTY_FORM
  );
  const [prereqIds, setPrereqIds] = useState(new Set(initialPrereqs));
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setField = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const togglePrereq = (id) =>
    setPrereqIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const credits = Number(form.credits);
    if (!Number.isInteger(credits) || credits < 1 || credits > 12) {
      setError("Credits must be a whole number between 1 and 12.");
      return;
    }

    setSubmitting(true);

    try {
      const body = {
        title: form.title.trim(),
        credits,
        description: form.description.trim() || null,
        prerequisite_course_ids: [...prereqIds],
      };

      if (editing) {
        await api.put(`/courses/${editing.id}`, body);
        onSaved(`Saved changes to ${editing.code}.`);
      } else {
        const code = form.code.trim().toUpperCase();
        await api.post("/courses", { ...body, code });
        onSaved(`Created course ${code}.`);
      }
    } catch (err) {
      setError(errorText(err, "Unable to save this course."));
    } finally {
      setSubmitting(false);
    }
  };

  const visible = courses.filter(
    (course) =>
      (!editing || course.id !== editing.id) &&
      `${course.code} ${course.title}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <form className="staff-card" onSubmit={handleSubmit}>
      <h2>{editing ? `Edit ${editing.code}` : "New course"}</h2>
      <p className="staff-sub">
        {editing
          ? "The course code cannot be changed."
          : "Add a course to the catalog, then create sections for it."}
      </p>

      {error && (
        <div className="staff-notice error" role="alert">
          {error}
        </div>
      )}

      <div className="staff-form-grid">
        <div className="staff-field">
          <label htmlFor="course-code">Course code</label>
          <input
            id="course-code"
            className="staff-input"
            value={form.code}
            onChange={setField("code")}
            placeholder="e.g. CS305"
            disabled={Boolean(editing)}
            required
          />
        </div>

        <div className="staff-field">
          <label htmlFor="course-credits">Credits</label>
          <input
            id="course-credits"
            type="number"
            min="1"
            max="12"
            className="staff-input"
            value={form.credits}
            onChange={setField("credits")}
            required
          />
        </div>

        <div className="staff-field wide">
          <label htmlFor="course-title">Title</label>
          <input
            id="course-title"
            className="staff-input"
            value={form.title}
            onChange={setField("title")}
            required
          />
        </div>

        <div className="staff-field wide">
          <label htmlFor="course-description">Description</label>
          <textarea
            id="course-description"
            className="staff-textarea"
            value={form.description}
            onChange={setField("description")}
          />
        </div>

        <div className="staff-field wide">
          <span className="staff-label">Prerequisites</span>
          <input
            className="staff-input"
            placeholder="Search courses..."
            aria-label="Search prerequisite courses"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="staff-checklist">
            {visible.length === 0 ? (
              <span className="staff-hint">No matching courses.</span>
            ) : (
              visible.map((course) => (
                <label key={course.id}>
                  <input
                    type="checkbox"
                    checked={prereqIds.has(course.id)}
                    onChange={() => togglePrereq(course.id)}
                  />
                  {course.code} — {course.title}
                </label>
              ))
            )}
          </div>
          <span className="staff-hint">
            {prereqIds.size} selected. Students must have completed these (directly or through
            other prerequisites) before enrolling. Circular chains are rejected.
          </span>
        </div>
      </div>

      <div className="staff-form-actions">
        <button type="button" className="staff-btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="staff-btn" disabled={submitting}>
          {submitting ? "Saving..." : editing ? "Save changes" : "Create course"}
        </button>
      </div>
    </form>
  );
}

function ManageCourses() {
  const [data, setData] = useState({ loaded: false, courses: [], error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState(null); // null | { mode: "new" } | { mode: "edit", course, prereqs }
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/courses");
        if (!cancelled) setData({ loaded: true, courses: response.data, error: "" });
      } catch (err) {
        if (!cancelled) {
          setData({
            loaded: true,
            courses: [],
            error: errorText(err, "Unable to load courses."),
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const openEdit = async (course) => {
    setMessage(null);

    try {
      const response = await api.get(`/courses/${course.id}/prerequisites`);
      setPanel({ mode: "edit", course, prereqs: response.data.map((p) => p.id) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setMessage({ type: "error", text: errorText(err, "Unable to load this course.") });
    }
  };

  const handleSaved = (text) => {
    setPanel(null);
    setMessage({ type: "success", text });
    setReloadKey((key) => key + 1);
  };

  const shown = data.courses.filter((course) =>
    `${course.code} ${course.title}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">REGISTRAR PORTAL</p>
          <h1>Manage courses</h1>
          <p>Add courses to the catalog and set their prerequisites.</p>
        </div>

        <div className="staff-actions">
          <button
            type="button"
            className="staff-btn"
            onClick={() => {
              setMessage(null);
              setPanel({ mode: "new" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            + New course
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`staff-notice ${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {panel && (
        <CourseForm
          key={panel.mode === "edit" ? `edit-${panel.course.id}` : "new"}
          editing={panel.mode === "edit" ? panel.course : null}
          courses={data.courses}
          initialPrereqs={panel.mode === "edit" ? panel.prereqs : []}
          onSaved={handleSaved}
          onCancel={() => setPanel(null)}
        />
      )}

      <div className="staff-toolbar" style={{ marginBottom: 14 }}>
        <input
          className="staff-input"
          style={{ minWidth: 260 }}
          placeholder="Search by code or title..."
          aria-label="Search courses"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="staff-hint">
          {shown.length} of {data.courses.length} courses
        </span>
      </div>

      {data.error ? (
        <div className="staff-notice error" role="alert">
          {data.error}
        </div>
      ) : !data.loaded ? (
        <p>Loading courses...</p>
      ) : shown.length === 0 ? (
        <div className="staff-empty">No courses match your search.</div>
      ) : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Credits</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((course) => (
                <tr key={course.id}>
                  <td>
                    <span className="staff-code">{course.code}</span>
                  </td>
                  <td>{course.title}</td>
                  <td>{course.credits}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="staff-btn small secondary"
                      onClick={() => openEdit(course)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default ManageCourses;
