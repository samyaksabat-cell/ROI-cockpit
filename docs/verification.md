# Verification record

Checks run against the app served at `http://127.0.0.1:8000` (headless Chrome 157) and Node 24.

## Automated
- `node scripts/test.mjs`: 48 checks pass. These cover CSV parsing and rejection cases, the
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
- JSON and Markdown exports match the on-screen totals and include the required disclaimers.
- Print to PDF produces a 3-page readout.
- At 390 px wide there is no horizontal overflow.
- Reload restores the synthetic defaults. No localStorage, sessionStorage, or cookies are used.
- Network: only loopback requests, plus Chrome's built-in date-picker icon as a `data:` URL.
  There are no console messages or page errors.
- axe-core: 0 violations in each of the four views.

## Not verified
- Browsers other than Chrome, and real printer output.
- Use of `/pilot-readout` and `roi-analyst` inside a live Droid session. Only their file
  definitions are tested.
