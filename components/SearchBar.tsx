'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { appendTermToHref, getTermFromSearchParams } from "@/lib/terms";
import { useTermProfessors, useTermSections } from "@/lib/termDataClient";

interface Section {
    courseCode: string;
    courseTitle: string;
    igetc?: string;
    igetcAreas?: string[];
}

interface Professor {
    displayName: string;
    key: string;
}

function normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeIgetc(value: string) {
    return value.trim().toUpperCase().replace(/^IGETC\s*/, "").replace(/\s+/g, "");
}

function getSubject(courseCode: string) {
    return normalizeWhitespace(courseCode).split(/\s+/)[0]?.toUpperCase() || "";
}

function toFullName(displayName: string) {
    if (!displayName.includes(",")) {
        return normalizeWhitespace(displayName);
    }

    const [lastName, ...rest] = displayName.split(",");
    const firstName = rest.join(",").trim();
    return normalizeWhitespace(`${firstName} ${lastName}`);
}

export default function SearchBar() {
    const router = useRouter()
    const searchParams = useSearchParams();
    const currentTerm = getTermFromSearchParams(searchParams);
    const [query, setQuery] = useState('')

    const {
        data: sections,
        loading: sectionsLoading,
    } = useTermSections<Section>(currentTerm.slug);
    const {
        data: professors,
        loading: professorsLoading,
    } = useTermProfessors<Professor>(currentTerm.slug);

    const { subjects, coursesByCode, orderedCourses, igetcAreas } = useMemo(() => {
        const subjectSet = new Set<string>();
        const courseMap = new Map<string, { subject: string; title: string }>();
        const igetcSet = new Set<string>();

        (sections ?? []).forEach((section) => {
            const courseCode = normalizeWhitespace(section.courseCode).toUpperCase();
            if (!courseCode) return;

            const subject = getSubject(courseCode);
            if (subject) {
                subjectSet.add(subject);
            }

            if (!courseMap.has(courseCode)) {
                courseMap.set(courseCode, {
                    subject,
                    title: normalizeWhitespace(section.courseTitle || ""),
                });
            }

            const sectionIgetc = new Set<string>();
            if (section.igetc) {
                sectionIgetc.add(normalizeIgetc(section.igetc));
            }
            if (Array.isArray(section.igetcAreas)) {
                section.igetcAreas.forEach((area) => {
                    sectionIgetc.add(normalizeIgetc(area || ""));
                });
            }
            sectionIgetc.forEach((area) => {
                if (area) {
                    igetcSet.add(area);
                }
            });
        });

        const courseList = Array.from(courseMap.entries())
            .map(([code, value]) => ({
                code,
                subject: value.subject,
                title: value.title,
                searchable: `${code} ${value.title}`.toLowerCase(),
            }))
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        return {
            subjects: subjectSet,
            coursesByCode: new Map(courseList.map((course) => [course.code, course])),
            orderedCourses: courseList,
            igetcAreas: igetcSet,
        };
    }, [sections]);

    const professorList = useMemo(() => {
        return (professors ?? []).map((professor) => {
            const fullName = toFullName(professor.displayName);
            const tokens = fullName.split(/\s+/).filter(Boolean);
            return {
                key: professor.key,
                fullName,
                displayNameLower: normalizeWhitespace(professor.displayName).toLowerCase(),
                lower: fullName.toLowerCase(),
                lastNameLower: tokens[tokens.length - 1]?.toLowerCase() || "",
            };
        });
    }, [professors]);

    const pushWithTerm = (href: string) => {
        router.push(appendTermToHref(href, currentTerm.slug));
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()

        const term = normalizeWhitespace(query)
        if (!term) return

        if ((sectionsLoading && !sections) || (professorsLoading && !professors)) {
            pushWithTerm("/classes");
            return;
        }

        const termUpper = term.toUpperCase();
        const termLower = term.toLowerCase();

        const igetcTerm = normalizeIgetc(term);
        if (igetcTerm && igetcAreas.has(igetcTerm)) {
            pushWithTerm(`/classes?igetc=${encodeURIComponent(igetcTerm)}`);
            return;
        }

        if (subjects.has(termUpper)) {
            pushWithTerm(`/classes/${encodeURIComponent(termUpper)}`);
            return;
        }

        if (coursesByCode.has(termUpper)) {
            const course = coursesByCode.get(termUpper)!;
            pushWithTerm(`/classes/${encodeURIComponent(course.subject)}/${encodeURIComponent(course.code)}`);
            return;
        }

        const compactCourseMatch = termUpper.match(/^([A-Z&]+)\s*([0-9][A-Z0-9-]*)$/);
        if (compactCourseMatch) {
            const normalizedCourseCode = `${compactCourseMatch[1]} ${compactCourseMatch[2]}`;
            if (coursesByCode.has(normalizedCourseCode)) {
                const course = coursesByCode.get(normalizedCourseCode)!;
                pushWithTerm(`/classes/${encodeURIComponent(course.subject)}/${encodeURIComponent(course.code)}`);
                return;
            }
        }

        let professorMatch: { fullName: string; score: number; key: string } | null = null;
        const professorMatches: { fullName: string; score: number; key: string }[] = [];
        for (const professor of professorList) {
            let score = -1;
            if (professor.lower === termLower) score = 0;
            else if (professor.displayNameLower === termLower) score = 0;
            else if (professor.lastNameLower === termLower) score = 1;
            else if (professor.lower.startsWith(termLower)) score = 2;
            else if (professor.displayNameLower.startsWith(termLower)) score = 2;
            else if (professor.lower.includes(termLower)) score = 3;
            else if (professor.displayNameLower.includes(termLower)) score = 3;

            if (score < 0) continue;
            professorMatches.push({ fullName: professor.fullName, score, key: professor.key });
            if (!professorMatch || score < professorMatch.score) {
                professorMatch = { fullName: professor.fullName, score, key: professor.key };
            }
        }

        if (professorMatch) {
            const bestScore = professorMatch.score;
            const bestScoreMatches = professorMatches.filter((match) => match.score === bestScore);

            if (bestScore === 0 && bestScoreMatches.length === 1) {
                pushWithTerm(`/professor/${encodeURIComponent(professorMatch.fullName)}?key=${encodeURIComponent(professorMatch.key)}`);
                return;
            }

            if (professorMatches.length === 1) {
                pushWithTerm(`/professor/${encodeURIComponent(professorMatch.fullName)}?key=${encodeURIComponent(professorMatch.key)}`);
                return;
            }

            pushWithTerm(`/professors?search=${encodeURIComponent(term)}`);
            return;
        }

        const courseByTitleMatch = orderedCourses.find((course) => {
            return course.searchable.includes(termLower);
        });
        if (courseByTitleMatch) {
            pushWithTerm(`/classes/${encodeURIComponent(courseByTitleMatch.subject)}/${encodeURIComponent(courseByTitleMatch.code)}`);
            return;
        }

        const subjectPrefixMatch = Array.from(subjects).sort().find((subject) => subject.startsWith(termUpper));
        if (subjectPrefixMatch) {
            pushWithTerm(`/classes/${encodeURIComponent(subjectPrefixMatch)}`);
            return;
        }

        pushWithTerm(`/classes`);
    }

    const isLoading = (sectionsLoading && !sections) || (professorsLoading && !professors);

    return (
        <form onSubmit={handleSearch} className="flex-1 max-w-xl w-full relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isLoading ? `Loading ${currentTerm.label}...` : `Search ${currentTerm.label} classes, professors, or IGETC...`}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-300 bg-white outline-none text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-300 transition shadow-sm"
            />
        </form>
    )
}

