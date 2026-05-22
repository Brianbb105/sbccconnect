import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
const CACHE_FILE = path.join(DATA_DIR, "rmp_cache.json");
const TERM_ORDER = ["202530", "202550", "202610", "202630", "202650", "202710", "202730"];
const SCHOOL_IDS = ["U2Nob29sLTI3ODM=", "U2Nob29sLTQ2NjU="];
const APPLY_FIX = process.env.APPLY_FIX === "1";
const LIMIT = Number(process.env.LIMIT || 0);

const TEACHER_NODE_QUERY = `
  query TeacherNode($id: ID!) {
    node(id: $id) {
      ... on Teacher {
        id
        firstName
        lastName
        department
        school {
          id
          name
        }
      }
    }
  }
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeName(value) {
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

function displayToFirstLast(displayName) {
  const cleaned = String(displayName || "").replace(/\s+/g, " ").trim();
  if (!cleaned.includes(",")) return cleaned;
  const [last, ...rest] = cleaned.split(",");
  return `${rest.join(" ").trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();
}

function firstLastParts(name) {
  const normalized = normalizeName(displayToFirstLast(name));
  const parts = normalized.split(" ").filter(Boolean);
  return {
    first: parts[0] || "",
    last: parts.at(-1) || "",
  };
}

function isFirstCompatible(targetFirst, cachedFirst) {
  if (!targetFirst || !cachedFirst) return true;
  return targetFirst.startsWith(cachedFirst) || cachedFirst.startsWith(targetFirst);
}

function isNameCompatible(localDisplayName, cacheEntry) {
  const target = firstLastParts(localDisplayName);
  const cached = firstLastParts(`${cacheEntry.firstName || ""} ${cacheEntry.lastName || ""}`);
  if (!target.first || !target.last || !cached.first || !cached.last) return true;
  return target.last === cached.last && isFirstCompatible(target.first, cached.first);
}

function isSbccSchool(school) {
  const schoolId = String(school?.id || "");
  const schoolName = normalizeName(String(school?.name || ""));
  return SCHOOL_IDS.includes(schoolId) || schoolName.includes("santa barbara city college");
}

function loadLocalProfessors() {
  const byKey = new Map();
  for (const term of TERM_ORDER) {
    const filePath = path.join(DATA_DIR, term, "professors.json");
    if (!fs.existsSync(filePath)) continue;
    const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const row of rows) {
      const key = String(row.key || row.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!key || byKey.has(key)) continue;
      byKey.set(key, row);
    }
  }
  return byKey;
}

async function graphqlRequest(query, variables, { maxRetries = 4 } = {}) {
  let attempt = 0;
  let backoff = 600;
  while (attempt < maxRetries) {
    attempt += 1;
    const response = await fetch("https://www.ratemyprofessors.com/graphql", {
      method: "POST",
      headers: {
        Authorization: "Basic dGVzdDp0ZXN0",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      await sleep(backoff);
      backoff *= 1.7;
      continue;
    }

    return response.json();
  }
  return null;
}

async function fetchTeacherNode(id) {
  const json = await graphqlRequest(TEACHER_NODE_QUERY, { id });
  return json?.data?.node ?? null;
}

async function main() {
  const professors = loadLocalProfessors();
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const entries = Object.entries(cache).filter(([key, value]) => {
    return professors.has(key) && value && typeof value === "object" && value.id;
  });
  const queue = LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
  const issues = [];
  let checked = 0;
  let updatedSchool = 0;

  for (const [key, entry] of queue) {
    checked += 1;
    process.stdout.write(`[${checked}/${queue.length}] ${key} ... `);
    const localProfessor = professors.get(key);
    const teacher = await fetchTeacherNode(entry.id);
    const school = teacher?.school || entry.school || null;
    const badSchool = school ? !isSbccSchool(school) : true;
    const badName = !isNameCompatible(localProfessor.displayName, entry);

    if (badSchool || badName) {
      issues.push({
        key,
        localName: localProfessor.displayName,
        cachedName: `${entry.firstName || ""} ${entry.lastName || ""}`.trim(),
        cachedDepartment: entry.department || "",
        schoolName: school?.name || "",
        schoolId: school?.id || "",
        reason: badSchool ? "non_sbcc_school" : "name_mismatch",
      });
      if (APPLY_FIX) cache[key] = null;
      console.log(`bad (${issues.at(-1).reason})`);
    } else {
      if (teacher?.school && JSON.stringify(entry.school || null) !== JSON.stringify(teacher.school)) {
        updatedSchool += 1;
        if (APPLY_FIX) entry.school = teacher.school;
      }
      console.log("ok");
    }

    await sleep(120);
  }

  if (APPLY_FIX && (issues.length > 0 || updatedSchool > 0)) {
    fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
  }

  const summary = {
    checked,
    issues: issues.length,
    fixed: APPLY_FIX ? issues.length : 0,
    updatedSchool,
    applyFix: APPLY_FIX,
  };

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) {
    console.log("\nIssues:");
    console.log(JSON.stringify(issues, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
