# SBCCPlan

SBCC course browsing site (classes + professors) built with Next.js.

## Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data files (important)

Each term is stored in its own folder:

```bash
app/data/<TERM_CODE>/
```

Example:

```bash
app/data/202650/sections.json
app/data/202650/professors.json
```

## How the extract scripts work now (simple)

The SBCC extraction scripts do **one term at a time**.

- `extractProfessors.mjs` = saves `professors.json` for one term
- `extractAllSections.mjs` = saves `sections.json` for one term
- `fetch_ratings.mjs` = refreshes `rmp_cache.json` from all local professor term files by default
- `importAssistAgreements.mjs` = caches and normalizes SBCC transfer agreements from ASSIST.org

The SBCC extraction scripts do **not** extract all terms automatically.

## Commands to extract a term

### 1) Extract professors for a term

```bash
node app/scripts/extractProfessors.mjs <TERM_CODE>
```

Example (Spring 2026):

```bash
node app/scripts/extractProfessors.mjs 202650
```

### 2) Extract all sections for a term

```bash
node app/scripts/extractAllSections.mjs <TERM_CODE> "<TERM LABEL>"
```

Example (Spring 2026):

```bash
node app/scripts/extractAllSections.mjs 202650 "Spring 2026"
```

This creates/updates:

- `app/data/<TERM_CODE>/professors.json`
- `app/data/<TERM_CODE>/sections.json`

### 3) Refresh RateMyProfessors cache

By default this scans every local `app/data/<TERM_CODE>/professors.json`, dedupes instructors, and writes `app/data/rmp_cache.json`.

```bash
node app/scripts/fetch_ratings.mjs
```

To refresh one term only:

```bash
node app/scripts/fetch_ratings.mjs 202730
```

To work through only missing or previously unfound RMP entries in batches:

```bash
ONLY_UNCACHED=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
```

To batch through only professors that have never been attempted, skipping known `null` misses:

```bash
ONLY_UNCACHED=1 SKIP_NULLS=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
```

## Future terms (Summer 2026 / Fall 2026)

When you get the new schedule, run both scripts for that term.

### Summer 2026 (likely `202710`)

```bash
node app/scripts/extractProfessors.mjs 202710
node app/scripts/extractAllSections.mjs 202710 "Summer 2026"
```

### Fall 2026 (likely `202730`)

```bash
node app/scripts/extractProfessors.mjs 202730
node app/scripts/extractAllSections.mjs 202730 "Fall 2026"
```

Important:

- The term code must match SBCC Banner.
- If you are not sure, verify the code from the SBCC Banner term selector first.
- If the code is wrong, the script may return an empty page / empty data.

## After extracting a new term (to show it in the website)

You also need to add the term to:

- `lib/terms.ts`

Add a new item to `SUPPORTED_TERMS` with:

- `slug` (example: `summer2026`)
- `code` (example: `202710`)
- `label` (example: `Summer 2026`)

## Helpful notes

- `extractAllSections.mjs` now runs headless by default (no visible browser window).
- If you want to see the browser while scraping:

```bash
HEADLESS=false node app/scripts/extractAllSections.mjs 202650 "Spring 2026"
```

## Build check

```bash
npm run build
```

## ASSIST transfer agreement importer

USC uses a separate source and importer. See [USC import, validation, and planner notes](app/data/usc/README.md) and [private-university transfer research](docs/research/private-transfer-agreements-2026-09-08.md).

The 15 additional private universities use the same ASSIST source with a separate latest-year archive. See [private-university import and validation](app/data/assist-private/README.md). Their planner entries distinguish major, GE, department, and course-prefix reports, including SBCC-organized views.

The ASSIST importer uses the public JSON endpoints used by ASSIST.org's app. It keeps raw API responses separate from normalized SBCCPlan data and is designed to resume from cached files.

The verified September 7, 2026 CSU snapshot contains 2,186 SBCC major agreements: 13 campuses use 2026–2027 and 10 use 2025–2026. See the [coverage and verification report](app/data/assist/reports/csu-latest-coverage.md) for campus counts, source-record notes, and validation evidence.

The planner initially sends only its school catalog and summary. Selecting a school requests `/api/planner/schools/[schoolId]`; selecting a major requests `/api/planner/agreements/[agreementId]`. Both endpoints are generated as static JSON responses during `npm run build`, so the source archive remains excluded from production function bundles. Rebuild after importing new agreements. During development, the importer manifest timestamp invalidates the prepared server data; refresh the browser after an import. Client requests share a bounded session cache, and failed requests can be retried.

The shared search bar loads term data when focused or used. An early search submission waits for the data before navigating. Route changes have a loading indicator while their content becomes available.

Run the planner loading and data-preservation checks with `node --test app/scripts/assistPlannerLoading.test.mjs` (Node 24). For realistic navigation checks, run `npm run build` followed by `npm run start -- --port 3001`, then open `http://localhost:3001`. Development mode can still pause to compile a route on its first visit.

Data locations:

- Raw cache: `app/data/assist/raw/`
- Normalized agreements: `app/data/assist/normalized/`
- Cache manifest: `app/data/assist/cache-manifest.json`
- Run reports: `app/data/assist/reports/`

Command examples:

```bash
# List available SBCC UC/CSU receiving institutions for one ASSIST year.
node app/scripts/importAssistAgreements.mjs partners --year-id 76

# List UCSB major agreements for one ASSIST year.
node app/scripts/importAssistAgreements.mjs list --receiving-id 128 --year-id 76 --category major

# Fetch and normalize one full agreement by key.
node app/scripts/importAssistAgreements.mjs fetch-one --key "76/92/to/128/Major/9b98e159-1754-4eb0-33c4-08ddf001012b"

# Dry-run all SBCC -> UC/CSU current major imports before downloading full agreements.
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --dry-run

# Fetch all SBCC -> UC/CSU major agreements for one year.
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --full-categories major --concurrency 1
```

Operational notes:

- Default full-agreement concurrency is `1` and is capped at `3`.
- Default request delay is `6500ms`; override with `--delay-ms`.
- `fetch-all` caches `major`, `breadth`, `dept`, and `prefix` agreement lists by default, but only downloads full `major` agreements unless `--full-categories` is changed.
- Use `--force` to re-fetch cached API responses.
- Use `--renormalize` to rebuild normalized files from cached raw agreements without re-downloading unchanged keys.

To prefer 2026–2027 CSU agreements and use 2025–2026 only for campuses without a 2026–2027 partner record:

```bash
# Refresh metadata and major lists, and review each campus's selected year and count.
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 77 --fallback-year-id 76 --segments CSU --list-categories major --full-categories major --dry-run --force

# Download or resume the selected agreements using those cached inventories.
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 77 --fallback-year-id 76 --segments CSU --list-categories major --full-categories major --concurrency 1
```

The fallback is selected per campus, not per major. A campus present in the preferred year's partner metadata never also receives a fallback-year import. A missing or failed preferred-year major list is not silently replaced with older data. Each run report includes campus names, selected years, inventory counts, and progress. `--dry-run` writes metadata, lists, and reports but skips full agreement downloads. Runs with inventory, download, or parse errors exit unsuccessfully; full downloads do not start if inventory requests fail. Validate output against every listed agreement key before treating the import as complete.

Run the importer selection and data-preservation checks with `node --test app/scripts/importAssistAgreements.test.mjs`.

The normalized output retains named requirements, general-education area names and codes, structured selection advisements, grade and credit notes, and conditional `templateOverrides`. The overrides remain structured source records; preserving them does not apply their conditions in the planner UI. Unmatched source records are retained separately in `unlinkedArticulations`, without inventing a requirement placement. Major source URLs select the agreement directly.

After changing normalization rules, rebuild selected normalized files from cached raw responses by adding `--renormalize` to the same import command. This avoids downloading the source again.

After a complete major-only import, reconcile its campus/year selection, every listed agreement key, raw hashes, normalized identities, requirement cells, course details, cross-listings, notes, and selection rules:

```bash
node app/scripts/validateAssistImport.mjs --output app/data/assist/reports/csu-latest-validation.json
```

The validator reads `reports/last-run.json` by default; use `--report <path>` for a specific run. It separately reports ASSIST articulation records that have no matching cell anywhere in the source template. These source inconsistencies remain preserved in the raw responses and the normalized `unlinkedArticulations` collection. A successful integrity check establishes data preservation; it does not certify every source requirement's meaning or its presentation in the planner UI.

To re-fetch one deterministic sample per campus and compare its complete response with the saved source, ignoring JSON object-key ordering and embedded JSON formatting:

```bash
node app/scripts/verifyAssistLiveSamples.mjs --output app/data/assist/reports/csu-live-sample-validation.json
```

Live sample checks retain the importer's 6.5-second request spacing. They supplement the full local reconciliation; they do not re-fetch every agreement.
