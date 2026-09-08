# CSU major agreement import — September 7, 2026

Imported **2,186 SBCC-to-CSU major agreements across 23 ASSIST destinations**. Each campus uses the freshest year selected for this import: **13 campuses / 1,134 agreements for 2026–2027**, and **10 campuses / 1,052 agreements for 2025–2026**. All entries in the Major category are included, including any concentrations, options, or credentials ASSIST lists there.

The original UC workflow used ASSIST's public JSON endpoints, saved the original responses, and converted them into structured planner data. This import reuses that workflow with a campus-level fallback year, resumable caching, progress reports, and complete inventory reconciliation.

## Coverage

| ASSIST destination | Academic year | Agreements verified | Agreements with unlinked source records |
|---|---|---:|---:|
| California Polytechnic University, Pomona | 2026-2027 | 104 | 0 |
| California Polytechnic University, San Luis Obispo | 2026-2027 | 66 | 3 |
| California State University, Bakersfield | 2026-2027 | 93 | 1 |
| California State University, Channel Islands | 2026-2027 | 46 | 0 |
| California State University, Dominguez Hills | 2026-2027 | 113 | 13 |
| California State University, East Bay | 2026-2027 | 110 | 0 |
| California State University, Fullerton | 2026-2027 | 77 | 3 |
| California State University, Long Beach | 2026-2027 | 143 | 0 |
| California State University, Los Angeles | 2026-2027 | 66 | 0 |
| California State University, Maritime Academy | 2026-2027 | 8 | 0 |
| California State University, Stanislaus | 2026-2027 | 53 | 0 |
| San Francisco State University | 2026-2027 | 106 | 0 |
| San Jose State University | 2026-2027 | 149 | 0 |
| California Polytechnic University, Humboldt | 2025-2026 | 104 | 9 |
| California State University, Chico | 2025-2026 | 125 | 0 |
| California State University, Fresno | 2025-2026 | 108 | 0 |
| California State University, Monterey Bay | 2025-2026 | 67 | 0 |
| California State University, Northridge | 2025-2026 | 136 | 1 |
| California State University, Sacramento | 2025-2026 | 127 | 0 |
| California State University, San Bernardino | 2025-2026 | 67 | 18 |
| California State University, San Marcos | 2025-2026 | 48 | 0 |
| San Diego State University | 2025-2026 | 174 | 0 |
| Sonoma State University | 2025-2026 | 96 | 0 |
| **Total** | **Selected years above** | **2,186** | **48** |

The campus count follows ASSIST's separate destinations, including its separate San Luis Obispo and Maritime entries. Preferred-year campuses do not also receive older-year duplicates. On the two public pages checked, the site's result counter included the “All Majors” option: Pomona displayed 105 results for 104 individual major agreements, and San Luis Obispo displayed 67 for 66.

## Verification results

- All **2,186 listed agreement keys** have raw and normalized files, matching source hashes, institutions, academic years, major identities, and publication dates. There are no unresolved validation errors.
- The full comparison checks receiving requirements, course options and order, course identifiers/titles/units/terms, cross-listings, notes, AND/OR rules, numeric selection limits, structured advisements, conditional overrides, and retained unlinked records. It compared **60,135 course representations**, which are not a count of unique courses.
- **23 fresh API samples**, one per campus, matched their complete saved responses after ignoring JSON object-key order and embedded JSON formatting.
- Two rendered ASSIST pages were checked: Pomona Biotechnology and San Luis Obispo Biomedical Engineering. The checks confirmed representative mappings, selection rules, general-education details, and working direct links.
- The planner data loader reads **3,232 detailed agreements**: 2,186 CSU plus the existing 1,046 UC. Every imported CSU major has details. All **2092 original UC raw and normalized files** match their pre-import hashes.

The 13 importer regression checks, targeted lint checks, and the production build all passed.

## Source records and limits

**48 agreements contain 344 articulation records without matching cells anywhere in the source template.** The original responses preserve these records, and the normalized files retain them in a separate `unlinkedArticulations` collection. They have not been assigned to guessed requirements. In the Biomedical Engineering page checked, the two such records were also absent from the displayed requirements.

**35 agreements contain no structured requirement groups.** Their source notes and other original content remain preserved.

The conversion fixes preserve named requirements, general-education areas and their courses, structured advisements, conditional options, grade/credit notes, explicit course positions, and absent numeric bounds. Source links now open the selected major directly. The CSU files were rebuilt from the saved originals after these fixes.

This verifies the saved data against captured ASSIST responses, with fresh API samples and two rendered-page checks. It is not a visual audit of all 2,186 pages or certification of every rule's interpretation in the planner UI. Conditional overrides are retained as structured source records; no new UI interpretation of them was implemented. Data can change after the recorded checks.

## Evidence

- [Download run](assist-import-2026-09-07T05-53-34-473Z.json)
- [Final rebuild run](assist-import-2026-09-07T09-50-34-881Z.json)
- [Complete data validation](csu-latest-validation.json)
- [Fresh API samples](csu-live-sample-validation.json)
- [Rendered page checks](csu-rendered-page-spot-checks.json)
- [Planner loading and UC preservation](csu-integration-validation.json)

Final data validation: 2026-09-07T09:51:16.459Z. Live sample checks finished: 2026-09-07T09:54:13.696Z.
