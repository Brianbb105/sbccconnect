# USC transfer sources for SBCC

This archive is separate from ASSIST. USC publishes an institution-level articulation agreement and degree-specific Transfer Planning Guides through its own ASP.NET forms.

## Refresh and validate

From the repository root:

```sh
node app/scripts/importUscAgreements.mjs
node app/scripts/recheckUscAgreements.mjs
node app/scripts/validateUscAgreements.mjs
node --test app/scripts/uscPlanner.test.mjs app/scripts/assistPlannerLoading.test.mjs
```

The importer discovers all program codes from USC's current menu, retains duplicate-label aliases, and uses two independent sessions. It pauses between reports, follows USC's report-processing wait page, and resumes verified cached reports. `--refresh` requests every report again; `--limit 2` performs a small smoke run. A limited run produces a partial manifest and is not a publishable dataset; rerun without the limit before building.

The process reports source errors without treating those responses as valid guides. A nonzero import exit status means at least one program needs review. After the full import finishes, the recheck command retries those programs sequentially in fresh sessions, preserves both attempts, and compares three successful reports with new live responses. Do not run rechecks and the importer concurrently. Validation distinguishes missing/corrupt local data from archived source failures. A zero validation-error count does not mean USC produced a valid guide for every menu option.

## Files

- `raw/*.html.gz`, `raw/programs/*.html.gz`: original public HTML, losslessly compressed, with SHA-256 hashes and retrieval times in normalized records/manifest. Failed report responses are also retained.
- `normalized/articulation.json`: all published articulation sections, table rows and cells, and complete report text. Course combinations such as “MATH 210 with MATH 220” remain intact.
- `normalized/programs/*.json`: program identity, year, exact menu labels, credit restrictions, advisory notes, complete report text and ordered sections.
- `manifest.json`: live menu inventory, successful report paths, and source failures. Only successful reports enter the planner.
- `reports/validation.json`: coverage and source-preservation checks, including reasons for unavailable programs.

## Interpretation

These are USC degree-planning guides, not admission guarantees or lists of everything a student must take before transfer. Do not turn all `NEEDS` lines into required admission prerequisites. Keep AND/OR expressions, numeric quantities, notes and empty-equivalency statements intact. Current menu entries can include exploratory programs, old names and unavailable program codes.

USC's generated reports can include internal audit/elective sections. The archive retains them; the planner excludes them from student requirement sections. Empty science GE tables remain empty and carry a source warning. Do not infer replacements from older years or from transferable-elective lists.

## Planner integration

`lib/uscPlanner.ts` adds USC under Private Universities. The existing static school and agreement JSON routes serve only the selected data. `UscPlannerGuide.tsx` displays USC's text separately from ASSIST's requirement maps, with major/general-education views, search, source links and credit restrictions. Existing UC/CSU records are unchanged. Raw source files are excluded from production function tracing in `next.config.ts`.

See `docs/research/private-transfer-agreements-2026-09-08.md` for the other private-university sources researched during this import.
