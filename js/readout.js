import { LIMITATIONS, PRICE_DISCLAIMER, VALUE_DISCLAIMER } from "./model.js";
import { ASSUMPTION_FIELDS } from "./validation.js";

export const number = value => value === null || value === undefined || !Number.isFinite(value)
  ? "N/A" : new Intl.NumberFormat("en-SG", { maximumFractionDigits: 1 }).format(value);
export const money = value => value === null || value === undefined || !Number.isFinite(value)
  ? "N/A" : new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", currencyDisplay: "code", maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ");
export const signed = value => value === null ? "N/A" : `${value > 0 ? "+" : ""}${number(value)}`;
export function metricValue(value, unit) {
  return value === null ? "N/A" : `${number(value)}${unit === "%" ? "%" : ` ${unit}`}`;
}
export function metricChange(metric) {
  if (metric.delta === null) return "N/A";
  if (metric.type === "lower") {
    if (metric.improvementPct === null) return `${signed(metric.delta)} hours; relative change N/A`;
    if (metric.improvementPct === 0) return "No change";
    return `${number(Math.abs(metric.improvementPct))}% ${metric.improvementPct > 0 ? "lower" : "higher"}`;
  }
  if (metric.type === "share") return `${signed(metric.delta)} percentage points`;
  if (metric.type === "ordinal") return `${signed(metric.delta)} points`;
  return `${signed(metric.delta)} ${metric.unit}`;
}
// Keep untrusted labels inert in Markdown/HTML-capable viewers.
const md = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replace(/([\\`*_[\]{}()!|#])/g, "\\$1").replace(/[\r\n]/g, " ");

export function headlineItems(result) {
  const t = result.projection?.totals;
  return [
    ["Net capacity value", money(t?.netValueSGD)],
    ["Capacity-value ROI", t?.roiPct == null ? "N/A" : `${number(t.roiPct)}%`],
    ["Payback (cumulative break-even)", !t ? "N/A" : t.breakEvenMonth === null ? "Not reached in 12 months" : `Month ${t.breakEvenMonth}`],
    ["Hours returned (potential)", t ? `${number(t.capacityHours)} hrs` : "N/A"],
  ];
}

export function buildBrief(snapshot) {
  const r = snapshot.results, t = r.projection?.totals;
  return [
    ["CIO / CFO decision summary", [snapshot.scenario, `${snapshot.provenance} · Model ${snapshot.modelVersion} · ${snapshot.generatedAt}`, VALUE_DISCLAIMER]],
    ["Year-one modeled case", [
      headlineItems(r).map(([label, value]) => `${label}: ${value}`).join(" · "),
      t ? `Capacity value ${money(t.capacityValueSGD)}; illustrative spend ${money(t.spendSGD)} (${PRICE_DISCLAIMER}).` : `Financial outputs ${r.status}. Resolve inputs before a decision.`,
      "Payback means cumulative capacity-value break-even, not cash investment payback; upfront costs are excluded.",
    ]],
    ["Pilot results · observed, not causal", r.evidence ? [
      ...r.evidence.metrics.map(m => `${m.label}: ${metricValue(m.baseline, m.unit)} → ${metricValue(m.pilot, m.unit)} (${metricChange(m)}).`),
      ...["baseline", "pilot"].map(phase => { const row = r.evidence[phase]; return `${phase}: ${row.start_date}–${row.end_date} (end exclusive), ${number(row.days)} days; ${number(row.prsPerMonth)} PRs/month. Source: ${row.source_label}`; }),
    ] : ["No data while inputs are invalid."]],
    ["Success plan · editable decision targets", snapshot.successPlan.map(s => `${s.label}: ${s.actual === null ? "N/A" : number(s.actual) + s.unit} vs target ≥${number(s.target)}${s.unit} — ${s.status}.`)],
    ["Three assumptions most worth checking", snapshot.assumptionChecks.map(c => `${c.label}: ${Array.isArray(c.current) ? c.current.map(number).join("/") : number(c.current)} ${c.unit}. ${c.test}: capacity value impact ${money(c.capacityValueImpactSGD)}; net value impact ${money(c.netValueImpactSGD)}.`)],
    ["Next steps", ["Engineering sponsor: validate comparable cohorts, PR attribution and a sampled labor time study. Rollout owner: confirm adoption and throughput transfer. Finance: validate costs, productive hours and commercial terms. Agree a decision gate and next measurement period."]],
    ["Caveats & data quality", [
      ...r.errors, ...r.warnings,
      "Downside checks change one assumption at a time, not forecasts. Cycle/review time is elapsed time, not saved labor. Readiness is ordinal, not certification. Credits are not SGD. Implementation, training, taxes and other tools are excluded; not full TCO. Full inputs and monthly figures are in Evidence JSON.",
    ]],
  ];
}

export function buildReadout(snapshot) {
  const { results: result, assumptions: a } = snapshot;
  const lines = [
    "# Pilot business case",
    "", `Scenario: ${md(snapshot.scenario)}`, `Provenance: ${md(snapshot.provenance)}`,
    `Generated: ${md(snapshot.generatedAt)} · Model ${md(snapshot.modelVersion)} · Schema ${snapshot.schemaVersion}`,
    "", `**${VALUE_DISCLAIMER}**`,
    "", "## Executive summary",
  ];
  if (result.projection) {
    const t = result.projection.totals;
    lines.push(`The 12-month model estimates ${number(t.capacityHours)} hours of potential engineering capacity, valued at ${money(t.capacityValueSGD)}. Against ${money(t.spendSGD)} illustrative spend, net capacity value is ${money(t.netValueSGD)}.`,
      `Capacity-value ROI: ${number(t.roiPct)}${t.roiPct === null ? "" : "%"}. Benefit/cost ratio: ${number(t.benefitCostRatio)}${t.benefitCostRatio === null ? "" : "×"}. Cumulative break-even: ${t.breakEvenMonth === null ? "not reached within 12 months" : `month ${t.breakEvenMonth}`}.`);
  } else lines.push(`Financial outputs are ${result.status}. Resolve the issues below before presenting a business case.`);
  lines.push("", "## Observed evidence", "", "| Metric | Baseline | Pilot | Change |", "| --- | ---: | ---: | --- |");
  if (result.evidence) {
    for (const metric of result.evidence.metrics) lines.push(`| ${metric.label} | ${metricValue(metric.baseline, metric.unit)} | ${metricValue(metric.pilot, metric.unit)} | ${metricChange(metric)} |`);
    for (const phase of ["baseline", "pilot"]) {
      const row = result.evidence[phase];
      lines.push("", `${phase}: ${row.start_date} to ${row.end_date} (end exclusive), ${number(row.days)} days; source: ${md(row.source_label)}.`,
        `Normalized throughput: ${number(row.prsPerMonth)} PRs/month; ${number(row.prsPerEngineerMonth)} PRs/active engineer/month. Assisted PRs: ${number(row.agent_assisted_prs)}. Credit intensity: ${number(row.creditsPerAssistedPR)} credits/PR (assisted).`);
    }
  } else lines.push("| Evidence unavailable while inputs are invalid | N/A | N/A | N/A |");
  lines.push("", "## Editable assumptions", "");
  for (const [key, label, unit] of ASSUMPTION_FIELDS) lines.push(`- ${label}: ${number(a[key])} ${unit}${key === "creditCostPerEngineerMonthSGD" ? ` (${PRICE_DISCLAIMER})` : ""}.`);
  lines.push(`- Adoption by month (% of total scope active): ${a.adoptionRampPct.map(number).join(", ")}.`,
    "", "## 12-month rollout", "", "| Month | Adoption | Active engineers | Assisted PRs | Capacity hours | Capacity value | Illustrative spend | Net capacity value | Cumulative net |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const m of result.projection?.months ?? []) lines.push(`| ${m.month} | ${number(m.adoptionPct)}% | ${number(m.activeEngineers)} | ${number(m.assistedPRs)} | ${number(m.capacityHours)} | ${money(m.capacityValueSGD)} | ${money(m.spendSGD)} | ${money(m.netValueSGD)} | ${money(m.cumulativeNetSGD)} |`);
  lines.push("", "## Data quality and limitations", "");
  for (const warning of [...result.errors, ...result.warnings, ...LIMITATIONS]) lines.push(`- ${md(warning)}`);
  lines.push("", "## Recommended next evidence", "",
    "- Confirm comparable cohorts, PR attribution rules, timestamp coverage, and source ownership with the engineering sponsor.",
    "- Validate assumed labor hours saved per assisted PR with a sampled time study; do not substitute elapsed cycle-time reductions.",
    "- Confirm productive hours, adoption, commercial terms, and excluded costs with finance before using the estimate for a decision.",
    "- Agree a rollout decision gate and an owner for the next measurement period.", "");
  return lines.join("\n");
}
