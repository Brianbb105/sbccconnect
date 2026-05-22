import { getDepartmentFullName } from "@/lib/departments";

export type SearchSuggestionKind = "department" | "course" | "instructor" | "igetc";

export type SearchSuggestion = {
    id: string;
    kind: SearchSuggestionKind;
    label: string;
    typeLabel: string;
    value: string;
    href: string;
};

type SearchSection = {
    courseCode?: string;
    courseTitle?: string;
    igetc?: string;
    igetcAreas?: string[];
};

type SearchProfessor = {
    displayName?: string;
    key?: string;
};

type SearchSuggestionData = {
    sections?: SearchSection[] | null;
    professors?: SearchProfessor[] | null;
    limit?: number;
};

type RankedSuggestion = SearchSuggestion & {
    score: number;
    sortLabel: string;
};

function toSearchSuggestion(suggestion: RankedSuggestion): SearchSuggestion {
    return {
        id: suggestion.id,
        kind: suggestion.kind,
        label: suggestion.label,
        typeLabel: suggestion.typeLabel,
        value: suggestion.value,
        href: suggestion.href,
    };
}

function normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeSearchText(value: string) {
    return normalizeWhitespace(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function compactSearchText(value: string) {
    return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
}

function normalizeCourseCode(value: string) {
    return normalizeWhitespace(value).toUpperCase();
}

function normalizeIgetc(value: string) {
    return value.trim().toUpperCase().replace(/^IGETC\s*/, "").replace(/\s+/g, "");
}

function getSubject(courseCode: string) {
    return normalizeCourseCode(courseCode).split(/\s+/)[0] || "";
}

function toFullName(displayName: string) {
    if (!displayName.includes(",")) {
        return normalizeWhitespace(displayName);
    }

    const [lastName, ...rest] = displayName.split(",");
    const firstName = rest.join(",").trim();
    return normalizeWhitespace(`${firstName} ${lastName}`);
}

function startsWithWord(value: string, query: string) {
    return value.split(/\s+/).some((part) => part.startsWith(query));
}

function encodePathSegment(value: string) {
    return encodeURIComponent(value);
}

function scoreDepartment(query: string, compactQuery: string, code: string, name: string) {
    const normalizedCode = normalizeSearchText(code);
    const normalizedName = normalizeSearchText(name);
    const compactCode = compactSearchText(code);

    if (normalizedCode === query || compactCode === compactQuery) return 0;
    if (normalizedCode.startsWith(query) || compactCode.startsWith(compactQuery)) return 10;
    if (normalizedName === query) return 12;
    if (normalizedName.startsWith(query)) return 20;
    if (startsWithWord(normalizedName, query)) return 25;
    if (normalizedName.includes(query)) return 70;
    if (normalizedCode.includes(query)) return 80;
    return null;
}

function scoreCourse(query: string, compactQuery: string, code: string, title: string) {
    const normalizedCode = normalizeSearchText(code);
    const compactCode = compactSearchText(code);
    const subject = getSubject(code);
    const normalizedSubject = normalizeSearchText(subject);
    const compactSubject = compactSearchText(subject);
    const normalizedTitle = normalizeSearchText(title);

    if (normalizedCode === query || compactCode === compactQuery) return 5;
    if (normalizedSubject === query || compactSubject === compactQuery) return 8;
    if (normalizedCode.startsWith(query) || compactCode.startsWith(compactQuery)) return 18;
    if (normalizedCode.includes(query) || compactCode.includes(compactQuery)) return 45;
    if (normalizedTitle === query) return 48;
    if (normalizedTitle.startsWith(query)) return 50;
    if (startsWithWord(normalizedTitle, query)) return 55;
    if (normalizedTitle.includes(query)) return 85;
    return null;
}

function scoreInstructor(query: string, fullName: string, displayName: string) {
    const normalizedFullName = normalizeSearchText(fullName);
    const normalizedDisplayName = normalizeSearchText(displayName);
    const nameTokens = normalizedFullName.split(/\s+/).filter(Boolean);
    const lastName = nameTokens[nameTokens.length - 1] || "";

    if (normalizedFullName === query || normalizedDisplayName === query) return 30;
    if (lastName === query) return 32;
    if (normalizedFullName.startsWith(query) || normalizedDisplayName.startsWith(query)) return 35;
    if (startsWithWord(normalizedFullName, query) || startsWithWord(normalizedDisplayName, query)) return 40;
    if (normalizedFullName.includes(query) || normalizedDisplayName.includes(query)) return 90;
    return null;
}

function scoreIgetc(query: string, compactQuery: string, area: string) {
    const label = `igetc ${area}`.toLowerCase();
    const compactLabel = compactSearchText(label);
    const compactArea = compactSearchText(area);

    if (compactArea === compactQuery || compactLabel === compactQuery) return 22;
    if (compactArea.startsWith(compactQuery) || compactLabel.startsWith(compactQuery)) return 35;
    if (label.includes(query)) return 88;
    return null;
}

export function getSearchSuggestions(query: string, data: SearchSuggestionData): SearchSuggestion[] {
    const normalizedQuery = normalizeSearchText(query);
    const compactQuery = compactSearchText(query);
    const limit = data.limit ?? 8;

    if (!normalizedQuery || !compactQuery) return [];

    const suggestions: RankedSuggestion[] = [];
    const departments = new Set<string>();
    const courses = new Map<string, { subject: string; title: string }>();
    const igetcAreas = new Set<string>();

    for (const section of data.sections ?? []) {
        const courseCode = normalizeCourseCode(section.courseCode || "");
        if (!courseCode) continue;

        const subject = getSubject(courseCode);
        if (subject) {
            departments.add(subject);
        }

        if (!courses.has(courseCode)) {
            courses.set(courseCode, {
                subject,
                title: normalizeWhitespace(section.courseTitle || ""),
            });
        }

        const areas = new Set<string>();
        if (section.igetc) {
            areas.add(normalizeIgetc(section.igetc));
        }
        if (Array.isArray(section.igetcAreas)) {
            section.igetcAreas.forEach((area) => areas.add(normalizeIgetc(area || "")));
        }
        areas.forEach((area) => {
            if (area) igetcAreas.add(area);
        });
    }

    // Ranking uses lower scores for better matches. Code and exact prefix matches
    // intentionally outrank broad contains matches so "anth" returns ANTH first.
    for (const code of departments) {
        const name = getDepartmentFullName(code);
        const score = scoreDepartment(normalizedQuery, compactQuery, code, name);
        if (score === null) continue;

        suggestions.push({
            id: `department:${code}`,
            kind: "department",
            label: `${code} - ${name}`,
            typeLabel: "Department",
            value: code,
            href: `/classes/${encodePathSegment(code)}`,
            score,
            sortLabel: code,
        });
    }

    for (const [code, course] of courses) {
        const score = scoreCourse(normalizedQuery, compactQuery, code, course.title);
        if (score === null) continue;

        suggestions.push({
            id: `course:${code}`,
            kind: "course",
            label: course.title ? `${code} - ${course.title}` : code,
            typeLabel: "Course",
            value: code,
            href: `/classes/${encodePathSegment(course.subject)}/${encodePathSegment(code)}`,
            score,
            sortLabel: code,
        });
    }

    for (const area of igetcAreas) {
        const score = scoreIgetc(normalizedQuery, compactQuery, area);
        if (score === null) continue;

        suggestions.push({
            id: `igetc:${area}`,
            kind: "igetc",
            label: `IGETC ${area} - Area`,
            typeLabel: "IGETC",
            value: `IGETC ${area}`,
            href: `/classes?igetc=${encodeURIComponent(area)}`,
            score,
            sortLabel: area,
        });
    }

    for (const professor of data.professors ?? []) {
        const displayName = normalizeWhitespace(professor.displayName || "");
        const key = normalizeWhitespace(professor.key || displayName);
        if (!displayName) continue;

        const fullName = toFullName(displayName);
        const score = scoreInstructor(normalizedQuery, fullName, displayName);
        if (score === null) continue;

        suggestions.push({
            id: `instructor:${key}`,
            kind: "instructor",
            label: `${fullName} - Instructor`,
            typeLabel: "Instructor",
            value: fullName,
            href: `/professor/${encodePathSegment(fullName)}?key=${encodeURIComponent(key)}`,
            score,
            sortLabel: fullName,
        });
    }

    return suggestions
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.sortLabel.localeCompare(b.sortLabel, undefined, { numeric: true, sensitivity: "base" });
        })
        .slice(0, limit)
        .map(toSearchSuggestion);
}
