import { CSV_FIELDS, NUMBER_FIELDS, MAX_UPLOAD_BYTES, parseNumber, validateObservations } from "./validation.js";

export function parseCSV(text) {
  if (typeof text !== "string") throw new Error("CSV must be text.");
  if (new TextEncoder().encode(text).length > MAX_UPLOAD_BYTES) throw new Error("CSV exceeds the 1 MB (1,000,000 bytes) limit.");
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ""; closed = false; };
  const finishRow = () => {
    finishField();
    // Permit an empty physical line, but not an empty multi-column record.
    if (row.length !== 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
      continue;
    }
    if (c === ",") finishField();
    else if (c === "\n" || c === "\r") {
      finishRow();
      if (c === "\r" && input[i + 1] === "\n") i++;
    } else if (c === '"' && field === "" && !closed) quoted = true;
    else if (c === '"' || closed) throw new Error(`Malformed CSV near record ${rows.length + 1}: unexpected text or quote.`);
    else field += c;
  }
  if (quoted) throw new Error("Malformed CSV: unterminated quoted field.");
  if (field !== "" || row.length || closed) finishRow();
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows.shift().map(header => header.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV has duplicate headers.");
  const missing = CSV_FIELDS.filter(field => !headers.includes(field));
  const unknown = headers.filter(field => !CSV_FIELDS.includes(field));
  if (missing.length || unknown.length) throw new Error(`CSV headers: ${missing.length ? `missing ${missing.join(", ")}. ` : ""}${unknown.length ? `unknown ${unknown.join(", ")}.` : ""}`);
  const observations = rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2}: expected ${headers.length} columns, found ${values.length}.`);
    return Object.fromEntries(headers.map((key, i) => [key, NUMBER_FIELDS.includes(key) ? parseNumber(values[i]) : values[i].trim()]));
  });
  const errors = validateObservations(observations);
  if (errors.length) throw new Error(errors.join("\n"));
  return observations;
}

export function serializeCSV(observations) {
  const quote = value => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [CSV_FIELDS.join(","), ...observations.map(row => CSV_FIELDS.map(field => quote(row[field])).join(","))].join("\r\n") + "\r\n";
}
