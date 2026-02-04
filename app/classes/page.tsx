"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import sectionsData from "@/app/data/202650/sections.json";

// --- Types & Helpers ---
interface Section {
    course: string;
}

function getSubject(course: string) {
    return (course || "").trim().split(/\s+/)[0] || "";
}

export default function DepartmentsPage() {
    const allSections = useMemo(() => sectionsData as Section[], []);

    // Extract unique subjects and count classes per subject
    const departments = useMemo(() => {
        const map = new Map<string, number>();
        allSections.forEach((s) => {
            const subj = getSubject(s.course);
            if (subj) {
                map.set(subj, (map.get(subj) || 0) + 1);
            }
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [allSections]);

    return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>Departments</h1>
            <p style={{ opacity: 0.85, marginTop: 0, marginBottom: 24 }}>
                Select a department to view available courses.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {departments.map(([subj, count]) => (
                    <Link
                        key={subj}
                        href={`/classes/${subj}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                    >
                        <div
                            style={{
                                border: "1px solid #333",
                                borderRadius: 12,
                                padding: 16,
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "background 0.2s",
                            }}
                        >
                            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{subj}</div>
                            <div style={{ fontSize: 13, opacity: 0.7 }}>{count} sections</div>
                        </div>
                    </Link>
                ))}
            </div>

            <div style={{ marginTop: 24 }}>
                <Link href="/" style={{ textDecoration: "underline" }}>← Back home</Link>
            </div>
        </main>
    );
}