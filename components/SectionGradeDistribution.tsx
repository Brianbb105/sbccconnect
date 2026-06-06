import instructorSummaryData from "@/app/data/grade-distributions/sbcc-grade-distribution-instructor-course-summaries-2025.json";

type GradeKey = "A" | "B" | "C" | "D" | "F";

type GradeAggregate = {
    min: number;
    max: number;
    exact: boolean;
    suppressedBucketCount?: number;
};

type TermGradeSummary = {
    termCode: string;
    termLabel: string;
    crn?: string;
    sectionCount: number;
    totalEnrollment: number;
    aRate?: {
        exact: boolean;
        percent: number | null;
        sourceSectionCount: number;
        method: string;
    };
    grades: Record<GradeKey, GradeAggregate>;
};

type InstructorCourseSummarySource = {
    courseCode: string;
    primaryInstructor: string;
    terms: TermGradeSummary[];
};

type TermSeason = "spring" | "summer" | "fall";

type TermDisplaySummary = TermGradeSummary & {
    gradeRows: Array<{
        key: GradeKey;
        value: string;
        chartValue: number;
        exact: boolean;
    }>;
    aRateDisplay: {
        value: string;
        toneRate: number | null;
        exact: boolean;
        sourceSectionCount: number;
    };
};

const HISTORICAL_SUMMARIES = (instructorSummaryData.summaries ?? []) as InstructorCourseSummarySource[];
const GRADE_KEYS: GradeKey[] = ["A", "B", "C", "D", "F"];

function normalizeName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getTermSeason(termCode: string): TermSeason | null {
    if (termCode.endsWith("50")) return "spring";
    if (termCode.endsWith("10")) return "summer";
    if (termCode.endsWith("30")) return "fall";
    return null;
}

function formatCountValue(aggregate: GradeAggregate) {
    if (aggregate.exact) return String(aggregate.min);
    return "Masked";
}

function formatPercent(value: number) {
    return `${value.toFixed(2)}%`;
}

function formatRateValue(term: TermGradeSummary) {
    if (term.aRate?.exact && typeof term.aRate.percent === "number") {
        return {
            value: formatPercent(term.aRate.percent),
            toneRate: term.aRate.percent,
            exact: true,
            sourceSectionCount: term.aRate.sourceSectionCount,
        };
    }

    const aggregate = term.grades.A;
    const totalEnrollment = term.totalEnrollment;
    const minRate = (aggregate.min / totalEnrollment) * 100;

    if (aggregate.exact) {
        return {
            value: formatPercent(minRate),
            toneRate: minRate,
            exact: true,
            sourceSectionCount: 1,
        };
    }

    return {
        value: "Masked",
        toneRate: null,
        exact: false,
        sourceSectionCount: 0,
    };
}

function getRateTone(rate: number | null) {
    if (rate === null) {
        return "border-slate-200 bg-white text-slate-600";
    }
    if (rate >= 50) {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }
    if (rate >= 30) {
        return "border-green-200 bg-green-50 text-green-700";
    }
    if (rate >= 10) {
        return "border-yellow-200 bg-yellow-50 text-yellow-800";
    }
    return "border-red-200 bg-red-50 text-red-700";
}

function getChartMax(gradeRows: TermDisplaySummary["gradeRows"]) {
    const exactMax = Math.max(...gradeRows.map((row) => row.chartValue), 0);
    if (exactMax <= 0) return 10;
    return Math.max(10, Math.ceil(exactMax / 10) * 10);
}

function formatAxisLabel(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function GradeDistributionChart({ gradeRows }: { gradeRows: TermDisplaySummary["gradeRows"] }) {
    const chartMax = getChartMax(gradeRows);
    const axisLabels = [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0];

    return (
        <div className="mt-5">
            <div className="grid grid-cols-[2.5rem_1fr] gap-3">
                <div className="flex h-48 flex-col justify-between text-right text-xs font-semibold text-slate-500">
                    {axisLabels.map((label) => (
                        <span key={label}>{formatAxisLabel(label)}</span>
                    ))}
                </div>

                <div
                    className="relative h-48 border-b border-slate-400"
                    aria-label="Grade count bar chart"
                >
                    {axisLabels.slice(0, -1).map((label) => (
                        <div
                            key={label}
                            className="absolute left-0 right-0 border-t border-slate-300"
                            style={{ top: `${((chartMax - label) / chartMax) * 100}%` }}
                        />
                    ))}

                    <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                        {gradeRows.map((grade) => {
                            const heightPercent = (grade.chartValue / chartMax) * 100;

                            return (
                                <div key={grade.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                                    <div className="mb-2 min-h-5 text-center text-xs font-bold text-slate-700">
                                        {grade.exact ? grade.value : "M"}
                                    </div>
                                    <div
                                        className={`w-full max-w-14 rounded-t-sm ${grade.exact ? "bg-sky-400" : "bg-slate-300"}`}
                                        style={{ height: `${heightPercent}%` }}
                                        title={`${grade.key}: ${grade.value}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="ml-[3.25rem] mt-3 grid grid-cols-5 gap-2 text-center text-base font-extrabold text-slate-900">
                {gradeRows.map((grade) => (
                    <span key={grade.key}>{grade.key}</span>
                ))}
            </div>
        </div>
    );
}

function getTermDisplaySummaries(
    courseCode: string,
    instructorName: string,
    currentTermCode: string,
): TermDisplaySummary[] {
    const normalizedInstructor = normalizeName(instructorName);
    const summarySource = HISTORICAL_SUMMARIES.find((entry) => (
        entry.courseCode === courseCode
        && normalizeName(entry.primaryInstructor) === normalizedInstructor
    ));
    const currentSeason = getTermSeason(currentTermCode);
    const terms = summarySource?.terms.filter((term) => (
        term.termCode < currentTermCode
        && getTermSeason(term.termCode) === currentSeason
        && term.totalEnrollment > 0
    )) ?? [];

    return terms.map((term) => ({
        ...term,
        gradeRows: GRADE_KEYS.map((key) => {
            const aggregate = term.grades[key];

            return {
                key,
                value: formatCountValue(aggregate),
                chartValue: aggregate.exact ? aggregate.min : 0,
                exact: aggregate.exact,
            };
        }),
        aRateDisplay: formatRateValue(term),
    }));
}

export default function SectionGradeDistribution({
    courseCode,
    currentTermCode,
    instructorName,
}: {
    courseCode: string;
    currentTermCode: string;
    instructorName: string;
}) {
    const termSummaries = getTermDisplaySummaries(courseCode, instructorName, currentTermCode);
    if (termSummaries.length === 0) return null;
    const termGridClass = termSummaries.length === 1
        ? "mt-5 grid gap-4 md:grid-cols-[minmax(0,28rem)] md:justify-center"
        : "mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3";
    const hasMultipleSectionSelection = termSummaries.some((term) => term.sectionCount > 1);
    const hasMaskedValues = termSummaries.some((term) => (
        !term.aRateDisplay.exact || GRADE_KEYS.some((key) => !term.grades[key].exact)
    ));

    return (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Instructor Grade Distribution From Previous Terms
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    {instructorName} | same course and term season | exact rates use enrolled students
                </p>
            </div>

            <div className={termGridClass}>
                {termSummaries.map((term) => {
                    const aRateTone = getRateTone(term.aRateDisplay.toneRate);

                    return (
                        <article key={term.termCode} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="whitespace-nowrap text-lg font-extrabold text-slate-900">{term.termLabel}</h3>

                                    <div
                                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm ${aRateTone}`}
                                        title={term.aRateDisplay.sourceSectionCount > 1
                                            ? `A rate averages ${term.aRateDisplay.sourceSectionCount} sections with visible A counts.`
                                            : undefined}
                                    >
                                        <span className="text-[10px] font-extrabold uppercase tracking-wide opacity-75">A Rate</span>
                                        <span className="text-sm font-extrabold leading-none">{term.aRateDisplay.value}</span>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600">
                                    {term.crn ? `CRN ${term.crn} | ` : null}{term.totalEnrollment} enrolled
                                </p>
                            </div>

                            <GradeDistributionChart gradeRows={term.gradeRows} />
                        </article>
                    );
                })}
            </div>

            {hasMaskedValues || hasMultipleSectionSelection ? (
                <p className="mt-3 text-xs font-medium text-slate-500">
                    {hasMaskedValues ? "SBCC suppresses grade buckets below 10 students; masked values are shown as zero-height bars, and M means masked." : ""}
                    {hasMultipleSectionSelection ? " When multiple prior sections exist, the chart shows one A-prioritized CRN while A rate averages sections with visible A counts." : ""}
                </p>
            ) : null}
        </section>
    );
}
