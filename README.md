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

They do **one term at a time**.

- `extractProfessors.mjs` = saves `professors.json` for one term
- `extractAllSections.mjs` = saves `sections.json` for one term
- `importAssistAgreements.mjs` = caches and normalizes SBCC transfer agreements from ASSIST.org

They do **not** extract all terms automatically.

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

The ASSIST importer uses the public JSON endpoints used by ASSIST.org's app. It keeps raw API responses separate from normalized SBCCPlan data and is designed to resume from cached files.

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
- Default request delay is `1250ms`; override with `--delay-ms`.
- `fetch-all` caches `major`, `breadth`, `dept`, and `prefix` agreement lists by default, but only downloads full `major` agreements unless `--full-categories` is changed.
- Use `--force` to re-fetch cached API responses.
- Use `--renormalize` to rebuild normalized files from cached raw agreements without re-downloading unchanged keys.
