# Private-university transfer agreements for SBCC students

Checked September 8, 2026. “SPC” was interpreted as Santa Barbara City College (SBCC), consistent with SBCCPlan.

Private universities do publish course-transfer agreements for California community college students. Coverage depends on the university, sending college, academic year, and program. An articulation agreement describes how courses transfer; an admission guarantee is a separate, conditional arrangement.

## USC: confirmed and collected directly

USC publishes its own [current community-college articulation agreements](https://darsweb.usc.edu/articagrmt/artic.aspx) and [Transfer Planning Guide](https://darsweb.usc.edu/TPG/Default.aspx). SBCC is a selectable sending college in both. The agreement's effective period is Fall 2026–Summer 2027; the guide uses FA26–SU27. [SBCC also links these USC resources](https://www.sbcc.edu/transfercenter/UniversityofSouthernCaliforniaUSC.php).

The current USC menu contains 264 choices representing 263 distinct program codes. Code 582 has two spelling variants. Some choices represent exploratory/undeclared programs or older program names, so this is **not a count of 263 currently admitting majors**. The import preserves the exact menu labels and codes, validates each returned report's program and year, and keeps failed responses separate from usable guides.

Final coverage: **248 valid guides; 15 unavailable programs after a fresh-session retry**. Three initially mismatched program responses were recovered by sequential rechecks. Fresh live reports for Computer Science (2054), Business Administration (486), and Psychology (598) matched the imported text, excluding the generated preparation timestamp. The unavailable programs return either no matching degree program or a USC application error; they remain labeled unavailable in the planner.

The full SBCC articulation agreement includes GE, writing, foreign language, 24 course-to-course equivalency rows, transferable-course lists, nontransferable-course lists, and credit rules. The major guides describe degree requirements, including work completed at USC, and are not admission checklists. [USC's transfer-credit resources](https://admission.usc.edu/admitted-students/transfer-credit-resources/) separately link major preparation and admission resources.

Source limitations to retain in the planner:

- The 2026–27 SBCC agreement currently has empty GE D (Life Sciences) and E (Physical Sciences) tables. These are source gaps, not permission to fill in older equivalents.
- Some program selections return USC application errors or a different program code. Those reports require review and must not be silently assigned to the requested program.
- Degree-audit/internal sections occur in the generated reports. They are preserved in the archive and excluded from student-facing requirement sections.
- Older-looking policy wording also appears inside current-year source documents. Students should use USC's current admissions page for admission policy and confirm course-credit questions with USC.

Scraped records, source snapshots, and the final coverage report are in `app/data/usc/`. The importer is `app/scripts/importUscAgreements.mjs`. USC is integrated with the planner's existing on-demand school/guide loading; source files are excluded from production function bundles.

## Private universities already publishing SBCC agreements on ASSIST

ASSIST began adding participating independent AICCU institutions in 2024–25, with additional voluntary cohorts in subsequent years. An institution being listed does not mean every sending-college pair or report category is published. [ASSIST FAQ](https://resource.assist.org/FAQ).

The live institution metadata listed 33 independent institutions. Fifteen had SBCC receiving-agreement years and published reports in the latest listed year: **4 in 2026–27, 10 in 2025–26, and 1 in 2024–25**. Across those latest-year lists there are **333 major-category reports**. These are report-list counts, not a claim that every private-school major is covered or that every report is an undergraduate admission pathway. Department and prefix views overlap and should not be added together as unique agreements.

| University | Latest SBCC year found | Major reports | Published report categories |
|---|---|---:|---|
| [California Lutheran](https://www.assist.org/transfer/results?year=76&institution=92&agreement=201&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 0 | Department, prefix |
| [Charles R. Drew](https://www.assist.org/transfer/results?year=76&institution=92&agreement=204&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 5 | Major, department, prefix |
| [Fresno Pacific](https://www.assist.org/transfer/results?year=76&institution=92&agreement=206&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 55 | Major, department, prefix, GE |
| [Concordia University Irvine](https://www.assist.org/transfer/results?year=76&institution=92&agreement=207&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 19 | Major, GE |
| [Loyola Marymount](https://www.assist.org/transfer/results?year=77&institution=92&agreement=209&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2026–27 | 0 | GE |
| [National University](https://www.assist.org/transfer/results?year=76&institution=92&agreement=213&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 48 | Major, department, prefix, GE |
| [Pepperdine](https://www.assist.org/transfer/results?year=77&institution=92&agreement=214&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2026–27 | 2 | Major, GE |
| [Touro University Worldwide](https://www.assist.org/transfer/results?year=77&institution=92&agreement=215&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2026–27 | 9 | Major, department, prefix, GE |
| [University of the Pacific](https://www.assist.org/transfer/results?year=76&institution=92&agreement=217&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 95 | Major, department, prefix |
| [University of Redlands](https://www.assist.org/transfer/results?year=76&institution=92&agreement=220&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 64 | Major, department, prefix, GE |
| [Palo Alto University](https://www.assist.org/transfer/results?year=75&institution=92&agreement=222&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2024–25 | 0 | GE |
| [Whittier College](https://www.assist.org/transfer/results?year=76&institution=92&agreement=224&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 6 | Major |
| [Santa Clara](https://www.assist.org/transfer/results?year=77&institution=92&agreement=227&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2026–27 | 0 | GE |
| [Simpson University](https://www.assist.org/transfer/results?year=76&institution=92&agreement=228&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 30 | Major, department, prefix, GE |
| [Azusa Pacific](https://www.assist.org/transfer/results?year=76&institution=92&agreement=230&agreementType=to&viewAgreementsOptions=true&view=agreement) | 2025–26 | 0 | Department, prefix |

Pepperdine's two major-category reports are College of Health Science ELM-CNL and Two Year BSN Nursing; its GE report is Seaver Core. They must not be presented as comprehensive Seaver-major coverage. LMU's current ASSIST entry was also checked in the visible website: it offers LMU Core Curriculum under GE, with Major/Department/Prefix disabled.

The full institution list and the returned categories/report keys are retained in [the evidence snapshot](private-transfer-evidence-2026-09-08.json). Other universities without an SBCC pair in this snapshot may still have agreements on their own sites or for other community colleges. USC is an example of a university whose own source should be used.

## Other official sources and admission guarantees

| University or pathway | What is confirmed | Scope or freshness limit |
|---|---|---|
| [Cal Lutheran SBCC major articulation](https://www.callutheran.edu/students/registrar/transfers/santa-barbara-city-college.html) | A university-hosted SBCC page organized by major, in addition to ASSIST department/prefix reports | No academic-year label was found on this page; verify its effective year before importing as current |
| [USF SBCC articulation](https://www.usfca.edu/admission/undergraduate/transfer-credit/santa-barbara-city-college-articulation-agreement) | Core requirements and common course equivalencies; explicitly updated January 21, 2026 | A menu of planning options, not requirements to complete before admission |
| [Westmont's SBCC agreement](https://www.westmont.edu/sites/default/files/2026-03/SBCC%20Articulation%20Agreement_25.26.pdf) | SBCC course equivalencies and GE mappings for the 2025–26 catalog, updated March 11, 2026 | Major applicability is evaluated with the department. The current registrar link points to this newer PDF, rather than the older 2022–23 copy still in search results |
| [Chapman course approvals](https://www.chapman.edu/students/academic-resources/registrar/student-services/transfer-credit-and-articulation.aspx) | Public TES course-equivalency search and Transferology | SBCC's current records and effective dates were not audited in this research; equivalency approval does not establish transferred unit amounts |
| [LMU's SBCC transfer guarantee](https://transfer.lmu.edu/howtotransfer/prepare/specialprograms/transferguarantee/santabarbaracitycollege/) | A separate conditional guaranteed-transfer pathway for specified colleges/majors | GPA, units, course preparation, enrollment, and deadlines apply; not a blanket all-major guarantee |
| [Santa Clara transfer admission agreements](https://www.scu.edu/admission/undergraduate/transfer-students/transfer-admission-agreement/) | SBCC forms for Arts and Sciences, Business, and Engineering, with conditional fall admission | The page explicitly makes Economics (Arts and Sciences) and Computer Science and Engineering subject to space availability |
| [Pepperdine Graziadio BSM guarantee](https://bschool.pepperdine.edu/undergraduate-programs/business-management/transfer-guarantee/) | A transfer-admission pathway for the online Bachelor of Science in Management degree-completion program | Distinct from Seaver College and the College of Health Science reports above; not a general Pepperdine guarantee |
| [California Community Colleges independent-university ADT partners](https://www.cccco.edu/Students/Transfer/participating-ca-independent-non-profit-universities) | Formal ADT arrangements with named institutions, including Fresno Pacific, Golden Gate, National, Saint Mary's, Pacific, and University of the West | Institution/major conditions apply. The page is not used here as an exhaustive, current count of every private ADT participant |

## Completed ASSIST import and additional candidates

All 15 verified ASSIST partners have now been imported and added to the local planner: 333 major, 23 GE, 545 department, and 732 prefix report views. Both university-organized and SBCC-organized course reports are included; the 1,633 views overlap and are not 1,633 unique majors. Each school’s latest verified year is visible. See [the import coverage and verification report](../../app/data/assist-private/reports/coverage.md).

USF is another practical source to add because its SBCC agreement has structured course tables and an explicit recent update date. Westmont's 2025–26 SBCC PDF is also a concrete import candidate. Cal Lutheran's own major page needs an effective-year check. Chapman requires a separate TES lookup and source validation.

This research confirms transfer-agreement availability, not a student's eligibility, admission outcome, or guaranteed award of credit. The 15 ASSIST partners are integrated locally pending publication approval. USF, Westmont, Cal Lutheran’s separate university-hosted major page, Chapman TES, and the separate admission-guarantee resources were researched but are not part of this import.
