"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getDepartmentFullName } from "@/lib/departments";
import { useAllProfessors, useTermSections } from "@/lib/termDataClient";
import { appendTermToHref, getTermFromSearchParams } from "@/lib/terms";



// --- Types ---
type Professor = {
    displayName: string; // Format: "Ali, Muhammad"
    key: string;         // ID: "MALI"
    terms?: string[];
};

type SectionMeeting = {
    instructor?: string;
};

type Section = {
    courseCode?: string;
    meetings?: SectionMeeting[];
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
    id?: string;
    legacyId?: string | number;
    firstName?: string;
    lastName?: string;
    queryName?: string;
    department?: string;
    avgRating?: number;
    numRatings?: number;
    avgDifficulty?: number;
    wouldTakeAgainPercent?: number;
    topTags?: ProfessorTag[];
    reviews?: ProfessorReview[];
    school?: {
        id?: string;
        name?: string;
    };
} | null;

type CacheMap = Record<string, CachedProfessor>;
type CachedProfessorRecord = Exclude<CachedProfessor, null>;
type CacheIndex = Map<string, CachedProfessor>;

const SBCC_SCHOOL_IDS = new Set(["U2Nob29sLTI3ODM=", "U2Nob29sLTQ2NjU="]);

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

function normalizeCacheKey(value: string) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeNameForCompare(value: string) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['’.]/g, "")
        .replace(/[-_/]+/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function displayToFirstLast(displayName: string) {
    const cleaned = String(displayName || "").replace(/\s+/g, " ").trim();
    if (!cleaned.includes(",")) return cleaned;
    const [last, ...rest] = cleaned.split(",");
    return `${rest.join(" ").trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();
}

function getFirstLastParts(name: string) {
    const normalized = normalizeNameForCompare(displayToFirstLast(name));
    const parts = normalized.split(" ").filter(Boolean);
    return {
        first: parts[0] || "",
        last: parts[parts.length - 1] || "",
    };
}

function isCachedProfessor(value: CachedProfessor): value is CachedProfessorRecord {
    // Exclude negative-cache "not found" markers — they aren't real rating records.
    return Boolean(value && typeof value === "object" && (value as { notFound?: boolean }).notFound !== true);
}

function isFirstCompatible(targetFirst: string, cachedFirst: string) {
    if (!targetFirst || !cachedFirst) return true;
    return targetFirst.startsWith(cachedFirst) || cachedFirst.startsWith(targetFirst);
}

function isProfessorNameCompatible(displayName: string, entry: CachedProfessorRecord) {
    const target = getFirstLastParts(displayName);
    const cached = getFirstLastParts(`${entry.firstName || ""} ${entry.lastName || ""}`);
    if (!target.first || !target.last || !cached.first || !cached.last) return true;
    return target.last === cached.last && isFirstCompatible(target.first, cached.first);
}

function isSbccSchool(school: CachedProfessorRecord["school"]) {
    if (!school) return true;
    const schoolId = String(school.id || "");
    const schoolName = normalizeNameForCompare(String(school.name || ""));
    return SBCC_SCHOOL_IDS.has(schoolId) || schoolName.includes("santa barbara city college");
}

function addCacheIndexAlias(index: CacheIndex, alias: string | undefined, value: CachedProfessor) {
    if (!alias) return;
    const normalizedAliases = new Set([
        normalizeCacheKey(alias),
        normalizeNameForCompare(alias),
    ]);

    for (const normalized of normalizedAliases) {
        if (!normalized || index.has(normalized)) continue;
        index.set(normalized, value);
    }
}

function buildCacheIndex(cache: CacheMap): CacheIndex {
    const index: CacheIndex = new Map();

    for (const [rawKey, value] of Object.entries(cache)) {
        addCacheIndexAlias(index, rawKey, value);

        if (!isCachedProfessor(value)) continue;

        addCacheIndexAlias(index, value.queryName, value);
        addCacheIndexAlias(index, `${value.firstName || ""} ${value.lastName || ""}`, value);
        addCacheIndexAlias(index, `${value.lastName || ""}, ${value.firstName || ""}`, value);
    }

    return index;
}

function getIndexedCacheValue(index: CacheIndex, alias: string): CachedProfessor | undefined {
    const normalizedAliases = [
        normalizeCacheKey(alias),
        normalizeNameForCompare(alias),
    ];

    for (const normalized of normalizedAliases) {
        if (!normalized || !index.has(normalized)) continue;
        return index.get(normalized) ?? null;
    }

    return undefined;
}

function getCacheEntry(
    cacheIndex: CacheIndex,
    key: string,
    displayName: string,
): CachedProfessorRecord | null {
    const aliases = [
        key,
        displayName,
        displayToFirstLast(displayName),
    ];

    for (const alias of aliases) {
        const entry = getIndexedCacheValue(cacheIndex, alias);
        if (entry === undefined) continue;
        if (!isCachedProfessor(entry)) return null;
        if (!isSbccSchool(entry.school)) return null;
        if (!isProfessorNameCompatible(displayName, entry)) return null;
        return entry;
    }

    return null;
}

function formatRating(value?: number) {
    const safe = Number(value ?? 0);
    return safe > 0 ? safe.toFixed(1) : "N/A";
}

function formatCount(value?: number) {
    const safe = Number(value ?? 0);
    return safe > 0 ? String(safe) : "N/A";
}

function getCourseSubject(courseCode?: string) {
    return String(courseCode || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
}

function addProfessorDepartment(
    map: Map<string, string[]>,
    instructor: string | undefined,
    department: string,
) {
    const normalized = normalizeNameForCompare(instructor || "");
    if (!normalized || !department) return;

    const departments = map.get(normalized) ?? [];
    if (!departments.includes(department)) {
        departments.push(department);
    }
    map.set(normalized, departments);
}

function buildCurrentTermDepartmentIndex(sections: Section[] | null) {
    const index = new Map<string, string[]>();

    (sections ?? []).forEach((section) => {
        const subject = getCourseSubject(section.courseCode);
        if (!subject) return;

        const department = getDepartmentFullName(subject);
        (section.meetings ?? []).forEach((meeting) => {
            addProfessorDepartment(index, meeting.instructor, department);
        });
    });

    return index;
}

function formatDepartmentLabel(departments: string[] | undefined) {
    if (!departments || departments.length === 0) {
        return "SBCC Instructor";
    }

    if (departments.length <= 2) {
        return departments.join(", ");
    }

    return `${departments.slice(0, 2).join(", ")} +${departments.length - 2}`;
}

function MetricPill({
    children,
    emphasis = false,
}: {
    children: React.ReactNode;
    emphasis?: boolean;
}) {
    return (
        <span className={`rounded-full border border-slate-200 px-2 py-1 font-semibold ${
            emphasis ? "bg-slate-100 text-[#0f172a]" : "bg-slate-50 text-slate-600"
        }`}>
            {children}
        </span>
    );
}

function ProfessorMetricPills({ rmp }: { rmp: CachedProfessorRecord | null }) {
    const reviewCount = Array.isArray(rmp?.reviews) ? rmp.reviews.length : 0;
    const topTag = Array.isArray(rmp?.topTags) ? rmp.topTags[0]?.tagName : "";

    return (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <MetricPill emphasis>Quality {rmp ? formatRating(rmp.avgRating) : "N/A"}</MetricPill>
            <MetricPill>Difficulty {rmp ? formatRating(rmp.avgDifficulty) : "N/A"}</MetricPill>
            <MetricPill>Ratings {rmp ? formatCount(rmp.numRatings) : "N/A"}</MetricPill>
            <MetricPill>Comments {rmp ? formatCount(reviewCount) : "N/A"}</MetricPill>
            {topTag ? (
                <MetricPill>
                    <span className="inline-block max-w-40 truncate align-bottom">{topTag}</span>
                </MetricPill>
            ) : null}
        </div>
    );
}

function ProfessorsPageContent() {
    const searchParams = useSearchParams();
    const currentTerm = getTermFromSearchParams(searchParams);
    const { data: professors, loading: professorsLoading, error: professorsError } = useAllProfessors<Professor>();
    const { data: currentTermSections } = useTermSections<Section>(currentTerm.slug);
    const searchQueryFromUrl = useMemo(() => {
        return (searchParams.get("search") || "").trim();
    }, [searchParams]);

    const [selectedLetter, setSelectedLetter] = useState("A");
    const [manualSearchQuery, setManualSearchQuery] = useState<string | null>(null);
    const searchQuery = manualSearchQuery ?? searchQueryFromUrl;
    const [cache, setCache] = useState<CacheMap>({});
    const cacheIndex = useMemo(() => buildCacheIndex(cache), [cache]);
    const currentTermDepartmentIndex = useMemo(
        () => buildCurrentTermDepartmentIndex(currentTermSections),
        [currentTermSections],
    );

    useEffect(() => {
        let isActive = true;

        async function loadCache() {
            try {
                const response = await fetch("/api/professor-cache", { cache: "no-store" });
                if (!response.ok) return;

                const data: unknown = await response.json();
                if (isActive && data && typeof data === "object" && !Array.isArray(data)) {
                    setCache(data as CacheMap);
                }
            } catch {
                // Keep empty cache fallback if request fails.
            }
        }

        loadCache();

        return () => {
            isActive = false;
        };
    }, []);

    // 1. Process Data: Add useful formatted names to the raw data
    const processedData = useMemo(() => {
        return (professors ?? []).map(p => {
            const { lastName, fullName } = processName(p.displayName);
            const rmp = getCacheEntry(cacheIndex, p.key, p.displayName);
            const inferredDepartments = currentTermDepartmentIndex.get(normalizeNameForCompare(fullName));
            return {
                ...p,
                lastName,  // Used for sorting/grouping
                formattedName: fullName, // Used for display
                departmentLabel: rmp?.department || formatDepartmentLabel(inferredDepartments),
                rmp,
            };
        });
    }, [cacheIndex, currentTermDepartmentIndex, professors]);

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
    const isInitialLoad = professorsLoading && !professors;
    const currentList = isSearching ? searchResults : (groups[selectedLetter] || []);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />

            <main className="max-w-6xl mx-auto px-6 py-12">

                {/* Header & Search */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div className="w-full md:w-auto">
                        <h1 className="text-3xl font-bold text-[#0f172a]">Professors</h1>
                        <p className="text-slate-500 mt-2">
                            All available terms • {(professors ?? []).length} instructors
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
                {isInitialLoad ? (
                    <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <p className="text-slate-500">Loading professors...</p>
                    </div>
                ) : professorsError ? (
                    <div className="mb-10 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                        <p className="text-red-700 font-medium">Failed to load professor data.</p>
                    </div>
                ) : null}

                {!isSearching && !isInitialLoad && (
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
                {!isInitialLoad && (
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
                                    href={appendTermToHref(`/professor/${encodeURIComponent(p.formattedName)}?key=${encodeURIComponent(p.key)}`, currentTerm.slug)}
                                    className="block group"
                                >
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-[#0f172a] hover:shadow-md transition-all">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-lg text-slate-800 group-hover:text-[#0f172a] transition-colors">
                                                {p.formattedName}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {p.departmentLabel}
                                            </div>
                                            <ProfessorMetricPills rmp={p.rmp} />
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
                )}
            </main>
        </div>
    );
}

function ProfessorsPageFallback() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
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
