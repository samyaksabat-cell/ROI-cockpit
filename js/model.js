import { validateState } from "./validation.js";

export const MODEL_VERSION = "1.0.0";
export const PRICE_DISCLAIMER = "illustrative, not Factory list price";
export const VALUE_DISCLAIMER = "Potential capacity value, not cash savings or guaranteed productivity.";
export const DEMO_DISCLAIMER = "DBS, illustrative. Synthetic data, not customer results or an endorsement.";
export const LIMITATIONS = [
  VALUE_DISCLAIMER,
  "Observed changes do not establish causality. PR cycle and review times measure elapsed time, not labor savings.",
  "The rollout assumes pilot active-engineer throughput and assisted share transfer to the wider scope; validate team comparability and attribution.",
  "Hours saved per assisted PR is an assumption, not a measured productivity result.",
  "Readiness is a supplied ordinal assessment, not an official certification. Credits are consumption units, not SGD.",
  `Credit cost is ${PRICE_DISCLAIMER}; applied per modeled active engineer-month, not per consumed credit.`,
  "Implementation, training, taxes, and other tools are excluded. This is not complete procurement TCO.",
  "Cumulative break-even excludes unmodeled upfront investment; positive capacity value is not a budget reduction.",
  "A normalized month is 365/12 days. Baseline and pilot must use the same team, attribution rules, and measurement definitions.",
];
export const DEFAULT_ASSUMPTIONS = {
  pilotEngineers: 25,
  scopeEngineers: 250,
  annualLoadedCostSGD: 208000,
  hoursSavedPerAssistedPR: 1.5,
  annualProductiveHours: 2080,
  creditCostPerEngineerMonthSGD: 200,
  adoptionRampPct: [10, 15, 20, 30, 40, 50, 60, 65, 70, 75, 80, 80],
};
export const METRICS = [
  { key: "pr_cycle_hours", label: "PR cycle time", unit: "hours", type: "lower", short: "Cycle time" },
  { key: "prs_merged", label: "PRs merged", unit: "PRs", type: "count", short: "PRs merged" },
  { key: "review_turnaround_hours", label: "Review turnaround", unit: "hours", type: "lower", short: "Review turnaround" },
  { key: "assistedSharePct", label: "Agent-assisted PR share", unit: "%", type: "share", short: "Assisted PR share" },
  { key: "readiness_level", label: "Readiness level", unit: "/ 5", type: "ordinal", short: "Readiness" },
  { key: "factory_credits", label: "Factory credits consumed", unit: "credits", type: "count", short: "Credits consumed" },
  { key: "active_engineers", label: "Active engineers", unit: "engineers", type: "count", short: "Active engineers" },
];

export function observationStats(row) {
  const days = (Date.parse(`${row.end_date}T00:00:00Z`) - Date.parse(`${row.start_date}T00:00:00Z`)) / 86400000;
  const months = days / (365 / 12);
  const assistedSharePct = row.prs_merged > 0 ? row.agent_assisted_prs / row.prs_merged * 100 : null;
  const prsPerMonth = row.prs_merged / months;
  return {
    ...row, days, months, assistedSharePct, prsPerMonth,
    prsPerEngineerMonth: row.active_engineers > 0 && row.prs_merged > 0 ? prsPerMonth / row.active_engineers : null,
    creditsPerAssistedPR: row.factory_credits !== null && row.agent_assisted_prs > 0 ? row.factory_credits / row.agent_assisted_prs : null,
  };
}

export function compareMetric(metric, baseline, pilot) {
  const b = baseline[metric.key], p = pilot[metric.key];
  if (b === null || p === null) return { baseline: b, pilot: p, delta: null, percent: null, improvementPct: null };
  const finite = value => Number.isFinite(value) ? value : null;
  return {
    baseline: b, pilot: p, delta: p - b,
    percent: b > 0 ? finite((p - b) / b * 100) : null,
    improvementPct: metric.type === "lower" && b > 0 ? finite((b - p) / b * 100) : null,
  };
}

export function calculate(state) {
  const errors = validateState(state);
  if (errors.length) return { status: "invalid", errors, warnings: [], evidence: null, projection: null };
  const baseline = observationStats(state.observations.find(row => row.phase === "baseline"));
  const pilot = observationStats(state.observations.find(row => row.phase === "pilot"));
  const evidence = {
    baseline, pilot,
    metrics: METRICS.map(metric => ({ ...metric, ...compareMetric(metric, baseline, pilot) })),
  };
  const warnings = [];
  if (state.provenance === "synthetic") warnings.push(DEMO_DISCLAIMER);
  else warnings.push("Customer-provided, unverified data. Import validation checks format and consistency, not factual accuracy.");
  if (baseline.days !== pilot.days) warnings.push("Observation periods differ. Compare normalized PR throughput, not raw PR count growth.");
  for (const row of [baseline, pilot]) {
    for (const key of ["pr_cycle_hours", "review_turnaround_hours", "readiness_level", "factory_credits"]) {
      if (row[key] === null) warnings.push(`${row.phase}: ${key} is missing; the affected metric is N/A.`);
    }
  }
  if (pilot.prsPerEngineerMonth === null || pilot.assistedSharePct === null) {
    warnings.push("Rollout unavailable: the pilot needs merged PRs and active engineers to establish throughput and assisted share.");
    return { status: "unavailable", errors: [], warnings, evidence, projection: null };
  }
  const a = state.assumptions;
  const hourlyRate = a.annualLoadedCostSGD / a.annualProductiveHours;
  if (!Number.isFinite(hourlyRate)) {
    warnings.push("Financial outputs blocked: the hourly rate exceeds numeric range. Check loaded cost and annual productive hours.");
    return { status: "blocked", errors: [], warnings, evidence, projection: null };
  }
  const monthlyProductiveHours = a.annualProductiveHours / 12;
  const hoursPerActiveEngineer = pilot.prsPerEngineerMonth * (pilot.assistedSharePct / 100) * a.hoursSavedPerAssistedPR;
  if (a.adoptionRampPct.some(pct => pct > 0) && hoursPerActiveEngineer > monthlyProductiveHours + 1e-9) {
    warnings.push("Financial outputs blocked: modeled saved hours exceed productive hours for the adopted cohort. Reduce hours saved per PR, check pilot throughput, or correct annual productive hours. Savings have not been capped.");
    return { status: "blocked", errors: [], warnings, evidence, projection: null };
  }
  let cumulativeValue = 0, cumulativeSpend = 0;
  const months = a.adoptionRampPct.map((adoptionPct, index) => {
    const activeEngineers = a.scopeEngineers * adoptionPct / 100;
    const assistedPRs = activeEngineers * pilot.prsPerEngineerMonth * pilot.assistedSharePct / 100;
    const capacityHours = assistedPRs * a.hoursSavedPerAssistedPR;
    const capacityValueSGD = capacityHours * hourlyRate;
    const spendSGD = activeEngineers * a.creditCostPerEngineerMonthSGD;
    cumulativeValue += capacityValueSGD;
    cumulativeSpend += spendSGD;
    return {
      month: index + 1, adoptionPct, activeEngineers, assistedPRs, capacityHours,
      availableHours: activeEngineers * monthlyProductiveHours,
      capacityValueSGD, spendSGD, netValueSGD: capacityValueSGD - spendSGD,
      cumulativeNetSGD: cumulativeValue - cumulativeSpend,
      cumulativeSpendSGD: cumulativeSpend, cumulativeValueSGD: cumulativeValue,
    };
  });
  const sum = key => months.reduce((total, month) => total + month[key], 0);
  const capacityValueSGD = sum("capacityValueSGD"), spendSGD = sum("spendSGD");
  const netValueSGD = capacityValueSGD - spendSGD;
  const projection = {
    hourlyRateSGD: hourlyRate, throughputPRsPerEngineerMonth: pilot.prsPerEngineerMonth,
    assistedSharePct: pilot.assistedSharePct, months,
    totals: {
      capacityHours: sum("capacityHours"), capacityValueSGD, spendSGD, netValueSGD,
      roiPct: spendSGD > 0 ? netValueSGD / spendSGD * 100 : null,
      benefitCostRatio: spendSGD > 0 ? capacityValueSGD / spendSGD : null,
      breakEvenMonth: months.find(m => m.cumulativeSpendSGD > 0 && m.cumulativeValueSGD >= m.cumulativeSpendSGD)?.month ?? null,
    },
  };
  const allFinite = value => value === null || typeof value !== "object"
    ? typeof value !== "number" || Number.isFinite(value)
    : Object.values(value).every(allFinite);
  if (!allFinite(projection)) {
    warnings.push("Financial outputs blocked: the calculation exceeds numeric range. Check extreme costs, adoption, or productive-hour assumptions.");
    return { status: "blocked", errors: [], warnings, evidence, projection: null };
  }
  return { status: "ready", errors: [], warnings, evidence, projection };
}

export function makeSnapshot(state, generatedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1, modelVersion: MODEL_VERSION, generatedAt,
    scenario: state.scenario, provenance: state.provenance,
    observations: structuredClone(state.observations), assumptions: structuredClone(state.assumptions),
    results: calculate(state), limitations: [...LIMITATIONS], priceDisclaimer: PRICE_DISCLAIMER,
  };
}
