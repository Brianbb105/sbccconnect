"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import sectionsData from "@/app/data/202650/sections.json";

interface Section {
    course: string;
    title: string;
}

function getSubject(course: string) {
    return (course || "").trim().split(/\s+/)[0] || "";
}

export default function CoursesPage() {
    const params = useParams();
    // Decode in case of special chars, though usually subjects are plain text
    const subject = decodeURIComponent(params.subject as string);

    const allSections = useMemo(() => sectionsData as Section[], []);

    // 1. Filter by specific subject
    // 2. Group by Course ID (e.g. "CS 105")
    const courses = useMemo(() => {
        const grouped = new Map<string, { title: string; count: number }>();

        allSections.forEach((s) => {
            const sSubject = getSubject(s.course);
            if (sSubject === subject) {
                if (!grouped.has(s.course)) {
                    grouped.set(s.course, { title: s.title, count: 0 });
                }
                const entry = grouped.get(s.course)!;
                entry.count += 1;
            }
        });

        return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [allSections, subject]);

    return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>{subject} Courses</h1>
            <p style={{ opacity: 0.85, marginTop: 0, marginBottom: 24 }}>
                Found {courses.length} courses in {subject}.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
                {courses.map(([courseName, data]) => (
                    <div
                        key={courseName}
                        style={{
                            border: "1px solid #333",
                            borderRadius: 12,
                            padding: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{courseName}</div>
                            <div style={{ opacity: 0.8, fontSize: 14 }}>{data.title}</div>
                        </div>

                        <Link
                            href={`/classes/${subject}/${courseName}`} // e.g. /classes/CS/CS 105
                            style={{
                                textDecoration: "underline",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                            }}
                        >
                            View {data.count} section{data.count !== 1 ? "s" : ""} →
                        </Link>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 24 }}>
                <Link href="/classes" style={{ textDecoration: "underline" }}>← Back to Departments</Link>
            </div>
        </main>
    );
}