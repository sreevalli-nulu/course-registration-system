// "Fall2026" -> "Fall 2026"
export function formatTerm(term) {
  if (!term) return "";
  return term.replace(/^([A-Za-z]+)\s*(\d+)$/, "$1 $2");
}

// Turn an API error into a readable message.
export function errorText(err, fallback) {
  if (!err?.response) return "Unable to connect to the server.";

  const detail = err.response.data?.detail;

  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  if (typeof detail === "string") return detail;

  return fallback;
}

const DAY_NAMES = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  Th: "Thursday",
  F: "Friday",
};

// "MWF 09:00-09:50" -> { days: ["Monday","Wednesday","Friday"], time: "09:00-09:50" }
// "TTh 14:00-15:15" -> { days: ["Tuesday","Thursday"], time: "14:00-15:15" }
// Returns null if the text is not in that format.
export function parseMeetingTime(text) {
  if (!text) return null;

  const match = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;

  const [, dayCodes, start, end] = match;
  const days = [];

  for (let i = 0; i < dayCodes.length; i += 1) {
    let code = dayCodes[i];

    if (code === "T" && dayCodes[i + 1] === "h") {
      code = "Th";
      i += 1;
    }

    if (!DAY_NAMES[code]) return null;
    days.push(DAY_NAMES[code]);
  }

  return { days, time: `${start}-${end}`, start };
}
