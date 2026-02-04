"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";

interface Section {
    crn: string;
    status: string;
    course: string;
    title: string;
    units: string;
    type: string;
    time: string;
    location: string;
    instructor: string;
}

function clean(s?: string) {
    return (s || "").trim();
}

function isUnknownOrTBA(s?: string) {
    const v = clean(s).toLowerCase();
    return v === "" || v === "tba" || v === "check link" || v === "unknown";
}

export default function SectionsPage() {
    const params = useParams();
    const router = useRouter();

    const subject = decodeURIComponent(params.subject as string);
    const course = decodeURIComponent(params.course as string);

    const allSections = useMemo(() => sectionsData as Section[], []);

    const sections = useMemo(() => {
        return allSections.filter((s) => s.course === course);
    }, [allSections, course]);

    const courseTitle = sections[0]?.title || "";

    return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>{course}</h1>
            <p style={{ opacity: 0.85, marginTop: 0, marginBottom: 24 }}>
                {courseTitle} • {sections.length} section(s) available
            </p>

            <div style={{ display: "grid", gap: 10 }}>
                {sections.map((s) => {
                    const instructorOk = !isUnknownOrTBA(s.instructor);
                    const time = isUnknownOrTBA(s.time) ? "TBA" : clean(s.time);
                    const location = isUnknownOrTBA(s.location) ? "TBA" : clean(s.location);

                    const detailHref = `/classes/section/${encodeURIComponent(s.crn)}`;
                    const professorHref = `/professor/${encodeURIComponent(s.instructor)}`;

                    return (
                        <div
                            key={s.crn}
                            style={{
                                border: "1px solid #333",
                                borderRadius: 12,
                                padding: 12,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            {/* Left Side: Info */}
                            <div>
                                <div style={{ fontWeight: 700 }}>
                                    Section {s.crn}
                                </div>
                                <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
                                    <div>
                                        {s.units} Units • {s.type} • <span style={{color: s.status === 'Open' ? 'green' : 'inherit'}}>{s.status}</span>
                                    </div>
                                    <div style={{ marginTop: 2 }}>
                                        {/* UPDATED: Professor Name is now a Link */}
                                        {instructorOk ? (
                                            <Link
                                                href={professorHref}
                                                style={{
                                                    textDecoration: "underline",
                                                    color: "inherit",
                                                    fontWeight: 500
                                                }}
                                            >
                                                {s.instructor}
                                            </Link>
                                        ) : (
                                            "Instructor TBA"
                                        )}
                                        {" "} • {time} • {location}
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Link */}
                            <div
                                onClick={() => router.push(detailHref)}
                                style={{
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    fontSize: 14
                                }}
                            >
                                View →
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: 24 }}>
                <Link href={`/classes/${subject}`} style={{ textDecoration: "underline" }}>
                    ← Back to {subject}
                </Link>
            </div>
        </main>
    );
}