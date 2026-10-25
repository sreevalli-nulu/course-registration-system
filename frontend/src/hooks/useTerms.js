import { useEffect, useState } from "react";
import api from "../services/api";

// Loads every term that has sections, plus the term that is open for enrollment.
export default function useTerms() {
  const [state, setState] = useState({
    terms: [],
    currentTerm: "",
    ready: false,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    api
      .get("/terms")
      .then((response) => {
        if (cancelled) return;
        setState({
          terms: response.data.terms,
          currentTerm: response.data.current_term,
          ready: true,
          error: "",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          ready: true,
          error: "Unable to load the list of terms.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
