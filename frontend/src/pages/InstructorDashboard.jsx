import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import useTerms from "../hooks/useTerms";
import { useAuth } from "../context/AuthContext";
import { errorText, formatTerm } from "../utils/format";
import "../staff.css";

function InstructorDashboard() {
  const { user } = useAuth();
  const { terms, currentTerm, ready, error: termError } = useTerms();

  const [chosenTerm, setChosenTerm] = useState("");
  const term = chosenTerm || currentTerm;

  const [result, setResult] = useState({ term: null, sections: [], error: "" });
  const loading = Boolean(term) && result.term !== term;

  useEffect(() => {
    if (!term) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/instructors/me/sections", {
          params: { term },
        });
        if (!cancelled) setResult({ term, sections: response.data, error: "" });
      } catch (err) {
        if (!cancelled) {
          setResult({
            term,
            sections: [],
            error: errorText(err, "Unable to load your sections."),
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [term]);

  const sections = result.term === term ? result.sections : [];
  const totalStudents = sections.reduce((sum, s) => sum + s.seats_taken, 0);
  const totalWaiting = sections.reduce((sum, s) => sum + s.waitlist_count, 0);
  const name = user?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">INSTRUCTOR PORTAL</p>
          <h1>Welcome back, {name}.</h1>
          <p>Your sections, rosters and grading in one place.</p>
        </div>

        <div className="staff-toolbar">
          <label htmlFor="term-select">Term</label>
          <select
            id="term-select"
            className="staff-select"
            value={term}
            onChange={(event) => setChosenTerm(event.target.value)}
            disabled={!ready}
          >
            {terms.map((item) => (
              <option key={item} value={item}>
                {formatTerm(item)}
                {item === currentTerm ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </header>

      {(termError || result.error) && (
        <div className="staff-notice error" role="alert">
          {termError || result.error}
        </div>
      )}

      <section className="staff-stats">
        <article className="staff-stat">
          <p>Sections taught</p>
          <strong>{sections.length}</strong>
        </article>
        <article className="staff-stat">
          <p>Students enrolled</p>
          <strong>{totalStudents}</strong>
        </article>
        <article className="staff-stat">
          <p>Waiting for a seat</p>
          <strong>{totalWaiting}</strong>
        </article>
      </section>

      <div className="staff-section-heading">
        <div>
          <h2>My sections — {formatTerm(term) || "…"}</h2>
          <p>Open a section to see its roster, post grades or check the waitlist.</p>
        </div>
      </div>

      {loading ? (
        <p>Loading your sections...</p>
      ) : sections.length === 0 ? (
        <div className="staff-empty">
          You are not teaching any sections in {formatTerm(term) || "this term"}.
        </div>
      ) : (
        <div className="staff-card-list">
          {sections.map((section) => {
            const isFull = section.seats_taken >= section.capacity;

            return (
              <article className="staff-section-card" key={section.section_id}>
                <div>
                  <span className="staff-code">{section.course_code}</span>
                  <h3>{section.course_title}</h3>
                  <p>
                    Section {section.section_number} ·{" "}
                    {section.meeting_time || "Schedule TBA"} ·{" "}
                    {section.room || "Room TBA"} · {section.credits} credits
                  </p>
                </div>

                <div className="staff-section-meta">
                  <span className={`staff-badge ${isFull ? "full" : "ok"}`}>
                    {section.seats_taken}/{section.capacity} seats
                  </span>
                  {section.waitlist_count > 0 && (
                    <span className="staff-badge wait">
                      {section.waitlist_count} waitlisted
                    </span>
                  )}
                  <Link
                    to={`/sections/${section.section_id}`}
                    className="staff-btn small"
                  >
                    Roster &amp; grades
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default InstructorDashboard;
