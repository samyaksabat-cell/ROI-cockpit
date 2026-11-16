import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCSV, serializeCSV } from "../js/csv.js";
import { calculate, DEFAULT_ASSUMPTIONS, makeSnapshot, PRICE_DISCLAIMER, VALUE_DISCLAIMER } from "../js/model.js";
import { MAX_UPLOAD_BYTES, parseNumber, validateState } from "../js/validation.js";
import { buildBrief, headlineItems, buildReadout, metricChange, money } from "../js/readout.js";
import { buildDocx } from "../js/docx.js";
import { crc32 } from "node:zlib";

let passed = 0;
const test = (label, fn) => {
  try { fn(); passed++; console.log(`PASS ${label}`); }
  catch (error) { console.error(`FAIL ${label}`); throw error; }
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const demo = parseCSV(await readFile(new URL("../data/demo.csv", import.meta.url), "utf8"));
const fixture = () => ({
  scenario: "Hand-calculated fixture", provenance: "synthetic",
  observations: [
    { ...demo[0], start_date: "2024-01-01", end_date: "2024-12-31", prs_merged: 1200, agent_assisted_prs: 120, active_engineers: 10 },
    { ...demo[1], start_date: "2025-01-01", end_date: "2026-01-01", prs_merged: 1200, agent_assisted_prs: 600, active_engineers: 10 },
  ],
  assumptions: { ...structuredClone(DEFAULT_ASSUMPTIONS), pilotEngineers: 10, scopeEngineers: 100, hoursSavedPerAssistedPR: 2, adoptionRampPct: Array(12).fill(80) },
});
const demoText = serializeCSV(demo);

test("demo and template are valid with starter assumptions", () => {
  assert.equal(calculate({ ...fixture(), observations: demo, assumptions: DEFAULT_ASSUMPTIONS }).status, "ready");
});
const template = parseCSV(await readFile(new URL("../data/template.csv", import.meta.url), "utf8"));
test("template imports unchanged", () => assert.equal(template.length, 2));
test("CSV round trip, BOM, CRLF, quote/comma/newline", () => {
  const data = structuredClone(demo);
  data[0].source_label = 'An "aggregate", with\nnewline';
  assert.deepEqual(parseCSV("\uFEFF" + serializeCSV(data)), data);
});
test("reordered columns are accepted", () => {
  const lines = demoText.trim().split("\r\n").map(line => line.split(",").reverse().join(",")).join("\n");
  assert.deepEqual(parseCSV(lines), demo);
});
test("blank optional metrics stay missing, not zero", () => {
  const data = structuredClone(demo);
  data[1].pr_cycle_hours = null;
  data[1].factory_credits = null;
  assert.equal(parseCSV(serializeCSV(data))[1].pr_cycle_hours, null);
  const result = calculate({ ...fixture(), observations: data, assumptions: DEFAULT_ASSUMPTIONS });
  assert.equal(result.status, "ready");
  assert.equal(result.evidence.metrics[0].delta, null);
  assert.equal(result.evidence.pilot.creditsPerAssistedPR, null);
  assert.ok(result.warnings.some(w => w.includes("missing")));
});
const malformed = [
  ["missing header", demoText.replace("source_label", "wrong")],
  ["duplicate header", demoText.replace("source_label", "phase")],
  ["duplicate phase", demoText.replace("pilot,", "baseline,")],
  ["unknown phase", demoText.replace("pilot,", "rollout,")],
  ["extra row", demoText + demoText.split("\r\n")[1]],
  ["empty file", ""],
  ["unterminated quote", demoText + '"'],
  ["unescaped quote", demoText.replace("Synthetic baseline", 'Synthetic "baseline"')],
  ["text after closing quote", demoText.replace("Synthetic baseline", '"bad"x')],
  ["wrong width", demoText.replace("baseline,", "baseline,extra,")],
  ["invalid date", demoText.replace("2026-08-03", "2026-02-30")],
  ["reverse dates", demoText.replace("2026-08-03", "2026-09-30")],
  ["overlapping periods", demoText.replace("2026-08-31", "2026-09-03")],
  ["blank required count", demoText.replace(",160,", ",,")],
  ["negative number", demoText.replace(",160,", ",-1,")],
  ["fractional count", demoText.replace(",160,", ",1.5,")],
  ["bad readiness", demoText.replace(",2,12000,", ",6,12000,")],
  ["too many assisted", demoText.replace(",16,2,", ",999,2,")],
  ["invalid zero active", demoText.replace(",12000,20,", ",12000,0,")],
  ["infinite number", demoText.replace(",160,", ",1e999,")],
  ["too large number", demoText.replace(",160,", ",1e13,")],
  ["large upload", "x".repeat(MAX_UPLOAD_BYTES + 1)],
];
for (const [label, text] of malformed) test(`reject ${label}`, () => assert.throws(() => parseCSV(text)));
test("hostile labels remain inert data", () => {
  const state = fixture();
  state.observations[0].source_label = '<img src=x onerror=alert(1)> [click](https://evil.invalid)';
  const parsed = parseCSV(serializeCSV(state.observations));
  assert.equal(parsed[0].source_label, state.observations[0].source_label);
  const readout = buildReadout(makeSnapshot(state));
  assert.ok(!readout.includes("<img"));
  assert.ok(!readout.includes("[click]("));
});
test("strict decimal numbers and empty input", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("0"), 0);
  assert.ok(Number.isNaN(parseNumber("0x10")));
  assert.ok(Number.isNaN(parseNumber("-1")));
});
test("independent annual golden fixture: 9600h, 960k value, 192k spend, 768k net, 400%, 5x", () => {
  const result = calculate(fixture());
  assert.equal(result.status, "ready");
  near(result.projection.throughputPRsPerEngineerMonth, 10);
  const t = result.projection.totals;
  near(t.capacityHours, 9600); near(t.capacityValueSGD, 960000); near(t.spendSGD, 192000);
  near(t.netValueSGD, 768000); near(t.roiPct, 400); near(t.benefitCostRatio, 5);
  assert.equal(t.breakEvenMonth, 1);
});
test("model sums a variable, decreasing ramp rather than extrapolating final month", () => {
  const state = fixture();
  state.assumptions.adoptionRampPct = [0, 0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0];
  // Sum adoption = 250% => 250 active engineer-months; 10 hours each; SGD100/hour; SGD200/engineer-month.
  const { totals: t } = calculate(state).projection;
  near(t.capacityHours, 2500); near(t.capacityValueSGD, 250000); near(t.spendSGD, 50000);
  assert.equal(t.breakEvenMonth, 3);
});
test("zero adoption returns zeros but undefined ROI/ratio and no break-even", () => {
  const state = fixture(); state.assumptions.adoptionRampPct.fill(0);
  const t = calculate(state).projection.totals;
  near(t.capacityHours, 0); near(t.spendSGD, 0);
  assert.equal(t.roiPct, null); assert.equal(t.benefitCostRatio, null); assert.equal(t.breakEvenMonth, null);
});
test("zero cost returns N/A ROI and ratio, not infinite claims", () => {
  const state = fixture(); state.assumptions.creditCostPerEngineerMonthSGD = 0;
  const t = calculate(state).projection.totals;
  assert.equal(t.roiPct, null); assert.equal(t.benefitCostRatio, null); assert.equal(t.breakEvenMonth, null);
});
test("negative net value is retained and break-even not reached", () => {
  const state = fixture(); state.assumptions.creditCostPerEngineerMonthSGD = 2000;
  const t = calculate(state).projection.totals;
  near(t.netValueSGD, -960000); near(t.roiPct, -50); assert.equal(t.breakEvenMonth, null);
});
test("zero hours saved is a valid assumption", () => {
  const state = fixture(); state.assumptions.hoursSavedPerAssistedPR = 0;
  const t = calculate(state).projection.totals;
  near(t.capacityHours, 0); near(t.roiPct, -100);
});
test("zero assisted share is valid and credits/PR is N/A", () => {
  const state = fixture(); state.observations[1].agent_assisted_prs = 0;
  const result = calculate(state);
  near(result.projection.totals.capacityHours, 0);
  assert.equal(result.evidence.pilot.creditsPerAssistedPR, null);
});
test("zero pilot PRs and active engineers suppress projections, not measured evidence", () => {
  const state = fixture();
  Object.assign(state.observations[1], { prs_merged: 0, agent_assisted_prs: 0, active_engineers: 0 });
  const result = calculate(state);
  assert.equal(result.status, "unavailable"); assert.equal(result.projection, null);
  assert.equal(result.evidence.pilot.assistedSharePct, null);
});
test("readiness uses point change; assisted share uses percentage points", () => {
  const metrics = calculate(fixture()).evidence.metrics;
  near(metrics[3].delta, 40);
  assert.equal(metricChange(metrics[3]), "+40 percentage points");
  assert.equal(metricChange(metrics[4]), "+1 points");
  near(metrics[0].improvementPct, 100 / 3);
});
test("zero baseline elapsed metric yields N/A relative improvement", () => {
  const state = fixture(); state.observations[0].pr_cycle_hours = 0;
  assert.equal(calculate(state).evidence.metrics[0].improvementPct, null);
});
test("elapsed time, readiness, and credits do not change financial benefits", () => {
  const state = fixture(); const before = calculate(state).projection;
  Object.assign(state.observations[1], { pr_cycle_hours: 999, review_turnaround_hours: 999, readiness_level: 1, factory_credits: 1e10 });
  assert.deepEqual(calculate(state).projection, before);
});
test("unequal durations normalize throughput and warn", () => {
  const state = fixture(); state.observations[1].end_date = "2025-01-31";
  const result = calculate(state);
  near(result.evidence.pilot.prsPerMonth, 1200 / 30 * (365 / 12));
  assert.ok(result.warnings.some(w => w.includes("periods differ")));
});
test("productive-hour constraint blocks, never silently caps, and accepts exact bound", () => {
  const state = fixture(); state.assumptions.hoursSavedPerAssistedPR = 100;
  assert.equal(calculate(state).status, "blocked");
  assert.equal(calculate(state).projection, null);
  state.assumptions.hoursSavedPerAssistedPR = (2080 / 12) / 5;
  assert.equal(calculate(state).status, "ready");
  state.assumptions.hoursSavedPerAssistedPR += 0.00001;
  assert.equal(calculate(state).status, "blocked");
});
test("invalid edits never preserve a stale projection", () => {
  const state = fixture(); assert.ok(calculate(state).projection);
  state.assumptions.annualLoadedCostSGD = null;
  assert.equal(calculate(state).status, "invalid"); assert.equal(calculate(state).projection, null);
});
test("assumption and cohort constraints", () => {
  for (const change of [
    a => { a.pilotEngineers = 1.5; },
    a => { a.scopeEngineers = 1; },
    a => { a.pilotEngineers = 5; },
    a => { a.annualProductiveHours = 0; },
    a => { a.adoptionRampPct[0] = 101; },
    a => { a.adoptionRampPct[0] = null; },
    a => { a.adoptionRampPct = [50]; },
    a => { a.hoursSavedPerAssistedPR = -1; },
  ]) {
    const state = fixture(); change(state.assumptions); assert.ok(validateState(state).length);
  }
});
test("snapshot reproduces calculation and readout contains shared numbers and disclaimers", () => {
  const snapshot = makeSnapshot(fixture(), "2026-11-16T00:00:00.000Z");
  assert.deepEqual(snapshot.results, calculate(snapshot));
  const readout = buildReadout(snapshot);
  for (const expected of [money(960000), money(192000), money(768000), "9,600", "400%", "5×", PRICE_DISCLAIMER, VALUE_DISCLAIMER, "Synthetic data"]) assert.ok(readout.includes(expected), expected);
  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(!/NaN|Infinity/.test(readout + JSON.stringify(snapshot)));
});
test("edge-case exports have N/A rather than NaN/Infinity", () => {
  for (const variant of ["zero", "missing", "blocked", "invalid"]) {
    const state = fixture();
    if (variant === "zero") state.assumptions.creditCostPerEngineerMonthSGD = 0;
    if (variant === "missing") state.observations[1].pr_cycle_hours = null;
    if (variant === "blocked") state.assumptions.hoursSavedPerAssistedPR = 9999;
    if (variant === "invalid") state.assumptions.annualProductiveHours = null;
    const snapshot = makeSnapshot(state);
    assert.ok(!/NaN|Infinity/.test(buildReadout(snapshot) + JSON.stringify(snapshot)));
  }
});
test("extreme tiny denominators cannot produce nonfinite financial output or comparisons", () => {
  const state = fixture();
  state.assumptions.annualProductiveHours = 1e-320;
  state.assumptions.hoursSavedPerAssistedPR = 0;
  assert.equal(calculate(state).status, "blocked");
  state.assumptions = structuredClone(fixture().assumptions);
  state.assumptions.creditCostPerEngineerMonthSGD = 1e-320;
  assert.equal(calculate(state).status, "blocked");
  state.observations[0].pr_cycle_hours = 1e-320;
  assert.equal(calculate(state).evidence.metrics[0].improvementPct, null);
});
const droid = await readFile(new URL("../.factory/droids/roi-analyst.md", import.meta.url), "utf8");
const skill = await readFile(new URL("../.factory/skills/pilot-readout/SKILL.md", import.meta.url), "utf8");
test("Factory resource definitions have required names and constrained tool policy", () => {
  assert.match(droid, /^---\nname: roi-analyst\n/);
  assert.match(droid, /model: inherit/);
  assert.match(droid, /tools: \["Read", "LS", "Grep", "Glob"\]/);
  assert.match(droid, /mcpServers: \[\]/);
  assert.match(skill, /^---\nname: pilot-readout\n/);
  assert.match(skill, /user-invocable: true/);
  assert.ok(skill.includes("configured model service"));
  assert.ok(droid.includes("unverifiable"));
});
test("success-plan default, edited, exact-boundary and missing statuses", () => {
  const state = fixture();
  let snapshot = makeSnapshot(state);
  assert.deepEqual(snapshot.successPlan.map(s => s.status), ["Met", "Met", "Met"]);
  state.successTargets = { cycleReductionPct: 40, assistedSharePct: 50, readinessLevel: 4 };
  snapshot = makeSnapshot(state);
  assert.deepEqual(snapshot.successPlan.map(s => s.status), ["Not met", "Met", "Not met"]);
  state.observations[0].pr_cycle_hours = 0;
  state.observations[1].readiness_level = null;
  Object.assign(state.observations[1], { prs_merged: 0, agent_assisted_prs: 0, active_engineers: 0 });
  assert.deepEqual(makeSnapshot(state).successPlan.map(s => s.status), ["No data", "No data", "No data"]);
});
test("decimal cycle times exactly at the target count as met", () => {
  for (const [b, p] of [[10.5, 8.4], [1, 0.8], [5.5, 4.4], [8, 6.4]]) {
    const state = fixture(); state.observations[0].pr_cycle_hours = b; state.observations[1].pr_cycle_hours = p;
    assert.equal(makeSnapshot(state).successPlan[0].status, "Met", `${b} → ${p}`);
  }
});
test("Word heading properties follow schema order", () => {
  const xml = new TextDecoder().decode(buildDocx(makeSnapshot(fixture())));
  assert.ok(xml.includes("<w:pPr><w:keepNext/><w:spacing"));
  assert.ok(!/<w:spacing[^>]*\/><w:keepNext\/>/.test(xml));
});
test("invalid targets suppress stale figures and target edits never change economics", () => {
  const state = fixture(), before = calculate(state).projection;
  state.successTargets = { cycleReductionPct: 100, assistedSharePct: 100, readinessLevel: 5 };
  assert.deepEqual(calculate(state).projection, before);
  for (const [key, invalid] of [["cycleReductionPct", 101], ["assistedSharePct", null], ["readinessLevel", 2.5]]) {
    const bad = structuredClone(state); bad.successTargets[key] = invalid;
    assert.equal(calculate(bad).status, "invalid");
    assert.equal(makeSnapshot(bad).results.projection, null);
  }
});
test("independent downside checks: value -192k, adoption net -153600, others net -192k", () => {
  const snapshot = makeSnapshot(fixture());
  assert.deepEqual(snapshot.assumptionChecks.map(c => c.capacityValueImpactSGD), [-192000, -192000, -192000]);
  assert.deepEqual(snapshot.assumptionChecks.map(c => c.netValueImpactSGD), [-192000, -153600, -192000]);
  const state = fixture(); state.assumptions.creditCostPerEngineerMonthSGD = 2000;
  assert.equal(makeSnapshot(state).assumptionChecks[1].netValueImpactSGD, 192000);
  state.assumptions.hoursSavedPerAssistedPR = 999;
  assert.ok(makeSnapshot(state).assumptionChecks.every(c => c.netValueImpactSGD === null));
});
test("brief and headline reuse totals and preserve all required sections", () => {
  const snapshot = makeSnapshot(fixture());
  const text = JSON.stringify(buildBrief(snapshot));
  for (const expected of ["768,000", "400%", "Month 1", "9,600", "Pilot results", "Success plan", "Three assumptions", "Next steps", PRICE_DISCLAIMER, VALUE_DISCLAIMER, "Synthetic data"]) assert.ok(text.includes(expected), expected);
  const state = fixture(); state.assumptions.hoursSavedPerAssistedPR = 999;
  assert.ok(headlineItems(calculate(state)).every(([, value]) => value === "N/A"));
});
test("brief tables are rectangular and cover every reference section", () => {
  const brief = buildBrief(makeSnapshot(fixture()));
  const tables = brief.filter(([, , table]) => table).map(([title, , table]) => [title, table]);
  assert.deepEqual(tables.map(([title]) => title.split(" ")[0]), ["Year-one", "Pilot", "Success", "Three", "Next"]);
  for (const [, table] of tables) for (const row of table.rows) assert.equal(row.length, table.headers.length);
  assert.equal(tables[1][1].rows.length, 7);
  assert.deepEqual(tables[2][1].rows.map(row => row.at(-1)), ["Met", "Met", "Met"]);
  const state = fixture(); state.assumptions.annualProductiveHours = null;
  assert.equal(buildBrief(makeSnapshot(state))[2][2], undefined);
});
test("Word summary contains one table per reference section with status colors", () => {
  const xml = new TextDecoder().decode(buildDocx(makeSnapshot(fixture())));
  assert.equal(xml.match(/<w:tbl>/g).length, 5);
  assert.ok(xml.includes('<w:color w:val="087560"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Met<'));
  assert.ok(xml.includes("<w:tblHeader/>"));
});
test("Word is a valid stored ZIP with matching CRCs and escaped shared content", () => {
  const state = fixture(); state.scenario = 'Test <&> "文本" \u0001';
  const snapshot = makeSnapshot(state), bytes = buildDocx(snapshot);
  const view = new DataView(bytes.buffer);
  let offset = 0, count = 0, document = "";
  while (view.getUint32(offset, true) === 0x04034b50) {
    const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const data = bytes.slice(offset + 30 + nameLength, offset + 30 + nameLength + length);
    assert.equal(crc32(data), view.getUint32(offset + 14, true));
    if (name === "word/document.xml") document = new TextDecoder().decode(data);
    offset += 30 + nameLength + length; count++;
  }
  assert.equal(count, 3); assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.match(document, /Test &lt;&amp;&gt; &quot;文本&quot;/);
  assert.ok(!document.includes("\u0001"));
  for (const expected of ["768,000", "960,000", "192,000", "Success plan", "Next steps"]) assert.ok(document.includes(expected));
  assert.ok(!/NaN|Infinity/.test(document));
});
console.log(`\n${passed} checks passed.`);
