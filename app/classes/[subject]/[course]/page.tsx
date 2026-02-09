"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";
import Header from "@/components/Header";

interface Meeting {
    type?: string;
    days: string;
    time: string;
    location: string;
    googleMapsUrl?: string;
    instructor: string;
    dateRange?: string;
}

interface Section {
    crn: string;
    status: string;
    courseCode: string;
    courseTitle: string;
    igetc?: string;
    igetcAreas?: string[];
    courseDescription?: string;
    prerequisitesText?: string;
    prerequisites?: string[];
    units: string;
    modality: "OL" | "HY" | "IP";
    meetings: Meeting[];
    enrolled: string;
    capacity: string;
}

function clean(value?: string) {
    return String(value || "").trim();
}

function isUnknownOrTBA(value?: string) {
    const normalized = clean(value).toLowerCase();
    return normalized === ""
        || normalized === "tba"
        || normalized === "check link"
        || normalized === "unknown"
        || normalized === "staff"
        || normalized === "sbff";
}

function clipText(text: string, maxLength = 220) {
    const normalized = clean(text);
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getStatusBadge(status: string) {
    const normalized = clean(status).toLowerCase();
    if (normalized.includes("waitlist") || normalized.includes("wait")) {
        return { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Waitlisted" };
    }
    if (normalized.includes("closed") || normalized.includes("full")) {
        return { color: "bg-red-100 text-red-700 border-red-200", label: "Closed" };
    }
    if (normalized.includes("add code")) {
        return { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Open With Add Code" };
    }
    if (normalized.includes("open")) {
        return { color: "bg-green-100 text-green-700 border-green-200", label: "Open" };
    }
    return { color: "bg-purple-100 text-purple-700 border-purple-200", label: status || "Add Code" };
}

function getModalityBadge(modality: string) {
    switch (modality) {
        case "OL":
            return { bg: "bg-blue-100", text: "text-blue-700", label: "Online" };
        case "HY":
            return { bg: "bg-teal-100", text: "text-teal-700", label: "Hybrid" };
        default:
            return { bg: "bg-gray-100", text: "text-gray-700", label: "In Person" };
    }
}

function buildGoogleMapsUrl(location: string, preferredUrl?: string) {
    if (clean(preferredUrl)) return clean(preferredUrl);
    const normalized = clean(location);
    const upper = normalized.toUpperCase();
    if (!normalized || upper === "TBA") return "";
    if (/(ONLINE|ZOOM|WEB|REMOTE)/i.test(upper)) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalized} Santa Barbara City College Santa Barbara CA`)}`;
}

function extractPrerequisites(section?: Section) {
    if (!section) return [];
    if (Array.isArray(section.prerequisites) && section.prerequisites.length > 0) {
        return section.prerequisites.map((value) => clean(value)).filter(Boolean);
    }

    const fallbackText = clean(section.prerequisitesText);
    if (!fallbackText) return [];

    return fallbackText
        .split(/(?:\s*;\s*|\s*\|\s*|\.\s+(?=(?:[A-Z]{2,6}\s*\d{1,3}[A-Z]?|Prereq|Prerequisite|Corequisite|Advisory)))/i)
        .map((value) => clean(value))
        .filter(Boolean);
}

export default function SectionsPage() {
    const params = useParams();
    const router = useRouter();

    const subject = decodeURIComponent(params.subject as string);
    const courseCode = decodeURIComponent(params.course as string);
    const allSections = useMemo(() => sectionsData as Section[], []);

    const sections = useMemo(() => {
        return allSections.filter((section) => section.courseCode === courseCode);
    }, [allSections, courseCode]);

    const courseTitle = sections[0]?.courseTitle || "";
    const courseDescription = clean(sections.find((section) => clean(section.courseDescription))?.courseDescription);
    const prerequisites = extractPrerequisites(sections.find((section) => {
        if (Array.isArray(section.prerequisites) && section.prerequisites.length > 0) return true;
        return Boolean(clean(section.prerequisitesText));
    }));
    const igetcAreas = useMemo(() => {
        const areas = new Set<string>();
        sections.forEach((section) => {
            if (Array.isArray(section.igetcAreas)) {
                section.igetcAreas.forEach((area) => {
                    if (area) areas.add(area);
                });
            } else if (section.igetc) {
                areas.add(section.igetc);
            }
        });
        return Array.from(areas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [sections]);

    return (
        <div className="min-h-screen bg-[#FEFDF5] font-sans text-slate-800">
            <Header />

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <div className="text-sm text-slate-500 mb-2">
                        <Link href="/classes" className="hover:underline">Departments</Link> &gt;
                        <Link href={`/classes/${subject}`} className="hover:underline mx-1">{subject}</Link> &gt;
                        {courseCode}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <h1 className="text-3xl font-bold text-[#0f172a]">{courseCode}</h1>
                        {igetcAreas.length > 0 && (
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold tracking-wide">
                                IGETC {igetcAreas.length === 1 ? "Area" : "Areas"} {igetcAreas.join(", ")}
                            </span>
                        )}
                    </div>
                    <p className="text-xl text-slate-700 mt-1 font-medium">{courseTitle}</p>
                    <p className="text-slate-500 mt-1">{sections.length} section(s) available</p>
                </div>

                {(courseDescription || prerequisites.length > 0) && (
                    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                        {courseDescription && (
                            <div className="mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Course Description</h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-700">{clipText(courseDescription)}</p>
                            </div>
                        )}
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Prerequisites</h2>
                            {prerequisites.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {prerequisites.map((item, index) => (
                                        <span key={`${item}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-slate-500">No prerequisite requirements listed.</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid gap-4">
                    {sections.map((section) => {
                        const primaryInstructor = section.meetings[0]?.instructor;
                        const instructorOk = !isUnknownOrTBA(primaryInstructor);
                        const statusConfig = getStatusBadge(section.status);
                        const modalityConfig = getModalityBadge(section.modality);

                        return (
                            <div
                                key={section.crn}
                                className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-all group"
                            >
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <span className="font-bold text-lg text-slate-900">CRN: {section.crn}</span>
                                        <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase border ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </span>
                                        <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase border border-transparent ${modalityConfig.bg} ${modalityConfig.text}`}>
                                            {modalityConfig.label}
                                        </span>
                                    </div>

                                    <div className="text-sm text-slate-600 space-y-3">
                                        <div className="flex flex-wrap gap-x-6 gap-y-1">
                                            <span><span className="font-semibold text-slate-900">Units:</span> {section.units}</span>
                                            <span><span className="font-semibold text-slate-900">Seats:</span> {section.enrolled} / {section.capacity}</span>
                                        </div>

                                        <div>
                                            <span className="font-semibold text-slate-900">Instructor: </span>
                                            {instructorOk ? (
                                                <Link href={`/professor/${encodeURIComponent(primaryInstructor)}`} className="text-[#0f172a] hover:underline font-medium">
                                                    {primaryInstructor}
                                                </Link>
                                            ) : "TBA"}
                                        </div>

                                        <div className="flex flex-col gap-2 mt-2">
                                            {section.meetings.map((meeting, index) => {
                                                const mapUrl = buildGoogleMapsUrl(meeting.location, meeting.googleMapsUrl);

                                                return (
                                                    <div key={index} className="flex flex-wrap items-center gap-2 text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-gray-100">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 px-1.5 rounded">
                                                            {clean(meeting.type) || "LEC"}
                                                        </span>
                                                        <span className="font-bold text-slate-800 min-w-[20px]">
                                                            {meeting.days || "-"}
                                                        </span>
                                                        <span className={meeting.time.includes("hours/week") ? "italic text-slate-500" : ""}>
                                                            {meeting.time === "TBA" ? "Time TBA" : meeting.time}
                                                        </span>
                                                        {meeting.dateRange && (
                                                            <span className="text-xs text-slate-500">({meeting.dateRange})</span>
                                                        )}
                                                        <span className="text-slate-300">|</span>
                                                        <span className="font-medium text-slate-700">
                                                            {meeting.location || "Location TBA"}
                                                        </span>
                                                        {mapUrl && (
                                                            <a
                                                                href={mapUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="font-semibold text-[#0f172a] hover:underline"
                                                            >
                                                                Map
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end">
                                    <button
                                        onClick={() => router.push(`/classes/section/${encodeURIComponent(section.crn)}`)}
                                        className="px-6 py-2.5 rounded-lg bg-gray-100 text-slate-700 font-semibold hover:bg-[#0f172a] hover:text-white transition-colors text-sm w-full md:w-auto"
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12">
                    <Link href={`/classes/${subject}`} className="text-[#0f172a] font-semibold hover:underline">
                        ← Back to {subject}
                    </Link>
                </div>
            </main>
        </div>
    );
}
