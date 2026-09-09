# Planner browser verification

Checked September 8, 2026 against the final production build at `http://127.0.0.1:3001/planner` using the in-app browser.

- Catalog: 48 schools, 5,128 programs/report views listed, 5,113 usable agreements/guides; 16 private schools including the existing USC entry. Each new school shows its selected year. The existing 15 unavailable USC programs remain unavailable.
- LMU: 2026–2027 Core Curriculum appears under GE, with 13 requirement areas, source links, grade C rule, and 31-/55-unit waiver notes preserved. Searching `MATH150` returns the relevant complete requirement rows; expand and collapse both work during search.
- Charles R. Drew: major, department, and prefix filters work. Math search distinguishes university and SBCC views. The Math department report has five rows. Its statistics mapping renders MATH 117A AND MATH 117B, OR the instruction to select one from SOC 125 OR STAT C1000. Both calculus rows retain their selection instruction and course alternatives. No instruction appears as an empty course option. The final guide was visually inspected.
- SBCC prefix view: CDU MATH Mathematics shows the source key `76/92/to/204/SendingPrefix/10002`, `viewSendingAgreements=true`, and five university receiving-course rows, preserving the correct direction.
- Private major: CDU Psychology, B.S. shows 12 course/requirement rows, MAJOR CORE COURSES, source selection wording, and explicit “No Current Articulation” entries where the source has no match.
- USC: Computer Science program 2054 still opens and retains the warning about empty 2026–2027 GE D/E source tables.
- Navigation: About opens with updated source/category copy; Planner opens again successfully. Controller call duration is not treated as a rendering benchmark.
- Final browser console inspection: no warnings or errors.
- The preview is left on the Private Universities school list for review.
