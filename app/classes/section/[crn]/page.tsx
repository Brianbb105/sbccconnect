import Link from "next/link";
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

export default function ClassDetailPage({ params }: { params: { crn: string } }) {
    const all = sectionsData as Section[];
    const section = all.find((s) => s.crn === params.crn);

    if (!section) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold">Class not found</h1>
                <div className="mt-4">
                    <Link href="/classes" className="underline hover:text-blue-600">
                        ← Back to Classes
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900">
                {section.course} — {section.title}
            </h1>

            <div className="mt-6 grid gap-3 text-sm">
                <div><span className="text-gray-500">CRN:</span> {section.crn}</div>
                <div><span className="text-gray-500">Status:</span> {section.status || "TBA"}</div>
                <div><span className="text-gray-500">Units:</span> {section.units || "TBA"}</div>
                <div><span className="text-gray-500">Type:</span> {section.type || "TBA"}</div>
                <div><span className="text-gray-500">Time:</span> {section.time || "TBA"}</div>
                <div><span className="text-gray-500">Location:</span> {section.location || "TBA"}</div>
                <div><span className="text-gray-500">Instructor:</span> {section.instructor || "TBA"}</div>
            </div>

            <div className="mt-8 flex gap-4">
                <Link href="/classes" className="underline hover:text-blue-600">
                    ← Back to Classes
                </Link>

                {section.instructor && section.instructor !== "TBA" && section.instructor !== "Check Link" && (
                    <Link
                        href={`/professor/${encodeURIComponent(section.instructor)}`}
                        className="underline hover:text-blue-600"
                    >
                        View instructor →
                    </Link>
                )}
            </div>
        </main>
    );
}
