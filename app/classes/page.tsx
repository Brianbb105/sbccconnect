"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";
import Header from "@/components/Header";

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
};

const DEPARTMENT_FULL_NAMES: Record<string, string> = {
    ACCT: "Accounting",
    ADC: "Addictions Counseling",
    AH: "Allied Health",
    AJ: "Administration of Justice",
    ANTH: "Anthropology",
    ART: "Art",
    ASAM: "Asian American Studies",
    ASL: "American Sign Language",
    AUTO: "Automotive Service and Technology",
    BIOL: "Biology",
    BLAW: "Business Law",
    BLST: "Black Studies",
    BMS: "Biomedical Sciences",
    BOT: "Botany",
    BUS: "Business Administration",
    CA: "Culinary Arts",
    CHEM: "Chemistry",
    CHIN: "Chinese",
    CHST: "Chicana/o Studies",
    CIM: "Cancer Information Management",
    CIS: "Computer Information Systems",
    CNEE: "Computer Network Engineering and Electronics",
    COMM: "Communication",
    COMP: "Computer Applications",
    CS: "Computer Science",
    CSMT: "Cosmetology",
    CT: "Construction Technology",
    DRFT: "Drafting",
    ECE: "Early Childhood Education",
    ECON: "Economics",
    ED: "Education",
    EH: "Environmental Horticulture",
    EMT: "Emergency Medical Technician",
    ENG: "English",
    ENGL: "English",
    ENGR: "Engineering",
    ENT: "Entrepreneurship",
    ENVS: "Environmental Studies",
    ERTH: "Earth Science",
    ESL: "English as a Second Language",
    ETHS: "Ethnic Studies",
    FIN: "Finance",
    FP: "Film Production",
    FR: "French",
    FS: "Film Studies",
    GDP: "Graphic Design and Photography",
    GEOG: "Geography",
    GER: "German",
    GLST: "Global Studies",
    HE: "Health Education",
    HIST: "History",
    HIT: "Health Information Technology",
    HM: "Hospitality Management",
    HNRS: "Honors",
    IBUS: "International Business",
    ID: "Interior Design",
    ITAL: "Italian",
    JAPN: "Japanese",
    JOUR: "Journalism",
    LIBR: "Library",
    MAT: "Multimedia Arts and Technologies",
    MATH: "Mathematics",
    MDT: "Marine Diving Technology",
    MGMT: "Management",
    MKT: "Marketing",
    MUS: "Music",
    NATA: "Native American Studies",
    NURS: "Nursing",
    PD: "Personal Development",
    PE: "Physical Education",
    PHIL: "Philosophy",
    PHOT: "Photography",
    PHSC: "Physical Science",
    PHYS: "Physics",
    POLS: "Political Science",
    PRO: "Professional Development",
    PSY: "Psychology",
    PSYC: "Psychology",
    RE: "Real Estate",
    RT: "Radiographic Technology",
    SOC: "Sociology",
    SPAN: "Spanish",
    SS: "Social Sciences",
    STAT: "Statistics",
    TA: "Theatre Arts",
    TIS: "Translation and Interpretation Studies",
    VN: "Vocational Nursing",
    WEXP: "Work Experience",
    ZOOL: "Zoology",
};

function getSubject(courseStr: string) {
    return (courseStr || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
}

function normalizeIgetc(value: string) {
    return value.trim().toUpperCase().replace(/^IGETC\s*/, "").replace(/\s+/g, "");
}

function getDepartmentFullName(code: string) {
    return DEPARTMENT_FULL_NAMES[code] || code;
}

function DepartmentsPageContent() {
    const searchParams = useSearchParams();
    const [selectedLetter, setSelectedLetter] = useState("ALL");
    const [manualIgetcSelection, setManualIgetcSelection] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const igetcFromUrl = useMemo(() => {
        const igetcParam = searchParams.get("igetc");
        const normalized = igetcParam ? normalizeIgetc(igetcParam) : "";
        return normalized || "ALL";
    }, [searchParams]);

    const selectedIgetc = manualIgetcSelection ?? igetcFromUrl;

    const { departments, groups, alphabet, igetcAreas, igetcCoursesByArea } = useMemo(() => {
        const departmentMap = new Map<string, number>();
        const igetcCourseMap = new Map<string, Map<string, IgetcCourse>>();

        (sectionsData as Section[]).forEach((section) => {
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
                    });
                }

                const entry = courseMapForArea.get(courseCode)!;
                entry.count += 1;
                if (!entry.courseTitle && title) {
                    entry.courseTitle = title;
                }
            });
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
        };
    }, []);

    const { currentDepartments, currentIgetcCourses, isSearching, isIgetcView } = useMemo(() => {
        const searching = searchQuery.trim() !== "";
        const igetcView = !searching && selectedIgetc !== "ALL";

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

        const filteredIgetcCourses = igetcView ? (igetcCoursesByArea[selectedIgetc] || []) : [];

        return {
            currentDepartments: filteredDepartments,
            currentIgetcCourses: filteredIgetcCourses,
            isSearching: searching,
            isIgetcView: igetcView,
        };
    }, [searchQuery, selectedIgetc, selectedLetter, departments, groups, igetcCoursesByArea]);

    const resultCount = isIgetcView ? currentIgetcCourses.length : currentDepartments.length;
    const showAlphabetGroups = !isSearching && !isIgetcView && selectedLetter === "ALL";

    const groupedDepartments = useMemo(() => {
        if (!showAlphabetGroups) return [];
        return alphabet
            .map((letter) => ({ letter, items: groups[letter] || [] }))
            .filter((group) => group.items.length > 0);
    }, [showAlphabetGroups, alphabet, groups]);

    const renderDepartmentCard = (dept: Department) => (
        <Link
            key={dept.name}
            href={`/classes/${dept.name}`}
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

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0f172a]">Departments</h1>
                        <p className="text-slate-500 mt-2">
                            Select a department to view available courses.
                        </p>
                    </div>

                    <div className="w-full md:w-1/3 relative">
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
                </div>

                {!isSearching && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                            <button
                                onClick={() => {
                                    setSelectedLetter("ALL");
                                    setManualIgetcSelection("ALL");
                                }}
                                className={`px-4 h-10 rounded-full font-bold transition-all text-sm ${
                                    selectedLetter === "ALL" && selectedIgetc === "ALL"
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
                                    selectedIgetc === "ALL"
                                        ? "bg-[#0f172a] text-white shadow-md scale-105"
                                        : "bg-gray-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                                }`}
                            >
                                All
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
                            {isSearching
                                ? `Search: "${searchQuery}"`
                                : isIgetcView
                                    ? `IGETC ${selectedIgetc}`
                                    : selectedLetter === "ALL"
                                        ? "All Departments"
                                        : selectedLetter}
                        </span>
                        <span className="text-slate-500 font-normal text-base">
                            {resultCount} Result{resultCount !== 1 && "s"}
                        </span>
                    </h2>

                    {resultCount > 0 ? (
                        isIgetcView ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {currentIgetcCourses.map((course) => (
                                    <Link
                                        key={`${selectedIgetc}-${course.courseCode}`}
                                        href={`/classes/${encodeURIComponent(course.subject)}/${encodeURIComponent(course.courseCode)}`}
                                        className="block group h-full"
                                    >
                                        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-[#0f172a] hover:shadow-md transition-all cursor-pointer h-full flex flex-col justify-center items-center">
                                            <div className="text-xl font-bold text-slate-800 group-hover:text-[#0f172a] mb-1">
                                                {course.courseCode}
                                            </div>
                                            <div className="text-xs text-slate-500 mb-2 line-clamp-2">
                                                {course.courseTitle || "Course title unavailable"}
                                            </div>
                                            <div className="text-sm text-slate-500 font-medium bg-gray-100 px-3 py-1 rounded-full group-hover:bg-slate-100 group-hover:text-[#0f172a] transition-colors">
                                                {course.count} section{course.count !== 1 && "s"}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
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
                                {isIgetcView ? "No classes found for this IGETC area." : "No departments found."}
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
