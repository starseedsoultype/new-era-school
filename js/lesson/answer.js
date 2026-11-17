// Answer kind `set` (CONTRACTS.md section 3): same rule as school_private.answer_matches on the server.
// Shared by the real lesson engine and demo mode.

const NUMBER = /^([+-]?)(\d*)(?:\.(\d*))?$/;

// One element as a comparison key: numbers by value, anything else as lower-case text.
function elementKey(raw) {
  const squeezed = String(raw).replace(/\s+/g, "").replace(",", ".");
  const m = NUMBER.exec(squeezed);
  if (m && (m[2] || m[3])) {
    const whole = m[2].replace(/^0+/, "");
    const fraction = (m[3] ?? "").replace(/0+$/, "");
    const zero = !whole && !fraction;
    return `n${m[1] === "-" && !zero ? "-" : ""}${whole || "0"}${fraction ? `.${fraction}` : ""}`;
  }
  return `t${String(raw).trim().toLowerCase()}`;
}

function parseSet(input) {
  const text = String(input ?? "").trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  if (text === "" || text.toLowerCase() === "empty" || text === "∅") return new Set();
  const parts = text.split(text.includes(";") ? ";" : ",");
  return new Set(parts.filter(part => part.replace(/\s+/g, "") !== "").map(elementKey));
}

// `expected` is the array from answer.value. Order and repeats do not matter.
export function setMatches(input, expected) {
  if (input == null || !Array.isArray(expected)) return false;
  const actual = parseSet(input);
  const wanted = new Set(expected.map(elementKey));
  return actual.size === wanted.size && [...actual].every(key => wanted.has(key));
}

export const SET_HINT = "Write the elements separated by commas, e.g. {3, 5, 7}";
