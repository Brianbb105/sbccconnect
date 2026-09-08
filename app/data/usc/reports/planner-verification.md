# USC planner verification

Checked September 8, 2026 against the local production preview at `http://127.0.0.1:3001`.

- Production build passed, including TypeScript and 3,523 static pages.
- Targeted lint and `git diff --check` passed.
- Seven import/planner tests passed. The USC subset passed again after correcting detection of blank science-table rows.
- The preservation test compared every existing UC/CSU agreement and school major list with the original ASSIST loader.
- Browser flow passed: select USC, search program 2054, open Computer Science, search `MATH 150`, switch to GE/writing, return to majors, and open unavailable program 1957.
- The course search displayed `MATH125={*MATH150}` and retained the source's conditional calculus wording.
- Program 1957 displayed its unavailable-source explanation and the official USC guide link.
- The final browser check confirmed the GE D/E source-gap notice and the updated About description.
- About and home navigation worked. No browser console errors were reported during these checks.
- Screenshots were visually reviewed for the guide controls and final source-gap notice.
- HTTP checks: planner and About returned 200; USC's school list returned 200 (58,270 uncompressed bytes); Computer Science returned 200 (10,191 bytes); unavailable guide 1957 returned 404.
- The initial planner document was 76,158 uncompressed bytes. School lists and individual guides use the existing on-demand data routes.
- All 18 production function trace files were checked: none included the USC source archive.

Source-validation evidence is in `validation.json` and `live-recheck.json`. These checks validate the import and local integration; they do not certify USC admission eligibility or a deployed version of the site.
