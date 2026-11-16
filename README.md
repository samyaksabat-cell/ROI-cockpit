# ROI Cockpit

A single-page web app an enterprise account executive (AE) uses to turn a potential
engineering pilot into a clear, defensible business case.

It compares a **baseline** period with a **pilot** period across seven engineering
metrics. It then projects a 12-month rollout and estimates **potential capacity value
in SGD** from assumptions you can see and edit. The output is an executive readout you
can print or export.

**Live demo:** https://samyaksabat-cell.github.io/ROI-cockpit/

> **Read before you use or share the numbers**
> - **DBS, illustrative. Synthetic data, not customer results or an endorsement.** The bundled
>   demo uses made-up numbers. DBS is only an example name.
> - **Potential capacity value, not cash savings or guaranteed productivity.** The model values
>   engineering time that could be redeployed. It does not promise headcount or budget reductions.
> - The credit-cost input is **illustrative, not Factory list price**.

---

## Contents

1. [Who it's for and what it does](#who-its-for-and-what-it-does)
2. [Quick start](#quick-start)
3. [The four views](#the-four-views)
4. [Metrics tracked](#metrics-tracked)
5. [Editable inputs](#editable-inputs)
6. [How the model works](#how-the-model-works)
7. [Bringing your own data (CSV)](#bringing-your-own-data-csv)
8. [Exports and printing](#exports-and-printing)
9. [Interpretation guardrails](#interpretation-guardrails)
10. [Privacy and security](#privacy-and-security)
11. [Project structure](#project-structure)
12. [Factory Droid resources](#factory-droid-resources)
13. [Testing and verification](#testing-and-verification)
14. [Deploying to GitHub Pages](#deploying-to-github-pages)
15. [Limitations and scope](#limitations-and-scope)
16. [Contributing](#contributing)

---

## Who it's for and what it does

An AE running a pilot (the example is a Singapore bank) usually holds scattered evidence:
PR counts, cycle times, agent usage, credits consumed. Finance and engineering sponsors want
one answer: *what is this worth if we roll it out, and what has to be true?*

ROI Cockpit gives a structured answer:

- **Evidence first.** Baseline and pilot metrics sit side by side, with dates, sources, and
  normalized throughput.
- **Assumptions visible.** Every input that drives value can be edited on screen and is
  labeled as an assumption.
- **Transparent model.** A plain formula you can recompute by hand. The same formula code
  feeds the screen, the exports, and the tests.
- **Honest output.** Missing data shows as N/A, impossible inputs block the result, and
  negative net value is shown, never hidden.

It is a plain HTML, CSS, and JavaScript site. There is no framework, build step, backend,
account, database, or external network call.

---

## Quick start

### Use the hosted version

Open https://samyaksabat-cell.github.io/ROI-cockpit/. The synthetic demo loads automatically.
Edit any value on **Data & assumptions** and every view updates immediately.

### Run it locally

Requirements: Python 3 (for a static server), a modern browser, and Node.js 22.7 or later
(Node 24 recommended) only if you want to run the tests.

```sh
git clone https://github.com/samyaksabat-cell/ROI-cockpit.git
cd ROI-cockpit
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 and stop the server with Ctrl+C.

Use a local server, not a `file://` path. The page uses ES modules and loads the bundled demo
CSV, and browsers block both from `file://`. Any static server works; binding to `127.0.0.1`
keeps it private to your machine.

---

## The four views

Navigation sits in the left sidebar (a tab bar on small screens). Each view has its own URL
hash (`#evidence`, `#inputs`, `#rollout`, `#readout`), so you can link straight to it.

| # | View | What you do there |
| --- | --- | --- |
| 01 | **Pilot evidence** | Compare baseline and pilot across the seven metrics. Shows observation dates, the change for each metric, PRs per active engineer per month, credit intensity, and source labels. |
| 02 | **Data & assumptions** | Download the CSV template, import data (with a preview and confirmation), edit both observation rows, edit the business assumptions, and set the 12-month adoption ramp. |
| 03 | **Rollout case** | See year-one capacity value, illustrative spend, net capacity value, capacity hours, ROI, benefit/cost ratio, and break-even month, plus a monthly chart and a full month-by-month table. |
| 04 | **Executive readout** | A one-page CIO/CFO summary: headlines, pilot results, editable success-plan status, three assumption checks, next steps and caveats. Print / Save as PDF, download Word, or export full Evidence JSON. |

A headline strip on Rollout case and Executive readout shows net capacity value, capacity-value ROI, payback
(cumulative capacity-value break-even, not cash payback), and potential hours returned.
Success targets default to cycle time ≥20% lower, assisted share ≥40%, and readiness ≥3.
Edit them in Data & assumptions. Missing evidence is No data, never a failed zero.
Each of the three fixed assumptions includes a one-at-a-time 20% downside check.

Colored badges mark where each number comes from: **Synthetic**, **Customer-provided,
unverified**, **Assumption**, or **Modeled**.

---

## Metrics tracked

| Metric | Unit | How the change is shown | Notes |
| --- | --- | --- | --- |
| PR cycle time | hours | % lower or higher | Mean creation-to-merge time for merged PRs. Elapsed time, not labor time. |
| PRs merged | PRs | absolute change | Raw count for the period. Compare normalized throughput when periods differ. |
| Review turnaround | hours | % lower or higher | Mean time from first review request to first submitted review. Elapsed time. |
| Agent-assisted PR share | % | percentage points | Calculated as assisted PRs ÷ merged PRs. Not a separate input. |
| Readiness level | 1–5 | points | A supplied ordinal assessment, not an official certification. |
| Factory credits consumed | credits | absolute change | A consumption quantity, never converted to SGD. |
| Active engineers | engineers | absolute change | Distinct engineers with at least one merged PR in the period. |

Derived context shown alongside the metrics:

- **PRs per month**: merged PRs ÷ observation months, where 1 month = 365/12 days.
- **PRs per active engineer per month**: the throughput figure the rollout model uses.
- **Credit intensity**: credits ÷ assisted PRs, labeled *credits/PR (assisted)*.

---

## Editable inputs

All defaults are synthetic starting points. Replace them with figures agreed with the
customer's engineering and finance sponsors.

| Input | Default | Unit | Rule |
| --- | --- | --- | --- |
| Engineers in pilot | 25 | engineers | Positive integer, at least the active engineers in each period |
| Total engineers in scope | 250 | engineers | Integer, at least the pilot size |
| Fully loaded annual cost | 208,000 | SGD per engineer per year | Positive |
| Hours saved per assisted PR | 1.5 | labor hours per PR | Zero or more. **An assumption, not a measurement.** |
| Annual productive hours | 2,080 | hours per engineer per year | Positive. Converts annual cost to an hourly rate. |
| Credit cost per active engineer | 200 | SGD per engineer per month | Zero or more. **Illustrative, not Factory list price.** |
| Adoption ramp | 10, 15, 20, 30, 40, 50, 60, 65, 70, 75, 80, 80 | % of scope active, months 1–12 | Each 0–100. Can go down as well as up. |

The demo observations (28-day baseline and pilot periods) are in [`data/demo.csv`](data/demo.csv).

---

## How the model works

The full specification is in [`docs/methodology.md`](docs/methodology.md). In short:

```text
T = pilot PRs merged ÷ pilot active engineers ÷ pilot observation months
S = pilot assisted PRs ÷ pilot PRs merged
H = hours saved per assisted PR             (assumption)
R = annual loaded cost ÷ annual productive hours   (SGD per hour)

For each month m = 1..12:
  active engineers  E[m] = scope engineers × adoption[m] ÷ 100
  assisted PRs           = E[m] × T × S
  capacity hours         = assisted PRs × H
  capacity value (SGD)   = capacity hours × R
  illustrative spend     = E[m] × credit cost per engineer per month
  net capacity value     = capacity value − illustrative spend
```

Year-one totals **add up all 12 months**, so the ramp counts. The model never multiplies
the last month by 12.

```text
capacity-value ROI (%) = (total value − total spend) ÷ total spend × 100
benefit / cost ratio   = total value ÷ total spend
break-even month       = first month where cumulative value ≥ cumulative spend (and spend > 0)
```

### Worked example (also an automated test)

10 PRs per active engineer per month, 50% assisted, 2 hours saved per assisted PR, 100
engineers in scope, flat 80% adoption, SGD 208,000 per year, 2,080 hours per year, SGD 200
per engineer per month:

- 80 active engineers × 10 saved hours each × 12 months = **9,600 hours**
- SGD 208,000 ÷ 2,080 = SGD 100 per hour, so value = **SGD 960,000**
- 80 × SGD 200 × 12 = **SGD 192,000** illustrative spend
- Net capacity value = **SGD 768,000**, ROI = **400%**, benefit/cost = **5×**

### Edge cases

| Situation | Result |
| --- | --- |
| Invalid or incomplete input | All results and exports are suppressed until fixed. No stale numbers stay on screen. |
| Optional metric left blank | That metric shows N/A. It is never treated as zero. |
| Pilot has no merged PRs or active engineers | Evidence still shows; the rollout is "unavailable". |
| Total spend is zero | ROI and ratio show N/A, not infinity. |
| Zero adoption in a month | That month has zero value and zero spend. |
| Saved hours exceed engineers' productive hours | Financial outputs are **blocked** with an explanation. Savings are never quietly capped. |
| Net value is negative | Shown as negative. Break-even shows "not reached within 12 months". |

---

## Bringing your own data (CSV)

The full contract is in [`docs/data-contract.md`](docs/data-contract.md).

1. On **Data & assumptions**, click **CSV template**.
2. Replace the example values with **aggregate** figures. Never include names, emails,
   repository content, or credentials.
3. Click **Import CSV**. A preview opens; nothing changes until you click
   **Replace observation data**.
4. Fix any assumption conflicts the preview lists (for example, pilot size smaller than
   active engineers).

The file has exactly one header row and two data rows (`baseline` and `pilot`). Columns can
appear in any order.

```csv
phase,start_date,end_date,pr_cycle_hours,prs_merged,review_turnaround_hours,agent_assisted_prs,readiness_level,factory_credits,active_engineers,source_label
baseline,2026-08-03,2026-08-31,48,160,12,16,2,12000,20,Synthetic baseline
pilot,2026-09-01,2026-09-29,32,220,7.5,132,3,78000,22,Synthetic pilot
```

Key rules:

- Dates are `YYYY-MM-DD`. The start date is included and the end date is excluded. The
  baseline must end on or before the pilot start.
- `prs_merged`, `agent_assisted_prs`, and `active_engineers` are required whole numbers.
  Assisted PRs cannot exceed merged PRs.
- `pr_cycle_hours`, `review_turnaround_hours`, `readiness_level` (1–5), and
  `factory_credits` may be blank when unavailable.
- `source_label` is required (200 characters max) and should describe where the aggregate
  came from.
- Files over 1 MB, unknown or duplicate columns, extra rows, and malformed quoting are
  rejected. A rejected import leaves the current data untouched.

After a successful import, provenance changes to **customer-provided, unverified**. The
check confirms format and consistency, not that the numbers are true.

---

## Exports and printing

| Output | Button | Contents |
| --- | --- | --- |
| Word document | **Word (.docx)** | The CIO/CFO summary, generated locally as a real Office document. Labels are inert escaped text. |
| JSON evidence snapshot | **Evidence JSON** | `schemaVersion`, model version, timestamp, scenario, provenance, both observations, all assumptions, success targets/status, downside checks, full-precision results, warnings, and limitations. |
| Print / PDF | **Print readout** | Prints only the one-page CIO/CFO summary, sized for A4. Choose Save as PDF in the browser dialog (100% scale, default A4 margins, headers/footers off). Full monthly figures remain in Evidence JSON. |

Downloads only happen when you click. Exports are disabled while inputs are invalid.
Treat an export as sensitive whenever its inputs are.

---

## Interpretation guardrails

These rules are built into the model and copy, and they should carry through any
conversation about the numbers:

- Faster PR cycle time and review turnaround are **signals, not saved labor**. They are
  never turned into money.
- Readiness and credits are **context**, never multipliers on value.
- A two-period comparison **does not prove causality**. Confirm that the teams, PR mix, and
  attribution rules are comparable.
- The rollout assumes pilot throughput and assisted share carry over to the wider scope.
  Validate that with the engineering sponsor.
- **Hours saved per assisted PR** is the most important assumption. Back it with a sampled
  time study.
- Spend excludes implementation, training, taxes, and other tools. This is **not full TCO**.
- Break-even ignores upfront investment. Positive capacity value is not a budget reduction.

---

## Privacy and security

- **Everything runs in your browser.** Imported CSVs are read locally and never uploaded,
  including on GitHub Pages.
- No cookies, localStorage, analytics, fonts, CDNs, or API calls. A Content-Security-Policy
  restricts the page to its own files.
- **Reloading clears your work.** Export first if you need to keep it.
- Imported text is rendered as text, never as HTML.
- Never commit real customer data. The `customer-data/` and `output/` folders are git-ignored
  for local working files.
- The demo is public and synthetic. Nothing in this repository is real bank data.

---

## Project structure

```text
ROI-cockpit/
├── index.html            Single page: four views, dialogs, and the CSP
├── styles.css            Layout, responsive breakpoints, and print styles
├── favicon.svg
├── js/
│   ├── app.js            UI state, rendering, events, import and export
│   ├── model.js          All formulas and business rules (single source of truth)
│   ├── validation.js     Field definitions and validation rules
│   ├── csv.js            CSV parsing and serialization
│   ├── readout.js        Shared brief, number formatting and detailed preview
│   └── docx.js           Dependency-free browser Word package writer
├── data/
│   ├── demo.csv          Synthetic demo observations
│   └── template.csv      Import template (illustrative values)
├── docs/
│   ├── data-contract.md  CSV and JSON schema
│   ├── methodology.md    Formulas, edge cases, worked example
│   ├── readout-template.md  Required readout structure and wording
│   └── verification.md   Record of checks run
├── scripts/
│   └── test.mjs          Dependency-free test suite (Node built-ins only)
├── .factory/
│   ├── droids/roi-analyst.md         Custom read-only analyst droid
│   └── skills/pilot-readout/SKILL.md /pilot-readout skill
├── AGENTS.md             Guardrails and commands for AI coding agents
├── .nojekyll             Tells GitHub Pages to serve files as-is
└── .gitignore
```

Change a formula only in `js/model.js`. The UI, the exports, and the readout skill all reuse
its results.

---

## Factory Droid resources

This repository includes configuration for [Factory](https://factory.ai) Droid.

- **[`AGENTS.md`](AGENTS.md)**: standing instructions for any agent working in the repo.
  It covers commands, architecture, data-safety rules, business guardrails, and the checks
  required before work is called done.
- **`roi-analyst`** ([`.factory/droids/roi-analyst.md`](.factory/droids/roi-analyst.md)):
  a custom droid with read-only tools and no MCP servers. It audits an exported JSON snapshot,
  separates observations from assumptions, flags missing evidence and denominator problems,
  and returns a concise interpretation. It cannot edit files, browse the web, or publish.
- **`/pilot-readout`** ([`.factory/skills/pilot-readout/SKILL.md`](.factory/skills/pilot-readout/SKILL.md)):
  a skill that turns an exported snapshot into an executive readout. It delegates to
  `roi-analyst` when available and returns the draft in chat only.

To use them, open Droid in the project folder and accept the folder-trust prompt. Then run
`/pilot-readout` and point it at a snapshot exported from the app. Check `/skills` and
`/droids` if they don't appear, and start a new session after adding them.

> The web app is browser-local, but **Droid is not**. Reading a snapshot into Droid sends its
> contents to your configured model service. The skill asks for explicit permission before
> reading customer data. Use synthetic data unless that permission is in place.

---

## Testing and verification

```sh
node scripts/test.mjs     # 55 checks; exits non-zero on any failure
node --check js/app.js    # syntax check for the UI module
```

The suite covers CSV parsing and rejection cases, every formula branch, the hand-calculated
worked example, variable and zero ramps, zero denominators, negative results, the
productive-hours block, numeric overflow, hostile text in labels, export disclaimers with no
`NaN`/`Infinity`, and the frontmatter of the Factory droid and skill.

Browser checks (all inputs, imports, reset, downloads, print, keyboard use, a 390 px mobile
width, network, console, and an axe-core accessibility audit) are recorded in
[`docs/verification.md`](docs/verification.md).

### Manual acceptance checklist

- [ ] All four views load; keyboard navigation works; no horizontal scroll at 390 px wide.
- [ ] Download the template, import it, cancel, re-import, and confirm.
- [ ] An invalid CSV shows an error and leaves the data unchanged.
- [ ] Any invalid edit clears results and disables exports.
- [ ] Zero adoption, zero cost, missing metrics, and impossible saved hours behave as in [Edge cases](#edge-cases).
- [ ] Exported totals match the screen and include the required disclaimers.
- [ ] Printing produces the one-page CIO/CFO summary; Word opens with matching figures.
- [ ] Reload restores the synthetic demo; no console errors or external requests.

---

## Deploying to GitHub Pages

The site is static, so GitHub Pages serves it straight from the repository:

1. Push to `main`.
2. In **Settings → Pages**, set **Build and deployment** to **Deploy from a branch**, branch
   `main`, folder `/ (root)`.
3. The site publishes at `https://<user>.github.io/<repo>/`. All asset paths are relative, so
   it works from a subpath.

Every push to `main` redeploys automatically within a minute or two. The `.nojekyll` file
stops GitHub from processing the files with Jekyll.

---

## Limitations and scope

Built as a one-day MVP. It deliberately does **not** include:

- Live integrations (GitHub, Jira, Factory Analytics API). Data enters by CSV only.
- Multi-team, weekly, or per-repository aggregation. There is one baseline and one pilot row.
- Statistical attribution, confidence intervals, or causal inference.
- Authentication, saved scenarios, side-by-side scenario comparison, or JSON re-import.
- Real pricing or full procurement TCO.

---

## Contributing

1. Read [`AGENTS.md`](AGENTS.md), [`docs/methodology.md`](docs/methodology.md), and
   [`docs/data-contract.md`](docs/data-contract.md) first.
2. Keep the project dependency-free and static. Do not add external assets or network calls.
3. Put any formula or business-rule change in `js/model.js` and add a regression test in
   `scripts/test.mjs`.
4. Keep the required disclaimers word-for-word: *Potential capacity value, not cash savings
   or guaranteed productivity* and *illustrative, not Factory list price*.
5. Run `node scripts/test.mjs` and check the app in a browser before opening a pull request.
6. Never commit real customer data, credentials, or personal information.
