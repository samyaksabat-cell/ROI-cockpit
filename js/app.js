import { ASSUMPTION_FIELDS, NUMBER_FIELDS, parseNumber, MAX_UPLOAD_BYTES, validateState } from "./validation.js";
import { parseCSV } from "./csv.js";
import { DEFAULT_ASSUMPTIONS, DEMO_DISCLAIMER, MODEL_VERSION, PRICE_DISCLAIMER, LIMITATIONS, METRICS, calculate, makeSnapshot } from "./model.js";
import { buildReadout, metricValue, metricChange, number, money } from "./readout.js";

const $ = id => document.getElementById(id);
const el = (tag, className = "", text = null) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
};
const put = (id, ...nodes) => $(id).replaceChildren(...nodes);
const list = values => values.map(value => el("li", "", value));
const viewNames = { evidence: "Pilot evidence", inputs: "Data & assumptions", rollout: "Rollout case", readout: "Executive readout" };
let demo = null, state = null, pendingImport = null, importSequence = 0;

const observationFields = [
  ["start_date", "Start date", "Inclusive · YYYY-MM-DD", "date"],
  ["end_date", "End date", "Exclusive · YYYY-MM-DD", "date"],
  ["pr_cycle_hours", "PR cycle time", "Mean hours · optional", "number"],
  ["prs_merged", "PRs merged", "Count", "number"],
  ["review_turnaround_hours", "Review turnaround", "Mean hours · optional", "number"],
  ["agent_assisted_prs", "Agent-assisted PRs", "Count, subset of merged PRs", "number"],
  ["readiness_level", "Readiness level", "1–5 · optional", "number"],
  ["factory_credits", "Factory credits consumed", "Credits, not SGD · optional", "number"],
  ["active_engineers", "Active engineers", "Distinct engineers with merged PRs", "number"],
  ["source_label", "Source label", "Aggregate provenance · max 200 characters", "text"],
];

function createTable(headers, rows, caption = "", className = "") {
  const table = el("table", className);
  const head = el("thead"), headerRow = el("tr");
  for (const header of headers) {
    const cell = el("th", "", header); cell.scope = "col"; headerRow.append(cell);
  }
  head.append(headerRow); table.append(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    row.forEach((value, i) => {
      const cell = el("td", i === 2 && headers.length === 4 ? "pilot-cell" : "");
      cell.append(value instanceof Node ? value : document.createTextNode(String(value)));
      tr.append(cell);
    });
    body.append(tr);
  }
  table.append(body);
  if (caption) table.append(el("caption", "", caption));
  return table;
}

function showView({ focus = false } = {}) {
  const requested = location.hash.slice(1);
  // Preserve the skip link's main target, but never hide every view for an unknown hash.
  const name = Object.hasOwn(viewNames, requested) ? requested : "evidence";
  for (const key of Object.keys(viewNames)) $(key).hidden = key !== name;
  document.querySelectorAll("[data-view]").forEach(link => {
    if (link.dataset.view === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("breadcrumb-view").textContent = viewNames[name];
  document.title = `${viewNames[name]} · ROI Cockpit`;
  if (focus && requested !== "main") { $("main").focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener("hashchange", () => showView({ focus: true }));
showView();

function newDemoState() {
  return {
    scenario: "DBS, illustrative", provenance: "synthetic",
    observations: structuredClone(demo), assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
  };
}

function inputElement(id, value, type, label, { optional = false, min = 0, max = 1e12, integer = false, maxlength = 200 } = {}) {
  const input = el("input");
  Object.assign(input, { id, type, value: value ?? "", required: !optional });
  input.setAttribute("aria-label", label);
  if (type === "number") {
    input.min = min; input.max = max; input.step = integer ? "1" : "any";
  } else if (type === "date") input.min = "1900-01-01";
  else input.maxLength = maxlength;
  return input;
}

function buildInputs() {
  $("scenario").value = state.scenario;
  const table = el("table", "edit-table");
  const head = el("thead"), heading = el("tr");
  for (const text of ["Field / definition", "Baseline", "Pilot"]) { const th = el("th", "", text); th.scope = "col"; heading.append(th); }
  head.append(heading); table.append(head);
  const body = el("tbody");
  for (const [key, label, description, type] of observationFields) {
    const tr = el("tr"), th = el("th", "", label); th.scope = "row";
    th.append(el("small", "", description)); tr.append(th);
    for (const phase of ["baseline", "pilot"]) {
      const row = state.observations.find(row => row.phase === phase);
      const input = inputElement(`${phase}-${key}`, row[key], type, `${phase} ${label}`, {
        optional: ["pr_cycle_hours", "review_turnaround_hours", "readiness_level", "factory_credits"].includes(key),
        min: key === "readiness_level" ? 1 : 0, max: key === "readiness_level" ? 5 : 1e12,
        integer: ["prs_merged", "agent_assisted_prs", "readiness_level", "active_engineers"].includes(key),
      });
      input.dataset.observation = phase; input.dataset.field = key;
      const td = el("td"); td.append(input); tr.append(td);
    }
    body.append(tr);
  }
  table.append(body); put("observation-inputs", table);
  put("assumption-inputs", ...ASSUMPTION_FIELDS.map(([key, label, unit, min, integer, exclusive]) => {
    const wrapper = el("div", "assumption-field"), labelNode = el("label", "", label);
    const id = `assumption-${key}`; labelNode.htmlFor = id;
    const input = inputElement(id, state.assumptions[key], "number", label, { min, integer });
    input.dataset.assumption = key;
    if (exclusive) input.dataset.positive = "true";
    wrapper.append(labelNode, input, el("small", "", unit));
    if (key === "creditCostPerEngineerMonthSGD") wrapper.append(el("small", "price-warning", PRICE_DISCLAIMER));
    return wrapper;
  }));
  put("ramp-inputs", ...state.assumptions.adoptionRampPct.map((pct, index) => {
    const wrapper = el("div"), label = el("label", "", `Month ${index + 1}`);
    const id = `adoption-${index + 1}`; label.htmlFor = id;
    const input = inputElement(id, pct, "number", `Month ${index + 1} adoption percentage`, { max: 100 });
    input.dataset.month = index;
    wrapper.append(label, input, el("span", "", "% of scope")); return wrapper;
  }));
}

function evidenceTable(evidence) {
  if (!evidence) return el("p", "empty-state", "Evidence unavailable while inputs are invalid. Correct the highlighted issues.");
  return createTable(["Metric", "Baseline", "Pilot", "Change"], evidence.metrics.map(m => [
    m.label, metricValue(m.baseline, m.unit), metricValue(m.pilot, m.unit), metricChange(m),
  ]), "Raw totals reflect their observation periods. Compare duration-normalized PR throughput when dates differ.");
}

function renderEvidence(result) {
  const e = result.evidence;
  put("periods", ...["baseline", "pilot"].map(phase => {
    const span = el("span"); span.append(el("i", "period-dot"), el("strong", "", `${phase === "baseline" ? "Baseline" : "Pilot"} `));
    span.append(document.createTextNode(e ? `${e[phase].start_date} → ${e[phase].end_date} · ${number(e[phase].days)} days` : "N/A"));
    return span;
  }));
  const cards = METRICS.map((definition, index) => {
    const metric = e?.metrics[index];
    const card = el("article", "metric-card"), label = el("h3", "metric-label", definition.short);
    label.append(el("span", "metric-symbol", ["◷", "⌁", "◷", "◌", "▥", "◇", "♙"][index]));
    label.lastChild.setAttribute("aria-hidden", "true");
    const main = el("p", "metric-main", number(metric?.pilot));
    main.append(el("small", "", definition.unit));
    const baseline = el("div", "metric-baseline");
    baseline.append(el("span", "", `Baseline ${number(metric?.baseline)}`));
    const delta = el("span", `delta${metric?.improvementPct > 0 ? " lower" : ""}`, metric ? metricChange(metric) : "N/A");
    baseline.append(delta); card.append(label, main, baseline); return card;
  });
  const context = el("article", "metric-card context-card");
  context.append(el("p", "eyebrow", "KNOW WHAT YOU'RE VALUING"), el("h3", "", "Capacity, not cash."), el("p", "", "A transparent estimate of time that could be redeployed. Not a promise of headcount savings."));
  cards.push(context); put("metric-cards", ...cards);
  put("comparison-table", evidenceTable(e));
  if (e) {
    const throughput = el("p"); throughput.append(el("strong", "", number(e.pilot.prsPerEngineerMonth)), document.createTextNode(" pilot PRs / active engineer / month"));
    put("throughput-summary", throughput,
      el("p", "", `Baseline: ${number(e.baseline.prsPerEngineerMonth)} PRs / active engineer / month.`),
      el("p", "", `Duration-normalized total: ${number(e.baseline.prsPerMonth)} → ${number(e.pilot.prsPerMonth)} PRs / month.`),
      el("p", "", `Pilot credit intensity: ${number(e.pilot.creditsPerAssistedPR)} credits/PR (assisted).`),
      el("p", "", `Baseline source: ${e.baseline.source_label}`),
      el("p", "", `Pilot source: ${e.pilot.source_label}`));
  } else put("throughput-summary", el("p", "", "Correct invalid inputs to restore evidence."));
}

function renderRollout(result) {
  const projection = result.projection;
  if (!projection) {
    put("rollout-summary", el("div", "notice error", `Financial outputs ${result.status}. ${result.status === "invalid" ? "Correct the validation errors above; no previous figures are retained." : result.warnings.at(-1)}`));
    put("rollout-chart");
    put("rollout-table", el("p", "empty-state", "Monthly projections are unavailable."));
    return;
  }
  const t = projection.totals;
  const feature = el("div", "rollout-feature");
  const headline = (label, amount, note) => {
    const div = el("div");
    div.append(el("p", "eyebrow", label), el("div", "hero-number", amount), el("p", "", note)); return div;
  };
  feature.append(
    headline("YEAR-ONE CAPACITY VALUE", money(t.capacityValueSGD), "Potential engineering capacity, valued at loaded cost."),
    headline("ILLUSTRATIVE SPEND", money(t.spendSGD), PRICE_DISCLAIMER),
    headline("NET CAPACITY VALUE", money(t.netValueSGD), "Capacity value less illustrative spend."),
  );
  const stats = el("dl", "rollout-stats");
  for (const [label, value, note] of [
    ["Potential capacity", `${number(t.capacityHours)} hrs`, "Sum of all 12 rollout months"],
    ["Capacity-value ROI", t.roiPct === null ? "N/A" : `${number(t.roiPct)}%`, "Not cash-on-cash return"],
    ["Benefit / cost", t.benefitCostRatio === null ? "N/A" : `${number(t.benefitCostRatio)}×`, "N/A when spend is zero"],
    ["Cumulative break-even", t.breakEvenMonth === null ? "Not reached" : `Month ${t.breakEvenMonth}`, t.breakEvenMonth === null ? "Not reached within 12 months" : "Excludes unmodeled upfront costs"],
  ]) {
    const div = el("div", "stat"); div.append(el("dt", "", label), el("dd", "", value), el("dd", "stat-note", note)); stats.append(div);
  }
  put("rollout-summary", feature, stats);
  const max = Math.max(1, ...projection.months.flatMap(m => [m.capacityValueSGD, m.spendSGD]));
  put("rollout-chart", ...projection.months.map(m => {
    const div = el("div", "bar-month"), bars = el("div", "bars");
    const value = el("div", "bar value-bar"), cost = el("div", "bar cost-bar");
    value.style.height = `${m.capacityValueSGD / max * 100}%`; cost.style.height = `${m.spendSGD / max * 100}%`;
    bars.append(value, cost); div.append(bars, el("span", "", `M${m.month}`)); return div;
  }));
  const table = createTable(["Month", "Adoption", "Active eng.", "Assisted PRs", "Capacity hrs", "Capacity value", "Illust. spend", "Net value", "Cumulative net"],
    projection.months.map(m => [
      `M${m.month}`, `${number(m.adoptionPct)}%`, number(m.activeEngineers), number(m.assistedPRs), number(m.capacityHours),
      money(m.capacityValueSGD), money(m.spendSGD), money(m.netValueSGD), money(m.cumulativeNetSGD),
    ]), `SGD. Cost is ${PRICE_DISCLAIMER}. Fractional engineers represent expected active engineer-equivalents, not a staffing plan.`, "rollout-table");
  const total = el("tr", "totals-row");
  ["Year 1", "—", "—", "—", number(t.capacityHours), money(t.capacityValueSGD), money(t.spendSGD), money(t.netValueSGD), money(t.netValueSGD)].forEach(value => total.append(el("td", "", value)));
  table.tBodies[0].append(total); put("rollout-table", table);
}

function renderReport(snapshot) {
  const { results: r, assumptions: a } = snapshot;
  const readout = buildReadout(snapshot);
  $("report-title").textContent = snapshot.scenario;
  $("report-provenance").textContent = `${snapshot.provenance} · Model ${snapshot.modelVersion} · ${snapshot.generatedAt}`;
  const executiveText = readout.split("## Executive summary\n")[1].split("\n## Observed evidence")[0].trim();
  put("report-summary", ...executiveText.split("\n").filter(Boolean).map(text => el("p", "", text)));
  put("report-evidence", evidenceTable(r.evidence));
  for (const phase of ["baseline", "pilot"]) {
    const row = r.evidence?.[phase];
    if (row) $("report-evidence").append(el("p", "report-period", `${phase}: ${row.start_date} → ${row.end_date} (end exclusive), ${number(row.days)} days. Source: ${row.source_label}. Normalized PRs/month: ${number(row.prsPerMonth)}; PRs/active engineer/month: ${number(row.prsPerEngineerMonth)}. Credit intensity: ${number(row.creditsPerAssistedPR)} credits/PR (assisted).`));
  }
  put("report-assumptions", ...list([
    ...ASSUMPTION_FIELDS.map(([key, label, unit]) => `${label}: ${number(a[key])} ${unit}${key === "creditCostPerEngineerMonthSGD" ? ` (${PRICE_DISCLAIMER})` : ""}.`),
    `Monthly adoption (% of total scope active): ${a.adoptionRampPct.map(number).join(", ")}.`,
  ]));
  put("report-limitations", ...list([...r.errors, ...r.warnings, ...LIMITATIONS]));
  // Print the complete month table too, not just the headline case.
  if (r.projection) {
    const table = $("rollout-table").firstElementChild.cloneNode(true);
    const heading = el("h3", "", "12-month rollout");
    $("report-assumptions").append(el("li", "", "Month-by-month economics are included below and in both exports."));
    put("report-monthly", heading, table);
  } else put("report-monthly");
  $("readout-preview").textContent = readout;
}

function render() {
  const snapshot = makeSnapshot(state);
  const result = snapshot.results;
  $("scenario-display").textContent = state.scenario || "Untitled scenario";
  const synthetic = state.provenance === "synthetic";
  $("provenance-badge").textContent = synthetic ? "Synthetic" : "Customer-provided, unverified";
  $("provenance-badge").className = `badge ${synthetic ? "synthetic" : "customer"}`;
  $("scenario-note").textContent = synthetic ? DEMO_DISCLAIMER : "Format checked, not factual accuracy. Confirm sources before a decision.";
  $("validation-errors").hidden = result.errors.length === 0;
  const errors = el("ul"); errors.append(...list(result.errors)); put("validation-errors", el("strong", "", "Inputs need attention. Outputs are suppressed until corrected."), errors);
  const warnings = result.warnings.filter(w => w !== DEMO_DISCLAIMER);
  $("status").hidden = result.status === "ready" && warnings.length === 0;
  $("status").textContent = warnings.join("\n");
  for (const id of ["download-snapshot", "download-readout", "print-readout"]) $(id).disabled = result.status === "invalid";
  document.querySelectorAll("input:not([type=file])").forEach(input => {
    input.setAttribute("aria-invalid", String(Boolean(!input.checkValidity()
      || (input.required && !input.value.trim())
      || (input.dataset.positive && !(parseNumber(input.value) > 0)))));
  });
  renderEvidence(result); renderRollout(result); renderReport(snapshot);
}

function download(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = el("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  // Give the browser time to consume the object URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("input", event => {
  if (!state) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  // A partly typed exponent or minus is a draft error, not an optional blank metric.
  const numericValue = () => input.validity.badInput ? NaN : parseNumber(input.value);
  if (input.id === "scenario") state.scenario = input.value;
  else if (input.dataset.observation) {
    const row = state.observations.find(row => row.phase === input.dataset.observation);
    row[input.dataset.field] = NUMBER_FIELDS.includes(input.dataset.field) ? numericValue() : input.value;
  } else if (input.dataset.assumption) state.assumptions[input.dataset.assumption] = numericValue();
  else if (input.dataset.month !== undefined) state.assumptions.adoptionRampPct[Number(input.dataset.month)] = numericValue();
  else return;
  render();
});

$("download-snapshot").addEventListener("click", () => {
  const snapshot = makeSnapshot(state);
  if (snapshot.results.status !== "invalid") download("roi-cockpit-evidence.json", JSON.stringify(snapshot, null, 2), "application/json");
});
$("download-readout").addEventListener("click", () => {
  const snapshot = makeSnapshot(state);
  if (snapshot.results.status !== "invalid") download("roi-cockpit-readout.md", buildReadout(snapshot), "text/markdown;charset=utf-8");
});
$("download-template").addEventListener("click", async () => {
  try {
    const response = await fetch("./data/template.csv");
    if (!response.ok) throw new Error("Could not load the bundled template.");
    download("roi-cockpit-template.csv", await response.text(), "text/csv;charset=utf-8");
  } catch (error) { $("import-error").hidden = false; $("import-error").textContent = error.message; }
});
$("print-readout").addEventListener("click", () => window.print());
$("reset-demo").addEventListener("click", () => { if (demo) $("reset-dialog").showModal(); });
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("confirm-reset").addEventListener("click", () => {
  importSequence++; pendingImport = null; state = newDemoState();
  $("import-error").hidden = true; $("csv-file").value = "";
  buildInputs(); render(); $("reset-dialog").close();
});
$("csv-file").addEventListener("change", async event => {
  const sequence = ++importSequence;
  const file = event.target.files[0]; pendingImport = null;
  $("import-error").hidden = true;
  if (!file || !state) return;
  try {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("CSV exceeds the 1 MB (1,000,000 bytes) limit.");
    const imported = parseCSV(await file.text());
    if (sequence !== importSequence) return;
    pendingImport = imported;
    put("import-preview", createTable(["Field", "Baseline", "Pilot"], observationFields.map(([key, label]) => [
      label, imported.find(row => row.phase === "baseline")[key] ?? "N/A", imported.find(row => row.phase === "pilot")[key] ?? "N/A",
    ])));
    const crossErrors = validateState({ ...state, observations: imported });
    if (crossErrors.length) $("import-preview").append(el("p", "notice", `After import, update assumptions to resolve:\n${crossErrors.join("\n")}`));
    $("import-dialog").showModal();
  } catch (error) {
    if (sequence === importSequence) { $("import-error").hidden = false; $("import-error").textContent = error.message; }
  } finally {
    if (sequence === importSequence) event.target.value = "";
  }
});
for (const id of ["cancel-import", "reject-import"]) $(id).addEventListener("click", () => $("import-dialog").close());
$("import-dialog").addEventListener("close", () => { pendingImport = null; });
$("confirm-import").addEventListener("click", () => {
  if (!pendingImport) return;
  state.observations = pendingImport; state.provenance = "customer-provided, unverified";
  // Do not carry an illustrative bank name into a customer-provided business case.
  if (state.scenario === "DBS, illustrative") state.scenario = "Customer pilot";
  pendingImport = null; buildInputs(); render(); $("import-dialog").close();
});

// Reserve an accessible region for the print-ready monthly economics.
const monthlyRegion = el("div", "table-wrap");
monthlyRegion.id = "report-monthly"; monthlyRegion.tabIndex = 0; monthlyRegion.setAttribute("aria-label", "Readout monthly economics");
$("report-assumptions").after(monthlyRegion);
document.querySelectorAll('[tabindex="0"][aria-label]').forEach(node => node.setAttribute("role", "region"));
$("scenario").required = true;
$("csv-file").setAttribute("aria-label", "Import aggregate pilot CSV");
$("main").setAttribute("aria-busy", "true");
$("model-version").textContent = MODEL_VERSION;
try {
  const response = await fetch("./data/demo.csv");
  if (!response.ok) throw new Error("The bundled fixture could not be loaded.");
  demo = parseCSV(await response.text()); state = newDemoState();
  buildInputs(); render();
} catch (error) {
  $("status").hidden = false; $("status").className = "notice error";
  $("status").textContent = `Unable to start: ${error.message} Serve this folder over localhost, not file://. See README.md.`;
} finally {
  $("main").setAttribute("aria-busy", "false");
}
