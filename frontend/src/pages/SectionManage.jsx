import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { errorText, formatTerm } from "../utils/format";
import "../staff.css";

const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];

function formatAdded(isoText) {
  // The server stores UTC without a "Z".
  const date = new Date(isoText.endsWith("Z") ? isoText : `${isoText}Z`);
  return date.toLocaleString();
}

function SectionManage() {
  const { sectionId } = useParams();
  const { user } = useAuth();
  const isRegistrar = user?.role === "registrar";

  const [data, setData] = useState({ id: null, roster: null, waitlist: null, error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("roster");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState(null);

  const loading = data.id !== sectionId;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [roster, waitlist] = await Promise.all([
          api.get(`/sections/${sectionId}/roster`),
          api.get(`/waitlist/${sectionId}`),
        ]);
        if (!cancelled) {
          setData({
            id: sectionId,
            roster: roster.data,
            waitlist: waitlist.data,
            error: "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setData({
            id: sectionId,
            roster: null,
            waitlist: null,
            error:
              err.response?.status === 404
                ? "This section could not be found."
                : errorText(err, "Unable to load this section."),
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sectionId, reloadKey]);

  const backLink = isRegistrar ? "/admin/sections" : "/dashboard";
  const backText = isRegistrar ? "← Back to sections" : "← Back to my sections";

  if (loading) {
    return (
      <main className="staff-page">
        <p>Loading section...</p>
      </main>
    );
  }

  if (data.error || !data.roster) {
    return (
      <main className="staff-page">
        <Link to={backLink} className="staff-back">
          {backText}
        </Link>
        <div className="staff-notice error" role="alert">
          {data.error || "This section is unavailable."}
        </div>
      </main>
    );
  }

  const { roster, waitlist } = data;
  const students = roster.students;
  const gradedCount = students.filter((s) => s.grade).length;

  const chosenGrade = (student) => drafts[student.enrollment_id] ?? student.grade ?? "";
  const hasChange = (student) => {
    const chosen = chosenGrade(student);
    return chosen !== "" && chosen !== (student.grade ?? "");
  };
  const changedStudents = students.filter(hasChange);

  const saveOne = async (student) => {
    const grade = chosenGrade(student);
    const result = await api.put(`/enrollments/${student.enrollment_id}/grade`, { grade });
    return result.data;
  };

  const finishSaving = (saved, failed) => {
    setDrafts({});
    setReloadKey((key) => key + 1);

    if (failed) {
      setMessage({ type: "error", text: failed });
    } else {
      setMessage({
        type: "success",
        text:
          saved === 1
            ? "Grade saved. The student has been notified."
            : `${saved} grades saved. The students have been notified.`,
      });
    }
  };

  const handleSave = async (student) => {
    setSavingId(student.enrollment_id);
    setMessage(null);

    try {
      await saveOne(student);
      finishSaving(1, "");
    } catch (err) {
      setMessage({ type: "error", text: errorText(err, "Unable to save this grade.") });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingId("all");
    setMessage(null);

    let saved = 0;
    let failed = "";

    for (const student of changedStudents) {
      try {
        await saveOne(student);
        saved += 1;
      } catch (err) {
        failed = `${student.full_name}: ${errorText(err, "Unable to save this grade.")}`;
        break;
      }
    }

    if (saved > 0 || failed) {
      finishSaving(saved, failed ? `Saved ${saved}, then stopped. ${failed}` : "");
    }
    setSavingId(null);
  };

  const downloadCsv = () => {
    const rows = [
      ["Student number", "Name", "Status", "Grade"],
      ...students.map((s) => [s.student_number, s.full_name, s.status, s.grade ?? ""]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${roster.course_code}-${roster.section_number}-${roster.term}-roster.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isFull = roster.seats_taken >= roster.capacity;

  return (
    <main className="staff-page">
      <Link to={backLink} className="staff-back">
        {backText}
      </Link>

      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">
            {roster.course_code} · SECTION {roster.section_number} ·{" "}
            {formatTerm(roster.term).toUpperCase()}
          </p>
          <h1>{roster.course_title}</h1>
          <p>
            <span className={`staff-badge ${isFull ? "full" : "ok"}`}>
              {roster.seats_taken}/{roster.capacity} seats filled
            </span>{" "}
            <span className="staff-badge muted">
              {gradedCount} of {students.length} graded
            </span>
          </p>
        </div>

        <div className="staff-actions">
          <button
            type="button"
            className="staff-btn secondary"
            onClick={downloadCsv}
            disabled={students.length === 0}
          >
            Download roster (CSV)
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

      <div className="staff-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "roster"}
          className={`staff-tab ${tab === "roster" ? "active" : ""}`}
          onClick={() => setTab("roster")}
        >
          Roster &amp; grades ({students.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "waitlist"}
          className={`staff-tab ${tab === "waitlist" ? "active" : ""}`}
          onClick={() => setTab("waitlist")}
        >
          Waitlist ({waitlist.entries.length})
        </button>
      </div>

      {tab === "roster" && (
        <>
          {students.length === 0 ? (
            <div className="staff-empty">No students are enrolled in this section yet.</div>
          ) : (
            <>
              <div className="staff-table-wrap">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Student no.</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Grade</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const changed = hasChange(student);

                      return (
                        <tr key={student.enrollment_id} className={changed ? "changed" : ""}>
                          <td>{student.student_number}</td>
                          <td>{student.full_name}</td>
                          <td>
                            <span
                              className={`staff-badge ${
                                student.status === "completed" ? "ok" : "muted"
                              }`}
                            >
                              {student.status === "completed" ? "Graded" : "Enrolled"}
                            </span>
                          </td>
                          <td>
                            <select
                              className="staff-select"
                              aria-label={`Grade for ${student.full_name}`}
                              value={chosenGrade(student)}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [student.enrollment_id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">—</option>
                              {GRADES.map((grade) => (
                                <option key={grade} value={grade}>
                                  {grade}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="right">
                            <button
                              type="button"
                              className="staff-btn small"
                              disabled={!changed || savingId !== null}
                              onClick={() => handleSave(student)}
                            >
                              {savingId === student.enrollment_id ? "Saving..." : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="staff-form-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="staff-btn"
                  disabled={changedStudents.length === 0 || savingId !== null}
                  onClick={handleSaveAll}
                >
                  {savingId === "all"
                    ? "Saving..."
                    : `Save all changes (${changedStudents.length})`}
                </button>
              </div>

              <p className="staff-hint" style={{ marginTop: 10 }}>
                Posting a grade marks the enrollment as completed, updates the student&apos;s
                GPA and sends them a notification.
              </p>
            </>
          )}
        </>
      )}

      {tab === "waitlist" && (
        <>
          {waitlist.entries.length === 0 ? (
            <div className="staff-empty">Nobody is on the waitlist for this section.</div>
          ) : (
            <>
              <div className="staff-table-wrap">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Student no.</th>
                      <th>Name</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlist.entries.map((entry) => (
                      <tr key={entry.student_id}>
                        <td>
                          <span className="staff-badge wait">#{entry.position}</span>
                        </td>
                        <td>{entry.student_number}</td>
                        <td>{entry.full_name}</td>
                        <td>{formatAdded(entry.added_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="staff-hint" style={{ marginTop: 10 }}>
                When a seat opens (a student drops, or the registrar adds capacity), the student
                at position #1 is enrolled automatically and notified.
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default SectionManage;
