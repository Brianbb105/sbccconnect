import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, "../data/202650/professors.json");
const OUTPUT_FILE = path.join(__dirname, "../data/rmp_cache.json");

const SCHOOL_IDS = ["U2Nob29sLTI3ODM=", "U2Nob29sLTQ2NjU="]; // School-2783 + School-4665
const MIN_MATCH_SCORE = 50;
const FORCE_REFRESH = process.env.FORCE_REFRESH === "1";
const LIMIT = Number(process.env.LIMIT || 0);
const SKIP_IF_HAS_TAGS = process.env.SKIP_IF_HAS_TAGS !== "0";
const ONLY_KEY = String(process.env.ONLY_KEY || "").trim().toLowerCase();
const REVIEWS_LIMIT = Number(process.env.REVIEWS_LIMIT || 30);

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripJunk(s) {
  return String(s || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\b(dr|prof|professor)\.?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toFirstLast(displayName) {
  const cleaned = stripJunk(displayName);
  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",");
    return `${rest.trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

function normalizeForCompare(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLastOnly(name) {
  const parts = String(name || "").split(" ").filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function decodeLegacyId(globalId) {
  if (!globalId) return "";
  try {
    const decoded = Buffer.from(globalId, "base64").toString("utf8");
    const match = decoded.match(/Teacher-(\d+)/i);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function buildQueryVariants(displayName) {
  const firstLast = toFirstLast(displayName);
  const cleaned = stripJunk(firstLast);
  const normalized = normalizeForCompare(cleaned);
  const parts = normalized.split(" ").filter(Boolean);
  const first = parts[0] || "";
  const last = parts.at(-1) || "";

  const variants = [
    cleaned,
    firstLastOnly(cleaned),
    `${first} ${last}`.trim(),
    last,
    `${last} ${first}`.trim(),
  ];

  return [...new Set(variants.map(stripJunk).filter(Boolean))];
}

function scoreCandidate(targetDisplayName, node) {
  const target = normalizeForCompare(firstLastOnly(toFirstLast(targetDisplayName)));
  const candFull = normalizeForCompare(`${node.firstName} ${node.lastName}`);
  const cand = normalizeForCompare(firstLastOnly(`${node.firstName} ${node.lastName}`));

  const tParts = target.split(" ");
  const cParts = cand.split(" ");
  const tFirst = tParts[0] || "";
  const tLast = tParts.at(-1) || "";
  const cFirst = cParts[0] || "";
  const cLast = cParts.at(-1) || "";

  let score = 0;
  if (cand === target) score += 100;
  if (candFull === normalizeForCompare(toFirstLast(targetDisplayName))) score += 20;
  if (tLast && cLast && tLast === cLast) score += 30;
  if (tFirst && cFirst && (tFirst.startsWith(cFirst) || cFirst.startsWith(tFirst))) score += 10;
  if (tLast && cLast && tLast !== cLast) score -= 40;
  score += Math.min(node.numRatings ?? 0, 50) * 0.25;

  return score;
}

function pickBestMatch(displayName, edges) {
  if (!edges?.length) return null;
  const scored = edges
    .map((e) => e.node)
    .filter(Boolean)
    .map((node) => ({ node, score: scoreCandidate(displayName, node) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < MIN_MATCH_SCORE) return null;
  return best;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => ({
      tagName: String(tag?.tagName || "").trim(),
      tagCount: Number(tag?.tagCount || 0),
    }))
    .filter((tag) => tag.tagName.length > 0)
    .sort((a, b) => b.tagCount - a.tagCount || a.tagName.localeCompare(b.tagName))
    .slice(0, 10);
}

function normalizeReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  const normalized = reviews
    .map((review) => ({
      id: String(review?.id || "").trim(),
      className: String(review?.className || review?.class || "").trim(),
      comment: String(review?.comment || "").replace(/\s+/g, " ").trim(),
      date: String(review?.date || "").trim(),
    }))
    .filter((review) => review.comment.length > 0)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const deduped = [];
  const seen = new Set();
  for (const review of normalized) {
    const key = `${review.className}|${review.comment}|${review.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(review);
  }
  return deduped;
}

function roundWouldTakeAgainPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return -1;
  return Math.round(parsed);
}

function normalizeNode(node, displayName, score, variant, reviews) {
  const topTags = normalizeTags(node.teacherRatingTags);
  const normalizedReviews = normalizeReviews(reviews);
  return {
    id: node.id || "",
    legacyId: decodeLegacyId(node.id),
    firstName: String(node.firstName || "").trim(),
    lastName: String(node.lastName || "").trim(),
    department: String(node.department || "").trim(),
    avgRating: Number(node.avgRating || 0),
    numRatings: Number(node.numRatings || 0),
    wouldTakeAgainPercent: roundWouldTakeAgainPercent(node.wouldTakeAgainPercent),
    avgDifficulty: Number(node.avgDifficulty || 0),
    topTags,
    reviews: normalizedReviews,
    fetchedAt: new Date().toISOString(),
    queryName: displayName,
    matchedBy: variant,
    matchScore: Number(score.toFixed(2)),
  };
}

async function graphqlRequest(query, variables, { maxRetries = 4 } = {}) {
  let attempt = 0;
  let backoff = 800;

  while (true) {
    attempt += 1;
    try {
      const res = await fetch("https://www.ratemyprofessors.com/graphql", {
        method: "POST",
        headers: {
          Authorization: "Basic dGVzdDp0ZXN0",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        if (attempt > maxRetries) throw new Error("Rate limited (429) too many times.");
        await sleep(backoff);
        backoff *= 1.7;
        continue;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      return json;
    } catch (err) {
      if (attempt > maxRetries) throw err;
      await sleep(backoff);
      backoff *= 1.7;
    }
  }
}

async function rmpSearchTeachers(text, schoolID = null) {
  const useScoped = Boolean(schoolID);
  const json = await graphqlRequest(
    useScoped ? TEACHER_QUERY : TEACHER_QUERY_GLOBAL,
    useScoped ? { text, schoolID } : { text },
  );
  return json?.data?.newSearch?.teachers?.edges ?? [];
}

function dedupeNodes(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const id = String(node?.id || "");
    if (!id) continue;
    if (!map.has(id)) map.set(id, node);
  }
  return Array.from(map.values());
}

async function fetchTeacherReviews(teacherId, limit = REVIEWS_LIMIT) {
  if (!teacherId || limit <= 0) return [];

  const reviews = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage && reviews.length < limit) {
    const first = Math.min(20, limit - reviews.length);
    let json;

    try {
      json = await graphqlRequest(TEACHER_RATINGS_QUERY, { id: teacherId, first, after });
    } catch (err) {
      if (reviews.length) break;
      console.warn(`⚠️ Reviews query failed for ${teacherId}: ${err?.message || String(err)}`);
      return [];
    }

    if (Array.isArray(json?.errors) && json.errors.length) {
      if (reviews.length) break;
      console.warn(`⚠️ Reviews query returned errors for ${teacherId}: ${json.errors[0]?.message || "Unknown GraphQL error"}`);
      return [];
    }

    const ratings = json?.data?.node?.ratings;
    const edges = Array.isArray(ratings?.edges) ? ratings.edges : [];
    if (!edges.length) break;

    for (const edge of edges) {
      if (!edge?.node) continue;
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

  return normalizeReviews(reviews).slice(0, limit);
}

async function fetchProfessorBestMatch(displayName) {
  const variants = buildQueryVariants(displayName);
  let bestNode = null;
  let bestScore = -Infinity;
  let bestVariant = "";

  for (const variant of variants) {
    const candidates = [];
    for (const schoolID of SCHOOL_IDS) {
      const edges = await rmpSearchTeachers(variant, schoolID);
      candidates.push(...edges.map((edge) => edge?.node).filter(Boolean));
    }
    const globalEdges = await rmpSearchTeachers(variant);
    candidates.push(...globalEdges.map((edge) => edge?.node).filter(Boolean));

    const deduped = dedupeNodes(candidates);
    const candidate = pickBestMatch(
      displayName,
      deduped.map((node) => ({ node })),
    );

    if (candidate && candidate.score > bestScore) {
      bestNode = candidate.node;
      bestScore = candidate.score;
      bestVariant = variant;
    }

    await sleep(120);
  }

  if (!bestNode || bestScore < MIN_MATCH_SCORE) return null;
  return { node: bestNode, score: bestScore, variant: bestVariant };
}

function shouldSkipCached(cacheEntry) {
  if (!cacheEntry) return false;
  if (cacheEntry === null) return false;
  if (!SKIP_IF_HAS_TAGS) return false;
  const hasTags = Array.isArray(cacheEntry.topTags) && cacheEntry.topTags.length > 0;
  const hasReviewsField = Array.isArray(cacheEntry.reviews);
  return hasTags && hasReviewsField;
}

(async () => {
  console.log("🚀 Starting RMP bulk fetch (ratings + tags + reviews)...");
  console.log(`📁 Output: ${OUTPUT_FILE}`);
  console.log(`🏫 School IDs: ${SCHOOL_IDS.join(", ")}`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ INPUT_FILE not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const allProfessors = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const filteredByKey = ONLY_KEY
    ? allProfessors.filter((p) => String(p.key || "").toLowerCase() === ONLY_KEY)
    : allProfessors;
  const professors = LIMIT > 0 ? filteredByKey.slice(0, LIMIT) : filteredByKey;

  const cache = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"))
    : {};

  console.log(`📦 Loaded cache keys: ${Object.keys(cache).length}`);
  console.log(`👩‍🏫 Professors queued: ${professors.length}${LIMIT > 0 ? ` (LIMIT=${LIMIT})` : ""}`);
  console.log(`⚙️ FORCE_REFRESH=${FORCE_REFRESH ? "1" : "0"} SKIP_IF_HAS_TAGS=${SKIP_IF_HAS_TAGS ? "1" : "0"} REVIEWS_LIMIT=${REVIEWS_LIMIT}`);
  if (ONLY_KEY) console.log(`🔎 ONLY_KEY=${ONLY_KEY}`);

  for (const [index, prof] of professors.entries()) {
    const displayName = prof.displayName ?? prof.name ?? "";
    const fallbackKey = normalizeForCompare(toFirstLast(displayName)) || `idx_${index}`;
    const key = prof.key ?? fallbackKey;

    process.stdout.write(`[${index + 1}/${professors.length}] ${displayName} ... `);

    const alreadyCached = Object.prototype.hasOwnProperty.call(cache, key);
    const cacheEntry = alreadyCached ? cache[key] : undefined;

    if (!FORCE_REFRESH && alreadyCached && shouldSkipCached(cacheEntry)) {
      console.log("⏩ Skipped (cached)");
      continue;
    }

    try {
      const best = await fetchProfessorBestMatch(displayName);

      if (!best) {
        console.log("❌ Not Found");
        cache[key] = null;
        await sleep(220);
        continue;
      }

      const reviews = await fetchTeacherReviews(best.node.id, REVIEWS_LIMIT);
      const normalized = normalizeNode(best.node, displayName, best.score, best.variant, reviews);
      cache[key] = normalized;

      const tagPreview = normalized.topTags.slice(0, 3).map((t) => t.tagName).join(", ");
      console.log(
        `✅ ${normalized.firstName} ${normalized.lastName} | ` +
          `${normalized.avgRating || "N/A"}/5 (${normalized.numRatings || 0})` +
          (tagPreview ? ` | tags: ${tagPreview}` : " | tags: none") +
          ` | reviews: ${normalized.reviews.length}`,
      );
    } catch (err) {
      console.log(`⚠️ Error: ${err?.message || String(err)}`);
      cache[key] = null;
    }

    await sleep(260);

    if ((index + 1) % 20 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
      console.log(`💾 Autosaved at ${index + 1}/${professors.length}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
  console.log(`\n🎉 Done! Saved to ${OUTPUT_FILE}`);
})();
