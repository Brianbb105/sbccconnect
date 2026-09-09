# Private-university ASSIST agreements for SBCC

This archive covers the 15 private universities verified in the September 8, 2026 research. USC has its own source in `app/data/usc`.

## Refresh and validate

```sh
node app/scripts/importPrivateAssistAgreements.mjs --refresh-inventory
node app/scripts/validatePrivateAssistAgreements.mjs
node app/scripts/verifyPrivateAssistLiveSamples.mjs
node --test app/scripts/privateAssistImport.test.mjs app/scripts/assistPlannerLoading.test.mjs app/scripts/uscPlanner.test.mjs
npm run build
```

The importer selects each named university's newest SBCC receiving year from live ASSIST metadata. It collects every published major, general-education, department, and course-prefix report in that selected year. Major and GE reports are downloaded individually. Course reports are extracted from ASSIST's official combined department/prefix exports, which contain the original named report groups. Reports absent from a combined export, or without a published combined export, are downloaded individually. The fallback reason is retained in the manifest. This avoids repeatedly downloading overlapping course data. If a current inventory fails, the import stops instead of silently substituting an older year. It does not add universities outside the reviewed 15-school scope.

Downloads use the shared ASSIST client's 6.5-second global spacing, one downloader, and retry/backoff behavior. All progress is resumable: rerun without `--refresh-inventory` to use the saved inventory and cached responses. Cached source hashes are verified, and normalized/prepared guides are rebuilt from those responses. Do not run two imports or refresh the inventory while another import is running. `--rebuild-guides-only` rebuilds prepared guides offline from the unchanged source snapshots and invalidates the previous validation until the validator runs again. `--inventory-only` does not download agreements. `--limit` creates a partial run that cannot be published. `--individual-course-reports` downloads every course report separately if a separate individual-response archive is required.

The completed latest-year snapshot contains 1,633 reports: 333 major, 23 GE, 545 department, and 732 prefix reports. See [the final coverage report](reports/coverage.md) for completed coverage and validation results. Department and prefix views overlap. Their lists also include both university-organized and SBCC-organized views; report counts are not counts of unique majors or unique course equivalencies.

## Data structure

- `raw/metadata`: institution names, partner years, academic years.
- `raw/lists`: categories and complete published report inventories by school/year.
- `raw/agreements`: complete public API responses, retaining all embedded source fields.
- `raw/collections`: official combined course-report responses. Each extracted report references its collection key, group name, and group index; no individual raw response is fabricated.
- `normalized`: identities, requirements, notes, course details, credit conditions, source references, and prepared student-facing guide content.
- `manifest.json`: every expected report and its raw/normalized paths, SHA-256 source hash, source URLs, and retrieval time.
- `reports/validation.json`: complete inventory and field-level source comparison, plus the manifest hash that passed validation.
- `reports/live-validation.json` and `reports/live-samples`: fresh comparisons covering every university and available source report type.

Private reports use the same core course/requirement normalization as the UC/CSU importer. Direct course reports have no requirement template: each original receiving-course/series record is retained as a course-equivalency row. SBCC-organized reports remain university-to-SBCC articulation records, filtered by the SBCC department or prefix. Source ordering, nested course combinations, units, notes, conditional variations, and unmatched source records remain in the archive.

Combined reports have their own publication dates. Those dates are retained in `sourceCollection.publishDate`, while the individual report's publication date is left unset. Live validation compares every course-articulation record plus institution, academic-year, and catalog metadata against freshly downloaded individual reports. It does not misrepresent the collection date as an individual report's date. Every group in a downloaded combined export must correspond to exactly one imported report.

Original group selection rules and sending-side selection advisements are preserved separately, including numeric conditions. Sending advisements appear before the course group they describe, rather than as empty course options. The prepared guide renders explicit selection wording and source notes as text with safe source links. Unsupported rule or course-record types cause a reviewable import error. Conditional source variations are retained and flagged for consultation in ASSIST; the planner does not infer their applicability to a student.

## Planner behavior

The 15 schools appear under Private Universities, with their selected academic years. Their report lists have separate major, GE, department, and prefix filters. Course reports also identify SBCC or university organization. Students open one report at a time through the existing static JSON routes; source archives are excluded from function bundles. Guide preparation happens during import rather than during page loads.

Building with incomplete private data or without a successful validation matching the current manifest fails explicitly. Existing UC/CSU/USC source files are unchanged. Publication is a separate step after data and browser verification.

These are articulation reports, not blanket admission guarantees. Some source entries describe degrees other than a traditional undergraduate transfer major. Preserve the program's exact title and consult the linked institution's admission requirements.
