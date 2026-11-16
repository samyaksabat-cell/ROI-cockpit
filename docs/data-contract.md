# Data contract · schema 1

## Input: two aggregate CSV records

UTF-8 text, maximum **1,000,000 bytes**. Header order may vary, but every listed
column must appear exactly once. Unknown columns are rejected to avoid accidentally
importing identities or silently dropping fields. One baseline row, one pilot row;
no extra phases, weekly rows, or multi-team aggregation. Empty physical lines are
ignored. Quoted commas/newlines, escaped double quotes, CRLF, and UTF-8 BOM are supported.
Errors refer to logical CSV record numbers (header is record 1), not physical lines
inside a quoted field.

```csv
phase,start_date,end_date,pr_cycle_hours,prs_merged,review_turnaround_hours,agent_assisted_prs,readiness_level,factory_credits,active_engineers,source_label
baseline,2026-08-03,2026-08-31,48,160,12,16,2,12000,20,Synthetic baseline
pilot,2026-09-01,2026-09-29,32,220,7.5,132,3,78000,22,Synthetic pilot
```

| Field | Type / constraints | Meaning |
| --- | --- | --- |
| phase | `baseline` or `pilot` | Exactly one of each |
| start_date | ISO date, 1900 or later | Inclusive observation start |
| end_date | ISO date, after start | Exclusive observation end |
| pr_cycle_hours | Nonnegative number or blank | Arithmetic mean creation-to-merge elapsed hours for merged PRs with valid timestamps |
| prs_merged | Nonnegative integer, required | Unique PRs merged in the observation period |
| review_turnaround_hours | Nonnegative number or blank | Arithmetic mean first-review-request-to-first-submitted-review hours for merged PRs with both timestamps |
| agent_assisted_prs | Integer, 0 to merged PRs | Unique merged PRs marked assisted by source attribution rules |
| readiness_level | Integer 1–5 or blank | Supplied ordinal assessment, not an official certification |
| factory_credits | Nonnegative number or blank | Factory credits consumed in the period, never SGD |
| active_engineers | Integer, 0 to merged PRs | Distinct engineers who merged at least one PR in the period |
| source_label | Required text, ≤200 characters | Aggregate source/coverage label, no secrets or identities |

All numeric inputs must be finite decimal values ≤1e12; counts must be integers.
Baseline must end before or at pilot start. Both rows describe the same pilot cohort.
Active engineers must not exceed the editable pilot cohort. Merged PRs >0 requires
active engineers >0. Zero merged PRs requires zero assisted PRs and active engineers.

Share (%) is derived from assisted PRs / merged PRs. It is not an independent input,
so an edited share cannot disagree with counts. Missing means/credits/readiness remain
null. Never substitute zero for absent timestamps. Means must use the same metric
definition and timestamp coverage policy in both phases; document coverage in the source
label and validate it with the source owner. This MVP does not estimate missing coverage,
reconstruct PR events, verify attribution, or merge averages from subgroups.

## Editable assumptions
| Key | Unit / rule |
| --- | --- |
| pilotEngineers | Positive integer cohort size |
| scopeEngineers | Integer ≥ pilotEngineers |
| annualLoadedCostSGD | Positive SGD/engineer/year |
| hoursSavedPerAssistedPR | Nonnegative assumed labor hours/assisted PR |
| annualProductiveHours | Positive hours/engineer/year; illustrative default 2,080 |
| adoptionRampPct | Exactly 12 numbers from 0 to 100; share of total scope active each month |
| creditCostPerEngineerMonthSGD | Nonnegative SGD/active engineer/month; **illustrative, not Factory list price** |

Adoption may fall; it is not cumulative new hires. The projected active engineer count
may be fractional because it represents expected engineer-equivalents.

## Exported JSON snapshot
The browser exports:
```text
{
  schemaVersion: 1,
  modelVersion: "1.0.0",
  generatedAt: ISO timestamp,
  scenario: nonempty label (max 120 characters),
  provenance: "synthetic" | "customer-provided, unverified",
  observations: [baseline aggregate, pilot aggregate],
  assumptions: { ...above keys },
  results: {
    status: "ready" | "invalid" | "unavailable" | "blocked",
    errors: string[],
    warnings: string[],
    evidence: { baseline: enriched row, pilot: enriched row, metrics: comparison[] } | null,
    projection: {
      hourlyRateSGD, throughputPRsPerEngineerMonth, assistedSharePct,
      months: [12 monthly result objects],
      totals: { capacityHours, capacityValueSGD, spendSGD, netValueSGD,
                roiPct, benefitCostRatio, breakEvenMonth }
    } | null
  },
  limitations: string[],
  priceDisclaimer: "illustrative, not Factory list price"
}
```

Evidence includes days, normalized months, monthly PR throughput, PRs/active
engineer/month, assisted share, and credits/assisted PR. Monthly results include
adoptionPct, activeEngineers, assistedPRs, capacityHours, availableHours,
capacityValueSGD, spendSGD, netValueSGD, and cumulative value/spend/net.
All monetary numbers are SGD, not strings; missing or undefined ratios are null.
UI/export prose rounds values, but snapshots retain full precision.
The app blocks downloads while inputs are invalid. Valid but unavailable/blocked
projections can be exported with evidence and explicit warnings.
Snapshots are evidence artifacts; JSON re-import is outside v1 scope.
