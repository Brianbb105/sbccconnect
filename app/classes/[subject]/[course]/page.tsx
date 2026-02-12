"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";
import Header from "@/components/Header";
import CourseCatalogDetails from "@/components/CourseCatalogDetails";
import {
    extractAdvisories,
    extractPrerequisites,
    extractTransferInformation,
} from "@/lib/courseMetadata";
import { buildSbccGoogleMapsUrl, getDisplayLocation } from "@/lib/locationMapping";

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
    advisoriesText?: string;
    advisories?: string[];
    prerequisitesText?: string;
    prerequisites?: string[];
    transferInformationText?: string;
    transferInformation?: string[];
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
    const metadataSource = sections.find((section) => {
        if (clean(section.courseDescription)) return true;
        if (extractAdvisories(section).length > 0) return true;
        if (extractPrerequisites(section).length > 0) return true;
        if (extractTransferInformation(section).length > 0) return true;
        return false;
    }) || sections[0];
    const courseDescription = clean(metadataSource?.courseDescription);
    const advisories = extractAdvisories(metadataSource);
    const prerequisites = extractPrerequisites(metadataSource);
    const transferInformation = extractTransferInformation(metadataSource);
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
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
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

                <CourseCatalogDetails
                    description={courseDescription}
                    advisories={advisories}
                    prerequisites={prerequisites}
                    transferInformation={transferInformation}
                />

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
                                                const locationLabel = getDisplayLocation(meeting.location);
                                                const mapUrl = buildSbccGoogleMapsUrl(meeting.location);

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
                                                            {locationLabel || "Location TBA"}
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
