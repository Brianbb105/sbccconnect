import courseSummaryData from "@/app/data/grade-distributions/sbcc-grade-distribution-course-summaries-2025.json";

export const EASY_GE_MIN_A_RATE_PERCENT = 75;
export const EASY_GE_MIN_EXACT_A_SECTIONS = 2;
export const EASY_GE_MIN_EXACT_A_ENROLLMENT = 30;

export type CourseGradeSummary = {
    courseCode: string;
    subject: string;
    courseNumber: string;
    courseTitle: string | null;
    recordCount: number;
    exactASectionCount: number;
    maskedASectionCount: number;
    exactAEnrollment: number;
    exactACount: number;
    aRate: {
        exact: boolean;
        percent: number | null;
        method: string;
    };
    termCount: number;
    instructorCount: number;
    terms: Array<{
        termCode: string;
        termSlug: string;
        termLabel: string;
    }>;
};

const COURSE_SUMMARIES = (courseSummaryData.summaries ?? []) as CourseGradeSummary[];

const COURSE_SUMMARY_BY_CODE = new Map(
    COURSE_SUMMARIES.map((summary) => [summary.courseCode.toUpperCase(), summary]),
);

export function getCourseGradeSummary(courseCode: string) {
    return COURSE_SUMMARY_BY_CODE.get(courseCode.trim().toUpperCase()) ?? null;
}

export function isEasyGeCourse(summary?: CourseGradeSummary | null) {
    if (!summary?.aRate.exact || typeof summary.aRate.percent !== "number") return false;

    return summary.aRate.percent >= EASY_GE_MIN_A_RATE_PERCENT
        && summary.exactASectionCount >= EASY_GE_MIN_EXACT_A_SECTIONS
        && summary.exactAEnrollment >= EASY_GE_MIN_EXACT_A_ENROLLMENT;
}

export function formatAForRate(percent: number) {
    return `${percent.toFixed(1)}%`;
}

