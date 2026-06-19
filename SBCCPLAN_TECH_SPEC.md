# SBCCPlan Technical Specification

Generated: 2026-05-15

## 1. Product Summary

SBCCPlan is an unofficial student-built course planning and course discovery site for Santa Barbara City College. The app lets students browse SBCC classes by term, department, course, CRN, IGETC area, and professor. It also includes cached RateMyProfessors data and a beta transfer planner powered by locally cached ASSIST.org articulation agreements.

The project is named `sbccconnect` in `package.json`, but the public product name and UI brand are `SBCCPlan`.

Core user-facing areas:

- Home page with term shortcuts and popular subjects.
- Class browser by department, course, section, and CRN.
- Professor directory and professor detail pages with cached RateMyProfessors ratings, tags, and comments.
- Transfer planner using SBCC to UC/CSU ASSIST agreements.
- Registration date table for Summer 2026 and Fall 2026.
- Basic anonymous click/page analytics.

## 2. High-Level Architecture

SBCCPlan is a Next.js App Router application backed primarily by local JSON files. There is no production database in the current implementation.

Runtime data model:

- Course section data is stored as static JSON under `app/data/<TERM_CODE>/sections.json`.
- Professor lists are stored as static JSON under `app/data/<TERM_CODE>/professors.json`.
- RateMyProfessors data is stored in `app/data/rmp_cache.json`.
- ASSIST transfer agreement data is stored in `app/data/assist/raw/` and `app/data/assist/normalized/`.
- Custom analytics are stored on disk in `.analytics/summary.json` unless `ANALYTICS_FILE_PATH` is set.

Data generation model:

- SBCC Banner data is scraped by local Node scripts.
- RateMyProfessors data is fetched through GraphQL and cached.
- ASSIST.org data is fetched through the public JSON endpoints used by the ASSIST web app, cached raw, then normalized.
- Registration dates are hard-coded in the planner page and must be manually updated.

## 3. Tech Stack

Application:

- Next.js `16.1.4`
- React `19.2.3`
- React DOM `19.2.3`
- TypeScript `5`
- Tailwind CSS `3.4.17`
- Next App Router under `app/`
- Vercel Analytics through `@vercel/analytics`

Data extraction:

- Node.js ES modules for scripts under `app/scripts/`
- `puppeteer` for scraping full SBCC schedule pages
- `cheerio` for parsing SBCC instructor dropdown HTML
- Native `fetch` for ASSIST.org and RateMyProfessors API requests
- Node `fs`, `path`, and `crypto` for local cache and normalization files

Legacy/prototype dependency:

- `@mtucourses/rate-my-professors` is listed in dependencies and used by `server.js`.
- `server.js` is a standalone Express prototype for RateMyProfessors lookup, not part of the current Next.js runtime or `npm` scripts.
- `server.js` imports `cors`, but `cors` is not currently listed in `package.json`.

Build and quality tooling:

- ESLint `9`
- `eslint-config-next`
- PostCSS and Autoprefixer
- `tsconfig.json` uses strict mode, `resolveJsonModule`, and `@/*` path aliasing.

## 4. Repository Map

Important app files:

- `app/layout.tsx`: root layout, global metadata, theme initialization script, analytics components, footer disclaimer.
- `app/page.tsx`: home page.
- `app/classes/page.tsx`: department browser and IGETC course browser.
- `app/classes/[subject]/page.tsx`: course list for one subject.
- `app/classes/[subject]/[course]/page.tsx`: section list for one course.
- `app/classes/section/[crn]/page.tsx`: CRN-level section detail page.
- `app/professors/page.tsx`: professor directory.
- `app/professor/[name]/page.tsx`: professor detail page.
- `app/planner/page.tsx`: transfer planner shell and registration date tables.
- `app/planner/AssistPlannerClient.tsx`: interactive transfer planner UI.
- `app/admin/analytics/page.tsx`: basic analytics dashboard.

Shared app logic:

- `lib/terms.ts`: supported term definitions and term URL helpers.
- `lib/termDataClient.ts`: client-side dynamic JSON loaders and in-memory promise caches.
- `lib/courseMetadata.ts`: reusable prerequisite/advisory/transfer-info parsing helpers.
- `lib/locationMapping.ts`: SBCC building-code display names and Google Maps URL generation.
- `lib/assistPlanner.ts`: server-side ASSIST normalized data reader and planner data builder.
- `lib/analyticsStore.ts`: local analytics summary storage.

Components:

- `components/Header.tsx`: global navigation, search bar, theme picker, back button.
- `components/SearchBar.tsx`: route-aware global search over the selected term.
- `components/CourseCatalogDetails.tsx`: reusable course description/prereq/advisory/transfer-info panel.
- `components/AnalyticsTracker.tsx`: client page-view and click tracker.
- `components/SBCCPlanLogo.tsx`: logo component.

API routes:

- `app/api/professor-cache/route.ts`: serves `app/data/rmp_cache.json`.
- `app/api/professor/route.ts`: resolves one professor from cache or live RateMyProfessors GraphQL.
- `app/api/track/route.ts`: records and reads anonymous analytics counts.

Data scripts:

- `app/scripts/extractProfessors.mjs`
- `app/scripts/extractAllSections.mjs`
- `app/scripts/fetch_ratings.mjs`
- `app/scripts/importAssistAgreements.mjs`
- `app/scripts/debug_rmp.mjs`
- `app/scripts/audit_rmp_cache.mjs`

## 5. Runtime Data Flow

### 5.1 Term Selection

Supported terms live in `lib/terms.ts`.

Current terms:

| Slug | Banner code | Label |
| --- | --- | --- |
| `fall2026` | `202730` | Fall 2026 |
| `summer2026` | `202710` | Summer 2026 |
| `spring2026` | `202650` | Spring 2026 |
| `fall2025` | `202630` | Fall 2025 |
| `summer2025` | `202610` | Summer 2025 |
| `spring2025` | `202550` | Spring 2025 |
| `fall2024` | `202530` | Fall 2024 |

Default term:

- `DEFAULT_TERM_SLUG = "fall2026"`
- `getDefaultTermSlug()` returns `fall2026`.

Term URLs:

- Most pages read `?term=<slug>`.
- Invalid or missing terms fall back to `fall2026`.
- `appendTermToHref()` keeps navigation links term-aware.

Important maintenance detail:

- Adding a new term requires updating both `lib/terms.ts` and the dynamic loader maps in `lib/termDataClient.ts`.

### 5.2 Client JSON Loading

`lib/termDataClient.ts` dynamically imports local JSON files:

- Sections: `@/app/data/<TERM_CODE>/sections.json`
- Professors: `@/app/data/<TERM_CODE>/professors.json`

It exposes:

- `loadSectionsForTerm(term)`
- `loadProfessorsForTerm(term)`
- `loadAllProfessors()`
- `useTermSections(term)`
- `useTermProfessors(term)`
- `useAllProfessors()`

Caching:

- Each term's sections and professors are cached in module-level `Map<TermSlug, Promise<unknown[]>>`.
- All-professor aggregation is cached in `allProfessorsPromiseCache`.
- This avoids refetching or re-importing the same JSON during client navigation.

### 5.3 Server-Side File Loading

Some features read JSON from the server filesystem:

- ASSIST planner reads `app/data/assist/normalized/` and raw list metadata through `lib/assistPlanner.ts`.
- Professor APIs read `app/data/rmp_cache.json`.
- Analytics writes and reads `.analytics/summary.json` or `ANALYTICS_FILE_PATH`.

## 6. Feature-Level Specification

### 6.1 Home Page

File:

- `app/page.tsx`

What it does:

- Presents the SBCCPlan landing page.
- Links directly to the featured term's class and professor browsers.
- Shows a second term card for Summer 2026.
- Shows quick subject links for `CS`, `MATH`, `ENG`, `PHYS`, `ART`, `COMM`, `BIOL`, `CHEM`, `ECON`, and `ACCT`.
- Links to About and a Google Forms feedback form.

Data used:

- `DEFAULT_TERM_SLUG` and `getTermBySlug()` from `lib/terms.ts`.
- No external runtime fetch on the home page, besides analytics.

### 6.2 Header, Navigation, Search, and Theme

Files:

- `components/Header.tsx`
- `components/SearchBar.tsx`
- `app/globals.css`
- `app/layout.tsx`

Navigation:

- Classes
- Professors
- Planner
- About

Search behavior:

- Uses the currently selected term from the URL.
- Loads sections and professors for that term.
- Recognizes IGETC area searches, subject codes, exact course codes, compact course codes such as `CS111`, professor names, course title matches, and subject prefixes.
- Routes users to the most specific matching page.

Theme:

- Light, dark, or auto.
- Stored in `localStorage` under `sbcc-theme-preference`.
- A small inline script in `app/layout.tsx` applies the chosen theme before hydration to reduce theme flash.
- Dark mode is implemented by global CSS overrides against Tailwind utility classes.

### 6.3 Class Department Browser

File:

- `app/classes/page.tsx`

What it does:

- Loads all sections for the selected term.
- Groups course sections by subject code.
- Displays department cards with section counts.
- Supports alphabet filtering.
- Supports department search.
- Extracts IGETC areas from `section.igetc` and `section.igetcAreas`.
- Lets users filter to courses that satisfy a selected IGETC area.

Data fields used:

- `courseCode`
- `courseTitle`
- `igetc`
- `igetcAreas`

Department names:

- Uses the `DEPARTMENT_FULL_NAMES` object in `app/classes/page.tsx`.
- Unknown subject codes fall back to the raw subject code.

### 6.4 Subject Course List

File:

- `app/classes/[subject]/page.tsx`

What it does:

- Reads the subject from the dynamic route.
- Loads all sections for the selected term.
- Groups matching rows by `courseCode`.
- Shows course title, section count, units, modality summary, and prerequisite count.

Data fields used:

- `courseCode`
- `courseTitle`
- `prerequisitesText`
- `prerequisites`
- `units`
- `modality`

Course metadata:

- Prerequisites are parsed through `extractPrerequisites()` from `lib/courseMetadata.ts`.

### 6.5 Course Section List

File:

- `app/classes/[subject]/[course]/page.tsx`

What it does:

- Shows all sections for one course code in the selected term.
- Shows course title, description, IGETC areas, advisories, prerequisites, transfer information, units, seats, instructor, meeting rows, maps, status, and modality.
- Links each section to its CRN detail page.

Data fields used:

- `crn`
- `status`
- `courseCode`
- `courseTitle`
- `igetc`
- `igetcAreas`
- `courseDescription`
- `advisoriesText`
- `advisories`
- `prerequisitesText`
- `prerequisites`
- `transferInformationText`
- `transferInformation`
- `units`
- `modality`
- `meetings`
- `enrolled`
- `capacity`

Status labels:

- `OPEN` -> Open
- values containing `waitlist` or `wait` -> Waitlisted
- values containing `closed` or `full` -> Closed
- values containing `add code` -> Open With Add Code

Modality labels:

- `OL` -> Online
- `HY` -> Hybrid
- `IP` -> In Person

Maps:

- Display locations and Google Maps URLs are generated through `lib/locationMapping.ts`.
- Online, Zoom, Web, Remote, TBA, Staff, and similar values intentionally do not get map URLs.

### 6.6 CRN Section Detail

File:

- `app/classes/section/[crn]/page.tsx`

What it does:

- Finds one section by CRN inside the selected term's `sections.json`.
- Shows a fuller card view with status, modality, units, seats, primary instructor, course catalog metadata, and each meeting row.
- Links back to the subject and course pages.

Primary instructor:

- Uses the first meeting instructor that is not treated as unknown/TBA.

### 6.7 Course Metadata Parser

File:

- `lib/courseMetadata.ts`

What it does:

- Normalizes prerequisites, advisories, and transfer information for display.
- Removes labels like `Prerequisite:`, `Course Advisory:`, and `Recommended Preparation:`.
- Splits prerequisite text on semicolons, pipes, and some sentence boundaries.
- Avoids obvious connector-only fragments such as `and`, `or`, `/`, and `&`.
- Attempts to strip long narrative course-description tails from prerequisite-like text.

Why it exists:

- The Banner scrape can put description, prerequisites, advisories, and transfer info in inconsistent row layouts.
- This helper gives the UI a consistent list of displayable metadata.

### 6.8 Location Mapping

File:

- `lib/locationMapping.ts`

What it does:

- Converts SBCC location codes into display names.
- Examples:
  - `BC` -> Business/Communications
  - `EBS` -> Earth & Biological Sciences
  - `LRC` -> Luria Library
  - `PE` -> Sports Pavilion
  - `SS` -> Student Services
- Builds Google Maps search URLs for in-person locations.

### 6.9 Professor Directory

File:

- `app/professors/page.tsx`

What it does:

- Loads the deduped professor list across all supported terms through `useAllProfessors()`.
- Fetches cached RateMyProfessors data from `/api/professor-cache`.
- Groups professors alphabetically by last name.
- Supports local professor search.
- Displays cached department, quality, difficulty, rating count, comment count, and top tag when available.

Professor identity:

- Term professor JSON stores names in SBCC format, usually `Last, First`.
- The UI converts that to `First Last`.
- Cache lookup uses several aliases: raw key, display name, first-last name, and RMP returned name.

### 6.10 Professor Detail Page

Files:

- `app/professor/[name]/page.tsx`
- `app/api/professor/route.ts`

What it does:

- Fetches one professor through `/api/professor?name=<name>&key=<key>&term=<slug>`.
- First attempts local cache resolution.
- If no acceptable cache entry exists, it does a live RateMyProfessors GraphQL search.
- Displays rating, difficulty, would-take-again percentage, top tags, recent comments, and a RateMyProfessors external link.

Cache behavior:

- If live lookup succeeds, the API attempts to write the normalized result back to `app/data/rmp_cache.json`.
- The write failure is swallowed because some deployment environments are read-only.
- The response marks data as `cache`, even for newly fetched live data, after normalization.

External fallback URL:

- If no `legacyId` is available, the UI links to RateMyProfessors search scoped to school ID `2783`.

### 6.11 Transfer Planner

Files:

- `app/planner/page.tsx`
- `app/planner/AssistPlannerClient.tsx`
- `lib/assistPlanner.ts`

What it does:

- Server-side code reads normalized ASSIST agreement files.
- Client UI guides users through three steps:
  1. Choose a transfer school.
  2. Choose a major.
  3. View the ASSIST agreement map.
- Shows receiving-school requirements on the left and SBCC articulation paths on the right.
- Supports views for all rows, required rows, recommended rows, and rows with no articulation.
- Links articulated SBCC courses back into the SBCCPlan class browser for the default term.
- Provides an external link to the source ASSIST agreement.

Planner data builder:

- `getAssistPlannerData()` reads:
  - partner metadata from `app/data/assist/raw/metadata/sbcc-agreement-partners.json`
  - institution metadata from `app/data/assist/raw/metadata/institutions.json`
  - major lists from `app/data/assist/raw/lists/**/major.json`
  - normalized agreements from `app/data/assist/normalized/**/*.json`
- It builds:
  - schools
  - majors
  - agreements
  - summary counts

Planner requirement logic:

- Receiving courses are normalized into `PlannerCourse`.
- SBCC articulations become one or more `PlannerOption` objects.
- ASSIST logic values `AND` and `OR` are preserved when known.
- Rows without SBCC courses become "No articulation" rows.
- Category labels are inferred from group titles and notes, such as Required, Strongly recommended, Upper division, Additional preparation, Recommended, Major preparation, or Agreement.

### 6.12 Registration Dates

File:

- `app/planner/page.tsx`

What it does:

- Displays hard-coded Summer 2026 and Fall 2026 registration date tables.

Important data note:

- The code does not store a source URL or scraper for registration dates.
- These dates must be manually verified and updated from the official SBCC registration calendar when terms change.

### 6.13 Analytics

Files:

- `components/AnalyticsTracker.tsx`
- `app/api/track/route.ts`
- `lib/analyticsStore.ts`
- `app/admin/analytics/page.tsx`
- `app/layout.tsx`

Two analytics systems are present:

- Vercel Analytics through `@vercel/analytics/react`.
- A custom local anonymous counter.

Custom analytics behavior:

- Sends `page_view` when the route changes.
- Captures clicks on elements matching `[data-track]`, links, and buttons.
- Uses `navigator.sendBeacon()` when available.
- Falls back to `fetch()` with `keepalive`.
- Stores aggregate counts only:
  - total event count
  - counts by event name
  - counts by path
  - last updated timestamp

Privacy:

- No IP addresses, user IDs, full user agents, cookies, or raw sessions are stored by the custom analytics feature.

Persistence caveat:

- Default storage path is `.analytics/summary.json`.
- On serverless hosts with ephemeral or read-only filesystems, this custom analytics store may not persist reliably.

## 7. Data Sources and Collection Details

### 7.1 SBCC Course Schedule Data

Source:

- SBCC Banner public schedule pages at `https://banner.sbcc.edu/ords/ssb/`.

Professor source URL:

```text
https://banner.sbcc.edu/ords/ssb/pw_pub_sched.p_search?term=<TERM_CODE>
```

Section source URL pattern:

```text
https://banner.sbcc.edu/ords/ssb/pw_pub_sched.p_listthislist?TERM=<TERM_CODE>&TERM_DESC=<TERM_LABEL>&...
```

The long query string in `extractAllSections.mjs` sets filters such as:

- all subjects
- credit level
- all parts of term
- all instruction methods
- all instructors
- broad time range from 5:00 AM to 11:00 PM

Professor extraction script:

- `app/scripts/extractProfessors.mjs`

How it works:

- Fetches the SBCC Banner search page for one term.
- Parses HTML with Cheerio.
- Reads the instructor dropdown: `select[name="sel_instr"]`.
- Removes bad placeholder values:
  - `<all>`
  - empty string
  - `Staff`
  - `Pending`
  - `TBA`
- Dedupes names.
- Sorts names alphabetically.
- Writes `app/data/<TERM_CODE>/professors.json`.

Professor JSON shape:

```json
{
  "displayName": "Abeloe, Lisa",
  "key": "abeloe, lisa"
}
```

Section extraction script:

- `app/scripts/extractAllSections.mjs`

How it works:

- Opens the SBCC Banner all-classes page in Puppeteer.
- Waits for schedule table rows.
- Scrapes rows in the browser context with DOM parsing.
- Detects course headers, meeting rows, continuation rows, metadata rows, IGETC text, prerequisites, advisories, descriptions, and transfer information.
- Computes modality:
  - `OL` if all meaningful meetings are online/remote.
  - `HY` if there is a mix of online and in-person meeting signals.
  - `IP` otherwise.
- Builds Google Maps URLs for in-person locations.
- Dedupes repeated meetings.
- Writes to a temp file first.
- Validates the temp JSON.
- Atomically renames the temp file to `sections.json` only after validation passes.

Section validation includes:

- JSON must be an array.
- Section count must be at least 100 and at least 75 percent of the previous existing file count when a previous file exists.
- CRN must be a five-digit value.
- CRNs must be unique.
- Status must be present.
- Course code and course title must be present.
- Units must be numeric.
- Meetings must be non-empty.
- Meeting type, time, location, instructor, and date range must be present.
- Status values are checked against:
  - `OPEN`
  - `CLOSED`
  - `Waitlisted`
  - `STANDBY`
  - `OPEN With Add Code`

Section JSON shape:

```json
{
  "crn": "30005",
  "status": "OPEN",
  "courseCode": "BLST 111",
  "courseTitle": "The African-American Music Experience",
  "igetc": "3A",
  "igetcAreas": ["3A", "3"],
  "courseDescription": "Survey and appreciation...",
  "advisoriesText": "",
  "advisories": [],
  "prerequisitesText": "",
  "prerequisites": [],
  "transferInformationText": "Hours: 54...",
  "transferInformation": ["Hours: 54 (54 lecture)"],
  "units": "3.0",
  "capacity": "40",
  "enrolled": "4",
  "meetings": [
    {
      "type": "Lec",
      "days": "",
      "time": "3.4 hours/week",
      "location": "ONLINE",
      "googleMapsUrl": "",
      "instructor": "Craig Cook",
      "dateRange": "08/24-12/12"
    }
  ],
  "hasLab": false,
  "hasOnlineLab": false,
  "hasHybridLecturePattern": false,
  "modality": "OL"
}
```

Refresh commands:

```bash
node app/scripts/extractProfessors.mjs 202730
node app/scripts/extractAllSections.mjs 202730 "Fall 2026"
```

Visible browser mode:

```bash
HEADLESS=false node app/scripts/extractAllSections.mjs 202730 "Fall 2026"
```

### 7.2 RateMyProfessors Data

Source:

- RateMyProfessors GraphQL endpoint.

Endpoint:

```text
https://www.ratemyprofessors.com/graphql
```

School IDs used:

- `U2Nob29sLTI3ODM=`: decoded legacy school ID `School-2783`
- `U2Nob29sLTQ2NjU=`: decoded legacy school ID `School-4665`

Headers used by the scripts/API:

- `Authorization: Basic dGVzdDp0ZXN0`
- `Content-Type: application/json`
- Browser-like `User-Agent`

Queries used:

- `newSearch.teachers(query: { text, schoolID })`
- `newSearch.teachers(query: { text })` as global fallback
- `node(id).ratings(first, after)` for recent review comments

Bulk cache script:

- `app/scripts/fetch_ratings.mjs`

How it works:

- Discovers term professor files under `app/data/<TERM_CODE>/professors.json`.
- Dedupes instructors by normalized key.
- Builds multiple query variants for each professor:
  - cleaned first-last name
  - raw first-last and last-first forms
  - last name
  - first plus last
  - last plus first
- Searches within each SBCC school ID and also globally.
- Filters matches to SBCC school IDs or school names containing "Santa Barbara City College".
- Scores candidates using:
  - exact normalized full-name match
  - matching last name
  - compatible first name/prefix
  - rating count
  - SBCC school ID/name bonus
  - wrong first/last/school penalties
- Rejects candidates below `MIN_MATCH_SCORE = 50`.
- Fetches up to `REVIEWS_LIMIT = 30` comments by default.
- Normalizes tags and reviews.
- Writes `app/data/rmp_cache.json`.

RMP cache shape:

```json
{
  "id": "VGVhY2hlci0yNzM4OTI3",
  "legacyId": "2738927",
  "firstName": "Lisa",
  "lastName": "Abeloe",
  "department": "Education",
  "avgRating": 5,
  "numRatings": 2,
  "wouldTakeAgainPercent": 100,
  "avgDifficulty": 3,
  "topTags": [
    {
      "tagName": "Clear grading criteria",
      "tagCount": 1
    }
  ],
  "reviews": [
    {
      "id": "UmF0aW5nLTM5MDQ2ODY1",
      "className": "ED101",
      "comment": "Example review text",
      "date": "2024-03-13 04:50:59 +0000 UTC"
    }
  ],
  "school": {
    "id": "U2Nob29sLTI3ODM=",
    "name": "Santa Barbara City College"
  },
  "fetchedAt": "2026-02-06T21:28:19.279Z",
  "queryName": "Abeloe, Lisa",
  "matchedBy": "Lisa Abeloe",
  "matchScore": 160.5
}
```

Operational commands:

```bash
node app/scripts/fetch_ratings.mjs
node app/scripts/fetch_ratings.mjs 202730
ONLY_UNCACHED=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
ONLY_UNCACHED=1 SKIP_NULLS=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
FORCE_REFRESH=1 SKIP_IF_HAS_TAGS=0 ONLY_KEY="abeloe, lisa" node app/scripts/fetch_ratings.mjs
```

Important note:

- The app does not rely only on the bulk cache. `/api/professor` can also do live RMP lookup when a cache miss occurs.

### 7.3 ASSIST Transfer Agreement Data

Source:

- ASSIST.org public JSON endpoints used by the web app.

Base URL:

```text
https://www.assist.org
```

SBCC institution ID:

- `92`

Endpoints used:

```text
/api/AcademicYears
/api/institutions
/api/institutions/92/agreements
/api/agreements/categories?receivingInstitutionId=<id>&sendingInstitutionId=92&academicYearId=<year>
/api/agreements?receivingInstitutionId=<id>&sendingInstitutionId=92&academicYearId=<year>&categoryCode=<category>
/api/articulation/Agreements?Key=<agreement-key>
```

Importer:

- `app/scripts/importAssistAgreements.mjs`

How it works:

- Bootstraps by requesting `https://www.assist.org` to get cookies.
- Stores cookies in a small in-memory cookie jar.
- Sends `X-XSRF-TOKEN` when available for ASSIST API calls.
- Supports optional API key headers through:
  - `ASSIST_API_KEY`
  - `ASSIST_API_KEY_HEADER`
- Uses a rate limiter.
- Default request delay is `6500ms`.
- Default retry count is `4`.
- Default full-agreement concurrency is `1`, capped at `3`.
- Retries transient HTTP statuses including 408, 425, 429, 500, 502, 503, and 504.
- Caches every API response as raw JSON.
- Writes a cache manifest with source URL, path, content hash, and timestamps.
- Normalizes full agreement JSON into display-friendly structures.

Raw data locations:

- Metadata: `app/data/assist/raw/metadata/`
- Agreement lists: `app/data/assist/raw/lists/year-<id>/receiving-<id>/`
- Full raw agreements: `app/data/assist/raw/agreements/year-<id>/receiving-<id>/<type>/`

Normalized data location:

- `app/data/assist/normalized/year-<id>/receiving-<id>/<type>/`

Reports and manifest:

- `app/data/assist/cache-manifest.json`
- `app/data/assist/reports/`

Normalized agreement shape:

```json
{
  "sendingInstitution": {
    "id": 92,
    "name": "Santa Barbara City College",
    "code": "SBCC",
    "segment": "CCC"
  },
  "receivingInstitution": {
    "id": 117,
    "name": "University of California, Los Angeles",
    "code": "UCLA",
    "segment": "UC"
  },
  "academicYear": {
    "id": 76,
    "label": "2025-2026",
    "fallYear": 2025
  },
  "agreement": {
    "key": "76/92/to/117/Major/...",
    "type": "Major",
    "name": "Aerospace Engineering/B.S",
    "publishDate": "2026-03-06T18:34:01.9770826"
  },
  "requirementGroups": []
}
```

ASSIST commands:

```bash
node app/scripts/importAssistAgreements.mjs partners --year-id 76
node app/scripts/importAssistAgreements.mjs list --receiving-id 128 --year-id 76 --category major
node app/scripts/importAssistAgreements.mjs fetch-one --key "76/92/to/128/Major/9b98e159-1754-4eb0-33c4-08ddf001012b"
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --dry-run
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --full-categories major --concurrency 1
```

Renormalize without redownloading:

```bash
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --renormalize
```

Current ASSIST data year:

- The cached normalized sample data uses academic year ID `76`, label `2025-2026`.

### 7.4 Registration Date Data

Location:

- `registrationSchedule` constant in `app/planner/page.tsx`

Current terms shown:

- Summer 2026
- Fall 2026

Data maintenance:

- This data is not scraped.
- It should be manually verified from official SBCC registration date pages before each update.

### 7.5 Analytics Data

Source:

- First-party client events captured inside SBCCPlan.

Stored file:

- `.analytics/summary.json` by default.

Override:

- `ANALYTICS_FILE_PATH=/path/to/summary.json`

Stored fields:

```json
{
  "totalEvents": 0,
  "byEvent": {},
  "byPath": {},
  "updatedAt": null
}
```

## 8. Current Data Inventory

Current term data counts:

| Term code | Label | Sections | Professor rows |
| --- | --- | ---: | ---: |
| `202530` | Fall 2024 | 1,524 | 617 |
| `202550` | Spring 2025 | 1,463 | 614 |
| `202610` | Summer 2025 | 390 | 268 |
| `202630` | Fall 2025 | 1,521 | 615 |
| `202650` | Spring 2026 | 1,536 | 615 |
| `202710` | Summer 2026 | 446 | 276 |
| `202730` | Fall 2026 | 1,559 | 592 |

Totals:

- Section rows across all supported terms: 8,439
- Professor rows across all term files before cross-term dedupe: 3,597

RateMyProfessors cache:

- Cache keys: 666
- Found professor entries: 333
- Null/no-match entries: 333
- Cached review comments: 5,936

ASSIST cache:

- Raw JSON files: 1,086
- Raw list JSON files: 37
- Raw full-agreement JSON files: 1,046
- Normalized agreement JSON files: 1,046
- Schools with normalized agreements: 9
- Normalized requirement sections: 6,859
- Manifest run records: 4
- Manifest updated at: `2026-05-08T20:36:55.729Z`

## 9. Data Refresh Workflows

### 9.1 Add or Refresh an SBCC Term

1. Verify the Banner term code from SBCC Banner.
2. Extract professors:

```bash
node app/scripts/extractProfessors.mjs <TERM_CODE>
```

3. Extract sections:

```bash
node app/scripts/extractAllSections.mjs <TERM_CODE> "<TERM LABEL>"
```

4. If the term is new, add it to `SUPPORTED_TERMS` in `lib/terms.ts`.
5. If the term is new, add section and professor loader entries in `lib/termDataClient.ts`.
6. Refresh RateMyProfessors cache:

```bash
node app/scripts/fetch_ratings.mjs
```

7. Run a build check:

```bash
npm run build
```

### 9.2 Refresh Missing RMP Entries

Use this when the cache already exists and you only want to work through missing entries:

```bash
ONLY_UNCACHED=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
```

Use this when you want to skip known null misses:

```bash
ONLY_UNCACHED=1 SKIP_NULLS=1 LIMIT=50 node app/scripts/fetch_ratings.mjs
```

### 9.3 Refresh ASSIST Agreements

Dry run first:

```bash
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --dry-run
```

Fetch full major agreements:

```bash
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --full-categories major --concurrency 1
```

Rebuild normalized files from raw cache:

```bash
node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --renormalize
```

## 10. Deployment and Build Notes

Build commands:

```bash
npm install
npm run build
npm run start
```

Development command:

```bash
npm run dev
```

Next config:

- `next.config.ts` excludes `app/data/assist/**/*` from output file tracing:

```ts
outputFileTracingExcludes: {
  "/*": ["app/data/assist/**/*"],
}
```

Why this matters:

- This helps reduce traced server output size.
- The transfer planner reads ASSIST files from disk at runtime through `fs`.
- A deployment must still make the ASSIST data available if the planner should work in production.
- Verify the deployment environment includes the required JSON files and does not tree-shake or omit them.

Filesystem assumptions:

- Course and professor JSON files are bundled/imported into the client build.
- ASSIST and RMP cache files are read from the server filesystem.
- Custom analytics writes to disk and may not be durable on serverless deployments.

## 11. Validation and Data Quality Controls

SBCC sections:

- Scraped to a temp file first.
- Validated before replacing production JSON.
- Uses a minimum count threshold and previous-file ratio threshold.
- Ensures CRN uniqueness.
- Ensures required row and meeting fields exist.
- Rejects unknown statuses.

RMP:

- Uses SBCC school ID filtering.
- Requires a minimum match score.
- Caches null misses to avoid repeated failed lookups.
- Supports `FORCE_REFRESH=1` when data should be refreshed.
- Dedupes reviews by class/comment/date.

ASSIST:

- Caches raw API responses separately from normalized output.
- Uses content hashes in the manifest.
- Supports `--force` for refetch.
- Supports `--renormalize` for rebuilding display data from raw cache.
- Uses low default concurrency and delay to avoid aggressive API access.

UI:

- Most runtime data loading has loading and error states.
- Term invalid/missing values fall back to the default term.
- Course metadata display uses normalization helpers instead of showing raw scraped strings directly.

## 12. Known Limitations and Risks

No database:

- The app depends on checked-in or locally generated JSON files.
- Updating data means running scripts and committing/redeploying the resulting JSON, unless running locally.

Live RMP writes:

- `/api/professor` attempts to write new cache entries into `app/data/rmp_cache.json`.
- This may fail silently in read-only production environments.

RMP dependency and API fragility:

- The active implementation uses RateMyProfessors GraphQL directly.
- GraphQL schema, headers, rate limits, or school IDs can change.

SBCC Banner scraping fragility:

- `extractAllSections.mjs` depends on Banner HTML table layout.
- The script includes fallback parsing for several layouts, but major Banner markup changes can break extraction.

ASSIST API fragility:

- ASSIST endpoints, cookies, XSRF behavior, keys, and rate limits can change.
- The importer is designed to cache and resume, but it still depends on public web-app endpoints.

Registration dates:

- Stored manually in code.
- No validation or external source tracking is attached.

Analytics persistence:

- Custom analytics is file-based and not suited for distributed/serverless persistence without a durable storage path.

Large local data footprint:

- `app/data/assist` contains over one thousand JSON files.
- This has deployment and repository-size implications.

## 13. Security and Privacy Notes

No student accounts:

- The app has no authentication layer in the current codebase.
- It does not store user academic plans or personal student data.

Analytics:

- Custom analytics stores aggregate event/path counts only.
- Vercel Analytics is also enabled through the Vercel package.

External data:

- SBCC course data comes from public SBCC Banner pages.
- Professor data comes from RateMyProfessors.
- Transfer agreement data comes from ASSIST.org.

Disclaimer:

- The root layout footer states: `THIS WEBSITE IS NOT AFFILIATED WITH SBCC.`

## 14. Suggested Future Improvements

- Move generated data into a durable database or object storage if updates need to happen without redeploys.
- Add a documented source URL for registration dates and a validation checklist.
- Add automated smoke tests for the class browser, professor lookup, and planner.
- Add a data freshness page showing scrape/import timestamps by dataset.
- Split ASSIST data into a smaller search index plus lazy-loaded agreement detail files.
- Replace file-based custom analytics with durable storage if production analytics are required.
- Remove or update `server.js` if it is no longer used, especially because it imports `cors` without a listed dependency.
- Add a single command or script to refresh one term end to end.
