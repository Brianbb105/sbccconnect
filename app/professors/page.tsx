"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import professorsData from "@/app/data/202650/professors.json";
import rmpCacheData from "@/app/data/rmp_cache.json";
import Header from "@/components/Header";



// --- Types ---
type Professor = {
    displayName: string; // Format: "Ali, Muhammad"
    key: string;         // ID: "MALI"
};

type ProfessorTag = {
    tagName: string;
    tagCount: number;
};

type ProfessorReview = {
    id?: string;
    className?: string;
    comment?: string;
    date?: string;
};

type CachedProfessor = {
    department?: string;
    avgRating?: number;
    numRatings?: number;
    avgDifficulty?: number;
    wouldTakeAgainPercent?: number;
    topTags?: ProfessorTag[];
    reviews?: ProfessorReview[];
} | null;

type CacheMap = Record<string, CachedProfessor>;

// --- Helper: Name Processing ---
function processName(rawName: string) {
    // Handle cases where comma might be missing
    if (!rawName.includes(',')) {
        return {
            lastName: rawName.trim(),
            fullName: rawName.trim()
        };
    }

    const parts = rawName.split(',');
    // "Ali, Muhammad" -> parts[0]="Ali", parts[1]="Muhammad"
    const lastName = parts[0].trim();
    const firstName = parts[1].trim();

    return {
        lastName: lastName,
        fullName: `${firstName} ${lastName}` // "Muhammad Ali"
    };
}

function getCacheEntry(
    cache: CacheMap,
    key: string,
    displayName: string,
): CachedProfessor {
    const byKey = cache[key];
    if (byKey !== undefined) return byKey;
    return cache[displayName.toLowerCase()] ?? null;
}

function formatRating(value?: number) {
    const safe = Number(value ?? 0);
    return safe > 0 ? safe.toFixed(1) : "N/A";
}

function ProfessorsPageContent() {
    const searchParams = useSearchParams();
    const searchQueryFromUrl = useMemo(() => {
        return (searchParams.get("search") || "").trim();
    }, [searchParams]);

    const [selectedLetter, setSelectedLetter] = useState("A");
    const [manualSearchQuery, setManualSearchQuery] = useState<string | null>(null);
    const searchQuery = manualSearchQuery ?? searchQueryFromUrl;
    const cache = useMemo(() => rmpCacheData as CacheMap, []);

    // 1. Process Data: Add useful formatted names to the raw data
    const processedData = useMemo(() => {
        return (professorsData as Professor[]).map(p => {
            const { lastName, fullName } = processName(p.displayName);
            const rmp = getCacheEntry(cache, p.key, p.displayName);
            return {
                ...p,
                lastName,  // Used for sorting/grouping
                formattedName: fullName, // Used for display
                rmp,
            };
        });
    }, [cache]);

    // 2. Filter & Group Logic
    const { groups, alphabet, searchResults } = useMemo(() => {

        // CASE A: User is Searching
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            const results = processedData.filter(p =>
                p.formattedName.toLowerCase().includes(query) ||
                p.lastName.toLowerCase().includes(query)
            );
            return {
                groups: {} as Record<string, typeof processedData>,
                alphabet: [],
                searchResults: results,
            };
        }

        // CASE B: User is using Alphabet Tabs (Default)
        const newGroups: Record<string, typeof processedData> = {};

        processedData.forEach((p) => {
            // Get first letter of Last Name
            const letter = p.lastName[0]?.toUpperCase() || "#";
            // Check if it's a valid letter A-Z, otherwise group under '#'
            const key = /[A-Z]/.test(letter) ? letter : "#";

            if (!newGroups[key]) newGroups[key] = [];
            newGroups[key].push(p);
        });

        const sortedAlphabet = Object.keys(newGroups).sort();
        return { groups: newGroups, alphabet: sortedAlphabet, searchResults: [] };

    }, [processedData, searchQuery]);

    // Determine what to show
    const isSearching = searchQuery.trim() !== "";
    const currentList = isSearching ? searchResults : (groups[selectedLetter] || []);

    return (
        <div className="min-h-screen bg-[#FEFDF5] font-sans text-slate-800">
            <Header />

            <main className="max-w-6xl mx-auto px-6 py-12">

                {/* Header & Search */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0f172a]">Professors</h1>
                        <p className="text-slate-500 mt-2">
                            Spring 2026 • {professorsData.length} instructors
                        </p>
                    </div>

                    {/* Local Search Input */}
                    <div className="w-full md:w-1/3 relative">
                        <input
                            type="text"
                            placeholder="Find a professor..."
                            value={searchQuery}
                            onChange={(e) => setManualSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] outline-none shadow-sm transition-all"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                    </div>
                </div>

                {/* Alphabet Filter Bar (Hidden when searching) */}
                {!isSearching && (
                    <div className="flex flex-wrap gap-2 mb-10 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        {alphabet.map((letter) => {
                            const isActive = selectedLetter === letter;
                            return (
                                <button
                                    key={letter}
                                    onClick={() => setSelectedLetter(letter)}
                                    className={`alphabet-pill w-10 h-10 rounded-full border border-slate-200 font-bold transition-all ${
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
                )}

                {/* Results Section */}
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg ${isSearching ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-[#0f172a]'}`}>
                            {isSearching ? `Search: "${searchQuery}"` : selectedLetter}
                        </span>
                        <span className="text-slate-500 font-normal text-base">
                            {currentList.length} Result{currentList.length !== 1 && 's'}
                        </span>
                    </h2>

                    {currentList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentList.map((p) => (
                                <Link
                                    key={p.key}
                                    // Use 'formattedName' ("Stephen Strenn") instead of 'displayName' ("Strenn, Stephen")
                                    href={`/professor/${encodeURIComponent(p.formattedName)}?key=${encodeURIComponent(p.key)}`}
                                    className="block group"
                                >
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-[#0f172a] hover:shadow-md transition-all">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-lg text-slate-800 group-hover:text-[#0f172a] transition-colors">
                                                {p.formattedName}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {p.rmp?.department || "SBCC Instructor"}
                                            </div>
                                            {p.rmp ? (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-semibold text-[#0f172a]">
                                                        Quality {formatRating(p.rmp.avgRating)}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                        Difficulty {formatRating(p.rmp.avgDifficulty)}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                        Ratings {Number(p.rmp.numRatings || 0)}
                                                    </span>
                                                    {Array.isArray(p.rmp.reviews) && p.rmp.reviews.length > 0 && (
                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                            Comments {p.rmp.reviews.length}
                                                        </span>
                                                    )}
                                                    {Array.isArray(p.rmp.topTags) && p.rmp.topTags[0]?.tagName && (
                                                        <span className="truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                                            {p.rmp.topTags[0].tagName}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-xs text-slate-400">
                                                    No cached rating data yet.
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4 text-[#0f172a] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-bold">
                                            →
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <p className="text-slate-400 text-lg">
                                No professors found matching your criteria.
                            </p>
                            {isSearching && (
                                <button
                                    onClick={() => setManualSearchQuery("")}
                                    className="mt-4 text-[#0f172a] font-semibold hover:underline"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function ProfessorsPageFallback() {
    return (
        <div className="min-h-screen bg-[#FEFDF5] font-sans text-slate-800">
            <Header />
            <main className="max-w-6xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                    <p className="text-slate-500">Loading professors...</p>
                </div>
            </main>
        </div>
    );
}

export default function ProfessorsPage() {
    return (
        <Suspense fallback={<ProfessorsPageFallback />}>
            <ProfessorsPageContent />
        </Suspense>
    );
}
