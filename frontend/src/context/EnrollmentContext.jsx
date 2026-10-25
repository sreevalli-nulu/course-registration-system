import { createContext, useContext, useState } from "react";

const EnrollmentContext = createContext(null);

function loadEnrollments() {
  try {
    const saved = localStorage.getItem("demoEnrollments");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function EnrollmentProvider({ children }) {
  const [demoEnrollments, setDemoEnrollments] = useState(loadEnrollments);

  const saveEnrollments = (updater) => {
    setDemoEnrollments((current) => {
      const updated =
        typeof updater === "function" ? updater(current) : updater;

      localStorage.setItem("demoEnrollments", JSON.stringify(updated));
      return updated;
    });
  };

  const enrollDemo = (enrollment) => {
    saveEnrollments((current) => {
      const alreadyEnrolled = current.some(
        (item) => String(item.sectionId) === String(enrollment.sectionId)
      );

      if (alreadyEnrolled) return current;
      return [...current, enrollment];
    });
  };

  const dropDemo = (sectionId) => {
    saveEnrollments((current) =>
      current.filter(
        (item) => String(item.sectionId) !== String(sectionId)
      )
    );
  };

  return (
    <EnrollmentContext.Provider
      value={{ demoEnrollments, enrollDemo, dropDemo }}
    >
      {children}
    </EnrollmentContext.Provider>
  );
}

export function useEnrollments() {
  const context = useContext(EnrollmentContext);

  if (!context) {
    throw new Error(
      "useEnrollments must be used inside an EnrollmentProvider."
    );
  }

  return context;
}