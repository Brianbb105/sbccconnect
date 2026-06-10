# SBCC Grade Distribution Data

This folder contains normalized grade distribution records from the public-records PDF:

`20260506_B Wumutijiang Grade Distribution Public Records Act Request.pdf`

## Files

- `raw/20260506_grade_distribution_public_records.txt`: text extracted from the PDF table.
- `sbcc-grade-distributions-2025.json`: app-friendly normalized data.
- `sbcc-grade-distributions-2025.csv`: portable flat export for spreadsheet/debug use.
- `sbcc-grade-distribution-instructor-course-summaries-2025.json`: compact A/B/C/D/F summaries grouped by course and instructor for the section detail page UI.
- `sbcc-grade-distribution-course-summaries-2025.json`: compact course-level exact A-rate summaries for GE discovery.

## Instructor UI Summaries

When an instructor taught multiple sections of the same course in the same term, the UI summary does not add those sections together. Each term chooses one representative CRN for the chart and enrollment, prioritizing sections where the A count is published instead of masked.

The A rate is computed separately. If multiple sections have visible A counts, the summary computes each section's A rate and averages those rates. Sections with masked A counts are excluded from the A-rate average. If all A counts are masked, the A rate remains masked.

## Course UI Summaries

Course summaries are grouped by course code and use only sections where the A count is visible. The course A rate is weighted by exact A count divided by enrolled students across those exact-A sections.

Masked A buckets are excluded from the rate and counted in `maskedASectionCount`, so UI consumers can require enough exact section history before showing an "easy GE" label.

## Suppressed Counts

The PDF uses `*` for grade buckets that SBCC suppressed for privacy. The normalized JSON does not preserve the literal `*`.

In JSON records:

- Published counts are numbers in `record.grades`.
- Suppressed counts are `null` in `record.grades`.
- Suppressed grade keys are listed in `record.suppressedGrades`.
- Suppressed counts should be treated as masked in the UI. The normalized files keep a `0-9` min/max range for analysis, but the exact count is not recoverable from the public-records PDF.

The CSV expands this into per-grade `count`, `suppressed`, `display`, `min`, and `max` columns.

## Enrollment Join

Enrollment data comes from `app/data/<termCode>/sections.json`, matched by term code and CRN.

The `section.enrolled` value is a scraped section-enrollment reference, not a guaranteed final grade-outcome denominator. Some visible grade totals exceed the scraped enrolled value, so consumers should not use it as a hard cap.

## Regeneration

Run:

```bash
node app/scripts/buildGradeDistributions.mjs
```

Optional arguments:

```bash
node app/scripts/buildGradeDistributions.mjs --input=path/to/raw.txt --out-json=path/to/output.json --out-csv=path/to/output.csv --out-instructor-summary=path/to/instructor-summary.json --out-course-summary=path/to/course-summary.json
```
