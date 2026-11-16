# Verification record

Checks run against the app served at `http://127.0.0.1:8000` (headless Chrome 157) and Node 24.

## Automated
- `node scripts/test.mjs`: 55 checks pass, including success-plan statuses (decimal exact-target boundaries), invalid targets,
  independent 20% downside checks, shared brief sections, and a CRC-verified Word package with
  schema-ordered paragraph properties. Opening in Microsoft Word itself was not tested here.
  Earlier baseline: These cover CSV parsing and rejection cases, the
  hand-calculated golden fixture (9,600 h, SGD 960,000 value, SGD 192,000 spend,
  SGD 768,000 net, 400%, 5×), variable and zero ramps, zero denominators, negative net value,
  the productive-hour block, numeric-range blocks, missing-versus-zero, hostile labels,
  export disclaimers with no NaN/Infinity, and Factory resource frontmatter.
- `node --check js/app.js`: passes.

## Browser
- All four views open through navigation and the keyboard (Enter on a nav link), and only one
  view shows at a time.
- Every editable input (scenario, 20 observation fields, 6 assumptions, 12 adoption months)
  accepts a valid edit. A blank required value suppresses evidence, financials, and exports.
- Blank optional metric shows N/A. Impossible saved hours block financials. Zero spend shows
  N/A ROI. Zero adoption shows 0 hours.
- HTML in a source label renders as text and does not execute.
- Reset asks for confirmation; cancel keeps edits and confirm restores the synthetic demo.
- An invalid CSV shows an error and leaves the state unchanged. Template download, preview,
  cancel, re-import, and confirm all work, and provenance becomes "customer-provided, unverified".
- The headline strip shows only on Rollout case and Executive readout and matches exports (SGD 1,156,797 net, 388.8%,
  Month 1, 14,543 hrs). Invalid targets clear it; blocked or zero-spend cases show N/A.
- Editing a success target updates Met / Not met; a missing metric shows No data.
- The Word download is a valid ZIP with the summary content. Evidence JSON is schema 2.
- Print to PDF produces a one-page CIO/CFO summary, including a worst case with 200-character
  source labels, a 120-character scenario, a missing metric, and negative net value.
- axe-core on the readout: 0 violations (4 decorative, aria-hidden nav icons need manual contrast review).
- At 390 px wide there is no horizontal overflow.
- Reload restores the synthetic defaults. No localStorage, sessionStorage, or cookies are used.
- Network: only loopback requests, plus Chrome's built-in date-picker icon as a `data:` URL.
  There are no console messages or page errors.
- axe-core: 0 violations in each of the four views.

## Not verified
- Browsers other than Chrome, and real printer output.
- Use of `/pilot-readout` and `roi-analyst` inside a live Droid session. Only their file
  definitions are tested.
