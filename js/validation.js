export const PHASES = ["baseline", "pilot"];
export const CSV_FIELDS = [
  "phase", "start_date", "end_date", "pr_cycle_hours", "prs_merged",
  "review_turnaround_hours", "agent_assisted_prs", "readiness_level",
  "factory_credits", "active_engineers", "source_label",
];
export const NUMBER_FIELDS = [
  "pr_cycle_hours", "prs_merged", "review_turnaround_hours",
  "agent_assisted_prs", "readiness_level", "factory_credits", "active_engineers",
];
export const ASSUMPTION_FIELDS = [
  ["pilotEngineers", "Engineers in pilot", "engineers", 1, true],
  ["scopeEngineers", "Total engineers in scope", "engineers", 1, true],
  ["annualLoadedCostSGD", "Fully loaded annual cost", "SGD / engineer / year", 0, false, true],
  ["hoursSavedPerAssistedPR", "Hours saved per assisted PR", "labor hours / PR", 0],
  ["annualProductiveHours", "Annual productive hours", "hours / engineer / year", 0, false, true],
  ["creditCostPerEngineerMonthSGD", "Credit cost per active engineer", "SGD / engineer / month", 0],
];
const INTEGER_FIELDS = new Set(["prs_merged", "agent_assisted_prs", "readiness_level", "active_engineers"]);
const OPTIONAL_FIELDS = new Set(["pr_cycle_hours", "review_turnaround_hours", "readiness_level", "factory_credits"]);
export const MAX_NUMBER = 1e12;
export const MAX_UPLOAD_BYTES = 1_000_000;

// Empty is missing, never a measured zero. Reject JS-specific forms such as hex.
export function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim();
  return /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) ? Number(raw) : NaN;
}

export function isISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validNumber(n, min = 0, integer = false, exclusive = false) {
  return typeof n === "number" && Number.isFinite(n) && n <= MAX_NUMBER
    && (exclusive ? n > min : n >= min) && (!integer || Number.isInteger(n));
}

export function validateObservations(observations) {
  const errors = [];
  if (!Array.isArray(observations) || observations.length !== 2) return ["CSV must contain exactly two rows: one baseline and one pilot."];
  for (const phase of PHASES) {
    if (observations.filter(row => row.phase === phase).length !== 1) errors.push(`Exactly one ${phase} row is required.`);
  }
  observations.forEach((row, index) => {
    const where = `Row ${index + 2} (${row.phase || "unknown"})`;
    if (!PHASES.includes(row.phase)) errors.push(`${where}: phase must be baseline or pilot.`);
    for (const field of ["start_date", "end_date"]) {
      if (!isISODate(row[field])) errors.push(`${where}: ${field} must be a real ISO date (1900 or later).`);
    }
    if (isISODate(row.start_date) && isISODate(row.end_date) && row.end_date <= row.start_date) {
      errors.push(`${where}: end_date must be after start_date (end exclusive).`);
    }
    for (const field of NUMBER_FIELDS) {
      if (row[field] === null && OPTIONAL_FIELDS.has(field)) continue;
      if (!validNumber(row[field], field === "readiness_level" ? 1 : 0, INTEGER_FIELDS.has(field))
          || (field === "readiness_level" && row[field] > 5)) {
        errors.push(`${where}: ${field} must be ${field === "readiness_level" ? "an integer from 1 to 5 or blank" : `a nonnegative ${INTEGER_FIELDS.has(field) ? "integer" : "number"} ≤ 1e12${OPTIONAL_FIELDS.has(field) ? " or blank" : ""}`}.`);
      }
    }
    if (row.agent_assisted_prs > row.prs_merged) errors.push(`${where}: agent_assisted_prs cannot exceed prs_merged.`);
    if (row.active_engineers > row.prs_merged) errors.push(`${where}: active_engineers cannot exceed prs_merged (each active engineer merged at least one PR).`);
    if (row.prs_merged > 0 && row.active_engineers === 0) errors.push(`${where}: merged PRs require at least one active engineer.`);
    if (typeof row.source_label !== "string" || !row.source_label.trim() || row.source_label.length > 200) {
      errors.push(`${where}: source_label is required, at most 200 characters.`);
    }
  });
  const baseline = observations.find(row => row.phase === "baseline");
  const pilot = observations.find(row => row.phase === "pilot");
  if (baseline && pilot && isISODate(baseline.end_date) && isISODate(pilot.start_date)
      && baseline.end_date > pilot.start_date) errors.push("Baseline must finish before or at the pilot start; periods must not overlap.");
  return errors;
}

export function validateAssumptions(a) {
  if (!a || typeof a !== "object") return ["Assumptions are required."];
  const errors = [];
  for (const [key, label, , min, integer, exclusive] of ASSUMPTION_FIELDS) {
    if (!validNumber(a[key], min, integer, exclusive)) errors.push(`${label}: enter ${exclusive ? "a positive" : `a value ≥ ${min}`} ${integer ? "integer" : "number"} ≤ 1e12.`);
  }
  if (a.scopeEngineers < a.pilotEngineers) errors.push("Total engineers in scope must be at least the engineers in pilot.");
  if (!Array.isArray(a.adoptionRampPct) || a.adoptionRampPct.length !== 12) errors.push("Provide exactly 12 monthly adoption percentages.");
  else a.adoptionRampPct.forEach((pct, i) => {
    if (!validNumber(pct) || pct > 100) errors.push(`Month ${i + 1} adoption must be between 0 and 100%.`);
  });
  return errors;
}

export function validateState(state) {
  const errors = [...validateObservations(state.observations), ...validateAssumptions(state.assumptions)];
  for (const row of state.observations ?? []) {
    if (row.active_engineers > state.assumptions?.pilotEngineers) errors.push(`${row.phase}: active engineers exceed engineers in pilot. Adjust the cohort assumption or the data.`);
  }
  if (typeof state.scenario !== "string" || !state.scenario.trim() || state.scenario.length > 120) errors.push("Scenario label is required, at most 120 characters.");
  if (!["synthetic", "customer-provided, unverified"].includes(state.provenance)) errors.push("Unrecognized provenance.");
  return errors;
}
