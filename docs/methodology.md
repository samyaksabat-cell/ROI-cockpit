# Capacity-value methodology · model 1.1.0

**Potential capacity value, not cash savings or guaranteed productivity.**

## Observed evidence
Periods use UTC calendar dates, start-inclusive/end-exclusive. Days are normalized
to months using **365 / 12 days per month**, not a calendar-month billing convention.
PR counts are unique merged PRs, assisted PRs are a subset, and active engineers are
distinct engineers with at least one merged PR in that period. The denominator is
the observed active engineers, not all pilot participants.

- Assisted share = assisted PRs / merged PRs × 100.
- PRs/month = merged PRs / observation months.
- PRs/active engineer/month = PRs/month / active engineers.
- Lower-is-better elapsed-time improvement = (baseline − pilot) / baseline × 100.
  Display “lower” or “higher,” not a causal claim.
- Assisted-share change uses percentage points; readiness change uses ordinal points.
- Other raw counts show absolute changes, not misleading normalized growth claims.
- Credit intensity = credits consumed / assisted PRs, labeled **credits/PR (assisted)**.
  This allocates all observed consumption over assisted PRs for context; it does not
  establish that every credit was spent producing those PRs and is not monetary cost.

Unequal periods trigger a warning. Display both normalized PRs/month and
PRs/active engineer/month, along with raw totals and source labels.
Observed changes do not establish attribution or causality.

## Rollout
Let `T` be pilot PRs per active engineer per normalized month, `S` the pilot assisted
share as a fraction, `H` assumed labor hours saved per assisted PR, and `R` annual loaded
cost / annual productive hours. The 12 adoption entries are fractions of total scope
active, not fractions of incremental engineers.

For month `m`:
```text
E[m]                 = scope engineers × adoption[m] / 100
assisted PRs[m]       = E[m] × T × S
capacity hours[m]     = assisted PRs[m] × H
available hours[m]    = E[m] × annual productive hours / 12
capacity value[m]     = capacity hours[m] × R
illustrative spend[m] = E[m] × credit cost per engineer/month
net capacity value[m] = capacity value[m] − illustrative spend[m]
```

The monthly credit-cost assumption is **illustrative, not Factory list price**.
It applies to expected active engineer-months; it is not a conversion rate per
Factory credit. No actual pricing or purchase commitment is implied.

Year-one hours, value, spend, and net are sums across all 12 months:
```text
capacity-value ROI (%) = (year-one value − year-one spend) / year-one spend × 100
benefit/cost ratio     = year-one value / year-one spend
```

Cumulative break-even is the first month with positive cumulative spend and
cumulative capacity value ≥ cumulative spend. Otherwise “not reached within 12 months.”
With constant per-engineer economics, a favorable case can break even in the first
adopted month. This is not investment payback: no upfront implementation cost is modeled.

## Invalid, missing, zero, and impossible
- Invalid inputs suppress all results; the UI never retains stale numbers.
- Blank optional metrics stay missing, and only their comparisons become N/A.
- Zero pilot merged PRs/active engineers makes rollout unavailable.
- Zero assisted share or zero assumed saved hours gives zero capacity benefit.
- Zero adoption gives zero value and spend in that month.
- Zero total spend gives N/A ROI and ratio, not infinity. No break-even is reported
  without positive cumulative spend.
- Baseline zero means N/A relative elapsed-time improvement; absolute change is still shown.
- Negative net capacity value is displayed, never hidden or clamped.
- Saved hours above the adopted cohort's available productive hours block financial
  output instead of silently capping the result. This is checked per adopted month.
- Full precision is used internally. A tiny floating-point comparison tolerance
  (1e-9 hours per engineer/month) avoids rejecting an exactly equal capacity bound.

## Success plan and assumption checks
Success targets compare observed cycle-time reduction (%), pilot assisted share (%),
and pilot readiness (points) with editable ≥ thresholds. A zero/missing baseline
cycle time cannot establish relative reduction and yields No data. Readiness is
not certification. Targets are decision criteria, not benefit multipliers.

The brief checks three fixed assumptions independently at 20% below current input:
- Hours saved per assisted PR: value impact = −20% × capacity value; spend unchanged.
- Adoption ramp: each month's percentage × 0.8; value and spend both fall 20%,
  so net value impact = −20% × current net value (which may be positive for a loss case).
- Throughput transfer: pilot PRs/active engineer/month × 0.8, holding assisted share
  constant; value falls 20%, spend unchanged. Base case assumes 100% transfer.

These are linear downside checks, not forecasts, confidence intervals, or a ranking
of uncertainty. Financial impacts are N/A when the base projection is unavailable.
The headline “payback” is the existing cumulative capacity-value break-even, not
cash investment payback. Full monthly economics remain in Evidence JSON and Rollout case.

## Independent arithmetic check
10 PRs/active engineer/month × 50% assisted × 2 assumed hours/assisted PR =
10 saved hours/active engineer/month.

100 engineers × 80% adoption = 80 active engineer-equivalents.
SGD 208,000/year ÷ 2,080 hours/year = SGD 100/hour.

Flat adoption for 12 months:
- 80 × 10 × 12 = **9,600 hours**.
- 9,600 × SGD 100 = **SGD 960,000 capacity value**.
- 80 × SGD 200 × 12 = **SGD 192,000 illustrative spend**.
- Net = **SGD 768,000**.
- 768,000 / 192,000 × 100 = **400% ROI**, **5× benefit/cost**.

The automated golden fixture uses a 365-day observation period so normalized months
equal exactly 12. That fixture tests arithmetic, not the realistic length of a pilot.
The bundled demo instead uses two realistic 28-day periods.

## Limits
Elapsed cycle/review reductions are never treated as saved labor. Readiness and
credits never multiply monetary benefits. Wider-rollout extrapolation assumes
comparable teams, throughput, PR mix, and attribution; validate with the sponsor.
Hours saved is an explicit assumption that needs separate time-study evidence.
No confidence interval or causal inference is claimed.
Implementation, training, taxes, and other tools are excluded, so this is not full TCO.
