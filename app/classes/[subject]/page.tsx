"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";
import Header from "@/components/Header";

interface Section {
    courseCode: string;
    courseTitle: string;
    courseDescription?: string;
    prerequisitesText?: string;
    prerequisites?: string[];
    units?: string;
    modality?: "OL" | "HY" | "IP";
}

function clean(value?: string) {
    return String(value || "").trim();
}

function getSubject(courseStr: string) {
    return clean(courseStr).split(/\s+/)[0] || "";
}

function summarizeModalities(modalities: string[]) {
    const set = new Set(modalities);
    if (set.has("HY")) return "Hybrid";
    if (set.has("OL") && set.has("IP")) return "Mixed";
    if (set.has("OL")) return "Online";
    return "In Person";
}

function extractPrerequisites(section: Section) {
    if (Array.isArray(section.prerequisites) && section.prerequisites.length > 0) {
        return section.prerequisites.map((item) => clean(item)).filter(Boolean);
    }

    const fallbackText = clean(section.prerequisitesText);
    if (!fallbackText) return [];

    return fallbackText
        .split(/(?:\s*;\s*|\s*\|\s*|\.\s+(?=(?:[A-Z]{2,6}\s*\d{1,3}[A-Z]?|Prereq|Prerequisite|Corequisite|Advisory)))/i)
        .map((item) => clean(item))
        .filter(Boolean);
}

function clipText(text: string, maxLength = 160) {
    const normalized = clean(text);
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export default function CoursesPage() {
    const params = useParams();
    const subject = decodeURIComponent(params.subject as string);
    const allSections = useMemo(() => sectionsData as Section[], []);

    const courses = useMemo(() => {
        const grouped = new Map<string, {
            title: string;
            count: number;
            description: string;
            prerequisites: string[];
            units: Set<string>;
            modalities: Set<string>;
        }>();

        allSections.forEach((section) => {
            const sSubject = getSubject(section.courseCode);
            if (sSubject !== subject) return;

            if (!grouped.has(section.courseCode)) {
                grouped.set(section.courseCode, {
                    title: section.courseTitle,
                    count: 0,
                    description: clean(section.courseDescription),
                    prerequisites: extractPrerequisites(section),
                    units: new Set<string>(),
                    modalities: new Set<string>(),
                });
            }

            const entry = grouped.get(section.courseCode)!;
            entry.count += 1;
            if (!entry.description && clean(section.courseDescription)) {
                entry.description = clean(section.courseDescription);
            }
            if (!entry.prerequisites.length) {
                entry.prerequisites = extractPrerequisites(section);
            }
            if (clean(section.units)) entry.units.add(clean(section.units));
            if (clean(section.modality)) entry.modalities.add(clean(section.modality));
        });

        return Array.from(grouped.entries())
            .map(([courseCode, value]) => ({
                courseCode,
                ...value,
            }))
            .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
    }, [allSections, subject]);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <div className="text-sm text-slate-500 mb-2">
                        <Link href="/classes" className="hover:underline">Departments</Link> &gt; {subject}
                    </div>
                    <h1 className="text-3xl font-bold text-[#0f172a]">{subject} Courses</h1>
                    <p className="text-slate-500 mt-1">
                        Found {courses.length} courses in {subject}.
                    </p>
                </div>

                <div className="grid gap-4">
                    {courses.map((course) => {
                        const prerequisiteCount = course.prerequisites.length;
                        const modalityLabel = summarizeModalities(Array.from(course.modalities));
                        const unitsLabel = Array.from(course.units)[0] || "TBA";

                        return (
                            <div
                                key={course.courseCode}
                                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-slate-200 transition-all"
                            >
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-xl font-bold text-slate-800">{course.courseCode}</div>
                                        <div className="text-slate-600 font-medium">{course.title}</div>
                                        <p className="mt-2 text-sm text-slate-500">
                                            {course.description
                                                ? clipText(course.description)
                                                : "Course description will appear after extraction completes."}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                Sections {course.count}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                Units {unitsLabel}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                Modality {modalityLabel}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                Prereqs {prerequisiteCount}
                                            </span>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/classes/${encodeURIComponent(subject)}/${encodeURIComponent(course.courseCode)}`}
                                        className="px-5 py-2 rounded-lg bg-slate-100 text-[#0f172a] font-semibold hover:bg-[#0f172a] hover:text-white transition-colors text-sm whitespace-nowrap"
                                    >
                                        View Sections →
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12">
                    <Link href="/classes" className="text-[#0f172a] font-semibold hover:underline">
                        ← Back to Departments
                    </Link>
                </div>
            </main>
        </div>
    );
}
