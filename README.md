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

