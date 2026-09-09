# Official ASSIST browser checks

Checked September 8, 2026 during the import. These checks supplement the complete API validation and fresh report sampling.

- California Lutheran, Film and Television, university department view, 2025–26: the generated source link opened the correct report. ASSIST displayed 18 receiving-course rows. FILM 101 (4 units) matched SBCC FS 101 (3 units) and FS 101H (4 units); the other displayed course rows had no articulated match.
- California Lutheran, Communication, SBCC department view, 2025–26: the source link selected the SBCC view and the correct report. It displayed university COMM 101 (4 units) with SBCC COMM 171 (3 units), and university COMM 103 (3 units) with SBCC COMM C1000/C1000H (3 units each).
- Loyola Marymount, LMU Core Curriculum, GE, 2026–27: the source link opened the selected GE report. The browser displayed the same 31-unit and 55-unit waiver notes, minimum C grade wording, university policy links, GE area codes, and “Complete 1 course from each 1 of the following areas” selection rule captured in the import fixture.

Source links use the report's exact key, category, selected academic year, sending institution 92, receiving institution, and SBCC/university view flag. Course reporting order in ASSIST's UI can differ from raw API order; the archive preserves the raw ordering.

These checks concern official source pages. Student-facing SBCCPlan browser verification is recorded separately after the completed import is validated and built.

Before adopting combined exports, three additional API comparisons verified complete deep equality of the course-articulation arrays: Cal Lutheran Film and Television in All Departments, FILM Film and Television in All Prefixes, and Communication in All Sending Departments. The combined export's publication date differs from the individual report's publication date; the importer retains these as distinct metadata.

## Charles R. Drew: Math department (individual fallback)

Checked the official ASSIST UI for `76/92/to/204/Department/15097`, 2025–2026. This published report is absent from the combined AllDepartments response, so its individual response was downloaded. The official page displays five receiving courses. MTH 126 (3 units) maps to SBCC MATH 137 (5 units); MTH 150 (3 units) maps to MATH 117A AND MATH 117B (2 units each), OR SOC 125 OR STAT C1000 (4 units each). The two calculus rows retain their alternatives and differing unit values. This confirms that absence from a combined export must not be treated as an empty individual report.
