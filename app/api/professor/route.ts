import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { SUPPORTED_TERMS, getTermBySlug, normalizeTermSlug } from "@/lib/terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RMP_URL = "https://www.ratemyprofessors.com/graphql";
const SBCC_SCHOOL_IDS = ["U2Nob29sLTI3ODM=", "U2Nob29sLTQ2NjU="]; // School-2783 + School-4665
const MIN_MATCH_SCORE = 50;
const REVIEWS_LIMIT = 30;
const CACHE_FILE = path.resolve(process.cwd(), "app/data/rmp_cache.json");

const HEADERS = {
  Authorization: "Basic dGVzdDp0ZXN0",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const TEACHER_QUERY = `
  query NewSearchTeachers($text: String!, $schoolID: ID!) {
    newSearch {
      teachers(query: { text: $text, schoolID: $schoolID }) {
        edges {
          node {
            id
            firstName
            lastName
            department
            avgRating
            numRatings
            wouldTakeAgainPercent
            avgDifficulty
            school {
              id
              name
            }
            teacherRatingTags {
              tagName
              tagCount
            }
          }
        }
      }
    }
  }
`;

const TEACHER_QUERY_GLOBAL = `
  query NewSearchTeachers($text: String!) {
    newSearch {
      teachers(query: { text: $text }) {
        edges {
          node {
            id
            firstName
            lastName
            department
            avgRating
            numRatings
            wouldTakeAgainPercent
            avgDifficulty
            school {
              id
              name
            }
            teacherRatingTags {
              tagName
              tagCount
            }
          }
        }
      }
    }
  }
`;

const TEACHER_RATINGS_QUERY = `
  query TeacherRatings($id: ID!, $first: Int!, $after: String) {
    node(id: $id) {
      ... on Teacher {
        ratings(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              class
              comment
              date
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

type ProfessorListItem = {
  displayName: string;
  key: string;
};

type RmpTag = {
  tagName: string;
  tagCount: number;
};

type RmpReview = {
  id?: string;
  className?: string;
  class?: string;
  comment?: string;
  date?: string;
};

type RmpNode = {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  avgRating: number;
  numRatings: number;
  wouldTakeAgainPercent: number;
  avgDifficulty: number;
  teacherRatingTags?: RmpTag[];
  school?: {
    id?: string;
    name?: string;
  };
};

type CachedProfessor = {
  id?: string;
  legacyId?: string | number;
  firstName?: string;
  lastName?: string;
  department?: string;
  avgRating?: number;
  numRatings?: number;
  wouldTakeAgainPercent?: number;
  avgDifficulty?: number;
  topTags?: RmpTag[];
  teacherRatingTags?: RmpTag[];
  reviews?: RmpReview[];
  school?: {
    id?: string;
    name?: string;
  };
  fetchedAt?: string;
  queryName?: string;
  matchedBy?: string;
  matchScore?: number;
};

type CacheMap = Record<string, CachedProfessor | null>;

type TeacherSearchResponse = {
  data?: {
    newSearch?: {
      teachers?: {
        edges?: Array<{ node?: RmpNode }>;
      };
    };
  };
};

type TeacherRatingEdge = {
  node?: { id?: string; class?: string; comment?: string; date?: string };
};

type TeacherRatingsPage = {
  edges?: TeacherRatingEdge[];
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

type TeacherRatingsResponse = {
  data?: {
    node?: {
      ratings?: TeacherRatingsPage;
    };
  };
  errors?: Array<{ message?: string }>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeName(value: string): string {
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

function stripNameJunk(value: string): string {
  return String(value || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\b(dr|prof|professor)\.?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayToFirstLast(displayName: string): string {
  const cleaned = stripNameJunk(displayName);
  if (!cleaned.includes(",")) return cleaned;
  const [last, ...rest] = cleaned.split(",");
  return `${rest.join(" ").trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();
}

function splitFirstLast(name: string): { firstName: string; lastName: string } {
  const normalized = displayToFirstLast(name).replace(/\s+/g, " ").trim();
  const parts = normalized.split(" ").filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function decodeLegacyId(globalId?: string): string | null {
  if (!globalId) return null;
  try {
    const decoded = Buffer.from(globalId, "base64").toString("utf8");
    const match = decoded.match(/Teacher-(\d+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function normalizeTagList(input: unknown): RmpTag[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      tagName: String((item as { tagName?: string }).tagName || "").trim(),
      tagCount: Number((item as { tagCount?: number }).tagCount || 0),
    }))
    .filter((tag) => tag.tagName.length > 0)
    .sort((a, b) => b.tagCount - a.tagCount || a.tagName.localeCompare(b.tagName));
}

function normalizeReviewList(input: unknown): Array<{ id: string; className: string; comment: string; date: string }> {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((item) => {
      const review = item as RmpReview;
      return {
        id: String(review?.id || "").trim(),
        className: String(review?.className || review?.class || "").trim(),
        comment: String(review?.comment || "").replace(/\s+/g, " ").trim(),
        date: String(review?.date || "").trim(),
      };
    })
    .filter((review) => review.comment.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const deduped: Array<{ id: string; className: string; comment: string; date: string }> = [];
  const seen = new Set<string>();
  for (const review of normalized) {
    const key = `${review.className}|${review.comment}|${review.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(review);
  }

  return deduped;
}

function normalizeCacheKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function roundWouldTakeAgainPercent(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return -1;
  return Math.round(parsed);
}

function scoreCandidate(
  targetName: string,
  node: Pick<RmpNode, "firstName" | "lastName" | "numRatings" | "school">,
): number {
  const target = normalizeName(displayToFirstLast(targetName));
  const candFull = normalizeName(`${node.firstName} ${node.lastName}`);

  const tParts = target.split(" ").filter(Boolean);
  const cParts = candFull.split(" ").filter(Boolean);
  const tFirst = tParts[0] || "";
  const tLast = tParts[tParts.length - 1] || "";
  const cFirst = cParts[0] || "";
  const cLast = cParts[cParts.length - 1] || "";

  let score = 0;
  if (candFull === target) score += 100;
  if (tLast && cLast && tLast === cLast) score += 30;
  if (tFirst && cFirst && (tFirst.startsWith(cFirst) || cFirst.startsWith(tFirst))) {
    score += 10;
  } else if (tFirst && cFirst) {
    score -= 70;
  }
  if (tLast && cLast && tLast !== cLast) score -= 40;
  score += Math.min(Number(node.numRatings || 0), 50) * 0.25;

  const school = node.school;
  const schoolId = String(school?.id || "");
  const schoolName = normalizeName(String(school?.name || ""));
  if (SBCC_SCHOOL_IDS.includes(schoolId)) {
    score += 60;
  } else if (schoolName.includes("santa barbara city college")) {
    score += 50;
  } else if (schoolId || schoolName) {
    score -= 20;
  }

  return score;
}

function isSbccSchool(school: RmpNode["school"] | CachedProfessor["school"]): boolean {
  const schoolId = String(school?.id || "");
  const schoolName = normalizeName(String(school?.name || ""));
  return SBCC_SCHOOL_IDS.includes(schoolId) || schoolName.includes("santa barbara city college");
}

function isAcceptableCachedProfessor(value: CachedProfessor | null | undefined): value is CachedProfessor {
  if (!isCachedProfessor(value)) return false;
  return !value.school || isSbccSchool(value.school);
}

function buildQueryVariants(name: string): string[] {
  const base = displayToFirstLast(name);
  const raw = stripNameJunk(name);
  const [rawLast = "", ...rawRest] = raw.includes(",") ? raw.split(",") : [];
  const rawFirst = rawRest.join(",").trim();
  const lastPhrase = rawLast.trim();
  const normalized = normalizeName(base);
  const parts = normalized.split(" ").filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";

  const variants = [
    base,
    base.replace(/[-_/]+/g, " "),
    rawFirst && lastPhrase ? `${rawFirst} ${lastPhrase}` : "",
    rawFirst && lastPhrase ? `${lastPhrase} ${rawFirst}` : "",
    lastPhrase,
    lastPhrase.replace(/[-_/]+/g, " "),
    `${first} ${last}`.trim(),
    last,
    `${last} ${first}`.trim(),
  ];

  return Array.from(
    new Set(
      variants
        .map((v) => v.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
}

function resolveProfessorKey(
  name: string,
  explicitKey: string | null,
  professors: ProfessorListItem[],
): string | null {
  if (explicitKey && professors.some((p) => p.key === explicitKey)) {
    return explicitKey;
  }

  const target = normalizeName(name);
  if (!target) return null;

  for (const prof of professors) {
    const displayNorm = normalizeName(prof.displayName);
    const firstLastNorm = normalizeName(displayToFirstLast(prof.displayName));
    if (target === displayNorm || target === firstLastNorm) return prof.key;
  }

  let bestKey: string | null = null;
  let bestScore = -Infinity;
  for (const prof of professors) {
    const { firstName, lastName } = splitFirstLast(prof.displayName);
    const score = scoreCandidate(name, {
      firstName,
      lastName,
      numRatings: 0,
    });
    if (score > bestScore) {
      bestScore = score;
      bestKey = prof.key;
    }
  }

  return bestScore >= MIN_MATCH_SCORE ? bestKey : null;
}

function buildStrictNameAliases(name: string): string[] {
  const cleaned = String(name || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const aliases = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeName(value);
    if (normalized) aliases.add(normalized);
  };

  add(cleaned);
  add(displayToFirstLast(cleaned));
  return Array.from(aliases);
}

function buildSimpleNameAlias(name: string): string | null {
  const normalized = normalizeName(displayToFirstLast(name));
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function findCacheByExactName(
  cache: CacheMap,
  name: string,
): { key: string; entry: CachedProfessor } | null {
  const targetStrictAliases = new Set(buildStrictNameAliases(name));
  const targetSimpleAlias = buildSimpleNameAlias(name);
  if (!targetStrictAliases.size && !targetSimpleAlias) return null;

  type CacheCandidate = { key: string; entry: CachedProfessor; score: number };
  let bestStrictMatch: CacheCandidate | null = null;
  const simpleMatches: CacheCandidate[] = [];

  for (const [key, value] of Object.entries(cache)) {
    if (!isAcceptableCachedProfessor(value)) continue;

    const score =
      Number(value.numRatings || 0) * 10 +
      (Array.isArray(value.reviews) ? value.reviews.length : 0);
    const candidate = { key, entry: value, score };

    const strictAliases = new Set<string>([
      ...buildStrictNameAliases(key),
      ...buildStrictNameAliases(displayToFirstLast(key)),
      ...buildStrictNameAliases(value.queryName || ""),
      ...buildStrictNameAliases(`${value.firstName || ""} ${value.lastName || ""}`),
    ]);
    const hasStrictMatch = Array.from(targetStrictAliases).some((alias) => strictAliases.has(alias));

    if (hasStrictMatch) {
      if (!bestStrictMatch || candidate.score > bestStrictMatch.score) {
        bestStrictMatch = candidate;
      }
      continue;
    }

    if (!targetSimpleAlias) continue;

    const simpleAliases = new Set<string>();
    const addSimpleAlias = (input: string) => {
      const alias = buildSimpleNameAlias(input);
      if (alias) simpleAliases.add(alias);
    };
    addSimpleAlias(key);
    addSimpleAlias(displayToFirstLast(key));
    addSimpleAlias(value.queryName || "");
    addSimpleAlias(`${value.firstName || ""} ${value.lastName || ""}`);

    if (simpleAliases.has(targetSimpleAlias)) {
      simpleMatches.push(candidate);
    }
  }

  if (bestStrictMatch) {
    return { key: bestStrictMatch.key, entry: bestStrictMatch.entry };
  }

  if (simpleMatches.length === 1) {
    return { key: simpleMatches[0].key, entry: simpleMatches[0].entry };
  }

  return null;
}

function isCachedProfessor(value: CachedProfessor | null | undefined): value is CachedProfessor {
  return Boolean(value && typeof value === "object");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readAllProfessorFiles(primaryTermCode: string): Promise<ProfessorListItem[]> {
  const orderedTerms = [
    primaryTermCode,
    ...SUPPORTED_TERMS.map((term) => term.code).filter((code) => code !== primaryTermCode),
  ];
  const byKey = new Map<string, ProfessorListItem>();

  await Promise.all(
    orderedTerms.map(async (termCode) => {
      const filePath = path.resolve(process.cwd(), `app/data/${termCode}/professors.json`);
      const rows = await readJsonFile<ProfessorListItem[]>(filePath, []);
      for (const professor of rows) {
        const identity = String(professor.key || professor.displayName || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
        if (!identity || byKey.has(identity)) continue;
        byKey.set(identity, professor);
      }
    }),
  );

  return Array.from(byKey.values());
}

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  let attempt = 0;
  let backoff = 600;

  while (attempt < 4) {
    attempt += 1;
    const res = await fetch(RMP_URL, {
      method: "POST",
      headers: HEADERS,
      cache: "no-store",
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      await sleep(backoff);
      backoff *= 1.7;
      continue;
    }

    const json = await res.json();
    return json as T;
  }

  return null;
}

async function graphqlTeachersSearch(text: string, schoolID?: string): Promise<RmpNode[]> {
  const useSchoolScopedQuery = Boolean(schoolID);
  const json = await graphqlRequest<TeacherSearchResponse>(
    useSchoolScopedQuery ? TEACHER_QUERY : TEACHER_QUERY_GLOBAL,
    useSchoolScopedQuery ? { text, schoolID } : { text },
  );
  const edges = json?.data?.newSearch?.teachers?.edges ?? [];
  return edges
    .map((edge) => edge.node)
    .filter((node): node is RmpNode => Boolean(node));
}

async function fetchTeacherReviews(teacherId: string, limit = REVIEWS_LIMIT): Promise<RmpReview[]> {
  if (!teacherId || limit <= 0) return [];

  const reviews: RmpReview[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && reviews.length < limit) {
    const first = Math.min(20, limit - reviews.length);
    const json: TeacherRatingsResponse | null = await graphqlRequest<TeacherRatingsResponse>(
      TEACHER_RATINGS_QUERY,
      { id: teacherId, first, after },
    );

    if (!json || Array.isArray(json.errors)) break;

    const ratings: TeacherRatingsPage | undefined = json.data?.node?.ratings;
    const edges: TeacherRatingEdge[] = Array.isArray(ratings?.edges) ? ratings.edges : [];
    if (!edges.length) break;

    for (const edge of edges) {
      if (!edge.node) continue;
      reviews.push({
        id: edge.node.id || "",
        className: String(edge.node.class || "").trim(),
        comment: edge.node.comment || "",
        date: edge.node.date || "",
      });
      if (reviews.length >= limit) break;
    }

    hasNextPage = Boolean(ratings?.pageInfo?.hasNextPage);
    after = ratings?.pageInfo?.endCursor || null;

    if (hasNextPage) await sleep(120);
  }

  return normalizeReviewList(reviews).slice(0, limit);
}

function normalizeLiveNodeForCache(
  node: RmpNode,
  queryName: string,
  matchedBy: string,
  matchScore: number,
  reviews: RmpReview[],
): CachedProfessor {
  return {
    id: String(node.id || ""),
    legacyId: decodeLegacyId(node.id) || "",
    firstName: String(node.firstName || "").trim(),
    lastName: String(node.lastName || "").trim(),
    department: String(node.department || "").trim(),
    avgRating: Number(node.avgRating || 0),
    numRatings: Number(node.numRatings || 0),
    wouldTakeAgainPercent: roundWouldTakeAgainPercent(node.wouldTakeAgainPercent),
    avgDifficulty: Number(node.avgDifficulty || 0),
    topTags: normalizeTagList(node.teacherRatingTags).slice(0, 10),
    reviews: normalizeReviewList(reviews),
    school: {
      id: String(node.school?.id || ""),
      name: String(node.school?.name || ""),
    },
    fetchedAt: new Date().toISOString(),
    queryName,
    matchedBy,
    matchScore: Number(matchScore.toFixed(2)),
  };
}

async function writeCacheEntry(key: string, entry: CachedProfessor): Promise<void> {
  const normalizedKey = normalizeCacheKey(key);
  if (!normalizedKey) return;

  try {
    const cache = await readJsonFile<CacheMap>(CACHE_FILE, {});
    cache[normalizedKey] = entry;
    await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
  } catch {
    // Some deployment environments are read-only; live data should still render.
  }
}

async function cacheLiveNode(
  key: string | null,
  queryName: string,
  node: RmpNode,
  matchedBy: string,
  matchScore: number,
): Promise<CachedProfessor> {
  const reviews = await fetchTeacherReviews(node.id, REVIEWS_LIMIT);
  const entry = normalizeLiveNodeForCache(node, queryName, matchedBy, matchScore, reviews);
  await writeCacheEntry(key || queryName, entry);
  return entry;
}

type RmpMatch = {
  node: RmpNode;
  variant: string;
  score: number;
};

function dedupeNodes(nodes: RmpNode[]): RmpNode[] {
  const map = new Map<string, RmpNode>();
  for (const node of nodes) {
    const id = String(node?.id || "");
    if (!id) continue;
    if (!map.has(id)) map.set(id, node);
  }
  return Array.from(map.values());
}

async function fetchBestRmpMatch(name: string): Promise<RmpMatch | null> {
  const variants = buildQueryVariants(name);
  let best: RmpMatch | null = null;

  for (const variant of variants) {
    const candidates: RmpNode[] = [];

    for (const schoolID of SBCC_SCHOOL_IDS) {
      const scoped = await graphqlTeachersSearch(variant, schoolID);
      candidates.push(...scoped);
    }

    // Global fallback catches profiles that are not indexed under the expected school ID.
    const global = await graphqlTeachersSearch(variant);
    candidates.push(...global);

    const dedupedCandidates = dedupeNodes(candidates).filter((node) => isSbccSchool(node.school));
    for (const node of dedupedCandidates) {
      const score = scoreCandidate(name, node);
      if (!best || score > best.score) {
        best = { node, variant, score };
      }
    }
    await sleep(120);
  }

  return best && best.score >= MIN_MATCH_SCORE ? best : null;
}

function formatApiResponse(
  raw: CachedProfessor | RmpNode,
  source: "cache" | "live",
  key: string | null,
) {
  const id = String(raw.id || "");
  const topTags = normalizeTagList((raw as CachedProfessor).topTags ?? (raw as RmpNode).teacherRatingTags);
  const reviews = source === "cache" ? normalizeReviewList((raw as CachedProfessor).reviews) : [];
  const legacyId =
    (raw as CachedProfessor).legacyId?.toString() ||
    decodeLegacyId(id) ||
    "";

  return {
    id,
    key: key || "",
    firstName: String(raw.firstName || "").trim(),
    lastName: String(raw.lastName || "").trim(),
    department: String(raw.department || "").trim(),
    avgRating: Number(raw.avgRating || 0),
    numRatings: Number(raw.numRatings || 0),
    wouldTakeAgainPercent: roundWouldTakeAgainPercent(raw.wouldTakeAgainPercent),
    avgDifficulty: Number(raw.avgDifficulty || 0),
    legacyId,
    topTags,
    reviews,
    source,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get("name") || "").trim();
  const explicitKey = String(searchParams.get("key") || "").trim() || null;
  const term = getTermBySlug(normalizeTermSlug(searchParams.get("term")));
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    const [professors, cache] = await Promise.all([
      readAllProfessorFiles(term.code),
      readJsonFile<CacheMap>(CACHE_FILE, {}),
    ]);

    const directExplicitCache = explicitKey ? cache[explicitKey] : null;
    if (explicitKey && isAcceptableCachedProfessor(directExplicitCache)) {
      return NextResponse.json(formatApiResponse(directExplicitCache, "cache", explicitKey));
    }

    const resolvedKey = resolveProfessorKey(name, explicitKey, professors);
    const directCache = resolvedKey ? cache[resolvedKey] : null;

    if (resolvedKey && isAcceptableCachedProfessor(directCache)) {
      return NextResponse.json(formatApiResponse(directCache, "cache", resolvedKey));
    }

    const cacheByName = findCacheByExactName(cache, name);
    if (cacheByName) {
      return NextResponse.json(formatApiResponse(cacheByName.entry, "cache", cacheByName.key));
    }

    const liveMatch = await fetchBestRmpMatch(name);
    if (liveMatch) {
      const cachedEntry = await cacheLiveNode(
        resolvedKey || explicitKey,
        name,
        liveMatch.node,
        liveMatch.variant,
        liveMatch.score,
      );
      return NextResponse.json(formatApiResponse(cachedEntry, "cache", resolvedKey || explicitKey));
    }

    return NextResponse.json({ error: "Professor not found" }, { status: 404 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details },
      { status: 500 },
    );
  }
}
