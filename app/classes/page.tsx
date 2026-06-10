"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getDepartmentFullName } from "@/lib/departments";
import {
    EASY_GE_MIN_A_RATE_PERCENT,
    EASY_GE_MIN_EXACT_A_ENROLLMENT,
    EASY_GE_MIN_EXACT_A_SECTIONS,
    formatAForRate,
    getCourseGradeSummary,
    isEasyGeCourse,
    type CourseGradeSummary,
} from "@/lib/gradeDistribution";
import { useTermSections } from "@/lib/termDataClient";
import { SUPPORTED_TERMS, appendTermToHref, getTermFromSearchParams } from "@/lib/terms";

interface Section {
    courseCode: string;
    courseTitle: string;
    igetc?: string;
    igetcAreas?: string[];
}

type Department = {
    name: string;
    count: number;
};

type IgetcCourse = {
    courseCode: string;
    courseTitle: string;
    subject: string;
    count: number;
    areas: string[];
    gradeSummary: CourseGradeSummary | null;
};

function getSubject(courseStr: string) {
    return (courseStr || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
}

function normalizeIgetc(value: string) {
    return value.trim().toUpperCase().replace(/^IGETC\s*/, "").replace(/\s+/g, "");
}

function DepartmentsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTerm = getTermFromSearchParams(searchParams);
    const { data: sections, loading: sectionsLoading, error: sectionsError } = useTermSections<Section>(currentTerm.slug);
    const [selectedLetter, setSelectedLetter] = useState("ALL");
    const [manualIgetcSelection, setManualIgetcSelection] = useState<string | null>(null);
    const [showEasyOnly, setShowEasyOnly] = useState(searchParams.get("easy") === "1");
    const [searchQuery, setSearchQuery] = useState("");

    const igetcFromUrl = useMemo(() => {
        const igetcParam = searchParams.get("igetc");
        const normalized = igetcParam ? normalizeIgetc(igetcParam) : "";
        return normalized || "ALL";
    }, [searchParams]);

    const selectedIgetc = manualIgetcSelection ?? igetcFromUrl;

    const handleTermChange = (nextTerm: string) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("term", nextTerm);
        router.push(`/classes?${nextParams.toString()}`);
    };

    const { departments, groups, alphabet, igetcAreas, igetcCoursesByArea, allIgetcCourses } = useMemo(() => {
        const departmentMap = new Map<string, number>();
        const igetcCourseMap = new Map<string, Map<string, IgetcCourse>>();
        const allIgetcCourseMap = new Map<string, IgetcCourse>();

        (sections ?? []).forEach((section) => {
            const courseCode = (section.courseCode || "").trim().toUpperCase();
            if (!courseCode) return;

            const subject = getSubject(courseCode);
            if (subject) {
                departmentMap.set(subject, (departmentMap.get(subject) || 0) + 1);
            }

            const title = (section.courseTitle || "").trim();
            const sectionIgetcAreas = new Set<string>();

            if (section.igetc) {
                sectionIgetcAreas.add(normalizeIgetc(section.igetc));
            }

            if (Array.isArray(section.igetcAreas)) {
                section.igetcAreas.forEach((area) => {
                    const normalizedArea = normalizeIgetc(area || "");
                    if (normalizedArea) {
                        sectionIgetcAreas.add(normalizedArea);
                    }
                });
            }

            sectionIgetcAreas.forEach((area) => {
                if (!area) return;

                if (!igetcCourseMap.has(area)) {
                    igetcCourseMap.set(area, new Map<string, IgetcCourse>());
                }

                const courseMapForArea = igetcCourseMap.get(area)!;
                if (!courseMapForArea.has(courseCode)) {
                    courseMapForArea.set(courseCode, {
                        courseCode,
                        courseTitle: title,
                        subject,
                        count: 0,
                        areas: [],
                        gradeSummary: getCourseGradeSummary(courseCode),
                    });
                }

                const areaEntry = courseMapForArea.get(courseCode)!;
                areaEntry.count += 1;
                if (!areaEntry.courseTitle && title) {
                    areaEntry.courseTitle = title;
                }
                if (!areaEntry.areas.includes(area)) {
                    areaEntry.areas.push(area);
                }
            });

            if (sectionIgetcAreas.size > 0) {
                if (!allIgetcCourseMap.has(courseCode)) {
                    allIgetcCourseMap.set(courseCode, {
                        courseCode,
                        courseTitle: title,
                        subject,
                        count: 0,
                        areas: [],
                        gradeSummary: getCourseGradeSummary(courseCode),
                    });
                }

                const allEntry = allIgetcCourseMap.get(courseCode)!;
                allEntry.count += 1;
                if (!allEntry.courseTitle && title) {
                    allEntry.courseTitle = title;
                }
                sectionIgetcAreas.forEach((area) => {
                    if (!allEntry.areas.includes(area)) {
                        allEntry.areas.push(area);
                    }
                });
            }
        });

        const sortedDepartments: Department[] = Array.from(departmentMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const groupedDepartments: Record<string, Department[]> = {};
        sortedDepartments.forEach((department) => {
            const letter = department.name[0]?.toUpperCase() || "#";
            const key = /[A-Z]/.test(letter) ? letter : "#";

            if (!groupedDepartments[key]) groupedDepartments[key] = [];
            groupedDepartments[key].push(department);
        });

        const igetcAreaList = Array.from(igetcCourseMap.keys()).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );

        const igetcCourseResults: Record<string, IgetcCourse[]> = {};
        igetcAreaList.forEach((area) => {
            const entries = Array.from(igetcCourseMap.get(area)?.values() || []);
            igetcCourseResults[area] = entries.sort((a, b) =>
                a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true })
            );
        });

        return {
            departments: sortedDepartments,
            groups: groupedDepartments,
            alphabet: Object.keys(groupedDepartments).sort(),
            igetcAreas: igetcAreaList,
            igetcCoursesByArea: igetcCourseResults,
            allIgetcCourses: Array.from(allIgetcCourseMap.values()).sort((a, b) =>
                a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true })
            ),
        };
    }, [sections]);

    const { currentDepartments, currentIgetcCourses, isSearching, isIgetcView } = useMemo(() => {
        const searching = searchQuery.trim() !== "";
        const igetcView = !searching && (selectedIgetc !== "ALL" || showEasyOnly);

        const departmentSearchResults = searching
            ? departments.filter((department) =>
                department.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : [];

        const filteredDepartments = searching
            ? departmentSearchResults
            : selectedLetter === "ALL"
                ? departments
                : (groups[selectedLetter] || []);

        const sourceIgetcCourses = selectedIgetc === "ALL"
            ? allIgetcCourses
            : (igetcCoursesByArea[selectedIgetc] || []);
        const filteredIgetcCourses = igetcView
            ? sourceIgetcCourses
                .filter((course) => !showEasyOnly || isEasyGeCourse(course.gradeSummary))
                .sort((a, b) => {
                    if (!showEasyOnly) {
                        return a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true });
                    }

                    const aRate = a.gradeSummary?.aRate.percent ?? -1;
                    const bRate = b.gradeSummary?.aRate.percent ?? -1;
                    if (aRate !== bRate) return bRate - aRate;
                    return a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true });
                })
            : [];

        return {
            currentDepartments: filteredDepartments,
            currentIgetcCourses: filteredIgetcCourses,
            isSearching: searching,
            isIgetcView: igetcView,
        };
    }, [searchQuery, selectedIgetc, showEasyOnly, selectedLetter, departments, groups, igetcCoursesByArea, allIgetcCourses]);

    const resultCount = isIgetcView ? currentIgetcCourses.length : currentDepartments.length;
    const showAlphabetGroups = !isSearching && !isIgetcView && selectedLetter === "ALL";

    const groupedDepartments = useMemo(() => {
        if (!showAlphabetGroups) return [];
        return alphabet
            .map((letter) => ({ letter, items: groups[letter] || [] }))
            .filter((group) => group.items.length > 0);
    }, [showAlphabetGroups, alphabet, groups]);

    const resultHeadingLabel = isSearching
        ? `Search: "${searchQuery}"`
        : isIgetcView
            ? showEasyOnly
                ? selectedIgetc === "ALL"
                    ? "Easy GEs"
                    : `Easy IGETC ${selectedIgetc}`
                : `IGETC ${selectedIgetc}`
            : selectedLetter === "ALL"
                ? "All Departments"
                : selectedLetter;

    const renderDepartmentCard = (dept: Department) => (
        <Link
            key={dept.name}
            href={appendTermToHref(`/classes/${dept.name}`, currentTerm.slug)}
            className="block group h-full"
        >
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-[#0f172a] hover:shadow-md transition-all cursor-pointer h-full flex flex-col justify-center items-center">
                <div className="text-2xl font-bold text-slate-800 group-hover:text-[#0f172a] mb-1">
                    {dept.name}
                </div>
                <div className="text-xs text-slate-500 mb-2">
                    {getDepartmentFullName(dept.name)}
                </div>
                <div className="text-sm text-slate-500 font-medium bg-gray-100 px-3 py-1 rounded-full group-hover:bg-slate-100 group-hover:text-[#0f172a] transition-colors">
                    {dept.count} classes
                </div>
            </div>
        </Link>
    );

    const renderIgetcCourseCard = (course: IgetcCourse) => {
        const gradeSummary = course.gradeSummary;
        const aRatePercent = gradeSummary?.aRate.exact && typeof gradeSummary.aRate.percent === "number"
            ? gradeSummary.aRate.percent
            : null;
        const easyCourse = isEasyGeCourse(gradeSummary);
        const areasLabel = course.areas.length > 0
            ? `IGETC ${course.areas.slice(0, 4).join(", ")}${course.areas.length > 4 ? ` +${course.areas.length - 4}` : ""}`
            : "";

        return (
            <Link
                key={`${selectedIgetc}-${course.courseCode}`}
                href={appendTermToHref(`/classes/${encodeURIComponent(course.subject)}/${encodeURIComponent(course.courseCode)}`, currentTerm.slug)}
                className="block group h-full"
            >
                <div className="bg-white border border-gray-200 rounded-xl p-5 text-center hover:border-[#0f172a] hover:shadow-md transition-all cursor-pointer h-full flex flex-col justify-center items-center">
                    <div className="text-xl font-bold text-slate-800 group-hover:text-[#0f172a] mb-1">
                        {course.courseCode}
                    </div>
                    <div className="text-xs text-slate-500 mb-2 line-clamp-2">
                        {course.courseTitle || "Course title unavailable"}
                    </div>

                    {showEasyOnly && selectedIgetc === "ALL" && areasLabel ? (
                        <div className="mb-2 text-[11px] font-semibold leading-tight text-indigo-700">
                            {areasLabel}
                        </div>
                    ) : null}

                    <div className="flex flex-col items-center gap-2">
                        <div className="text-sm text-slate-500 font-medium bg-gray-100 px-3 py-1 rounded-full group-hover:bg-slate-100 group-hover:text-[#0f172a] transition-colors">
                            {course.count} section{course.count !== 1 && "s"}
                        </div>

                        {aRatePercent !== null && gradeSummary ? (
                            <>
                                <div className={`text-sm font-bold px-3 py-1 rounded-full border ${
                                    easyCourse
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}>
                                    {formatAForRate(aRatePercent)} A rate
                                </div>
                                <div className="text-[11px] font-medium leading-tight text-slate-500">
                                    {gradeSummary.exactASectionCount} grade section{gradeSummary.exactASectionCount !== 1 && "s"} | {gradeSummary.exactAEnrollment} students
                                </div>
                            </>
                        ) : (
                            <div className="text-[11px] font-semibold leading-tight text-slate-400">
                                A rate masked
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0f172a]">Departments</h1>
                        <p className="text-slate-500 mt-2">
                            {currentTerm.label} • Select a department to view available courses.
                        </p>
                    </div>

                    <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 md:items-center">
                        <div className="relative w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Find a department (e.g. CS)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] outline-none shadow-sm transition-all"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="sr-only" htmlFor="term-select">Term</label>
                            <select
                                id="term-select"
                                value={currentTerm.slug}
                                onChange={(e) => handleTermChange(e.target.value)}
                                className="px-4 pr-10 h-12 rounded-xl font-bold transition-all text-sm bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0f172a] border border-slate-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 min-w-[150px]"
                            >
                                {SUPPORTED_TERMS.map((term) => (
                                    <option key={term.slug} value={term.slug}>
                                        {term.label}
                                    </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                                ▾
                            </span>
                        </div>
                    </div>
                </div>

                {(sectionsLoading && !sections) ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center mb-8">
                        <p className="text-slate-500">Loading {currentTerm.label} departments...</p>
                    </div>
                ) : sectionsError ? (
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center mb-8">
                        <p className="text-red-700 font-medium">Failed to load {currentTerm.label} data.</p>
                    </div>
                ) : null}

                {!isSearching && !(sectionsLoading && !sections) && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                            <button
                                onClick={() => {
                                    setSelectedLetter("ALL");
                                    setManualIgetcSelection("ALL");
                                    setShowEasyOnly(false);
                                }}
                                className={`px-4 h-10 rounded-full font-bold transition-all text-sm ${
                                    selectedLetter === "ALL" && selectedIgetc === "ALL" && !showEasyOnly
                                        ? "bg-[#0f172a] text-white shadow-md scale-105"
                                        : "bg-gray-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                                }`}
                            >
                                All
                            </button>

                            <div className="w-px bg-gray-300 mx-1 h-6 self-center"></div>

                            {alphabet.map((letter) => {
                                const isActive = selectedIgetc === "ALL" && selectedLetter === letter;
                                return (
                                    <button
                                        key={letter}
                                        onClick={() => {
                                            setSelectedLetter(letter);
                                            setManualIgetcSelection("ALL");
                                            setShowEasyOnly(false);
                                        }}
                                        className={`w-10 h-10 rounded-full font-bold transition-all ${
                                            isActive
                                                ? "bg-[#0f172a] text-white shadow-md scale-110"
                                                : "bg-gray-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                                        }`}
                                    >
                                        {letter}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-10 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                            <button
                                onClick={() => setManualIgetcSelection("ALL")}
                                className={`px-4 h-10 rounded-full font-bold transition-all text-sm ${
                                    selectedIgetc === "ALL" && !showEasyOnly
                                        ? "bg-[#0f172a] text-white shadow-md scale-105"
                                        : "bg-gray-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                                }`}
                            >
                                All
                            </button>

                            <button
                                onClick={() => {
                                    setSelectedLetter("ALL");
                                    setShowEasyOnly((value) => !value);
                                }}
                                title={`Easy GEs require ${EASY_GE_MIN_A_RATE_PERCENT}%+ exact A rate, ${EASY_GE_MIN_EXACT_A_SECTIONS}+ exact grade sections, and ${EASY_GE_MIN_EXACT_A_ENROLLMENT}+ exact enrolled students.`}
                                className={`px-4 h-10 rounded-full font-bold transition-all text-sm ${
                                    showEasyOnly
                                        ? "bg-emerald-700 text-white shadow-md scale-105"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                Easy GEs
                            </button>

                            <div className="w-px bg-gray-300 mx-1 h-6 self-center"></div>

                            {igetcAreas.map((area) => {
                                const isActive = selectedIgetc === area;
                                return (
                                    <button
                                        key={area}
                                        onClick={() => setManualIgetcSelection(area)}
                                        className={`px-4 h-10 rounded-full font-bold transition-all text-sm ${
                                            isActive
                                                ? "bg-[#0f172a] text-white shadow-md scale-105"
                                                : "bg-gray-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                                        }`}
                                    >
                                        IGETC {area}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg ${
                            isSearching || selectedLetter === "ALL" || isIgetcView
                                ? "bg-slate-100 text-slate-700"
                                : "bg-slate-200 text-[#0f172a]"
                        }`}>
                            {resultHeadingLabel}
                        </span>
                        <span className="text-slate-500 font-normal text-base">
                            {resultCount} Result{resultCount !== 1 && "s"}
                        </span>
                    </h2>

                    {resultCount > 0 ? (
                        isIgetcView ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {currentIgetcCourses.map(renderIgetcCourseCard)}
                            </div>
                        ) : (
                            showAlphabetGroups ? (
                                <div className="space-y-10">
                                    {groupedDepartments.map((group) => (
                                        <div key={group.letter}>
                                            <h3 className="text-2xl font-bold text-[#0f172a] mb-4">
                                                {group.letter}
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                {group.items.map(renderDepartmentCard)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {currentDepartments.map(renderDepartmentCard)}
                                </div>
                            )
                        )
                    ) : (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <p className="text-slate-400 text-lg">
                                {isIgetcView
                                    ? showEasyOnly
                                        ? "No easy GE classes match this selection."
                                        : "No classes found for this IGETC area."
                                    : "No departments found."}
                            </p>
                            {isSearching && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="mt-4 text-[#0f172a] font-semibold hover:underline"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-12">
                    <Link href="/" className="text-[#0f172a] font-semibold hover:underline flex items-center gap-2">
                        ← Back home
                    </Link>
                </div>
            </main>
        </div>
    );
}

function DepartmentsPageFallback() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />
            <main className="max-w-6xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                    <p className="text-slate-500">Loading departments...</p>
                </div>
            </main>
        </div>
    );
}

export default function DepartmentsPage() {
    return (
        <Suspense fallback={<DepartmentsPageFallback />}>
            <DepartmentsPageContent />
        </Suspense>
    );
}
