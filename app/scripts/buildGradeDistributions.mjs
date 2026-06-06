import fs from 'fs';
import path from 'path';

const TERM_CONFIGS = [
  {
    pdfLabel: 'Spring 2025',
    code: '202550',
    slug: 'spring2025',
    sortOrder: 1,
  },
  {
    pdfLabel: 'Summer 2025',
    code: '202610',
    slug: 'summer2025',
    sortOrder: 2,
  },
  {
    pdfLabel: 'Fall 2025',
    code: '202630',
    slug: 'fall2025',
    sortOrder: 3,
  },
];

const TERM_BY_PDF_LABEL = new Map(TERM_CONFIGS.map((term) => [term.pdfLabel, term]));
const GRADE_COLUMNS = ['A', 'B', 'C', 'D', 'F', 'CR', 'NC', 'P', 'NP', 'W', 'FW'];
const INSTRUCTOR_SUMMARY_GRADE_COLUMNS = ['A', 'B', 'C', 'D', 'F'];
const SUPPRESSION_THRESHOLD = 10;
const SUPPRESSED_MIN = 0;
const SUPPRESSED_MAX = SUPPRESSION_THRESHOLD - 1;

const DEFAULT_INPUT = 'app/data/grade-distributions/raw/20260506_grade_distribution_public_records.txt';
const DEFAULT_JSON_OUTPUT = 'app/data/grade-distributions/sbcc-grade-distributions-2025.json';
const DEFAULT_CSV_OUTPUT = 'app/data/grade-distributions/sbcc-grade-distributions-2025.csv';
const DEFAULT_INSTRUCTOR_SUMMARY_OUTPUT = 'app/data/grade-distributions/sbcc-grade-distribution-instructor-course-summaries-2025.json';

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg.startsWith('--input=')) {
        options.input = arg.slice('--input='.length);
      } else if (arg.startsWith('--out-json=')) {
        options.outJson = arg.slice('--out-json='.length);
      } else if (arg.startsWith('--out-csv=')) {
        options.outCsv = arg.slice('--out-csv='.length);
      } else if (arg.startsWith('--out-instructor-summary=')) {
        options.outInstructorSummary = arg.slice('--out-instructor-summary='.length);
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }

      return options;
    },
    {
      input: DEFAULT_INPUT,
      outJson: DEFAULT_JSON_OUTPUT,
      outCsv: DEFAULT_CSV_OUTPUT,
      outInstructorSummary: DEFAULT_INSTRUCTOR_SUMMARY_OUTPUT,
    },
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value) {
  const text = cleanString(String(value ?? ''));
  return /^\d+$/.test(text) ? Number(text) : null;
}

function parseNumber(value) {
  const text = cleanString(String(value ?? ''));
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

function normalizeCourseCode(subject, courseNumber) {
  return `${subject} ${courseNumber}`.trim().replace(/\s+/g, ' ');
}

function parseRawRows(rawText) {
  const records = [];
  const errors = [];

  rawText.split(/\n/).forEach((line, index) => {
    if (!/^(Fall|Spring|Summer) \d{4} /.test(line)) return;

    const tokens = line.trim().split(/\s+/);
    const termLabel = tokens.slice(0, 2).join(' ');
    const term = TERM_BY_PDF_LABEL.get(termLabel);
    const gradeTokens = tokens.slice(-GRADE_COLUMNS.length);
    const hasValidGradeTokens = gradeTokens.every((token) => token === '*' || /^\d+$/.test(token));

    if (!term || tokens.length < 5 + GRADE_COLUMNS.length || !hasValidGradeTokens) {
      errors.push({
        lineNumber: index + 1,
        line,
      });
      return;
    }

    const subject = tokens[2];
    const courseNumber = tokens[3];
    const crn = tokens[4];

    records.push({
      sourceLine: index + 1,
      term,
      subject,
      courseNumber,
      crn,
      pdfCourseCode: normalizeCourseCode(subject, courseNumber),
      pdfTitleInstructorText: tokens.slice(5, -GRADE_COLUMNS.length).join(' '),
      gradeTokens,
    });
  });

  if (errors.length > 0) {
    const samples = errors.slice(0, 5).map((error) => `line ${error.lineNumber}: ${error.line}`);
    throw new Error(`Failed to parse ${errors.length} grade distribution rows.\n${samples.join('\n')}`);
  }

  return records;
}

function loadSectionsByTerm() {
  return new Map(
    TERM_CONFIGS.map((term) => {
      const sectionsPath = path.resolve(process.cwd(), `app/data/${term.code}/sections.json`);
      const sections = readJson(sectionsPath);

      return [
        term.code,
        new Map(
          sections.map((section) => [
            cleanString(section.crn),
            section,
          ]),
        ),
      ];
    }),
  );
}

function getSectionInstructors(section) {
  if (!Array.isArray(section?.meetings)) return [];

  return [
    ...new Set(
      section.meetings
        .map((meeting) => cleanString(meeting.instructor))
        .filter(Boolean),
    ),
  ];
}

function buildGrades(gradeTokens) {
  const grades = {};
  const suppressedGrades = [];

  GRADE_COLUMNS.forEach((column, index) => {
    const token = gradeTokens[index];

    if (token === '*') {
      grades[column] = null;
      suppressedGrades.push(column);
      return;
    }

    grades[column] = Number(token);
  });

  return {
    grades,
    suppressedGrades,
  };
}

function buildGradeSummary(grades, suppressedGrades, enrolled) {
  const knownCount = Object.values(grades).reduce((sum, count) => sum + (count ?? 0), 0);
  const suppressedBucketCount = suppressedGrades.length;
  const knownCountExceedsEnrolled = typeof enrolled === 'number' ? knownCount > enrolled : null;
  const maxObservedCount = knownCount + suppressedBucketCount * SUPPRESSED_MAX;

  return {
    knownCount,
    suppressedBucketCount,
    allBucketsSuppressed: suppressedBucketCount === GRADE_COLUMNS.length,
    knownCountExceedsEnrolled,
    observedCountRange: {
      min: knownCount + suppressedBucketCount * SUPPRESSED_MIN,
      max: typeof enrolled === 'number' && !knownCountExceedsEnrolled
        ? Math.min(enrolled, maxObservedCount)
        : maxObservedCount,
    },
  };
}

function compareCourseCode(pdfCourseCode, sectionCourseCode) {
  if (!sectionCourseCode) return 'no-section-match';
  return pdfCourseCode === sectionCourseCode ? 'exact' : 'section-code-preferred';
}

function buildRecords(rawRecords, sectionsByTerm) {
  return rawRecords.map((rawRecord) => {
    const section = sectionsByTerm.get(rawRecord.term.code)?.get(rawRecord.crn) ?? null;
    const instructors = getSectionInstructors(section);
    const sectionCourseCode = cleanString(section?.courseCode);
    const courseCode = sectionCourseCode || rawRecord.pdfCourseCode;
    const [subject, ...courseNumberParts] = courseCode.split(/\s+/);
    const { grades, suppressedGrades } = buildGrades(rawRecord.gradeTokens);
    const sectionSummary = section
      ? {
          status: cleanString(section.status) || null,
          capacity: parseInteger(section.capacity),
          enrolled: parseInteger(section.enrolled),
          units: parseNumber(section.units),
          modality: cleanString(section.modality) || null,
        }
      : null;

    return {
      termCode: rawRecord.term.code,
      termSlug: rawRecord.term.slug,
      termLabel: rawRecord.term.pdfLabel,
      crn: rawRecord.crn,
      courseCode,
      subject: subject || rawRecord.subject,
      courseNumber: courseNumberParts.join(' ') || rawRecord.courseNumber,
      courseTitle: cleanString(section?.courseTitle) || null,
      primaryInstructor: instructors[0] ?? null,
      instructors,
      section: sectionSummary,
      source: {
        line: rawRecord.sourceLine,
        pdfCourseCode: rawRecord.pdfCourseCode,
        pdfTitleInstructorText: rawRecord.pdfTitleInstructorText,
        courseCodeMatch: compareCourseCode(rawRecord.pdfCourseCode, sectionCourseCode),
      },
      grades,
      suppressedGrades,
      summary: buildGradeSummary(grades, suppressedGrades, sectionSummary?.enrolled),
    };
  });
}

function sortRecords(records) {
  return records.sort((a, b) => {
    const termSort = TERM_BY_PDF_LABEL.get(a.termLabel).sortOrder - TERM_BY_PDF_LABEL.get(b.termLabel).sortOrder;
    if (termSort !== 0) return termSort;

    const subjectSort = a.subject.localeCompare(b.subject);
    if (subjectSort !== 0) return subjectSort;

    const courseSort = a.courseNumber.localeCompare(b.courseNumber, undefined, { numeric: true });
    if (courseSort !== 0) return courseSort;

    return a.crn.localeCompare(b.crn, undefined, { numeric: true });
  });
}

function buildCourseIndex(records) {
  const index = new Map();

  records.forEach((record) => {
    const existing = index.get(record.courseCode) ?? {
      courseCode: record.courseCode,
      subject: record.subject,
      courseNumber: record.courseNumber,
      courseTitle: record.courseTitle,
      recordCount: 0,
      terms: [],
      sections: [],
    };

    existing.recordCount += 1;

    if (!existing.terms.some((term) => term.termCode === record.termCode)) {
      existing.terms.push({
        termCode: record.termCode,
        termSlug: record.termSlug,
        termLabel: record.termLabel,
      });
    }

    existing.sections.push({
      termCode: record.termCode,
      crn: record.crn,
    });

    if (!existing.courseTitle && record.courseTitle) {
      existing.courseTitle = record.courseTitle;
    }

    index.set(record.courseCode, existing);
  });

  return Array.from(index.values()).sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }));
}

function buildStats(records) {
  const matchedEnrollmentCount = records.filter((record) => record.section).length;
  const courseCodeAdjustedCount = records.filter((record) => record.source.courseCodeMatch === 'section-code-preferred').length;
  const suppressedCellCount = records.reduce(
    (count, record) => count + record.suppressedGrades.length,
    0,
  );
  const visibleCellCount = records.length * GRADE_COLUMNS.length - suppressedCellCount;

  return {
    recordCount: records.length,
    matchedEnrollmentCount,
    missingEnrollmentCount: records.length - matchedEnrollmentCount,
    courseCodeAdjustedCount,
    visibleCellCount,
    suppressedCellCount,
    allBucketsSuppressedRecordCount: records.filter((record) => record.summary.allBucketsSuppressed).length,
    knownCountExceedsEnrolledCount: records.filter((record) => record.summary.knownCountExceedsEnrolled).length,
    terms: Object.fromEntries(
      TERM_CONFIGS.map((term) => [
        term.code,
        {
          termSlug: term.slug,
          termLabel: term.pdfLabel,
          recordCount: records.filter((record) => record.termCode === term.code).length,
        },
      ]),
    ),
  };
}

function getUiGradeCount(record) {
  return INSTRUCTOR_SUMMARY_GRADE_COLUMNS.reduce(
    (count, grade) => count + (typeof record.grades[grade] === 'number' ? 1 : 0),
    0,
  );
}

function chooseRepresentativeRecord(records) {
  return [...records].sort((a, b) => {
    const aHasExactA = typeof a.grades.A === 'number';
    const bHasExactA = typeof b.grades.A === 'number';
    if (aHasExactA !== bHasExactA) return aHasExactA ? -1 : 1;

    const gradeVisibilitySort = getUiGradeCount(b) - getUiGradeCount(a);
    if (gradeVisibilitySort !== 0) return gradeVisibilitySort;

    const knownCountSort = b.summary.knownCount - a.summary.knownCount;
    if (knownCountSort !== 0) return knownCountSort;

    return a.crn.localeCompare(b.crn, undefined, { numeric: true });
  })[0];
}

function compactGradeFromRecord(record, grade) {
  const count = record.grades[grade];

  if (typeof count === 'number') {
    return {
      min: count,
      max: count,
      exact: true,
      suppressedBucketCount: 0,
    };
  }

  return {
    min: SUPPRESSED_MIN,
    max: SUPPRESSED_MAX,
    exact: false,
    suppressedBucketCount: record.suppressedGrades.includes(grade) ? 1 : 0,
  };
}

function buildExactARateSummary(records) {
  const exactARecords = records.filter((record) => (
    typeof record.grades.A === 'number'
    && (record.section?.enrolled ?? 0) > 0
  ));

  if (exactARecords.length === 0) {
    return {
      exact: false,
      percent: null,
      sourceSectionCount: 0,
      method: 'masked',
    };
  }

  const percent = exactARecords.reduce(
    (sum, record) => sum + (record.grades.A / record.section.enrolled) * 100,
    0,
  ) / exactARecords.length;

  return {
    exact: true,
    percent,
    sourceSectionCount: exactARecords.length,
    method: 'average-exact-section-rates',
  };
}

function compactTermSummary(records) {
  const representativeRecord = chooseRepresentativeRecord(records);
  if (!representativeRecord) return null;

  return {
    termCode: representativeRecord.termCode,
    termLabel: representativeRecord.termLabel,
    crn: representativeRecord.crn,
    sectionCount: records.length,
    totalEnrollment: representativeRecord.section.enrolled,
    aRate: buildExactARateSummary(records),
    grades: Object.fromEntries(
      INSTRUCTOR_SUMMARY_GRADE_COLUMNS.map((grade) => [
        grade,
        compactGradeFromRecord(representativeRecord, grade),
      ]),
    ),
  };
}

function buildInstructorSummaryPayload(records, source) {
  const summariesByKey = new Map();

  records.forEach((record) => {
    const enrolled = record.section?.enrolled ?? 0;
    const primaryInstructor = cleanString(record.primaryInstructor);
    if (enrolled <= 0 || !primaryInstructor || primaryInstructor.toLowerCase() === 'tba') return;

    const key = `${record.courseCode}\n${primaryInstructor}`;
    if (!summariesByKey.has(key)) {
      summariesByKey.set(key, {
        courseCode: record.courseCode,
        subject: record.subject,
        courseNumber: record.courseNumber,
        courseTitle: record.courseTitle,
        primaryInstructor,
        terms: new Map(),
      });
    }

    const summary = summariesByKey.get(key);
    if (!summary.terms.has(record.termCode)) {
      summary.terms.set(record.termCode, []);
    }

    if (!summary.courseTitle && record.courseTitle) {
      summary.courseTitle = record.courseTitle;
    }

    summary.terms.get(record.termCode).push(record);
  });

  const summaries = Array.from(summariesByKey.values())
    .map((summary) => ({
      courseCode: summary.courseCode,
      subject: summary.subject,
      courseNumber: summary.courseNumber,
      courseTitle: summary.courseTitle,
      primaryInstructor: summary.primaryInstructor,
      terms: Array.from(summary.terms.values())
        .map((termRecords) => compactTermSummary(termRecords))
        .filter(Boolean)
        .sort((a, b) => a.termCode.localeCompare(b.termCode)),
    }))
    .sort((a, b) => {
      const courseSort = a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true });
      if (courseSort !== 0) return courseSort;
      return a.primaryInstructor.localeCompare(b.primaryInstructor);
    });

  return {
    schemaVersion: 1,
    source: {
      ...source,
      summary: 'Instructor-by-course term summaries for grade distribution UI. Each term selects one A-prioritized representative section for chart counts and enrollment; A-rate averages sections with visible A counts.',
      gradeColumns: INSTRUCTOR_SUMMARY_GRADE_COLUMNS,
    },
    summaries,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';

  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(records) {
  const gradeHeaders = GRADE_COLUMNS.flatMap((grade) => [
    `grade_${grade.toLowerCase()}_count`,
    `grade_${grade.toLowerCase()}_suppressed`,
    `grade_${grade.toLowerCase()}_display`,
    `grade_${grade.toLowerCase()}_min`,
    `grade_${grade.toLowerCase()}_max`,
  ]);
  const headers = [
    'term_code',
    'term_slug',
    'term_label',
    'crn',
    'course_code',
    'subject',
    'course_number',
    'course_title',
    'primary_instructor',
    'status',
    'capacity',
    'enrolled',
    'units',
    'modality',
    'known_count',
    'suppressed_bucket_count',
    'observed_count_min',
    'observed_count_max',
    'all_buckets_suppressed',
    'pdf_course_code',
    'course_code_match',
    'pdf_title_instructor_text',
    ...gradeHeaders,
  ];

  const rows = records.map((record) => {
    const gradeValues = GRADE_COLUMNS.flatMap((grade) => {
      const count = record.grades[grade];
      const suppressed = record.suppressedGrades.includes(grade);

      return [
        count,
        suppressed,
        suppressed ? `<${SUPPRESSION_THRESHOLD}` : count,
        suppressed ? SUPPRESSED_MIN : count,
        suppressed ? SUPPRESSED_MAX : count,
      ];
    });

    return [
      record.termCode,
      record.termSlug,
      record.termLabel,
      record.crn,
      record.courseCode,
      record.subject,
      record.courseNumber,
      record.courseTitle,
      record.primaryInstructor,
      record.section?.status,
      record.section?.capacity,
      record.section?.enrolled,
      record.section?.units,
      record.section?.modality,
      record.summary.knownCount,
      record.summary.suppressedBucketCount,
      record.summary.observedCountRange.min,
      record.summary.observedCountRange.max,
      record.summary.allBucketsSuppressed,
      record.source.pdfCourseCode,
      record.source.courseCodeMatch,
      record.source.pdfTitleInstructorText,
      ...gradeValues,
    ].map(csvEscape).join(',');
  });

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  const outputJsonPath = path.resolve(process.cwd(), options.outJson);
  const outputCsvPath = path.resolve(process.cwd(), options.outCsv);
  const outputInstructorSummaryPath = path.resolve(process.cwd(), options.outInstructorSummary);
  const rawText = fs.readFileSync(inputPath, 'utf8');
  const rawRecords = parseRawRows(rawText);
  const records = sortRecords(buildRecords(rawRecords, loadSectionsByTerm()));
  const source = {
    fileName: path.basename(inputPath),
    originalDocument: '20260506_B Wumutijiang Grade Distribution Public Records Act Request.pdf',
    institution: 'Santa Barbara City College',
    gradeColumns: GRADE_COLUMNS,
    suppression: {
      sourceMarker: '*',
      threshold: SUPPRESSION_THRESHOLD,
      representation: `Suppressed grade counts are null in records.grades and listed in records.suppressedGrades. Display them as "<${SUPPRESSION_THRESHOLD}" with range ${SUPPRESSED_MIN}-${SUPPRESSED_MAX}.`,
    },
    enrollmentSource: {
      path: 'app/data/<termCode>/sections.json',
      joinKey: 'term code + CRN',
      caution: 'The enrolled value is the scraped section enrollment reference, not a guaranteed final grade-outcome denominator.',
    },
  };
  const payload = {
    schemaVersion: 1,
    source,
    stats: buildStats(records),
    courses: buildCourseIndex(records),
    records,
  };
  const instructorSummaryPayload = buildInstructorSummaryPayload(records, source);

  ensureParentDirectory(outputJsonPath);
  ensureParentDirectory(outputCsvPath);
  ensureParentDirectory(outputInstructorSummaryPath);

  fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(outputCsvPath, buildCsv(records));
  fs.writeFileSync(outputInstructorSummaryPath, `${JSON.stringify(instructorSummaryPayload, null, 2)}\n`);

  console.log(`Parsed ${records.length} grade distribution records.`);
  console.log(`Wrote ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), outputCsvPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), outputInstructorSummaryPath)}`);
  console.log(`Matched enrollment for ${payload.stats.matchedEnrollmentCount}/${payload.stats.recordCount} records.`);
}

main();
