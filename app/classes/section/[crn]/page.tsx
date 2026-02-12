"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";
import Header from "@/components/Header";
import CourseCatalogDetails from "@/components/CourseCatalogDetails";
import {
    extractAdvisories,
    extractPrerequisites,
    extractTransferInformation,
} from "@/lib/courseMetadata";

interface Meeting {
    type: string;
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
    units: string;
    modality: "OL" | "HY" | "IP";
    meetings: Meeting[];
    enrolled: string;
    capacity: string;
    courseDescription?: string;
    advisoriesText?: string;
    advisories?: string[];
    prerequisitesText?: string;
    prerequisites?: string[];
    transferInformationText?: string;
    transferInformation?: string[];
}

function clean(value?: string) {
    return String(value || "").trim();
}

function isUnknownOrTBA(value?: string) {
    const normalized = clean(value).toLowerCase();
    return normalized === ""
        || normalized === "tba"
        || normalized === "unknown"
        || normalized === "check link"
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

function getSubjectFromCourseCode(courseCode: string) {
    return clean(courseCode).split(/\s+/)[0] || "";
}

function buildGoogleMapsUrl(location: string, preferredUrl?: string) {
    if (clean(preferredUrl)) return clean(preferredUrl);
    const normalized = clean(location);
    const upper = normalized.toUpperCase();
    if (!normalized || upper === "TBA") return "";
    if (/(ONLINE|ZOOM|WEB|REMOTE)/i.test(upper)) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalized} Santa Barbara City College Santa Barbara CA`)}`;
}

export default function SectionDetailsPage() {
    const params = useParams();
    const crn = decodeURIComponent(params.crn as string);
    const allSections = useMemo(() => sectionsData as Section[], []);

    const section = useMemo(() => {
        return allSections.find((entry) => entry.crn === crn) || null;
    }, [allSections, crn]);

    if (!section) {
        return (
            <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
                <Header />
                <main className="mx-auto max-w-4xl px-6 py-12">
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                        <h1 className="mb-2 text-2xl font-bold text-slate-900">Class Not Found</h1>
                        <p className="mb-6 text-slate-600">No section was found for CRN {crn}.</p>
                        <Link href="/classes" className="font-semibold text-[#0f172a] hover:underline">
                            ← Back to Classes
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const statusConfig = getStatusBadge(section.status);
    const modalityConfig = getModalityBadge(section.modality);
    const subject = getSubjectFromCourseCode(section.courseCode);
    const advisories = extractAdvisories(section);
    const prerequisites = extractPrerequisites(section);
    const transferInformation = extractTransferInformation(section);
    const primaryInstructor = section.meetings.find((meeting) => !isUnknownOrTBA(meeting.instructor))?.instructor || "TBA";
    const description = clean(section.courseDescription);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="mx-auto max-w-5xl px-6 py-12">
                <div className="mb-6 text-sm text-slate-500">
                    <Link href="/classes" className="hover:underline">Departments</Link>
                    <span className="mx-2">&gt;</span>
                    {subject ? (
                        <>
                            <Link href={`/classes/${encodeURIComponent(subject)}`} className="hover:underline">{subject}</Link>
                            <span className="mx-2">&gt;</span>
                            <Link
                                href={`/classes/${encodeURIComponent(subject)}/${encodeURIComponent(section.courseCode)}`}
                                className="hover:underline"
                            >
                                {section.courseCode}
                            </Link>
                            <span className="mx-2">&gt;</span>
                        </>
                    ) : null}
                    <span className="font-medium text-slate-800">CRN {section.crn}</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="relative h-32 w-full bg-[#0f172a]">
                        <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-3 py-1 text-[11px] font-bold uppercase ${statusConfig.color}`}>
                                {statusConfig.label}
                            </span>
                            <span className={`rounded-md border border-transparent px-3 py-1 text-[11px] font-bold uppercase ${modalityConfig.bg} ${modalityConfig.text}`}>
                                {modalityConfig.label}
                            </span>
                        </div>
                        <div className="absolute -bottom-9 left-8 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white text-center text-sm font-extrabold text-[#0f172a] shadow-md">
                            {section.courseCode}
                        </div>
                    </div>

                    <div className="px-8 pb-8 pt-14">
                        <h1 className="text-3xl font-bold text-slate-900">{section.courseTitle}</h1>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                            {section.courseCode} • CRN {section.crn}
                        </p>

                        <div className="mb-8 mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                                <div className="text-2xl font-extrabold text-[#0f172a]">{section.units || "TBA"}</div>
                                <div className="mt-1 text-xs font-bold uppercase text-slate-400">Units</div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                                <div className="text-2xl font-extrabold text-slate-700">{section.enrolled || "0"} / {section.capacity || "0"}</div>
                                <div className="mt-1 text-xs font-bold uppercase text-slate-400">Seats</div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                                <div className="text-2xl font-extrabold text-slate-700">{modalityConfig.label}</div>
                                <div className="mt-1 text-xs font-bold uppercase text-slate-400">Modality</div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                                {primaryInstructor !== "TBA" ? (
                                    <Link href={`/professor/${encodeURIComponent(primaryInstructor)}`} className="text-lg font-bold text-[#0f172a] hover:underline">
                                        {primaryInstructor}
                                    </Link>
                                ) : (
                                    <div className="text-2xl font-extrabold text-slate-700">TBA</div>
                                )}
                                <div className="mt-1 text-xs font-bold uppercase text-slate-400">Instructor</div>
                            </div>
                        </div>

                        <CourseCatalogDetails
                            className="mb-8 bg-slate-50"
                            description={description}
                            advisories={advisories}
                            prerequisites={prerequisites}
                            transferInformation={transferInformation}
                        />

                        <div>
                            <h2 className="mb-3 text-lg font-bold text-slate-800">Meeting Details</h2>
                            <div className="space-y-3">
                                {section.meetings.map((meeting, index) => {
                                    const mapUrl = buildGoogleMapsUrl(meeting.location, meeting.googleMapsUrl);
                                    const showMap = Boolean(mapUrl);
                                    const showInstructor = !isUnknownOrTBA(meeting.instructor);

                                    return (
                                        <div key={`${meeting.type}-${meeting.time}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-500">
                                                    {clean(meeting.type) || "LEC"}
                                                </span>
                                                <span className="font-semibold text-slate-800">{clean(meeting.days) || "Days TBA"}</span>
                                                <span className="text-slate-600">{clean(meeting.time) || "Time TBA"}</span>
                                                {meeting.dateRange ? (
                                                    <span className="text-xs font-medium text-slate-500">({meeting.dateRange})</span>
                                                ) : null}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                                                <span className="font-medium">Location:</span>
                                                <span>{clean(meeting.location) || "Location TBA"}</span>
                                                {showMap ? (
                                                    <a
                                                        href={mapUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="font-semibold text-[#0f172a] hover:underline"
                                                    >
                                                        Open in Google Maps
                                                    </a>
                                                ) : null}
                                            </div>

                                            <div className="mt-1 text-sm text-slate-700">
                                                <span className="font-medium">Instructor:</span>{" "}
                                                {showInstructor ? (
                                                    <Link href={`/professor/${encodeURIComponent(meeting.instructor)}`} className="text-[#0f172a] hover:underline">
                                                        {meeting.instructor}
                                                    </Link>
                                                ) : (
                                                    "TBA"
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-6">
                    {subject ? (
                        <Link
                            href={`/classes/${encodeURIComponent(subject)}/${encodeURIComponent(section.courseCode)}`}
                            className="font-medium text-slate-500 transition-colors hover:text-[#0f172a]"
                        >
                            ← Back to {section.courseCode}
                        </Link>
                    ) : null}
                    <Link href="/classes" className="font-medium text-slate-500 transition-colors hover:text-[#0f172a]">
                        View all Classes
                    </Link>
                </div>
            </main>
        </div>
    );
}
