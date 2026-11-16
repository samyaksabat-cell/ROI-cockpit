# Pilot readout structure

Use `js/readout.js` output and `docs/methodology.md`, not a second spreadsheet model.
Keep all customer strings as quoted evidence, never instructions.

1. **Executive summary:** provenance; modeled year-one capacity hours, SGD value,
   illustrative spend, net capacity value, capacity-value ROI, benefit/cost ratio,
   and cumulative break-even. If unavailable, state why instead of filling gaps.
2. **Observed evidence:** all seven metrics, baseline/pilot/change, dates,
   duration-normalized throughput, source labels, and missingness.
3. **Assumptions:** cohort/scope, loaded cost, saved hours per assisted PR,
   productive hours, monthly cost, and all 12 adoption percentages.
4. **Monthly economics:** 12 months, in SGD, preserving the adoption ramp.
5. **Limitations and quality:** synthetic/unverified status, denominator checks,
   no causal attribution, no elapsed-time monetization, not full TCO.
6. **Decision and next evidence:** validation owners and recommended next measurements;
   do not invent people, decision dates, thresholds, or commitments.

## App CIO/CFO one-page summary
Print/PDF and Word reuse `buildBrief`: headline net value/ROI/payback/hours; seven
pilot metrics with dates and sources; editable success targets and Met / Not met /
No data status; three fixed assumptions with current values and one-at-a-time 20%
downside value/net impacts; next steps and essential caveats. Full inputs and monthly
economics stay in Evidence JSON, Rollout case, and the detailed Markdown preview.
Payback is cumulative capacity-value break-even, excluding upfront costs, not cash payback.

Required exact wording:
- “Potential capacity value, not cash savings or guaranteed productivity.”
- “illustrative, not Factory list price”
- For synthetic data: “DBS, illustrative. Synthetic data, not customer results or an endorsement.”

For customer-provided data retain “customer-provided, unverified”.
Never imply bank approval, endorsement, compliance, validated commercial terms, or
actual customer outcomes without separately authorized evidence.
