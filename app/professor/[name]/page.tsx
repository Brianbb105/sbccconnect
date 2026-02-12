'use client';

import { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from "next/link";
import Header from "@/components/Header";

interface ProfessorTag {
    tagName: string;
    tagCount: number;
}

interface ProfessorReview {
    id: string;
    className: string;
    comment: string;
    date: string;
}

interface ProfessorData {
    id: string;
    key: string;
    firstName: string;
    lastName: string;
    department: string;
    legacyId: string;
    avgRating: number;
    numRatings: number;
    avgDifficulty: number;
    wouldTakeAgainPercent: number;
    topTags: ProfessorTag[];
    reviews: ProfessorReview[];
    source: "cache" | "live";
}

function formatReviewDate(rawDate: string) {
    if (!rawDate) return "";

    // RMP often returns: "2024-03-13 04:50:59 +0000 UTC"
    // We display only date + hour/minute, never seconds/timezone suffixes.
    const structuredMatch = rawDate
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?(?:\s*[+-]\d{2}:?\d{2}|Z)?(?:\s+UTC)?$/i);

    if (structuredMatch) {
        const [, year, month, day, hour, minute] = structuredMatch;
        const datePart = new Date(Number(year), Number(month) - 1, Number(day));
        const formattedDate = datePart.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
        const hour24 = Number(hour);
        const hour12 = ((hour24 + 11) % 12) + 1;
        const ampm = hour24 >= 12 ? "PM" : "AM";
        return `${formattedDate}, ${hour12}:${minute} ${ampm}`;
    }

    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    const cleaned = rawDate
        .replace(/\s+UTC\b/i, "")
        .replace(/:(\d{2})(?=\s*[+-]\d{2}:?\d{2}\b|Z\b|$)/, "");
    return cleaned.trim();
}

function formatTakeAgainPercent(value: number) {
    if (value <= -1) return "N/A";
    return `${Math.round(value)}%`;
}

export default function ProfessorPage({ params }: { params: Promise<{ name: string }> }) {
    const { name } = use(params);
    const decodedName = decodeURIComponent(name);
    const searchParams = useSearchParams();
    const explicitKey = (searchParams.get("key") || "").trim();

    // SBCC's specific ID on RMP, used for fallback search URL.
    const SBCC_SCHOOL_ID = "2783";

    const requestKey = `${decodedName}::${explicitKey}`;
    const [result, setResult] = useState<{
        requestKey: string;
        professor: ProfessorData | null;
        error: string;
    }>({
        requestKey: "",
        professor: null,
        error: "",
    });

    const loading = result.requestKey !== requestKey;
    const professor = loading ? null : result.professor;
    const error = loading ? "" : result.error;

    useEffect(() => {
        let cancelled = false;

        const qs = new URLSearchParams({ name: decodedName });
        if (explicitKey) qs.set("key", explicitKey);

        fetch(`/api/professor?${qs.toString()}`, { cache: "no-store" })
            .then((res) => {
                if (!res.ok) throw new Error('Professor not found');
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setResult({
                    requestKey,
                    professor: data,
                    error: "",
                });
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("API Fetch Error (using fallback link):", err);
                setResult({
                    requestKey,
                    professor: null,
                    error: err.message || 'An error occurred',
                });
            });

        return () => {
            cancelled = true;
        };
    }, [decodedName, explicitKey, requestKey]);

    // --- THE FIX IS HERE ---
    // 1. If we have a direct ID, go to their specific page.
    // 2. If not, search ONLY inside SBCC (ID 2783). This prevents the 404 "Dog Ate It" error.
    const rmpUrl = professor?.legacyId
        ? `https://www.ratemyprofessors.com/professor/${professor.legacyId}`
        : `https://www.ratemyprofessors.com/search/professors/${SBCC_SCHOOL_ID}?q=${encodeURIComponent(decodedName)}`;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="max-w-4xl mx-auto px-6 py-12">

                {/* Navigation Breadcrumb */}
                <div className="mb-6 text-sm text-slate-500">
                    <Link href="/professors" className="hover:underline hover:text-[#0f172a]">
                        Professors
                    </Link>
                    <span className="mx-2">&gt;</span>
                    <span className="text-slate-800 font-medium truncate">
                        {loading ? 'Loading...' : (professor ? `${professor.firstName} ${professor.lastName}` : decodedName)}
                    </span>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">

                    {/* Header Banner */}
                    <div className="bg-[#0f172a] h-32 w-full relative">
                        {!loading && !error && professor && (
                            <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex gap-2 items-center">
                                <span className={`w-2 h-2 rounded-full ${professor.source === "cache" ? "bg-amber-400" : "bg-green-400 animate-pulse"}`}></span>
                                {professor.source === "cache" ? "Cached Data" : "Live Data"}
                            </div>
                        )}

                        <div className="absolute -bottom-10 left-8">
                            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold text-[#0f172a] select-none">
                                {loading ? '...' : (professor ? `${professor.firstName?.[0]}${professor.lastName?.[0]}` : `${decodedName.split(' ')[0][0]}`)}
                            </div>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="pt-14 pb-8 px-8">

                        {/* Loading State */}
                        {loading && (
                            <div className="animate-pulse space-y-4">
                                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-24 bg-gray-100 rounded-xl mt-6"></div>
                            </div>
                        )}

                        {/* Error / Fallback State */}
                        {/* Even if API fails, we show the card with a Manual Search button */}
                        {!loading && error && (
                            <div className="text-center py-6">
                                <h1 className="text-3xl font-bold text-slate-900 mb-1">{decodedName}</h1>
                                <p className="text-slate-500 mb-6">Instructor • Santa Barbara City College</p>

                                <div className="p-6 bg-slate-100 rounded-xl border border-slate-200 mb-6">
                                    <p className="text-[#0f172a] font-medium mb-3">Live ratings currently unavailable</p>
                                    <a
                                        href={rmpUrl}
                                        target="_blank"
                                        className="inline-flex items-center gap-2 px-5 py-2 bg-[#0f172a] text-white rounded-lg font-bold hover:bg-[#1e293b] transition-colors"
                                    >
                                        Find on RateMyProfessors →
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {!loading && professor && (
                            <>
                                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                                    {professor.firstName} {professor.lastName}
                                </h1>
                                <p className="text-slate-500 font-medium mb-6">
                                    {professor.department || "Instructor"} • Santa Barbara City College
                                </p>

                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <div className="text-3xl md:text-4xl font-extrabold text-[#0f172a]">
                                            {professor.avgRating}
                                        </div>
                                        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1">
                                            Quality ({professor.numRatings || 0})
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <div className="text-3xl md:text-4xl font-extrabold text-slate-700">
                                            {professor.avgDifficulty}
                                        </div>
                                        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1">Difficulty</div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <div className={`text-3xl md:text-4xl font-extrabold ${professor.wouldTakeAgainPercent >= 50 ? 'text-green-600' : 'text-slate-600'}`}>
                                            {formatTakeAgainPercent(professor.wouldTakeAgainPercent)}
                                        </div>
                                        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1">Take Again</div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-slate-800 mb-3">Top Tags</h2>
                                    {professor.topTags?.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {professor.topTags.slice(0, 8).map((tag) => (
                                                    <span
                                                        key={tag.tagName}
                                                        className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-slate-100 text-[#0f172a]"
                                                    >
                                                        {tag.tagName} {tag.tagCount > 0 ? `(${tag.tagCount})` : ""}
                                                    </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">No tag data available yet.</p>
                                    )}
                                </div>

                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-slate-800 mb-3">Recent Student Comments</h2>
                                    {professor.reviews?.length > 0 ? (
                                        <div className="space-y-3">
                                            {professor.reviews.slice(0, 8).map((review, index) => (
                                                <div key={review.id || `${review.className}-${index}`} className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        {review.className && (
                                                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f172a]">
                                                                {review.className}
                                                            </span>
                                                        )}
                                                        {review.date && (
                                                            <span className="text-xs font-medium text-slate-500">
                                                                {formatReviewDate(review.date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm leading-relaxed text-slate-700">{review.comment}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">No cached comments yet.</p>
                                    )}
                                </div>

                                <div className="border-t border-gray-100 py-6">
                                    <h2 className="text-lg font-bold text-slate-800 mb-4">External Resources</h2>

                                    <a
                                        href={rmpUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-[#0f172a] hover:shadow-md transition-all bg-slate-50 hover:bg-white"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center font-bold text-xs">
                                                RMP
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-[#0f172a] transition-colors">
                                                    RateMyProfessors
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    View full reviews and comments
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-slate-400 group-hover:text-[#0f172a] transition-colors">
                                            →
                                        </div>
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex gap-6">
                    <Link href="/professors" className="text-slate-500 hover:text-[#0f172a] font-medium transition-colors">
                        ← Back to Professors
                    </Link>
                    <Link href="/classes" className="text-slate-500 hover:text-[#0f172a] font-medium transition-colors">
                        View all Classes
                    </Link>
                </div>

            </main>
        </div>
    );
}
