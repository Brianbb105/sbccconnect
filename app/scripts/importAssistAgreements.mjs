import crypto from "crypto";
import fs from "fs";
import path from "path";

const ASSIST_BASE_URL = "https://www.assist.org";
const SBCC_INSTITUTION_ID = 92;
const DATA_ROOT = path.resolve(process.cwd(), "app/data/assist");
const RAW_ROOT = path.join(DATA_ROOT, "raw");
const NORMALIZED_ROOT = path.join(DATA_ROOT, "normalized");
const REPORTS_ROOT = path.join(DATA_ROOT, "reports");
const MANIFEST_PATH = path.join(DATA_ROOT, "cache-manifest.json");
const DEFAULT_DELAY_MS = 1250;
const DEFAULT_RETRIES = 4;
const DEFAULT_LIST_CATEGORIES = ["major", "breadth", "dept", "prefix"];
const DEFAULT_FULL_CATEGORIES = ["major"];
const DEFAULT_SEGMENTS = ["UC", "CSU"];

const INSTITUTION_CATEGORY_SEGMENTS = new Map([
  [0, "CSU"],
  [1, "UC"],
  [2, "CCC"],
  [5, "PRIVATE"],
  ["CSU", "CSU"],
  ["UC", "UC"],
  ["CCC", "CCC"],
  ["PRIVATE", "PRIVATE"],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureParent(filePath) {
  ensureDir(path.dirname(filePath));
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readJsonFile(filePath, fallback = null) {
  if (!fileExists(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath);
}

function toAbsolute(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function safeSlug(value, fallback = "item") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || fallback;
}

function trimString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimCode(value) {
  return String(value || "").trim();
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseCsv(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function parseCli(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("-") ? args.shift() : "help";
  const options = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    if (raw.startsWith("no-")) {
      options[raw.slice(3)] = false;
      continue;
    }

    const equalsIndex = raw.indexOf("=");
    if (equalsIndex >= 0) {
      options[raw.slice(0, equalsIndex)] = raw.slice(equalsIndex + 1);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options[raw] = next;
      index += 1;
    } else {
      options[raw] = true;
    }
  }

  return { command, options };
}

function printHelp() {
  console.log(`
ASSIST.org SBCC transfer agreement importer

Usage:
  node app/scripts/importAssistAgreements.mjs partners [--year-id 76] [--segments UC,CSU]
  node app/scripts/importAssistAgreements.mjs list --receiving-id 128 [--year-id 76] [--category major]
  node app/scripts/importAssistAgreements.mjs fetch-one --key "76/92/to/128/Major/..." [--force]
  node app/scripts/importAssistAgreements.mjs fetch-all [--year-id 76] [--segments UC,CSU] [--dry-run]

Examples:
  node app/scripts/importAssistAgreements.mjs partners --year-id 76
  node app/scripts/importAssistAgreements.mjs list --receiving-id 128 --year-id 76 --category major
  node app/scripts/importAssistAgreements.mjs fetch-one --key "76/92/to/128/Major/9b98e159-1754-4eb0-33c4-08ddf001012b"
  node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --dry-run
  node app/scripts/importAssistAgreements.mjs fetch-all --year-id 76 --segments UC,CSU --full-categories major --concurrency 1

Options:
  --year-id <id>                 ASSIST academic year id. Defaults to the latest year with SBCC UC/CSU agreements.
  --segments <UC,CSU>            Receiving institution segments to include.
  --receiving-id <id>            Restrict list/fetch-all to one receiving institution.
  --category <code>              Agreement category for list mode. Default: major.
  --list-categories <codes>      Categories whose lists are cached in fetch-all. Default: major,breadth,dept,prefix.
  --full-categories <codes>      Categories whose full agreements are downloaded. Default: major.
  --limit <n>                    Limit displayed rows or full agreement downloads.
  --concurrency <1-3>            Small fetch concurrency for full agreements. Default: 1.
  --delay-ms <ms>                Global delay between network requests. Default: ${DEFAULT_DELAY_MS}.
  --force                        Re-fetch cached network responses.
  --renormalize                  Rebuild normalized files from cached raw agreements.
  --dry-run                      List what would be fetched without downloading full agreements.

Data locations:
  Raw cache:          app/data/assist/raw/
  Normalized output:  app/data/assist/normalized/
  Cache manifest:     app/data/assist/cache-manifest.json
  Run reports:        app/data/assist/reports/
`);
}

function readManifest() {
  const manifest = readJsonFile(MANIFEST_PATH, null);
  if (manifest) return manifest;
  return {
    version: 1,
    source: "ASSIST",
    sendingInstitutionId: SBCC_INSTITUTION_ID,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: {},
    lists: {},
    agreements: {},
    runs: [],
  };
}

function writeManifest(manifest) {
  manifest.updatedAt = nowIso();
  writeJsonFile(MANIFEST_PATH, manifest);
}

function parseSetCookieHeader(headerValue) {
  if (!headerValue) return [];
  return headerValue.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((value) => value.trim()).filter(Boolean);
}

function setCookiesFromHeaders(headers, jar) {
  const setCookieHeaders = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : parseSetCookieHeader(headers.get("set-cookie"));

  for (const setCookie of setCookieHeaders) {
    const [pair] = setCookie.split(";");
    const equalsIndex = pair.indexOf("=");
    if (equalsIndex <= 0) continue;
    jar.set(pair.slice(0, equalsIndex).trim(), pair.slice(equalsIndex + 1).trim());
  }
}

function cookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

class RateLimiter {
  constructor(delayMs) {
    this.delayMs = Math.max(0, Number(delayMs) || 0);
    this.lastRequestAt = 0;
    this.queue = Promise.resolve();
  }

  async waitTurn() {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.delayMs) {
      await sleep(this.delayMs - elapsed);
    }
    this.lastRequestAt = Date.now();
    release();
  }
}

class AssistClient {
  constructor(options) {
    this.delayMs = Number(options["delay-ms"] || process.env.ASSIST_DELAY_MS || DEFAULT_DELAY_MS);
    this.maxRetries = Number(options.retries || process.env.ASSIST_MAX_RETRIES || DEFAULT_RETRIES);
    this.force = parseBoolean(options.force);
    this.jar = new Map();
    this.bootstrapped = false;
    this.bootstrapPromise = null;
    this.limiter = new RateLimiter(this.delayMs);
    this.userAgent = process.env.ASSIST_USER_AGENT || "SBCCPlan ASSIST importer (respectful cached research script)";
    this.apiKey = process.env.ASSIST_API_KEY || "";
    this.apiKeyHeader = process.env.ASSIST_API_KEY_HEADER || "Authorization";
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    if (this.bootstrapPromise) {
      await this.bootstrapPromise;
      return;
    }
    this.bootstrapPromise = this.runBootstrap();
    try {
      await this.bootstrapPromise;
    } finally {
      if (!this.bootstrapped) this.bootstrapPromise = null;
    }
  }

  async runBootstrap() {
    await this.limiter.waitTurn();
    const response = await fetch(ASSIST_BASE_URL, {
      headers: {
        "User-Agent": this.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    setCookiesFromHeaders(response.headers, this.jar);
    if (!response.ok) {
      throw new Error(`ASSIST bootstrap failed: HTTP ${response.status}`);
    }
    await response.text();
    this.bootstrapped = true;
    this.bootstrapPromise = null;
  }

  async requestText(url) {
    const isAssistApi = url.startsWith(`${ASSIST_BASE_URL}/api/`);
    if (isAssistApi) {
      await this.bootstrap();
    }

    let attempt = 0;
    let lastError = null;
    while (attempt <= this.maxRetries) {
      attempt += 1;
      await this.limiter.waitTurn();

      try {
        const headers = {
          "User-Agent": this.userAgent,
          Accept: "application/json, text/plain, */*",
          Referer: `${ASSIST_BASE_URL}/`,
        };

        const cookies = cookieHeader(this.jar);
        if (cookies) headers.Cookie = cookies;
        const xsrfToken = this.jar.get("X-XSRF-TOKEN");
        if (isAssistApi && xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;
        if (this.apiKey) {
          headers[this.apiKeyHeader] = this.apiKeyHeader.toLowerCase() === "authorization"
            ? `Bearer ${this.apiKey}`
            : this.apiKey;
        }

        const response = await fetch(url, { headers });
        setCookiesFromHeaders(response.headers, this.jar);
        const text = await response.text();
        if (response.ok) return text;

        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
        if (!retryable || attempt > this.maxRetries) {
          throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 300)}`);
        }

        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(30000, 800 * 2 ** (attempt - 1));
        await sleep(waitMs);
      } catch (error) {
        lastError = error;
        if (attempt > this.maxRetries) break;
        await sleep(Math.min(30000, 800 * 2 ** (attempt - 1)));
      }
    }

    throw lastError || new Error(`Request failed for ${url}`);
  }

  async fetchJsonCached(url, cachePath, options = {}) {
    const force = options.force ?? this.force;
    if (!force && fileExists(cachePath)) {
      const text = fs.readFileSync(cachePath, "utf8");
      return {
        data: JSON.parse(text),
        hash: sha256Text(text),
        fromCache: true,
        cachePath,
      };
    }

    const text = await this.requestText(url);
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON from ${url}: ${error.message}`);
    }

    const pretty = `${JSON.stringify(data, null, 2)}\n`;
    ensureParent(cachePath);
    fs.writeFileSync(cachePath, pretty);
    return {
      data,
      hash: sha256Text(pretty),
      fromCache: false,
      cachePath,
    };
  }
}

function assistApiUrl(pathname, params = {}) {
  const url = new URL(pathname, ASSIST_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchAcademicYears(client, manifest) {
  const url = assistApiUrl("/api/AcademicYears");
  const cachePath = path.join(RAW_ROOT, "metadata", "academic-years.json");
  const result = await client.fetchJsonCached(url, cachePath);
  manifest.metadata.academicYears = {
    url,
    path: toRelative(cachePath),
    contentHash: result.hash,
    lastCheckedAt: nowIso(),
  };
  return result.data;
}

async function fetchInstitutions(client, manifest) {
  const url = assistApiUrl("/api/institutions");
  const cachePath = path.join(RAW_ROOT, "metadata", "institutions.json");
  const result = await client.fetchJsonCached(url, cachePath);
  manifest.metadata.institutions = {
    url,
    path: toRelative(cachePath),
    contentHash: result.hash,
    lastCheckedAt: nowIso(),
  };
  return result.data;
}

async function fetchSbccPartners(client, manifest) {
  const url = assistApiUrl(`/api/institutions/${SBCC_INSTITUTION_ID}/agreements`);
  const cachePath = path.join(RAW_ROOT, "metadata", "sbcc-agreement-partners.json");
  const result = await client.fetchJsonCached(url, cachePath);
  manifest.metadata.sbccAgreementPartners = {
    url,
    path: toRelative(cachePath),
    contentHash: result.hash,
    lastCheckedAt: nowIso(),
  };
  return result.data;
}

function academicYearId(year) {
  return Number(year?.Id ?? year?.id);
}

function academicYearFallYear(year) {
  return Number(year?.FallYear ?? year?.fallYear ?? year?.code?.slice?.(0, 4));
}

function normalizeAcademicYear(year) {
  const id = academicYearId(year);
  const fallYear = academicYearFallYear(year);
  const label = trimString(year?.code) || (Number.isFinite(fallYear) ? `${fallYear}-${fallYear + 1}` : "");
  return {
    id,
    label,
    fallYear: Number.isFinite(fallYear) ? fallYear : null,
  };
}

function pickInstitutionName(institution, fallYear = null) {
  const names = Array.isArray(institution?.names) ? institution.names : [];
  const visibleNames = names.filter((name) => !name.hideInList);
  const eligible = visibleNames
    .filter((name) => fallYear == null || !Number.isFinite(Number(name.fromYear)) || Number(name.fromYear) <= fallYear)
    .sort((a, b) => Number(b.fromYear || 0) - Number(a.fromYear || 0));
  return trimString(eligible[0]?.name || visibleNames[0]?.name || names[0]?.name || institution?.institutionName);
}

function segmentFromCategory(category) {
  if (typeof category === "string") return INSTITUTION_CATEGORY_SEGMENTS.get(category.trim().toUpperCase()) || category.trim();
  return INSTITUTION_CATEGORY_SEGMENTS.get(category) || "UNKNOWN";
}

function normalizeInstitution(institution, fallYear = null) {
  if (!institution) return null;
  return {
    id: Number(institution.id ?? institution.institutionParentId),
    name: pickInstitutionName(institution, fallYear),
    code: trimCode(institution.code),
    segment: segmentFromCategory(institution.category),
  };
}

function buildSbccTransferPartners(partners, institutions, yearId, segments) {
  const institutionById = new Map((institutions || []).map((institution) => [Number(institution.id), institution]));
  const segmentSet = new Set(segments);
  const rowsById = new Map();

  for (const partner of partners || []) {
    const id = Number(partner.institutionParentId ?? partner.id);
    const institution = institutionById.get(id);
    const segment = segmentFromCategory(institution?.category ?? partner.category);
    if (!segmentSet.has(segment)) continue;
    if (yearId && !new Set(partner.receivingYearIds || []).has(Number(yearId))) continue;

    const existing = rowsById.get(id);
    const receivingYearIds = unique([
      ...(existing?.receivingYearIds || []),
      ...(partner.receivingYearIds || []),
    ].map((value) => String(value))).map(Number).sort((a, b) => a - b);

    rowsById.set(id, {
      id,
      name: pickInstitutionName(institution || partner),
      code: trimCode(institution?.code ?? partner.code),
      segment,
      isCommunityCollege: Boolean(institution?.isCommunityCollege ?? partner.isCommunityCollege),
      receivingYearIds,
    });
  }

  return Array.from(rowsById.values())
    .filter((partner) => !partner.isCommunityCollege)
    .sort((a, b) => a.segment.localeCompare(b.segment) || a.name.localeCompare(b.name));
}

function resolveYear(academicYears, partners, explicitYearId = null) {
  const sortedYears = [...(academicYears || [])].sort((a, b) => academicYearFallYear(b) - academicYearFallYear(a));
  if (explicitYearId) {
    const match = sortedYears.find((year) => academicYearId(year) === Number(explicitYearId));
    if (!match) throw new Error(`Academic year id ${explicitYearId} was not found in ASSIST AcademicYears.`);
    return match;
  }

  const partnerYearIds = new Set();
  for (const partner of partners || []) {
    for (const yearId of partner.receivingYearIds || []) partnerYearIds.add(Number(yearId));
  }
  const latestWithSbccAgreements = sortedYears.find((year) => partnerYearIds.has(academicYearId(year)));
  return latestWithSbccAgreements || sortedYears[0];
}

function categoryListPath(yearId, receivingId, categoryCode) {
  return path.join(RAW_ROOT, "lists", `year-${yearId}`, `receiving-${receivingId}`, `${categoryCode}.json`);
}

async function fetchAgreementCategories(client, manifest, yearId, receivingId) {
  const url = assistApiUrl("/api/agreements/categories", {
    receivingInstitutionId: receivingId,
    sendingInstitutionId: SBCC_INSTITUTION_ID,
    academicYearId: yearId,
  });
  const cachePath = path.join(RAW_ROOT, "lists", `year-${yearId}`, `receiving-${receivingId}`, "categories.json");
  const result = await client.fetchJsonCached(url, cachePath);
  manifest.lists[`year-${yearId}/receiving-${receivingId}/categories`] = {
    url,
    path: toRelative(cachePath),
    contentHash: result.hash,
    lastCheckedAt: nowIso(),
  };
  return result.data;
}

async function fetchAgreementList(client, manifest, yearId, receivingId, categoryCode) {
  const url = assistApiUrl("/api/agreements", {
    receivingInstitutionId: receivingId,
    sendingInstitutionId: SBCC_INSTITUTION_ID,
    academicYearId: yearId,
    categoryCode,
  });
  const cachePath = categoryListPath(yearId, receivingId, categoryCode);
  const result = await client.fetchJsonCached(url, cachePath);
  manifest.lists[`year-${yearId}/receiving-${receivingId}/${categoryCode}`] = {
    url,
    path: toRelative(cachePath),
    contentHash: result.hash,
    lastCheckedAt: nowIso(),
  };
  return result.data;
}

function reportsFromAgreementList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.reports)) return value.reports;
  return [];
}

function parseAgreementKey(key) {
  const parts = String(key || "").split("/");
  return {
    academicYearId: Number(parts[0]),
    sendingInstitutionId: Number(parts[1]),
    direction: parts[2] || "",
    receivingInstitutionId: Number(parts[3]),
    type: parts[4] || "Unknown",
    id: parts.slice(5).join("/"),
  };
}

function agreementRawPath(key) {
  const parsed = parseAgreementKey(key);
  const typeSlug = safeSlug(parsed.type, "agreement");
  const keyHash = sha256Text(key).slice(0, 16);
  return path.join(
    RAW_ROOT,
    "agreements",
    `year-${parsed.academicYearId || "unknown"}`,
    `receiving-${parsed.receivingInstitutionId || "unknown"}`,
    typeSlug,
    `${keyHash}.json`,
  );
}

function agreementNormalizedPath(normalized) {
  const keyHash = sha256Text(normalized.agreement.key).slice(0, 16);
  const yearId = normalized.academicYear.id || "unknown";
  const receivingId = normalized.receivingInstitution.id || "unknown";
  const typeSlug = safeSlug(normalized.agreement.type, "agreement");
  const nameSlug = safeSlug(normalized.agreement.name, "agreement");
  return path.join(
    NORMALIZED_ROOT,
    `year-${yearId}`,
    `receiving-${receivingId}`,
    typeSlug,
    `${nameSlug}-${keyHash}.json`,
  );
}

function agreementApiUrl(key) {
  return assistApiUrl("/api/articulation/Agreements", { Key: key });
}

function agreementSourceUrl(normalizedKey, academicYear, sendingInstitution, receivingInstitution) {
  const url = new URL("/transfer/results", ASSIST_BASE_URL);
  url.searchParams.set("year", String(academicYear.id || ""));
  url.searchParams.set("institution", String(sendingInstitution.id || SBCC_INSTITUTION_ID));
  url.searchParams.set("agreement", String(receivingInstitution.id || ""));
  url.searchParams.set("agreementType", "to");
  url.searchParams.set("view", "agreement");
  url.searchParams.set("keyName", normalizedKey);
  return url.toString();
}

function parseJsonField(value, fieldName, parseErrors) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    parseErrors.push({ field: fieldName, message: error.message });
    return value;
  }
}

function stripHtml(value) {
  return trimString(String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "));
}

function normalizeAttributes(attributes) {
  if (!Array.isArray(attributes)) return [];
  return attributes
    .map((attribute) => {
      if (typeof attribute === "string") return { content: trimString(attribute) };
      return {
        id: attribute.id ?? null,
        position: numberOrNull(attribute.position),
        content: trimString(attribute.content ?? attribute.name ?? attribute.description),
      };
    })
    .filter((attribute) => attribute.content || attribute.id != null);
}

function normalizeAdvisements(advisements) {
  if (!Array.isArray(advisements)) return [];
  return advisements.map((advisement) => ({
    id: advisement.id ?? null,
    position: numberOrNull(advisement.position),
    content: trimString(advisement.content ?? advisement.text ?? advisement.name),
  }));
}

function normalizeCourse(course, extras = {}) {
  if (!course) return null;
  return {
    id: course.id ?? null,
    courseIdentifierParentId: course.courseIdentifierParentId ?? null,
    prefix: trimCode(course.prefix),
    courseNumber: trimCode(course.courseNumber),
    title: trimString(course.courseTitle ?? course.title),
    minUnits: numberOrNull(course.minUnits),
    maxUnits: numberOrNull(course.maxUnits),
    beginTerm: trimCode(course.begin),
    endTerm: trimCode(course.end),
    department: trimString(course.department),
    departmentParentId: course.departmentParentId ?? null,
    prefixDescription: trimString(course.prefixDescription),
    prefixParentId: course.prefixParentId ?? null,
    attributes: normalizeAttributes(extras.attributes ?? course.attributes),
    courseAttributes: normalizeAttributes(extras.courseAttributes ?? course.courseAttributes),
    requisites: Array.isArray(extras.requisites ?? course.requisites) ? (extras.requisites ?? course.requisites) : [],
    visibleCrossListedCourses: Array.isArray(extras.visibleCrossListedCourses ?? course.visibleCrossListedCourses)
      ? (extras.visibleCrossListedCourses ?? course.visibleCrossListedCourses).map((crossListedCourse) => normalizeCourse(crossListedCourse)).filter(Boolean)
      : [],
    hiddenCrossListedCourses: Array.isArray(extras.hiddenCrossListedCourses ?? course.hiddenCrossListedCourses)
      ? (extras.hiddenCrossListedCourses ?? course.hiddenCrossListedCourses).map((crossListedCourse) => normalizeCourse(crossListedCourse)).filter(Boolean)
      : [],
    pathways: Array.isArray(course.pathways) ? course.pathways : [],
  };
}

function normalizeConjunction(value) {
  const normalized = trimString(value).toUpperCase();
  if (normalized === "AND") return "AND";
  if (normalized === "OR") return "OR";
  return "UNKNOWN";
}

function normalizeInstruction(instruction) {
  if (!instruction) return null;
  const type = trimString(instruction.type);
  if (type === "Conjunction") {
    return {
      type,
      logic: normalizeConjunction(instruction.conjunction),
      selectionType: trimString(instruction.selectionType),
    };
  }
  if (type === "NFromArea") {
    return {
      type,
      logic: "UNKNOWN",
      amount: numberOrNull(instruction.amount),
      amountUnitType: trimString(instruction.amountUnitType),
      amountQuantifier: trimString(instruction.amountQuantifier),
      toAmount: numberOrNull(instruction.toAmount),
      toAmountDeterminer: trimString(instruction.toAmountDeterminer),
      areaType: trimString(instruction.areaType),
      selectionType: trimString(instruction.selectionType),
    };
  }
  return {
    type: type || "UNKNOWN",
    logic: "UNKNOWN",
  };
}

function coursesFromReceivingCell(cell) {
  if (!cell) return [];
  if (cell.type === "Course") {
    return [normalizeCourse(cell.course, cell)].filter(Boolean);
  }
  if (cell.type === "Series") {
    return (cell.series?.courses || []).map((course) => normalizeCourse(course, cell)).filter(Boolean);
  }
  return [];
}

function normalizeReceivingCell(cell) {
  const item = {
    id: cell.id ?? null,
    type: trimString(cell.type) || "UNKNOWN",
    position: numberOrNull(cell.position),
    logic: "UNKNOWN",
    name: "",
    courses: coursesFromReceivingCell(cell),
    attributes: normalizeAttributes(cell.attributes),
    courseAttributes: normalizeAttributes(cell.courseAttributes ?? cell.seriesAttributes),
    advisements: normalizeAdvisements(cell.advisements),
  };

  if (cell.type === "Series") {
    item.logic = normalizeConjunction(cell.series?.conjunction);
    item.name = trimString(cell.series?.name);
    item.seriesPathways = Array.isArray(cell.series?.seriesPathways) ? cell.series.seriesPathways : [];
  }

  return item;
}

function normalizeSendingItem(item) {
  if (!item) return { type: "UNKNOWN", courses: [] };
  if (item.type === "Course") {
    return {
      type: "Course",
      courses: [normalizeCourse(item, item)].filter(Boolean),
      attributes: normalizeAttributes(item.attributes),
    };
  }
  if (item.type === "Series") {
    return {
      type: "Series",
      logic: normalizeConjunction(item.series?.conjunction),
      name: trimString(item.series?.name),
      courses: (item.series?.courses || []).map((course) => normalizeCourse(course, item)).filter(Boolean),
      attributes: normalizeAttributes(item.attributes ?? item.seriesAttributes),
    };
  }
  return {
    type: trimString(item.type) || "UNKNOWN",
    courses: [],
    attributes: normalizeAttributes(item.attributes),
  };
}

function deriveSendingLogic(groups, conjunctions) {
  const explicit = unique((conjunctions || []).map((item) => normalizeConjunction(item.groupConjunction)));
  if (explicit.length === 1 && explicit[0] !== "UNKNOWN") return explicit[0];
  if (groups.length === 1) return groups[0].logic || "UNKNOWN";
  return "UNKNOWN";
}

function normalizeSendingArticulation(articulationRecord, receivingCellId) {
  const articulation = articulationRecord?.articulation || articulationRecord;
  const sending = articulation?.sendingArticulation;
  if (!sending) {
    return {
      receivingCellId,
      logic: "UNKNOWN",
      courses: [],
      courseGroups: [],
      noArticulationReason: "NO_SENDING_ARTICULATION_IN_SOURCE",
      deniedCourses: [],
      attributes: [],
      rawConjunctions: [],
    };
  }

  const courseGroups = (sending.items || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((group) => {
      const normalizedItems = (group.items || []).map((item) => normalizeSendingItem(item));
      return {
        type: trimString(group.type) || "CourseGroup",
        position: numberOrNull(group.position),
        logic: normalizeConjunction(group.courseConjunction),
        courses: normalizedItems.flatMap((item) => item.courses),
        items: normalizedItems,
        attributes: normalizeAttributes(group.attributes),
      };
    });

  return {
    receivingCellId,
    logic: deriveSendingLogic(courseGroups, sending.courseGroupConjunctions),
    courses: courseGroups.flatMap((group) => group.courses),
    courseGroups,
    noArticulationReason: sending.noArticulationReason ?? null,
    deniedCourses: Array.isArray(sending.deniedCourses)
      ? sending.deniedCourses.map((course) => normalizeCourse(course)).filter(Boolean)
      : [],
    attributes: normalizeAttributes(sending.attributes),
    rawConjunctions: Array.isArray(sending.courseGroupConjunctions) ? sending.courseGroupConjunctions : [],
  };
}

function normalizeTemplateNotes(templateAssets) {
  return templateAssets
    .filter((asset) => ["GeneralText", "GeneralTitle"].includes(asset.type))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((asset) => ({
      id: asset.groupId ?? null,
      type: asset.type,
      area: trimString(asset.area),
      position: numberOrNull(asset.position),
      content: asset.type === "GeneralText" ? stripHtml(asset.content) : trimString(asset.content),
      contentHtml: asset.type === "GeneralText" ? String(asset.content || "") : null,
    }));
}

function titleForGroup(requirementTitles, group) {
  const groupPosition = Number(group.position || 0);
  const title = requirementTitles
    .filter((asset) => Number(asset.position || 0) <= groupPosition)
    .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))[0];
  return trimString(title?.content) || "Requirement Group";
}

function normalizeRequirementSection(section, group, articulationByCellId, sectionIndex) {
  const instruction = normalizeInstruction(group.instruction);
  const rows = (section.rows || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));

  const receivingItems = rows.flatMap((row) => (row.cells || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((cell) => ({
      ...normalizeReceivingCell(cell),
      rowPosition: numberOrNull(row.position),
      rowAttributes: normalizeAttributes(row.attributes),
    })));

  const sbccArticulations = receivingItems.map((item) => {
    const record = articulationByCellId.get(item.id);
    if (record) return normalizeSendingArticulation(record, item.id);
    return {
      receivingCellId: item.id,
      logic: "UNKNOWN",
      courses: [],
      courseGroups: [],
      noArticulationReason: "NO_ARTICULATION_RECORD_FOR_TEMPLATE_CELL",
      deniedCourses: [],
      attributes: [],
      rawConjunctions: [],
    };
  });

  return {
    id: `${group.groupId || "group"}:section-${section.position ?? sectionIndex}`,
    position: numberOrNull(section.position),
    logic: instruction?.logic || "UNKNOWN",
    selection: instruction,
    receivingCourses: receivingItems.flatMap((item) => item.courses),
    receivingItems,
    sbccArticulations,
    advisements: normalizeAdvisements(section.advisements),
    attributes: normalizeAttributes(section.attributes),
    rawTemplateCellIds: receivingItems.map((item) => item.id).filter(Boolean),
  };
}

function normalizeRequirementGroups(templateAssets, articulations) {
  const requirementAssets = templateAssets
    .filter((asset) => asset.area === "Requirements")
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  const requirementTitles = requirementAssets.filter((asset) => asset.type === "RequirementTitle");
  const articulationByCellId = new Map((articulations || []).map((record) => [record.templateCellId, record]));

  return requirementAssets
    .filter((asset) => asset.type === "RequirementGroup")
    .map((group, groupIndex) => {
      const instruction = normalizeInstruction(group.instruction);
      return {
        id: group.groupId || `requirement-group-${groupIndex + 1}`,
        title: titleForGroup(requirementTitles, group),
        position: numberOrNull(group.position),
        logic: instruction?.logic || "UNKNOWN",
        selection: instruction,
        hideSectionLetters: Boolean(group.hideSectionLetters),
        showConjunctionBetweenSections: Boolean(group.showConjunctionBetweenSections),
        advisements: normalizeAdvisements(group.advisements),
        attributes: normalizeAttributes(group.attributes),
        sections: (group.sections || [])
          .slice()
          .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
          .map((section, sectionIndex) => normalizeRequirementSection(section, group, articulationByCellId, sectionIndex)),
      };
    });
}

function normalizeAgreementResponse(apiResponse, context = {}) {
  const parseErrors = [];
  const result = apiResponse?.result;
  if (!result) throw new Error("ASSIST agreement response does not include result.");

  const receivingInstitution = parseJsonField(result.receivingInstitution, "receivingInstitution", parseErrors);
  const sendingInstitution = parseJsonField(result.sendingInstitution, "sendingInstitution", parseErrors);
  const academicYear = parseJsonField(result.academicYear, "academicYear", parseErrors);
  const catalogYear = parseJsonField(result.catalogYear, "catalogYear", parseErrors);
  const templateAssets = parseJsonField(result.templateAssets, "templateAssets", parseErrors);
  const articulations = parseJsonField(result.articulations, "articulations", parseErrors);
  const normalizedAcademicYear = normalizeAcademicYear(academicYear);
  const normalizedSendingInstitution = normalizeInstitution(sendingInstitution, normalizedAcademicYear.fallYear) || {
    id: SBCC_INSTITUTION_ID,
    name: "Santa Barbara City College",
    code: "SBCC",
    segment: "CCC",
  };
  const normalizedReceivingInstitution = normalizeInstitution(receivingInstitution, normalizedAcademicYear.fallYear) || {
    id: parseAgreementKey(context.key).receivingInstitutionId,
    name: "",
    code: "",
    segment: context.segment || "UNKNOWN",
  };
  const key = context.key || result.key || "";

  const normalized = {
    source: "ASSIST",
    sendingInstitution: normalizedSendingInstitution,
    receivingInstitution: normalizedReceivingInstitution,
    academicYear: normalizedAcademicYear,
    agreement: {
      key,
      type: trimString(result.type || parseAgreementKey(key).type),
      name: trimString(result.name || context.label),
      publishDate: result.publishDate ?? null,
      catalogYear,
    },
    requirementGroups: normalizeRequirementGroups(Array.isArray(templateAssets) ? templateAssets : [], Array.isArray(articulations) ? articulations : []),
    notes: normalizeTemplateNotes(Array.isArray(templateAssets) ? templateAssets : []),
    parseErrors,
    lastCheckedAt: nowIso(),
    sourceUrl: "",
    sourceApiUrl: agreementApiUrl(key),
    rawDataReference: {
      rawAgreementPath: context.rawPath ? toRelative(context.rawPath) : "",
      templateAssetCount: Array.isArray(templateAssets) ? templateAssets.length : 0,
      articulationCount: Array.isArray(articulations) ? articulations.length : 0,
    },
  };

  normalized.sourceUrl = agreementSourceUrl(
    key,
    normalized.academicYear,
    normalized.sendingInstitution,
    normalized.receivingInstitution,
  );

  return normalized;
}

async function fetchAndNormalizeAgreement(client, manifest, task, options = {}) {
  const rawPath = agreementRawPath(task.key);
  const existing = manifest.agreements[task.key];
  const normalizedPath = existing?.normalizedPath ? toAbsolute(existing.normalizedPath) : null;
  const canSkip = existing
    && !parseBoolean(options.force)
    && !parseBoolean(options.renormalize)
    && existing.rawPath
    && existing.normalizedPath
    && fileExists(toAbsolute(existing.rawPath))
    && fileExists(toAbsolute(existing.normalizedPath));

  if (canSkip) {
    return { status: "skipped", key: task.key, normalizedPath: toAbsolute(existing.normalizedPath), parseErrors: [] };
  }

  const result = await client.fetchJsonCached(agreementApiUrl(task.key), rawPath, { force: parseBoolean(options.force) });
  const normalized = normalizeAgreementResponse(result.data, {
    key: task.key,
    label: task.label,
    segment: task.segment,
    rawPath,
  });
  const outputPath = normalizedPath || agreementNormalizedPath(normalized);
  writeJsonFile(outputPath, normalized);

  manifest.agreements[task.key] = {
    key: task.key,
    label: normalized.agreement.name,
    type: normalized.agreement.type,
    publishDate: normalized.agreement.publishDate,
    academicYearId: normalized.academicYear.id,
    receivingInstitutionId: normalized.receivingInstitution.id,
    receivingInstitutionName: normalized.receivingInstitution.name,
    segment: normalized.receivingInstitution.segment,
    sourceApiUrl: normalized.sourceApiUrl,
    sourceUrl: normalized.sourceUrl,
    rawPath: toRelative(rawPath),
    normalizedPath: toRelative(outputPath),
    contentHash: result.hash,
    lastCheckedAt: normalized.lastCheckedAt,
  };

  return {
    status: result.fromCache ? "normalized-from-cache" : "fetched",
    key: task.key,
    normalizedPath: outputPath,
    normalized,
    parseErrors: normalized.parseErrors || [],
  };
}

async function getMetadata(client, manifest, options) {
  const [academicYears, institutions, partners] = await Promise.all([
    fetchAcademicYears(client, manifest),
    fetchInstitutions(client, manifest),
    fetchSbccPartners(client, manifest),
  ]);
  const requestedSegments = parseCsv(options.segments, DEFAULT_SEGMENTS);
  const allSegmentPartners = buildSbccTransferPartners(partners, institutions, null, requestedSegments);
  const selectedYear = resolveYear(academicYears, allSegmentPartners, options["year-id"]);
  const year = normalizeAcademicYear(selectedYear);
  const transferPartners = buildSbccTransferPartners(partners, institutions, year.id, requestedSegments);
  return {
    academicYears,
    institutions,
    partners,
    requestedSegments,
    selectedYear,
    year,
    transferPartners,
  };
}

function summarizePartnerCounts(partners) {
  return {
    ucCampusesFound: partners.filter((partner) => partner.segment === "UC").length,
    csuCampusesFound: partners.filter((partner) => partner.segment === "CSU").length,
  };
}

async function commandPartners(client, manifest, options) {
  const metadata = await getMetadata(client, manifest, options);
  const counts = summarizePartnerCounts(metadata.transferPartners);
  console.log(`Academic year: ${metadata.year.label} (id ${metadata.year.id})`);
  console.log(`UC campuses found: ${counts.ucCampusesFound}`);
  console.log(`CSU campuses found: ${counts.csuCampusesFound}`);
  for (const partner of metadata.transferPartners) {
    console.log(`${partner.segment.padEnd(3)} ${String(partner.id).padStart(3)} ${partner.code.padEnd(8)} ${partner.name}`);
  }
}

async function commandList(client, manifest, options) {
  const receivingId = Number(options["receiving-id"]);
  if (!receivingId) throw new Error("list requires --receiving-id <id>.");
  const metadata = await getMetadata(client, manifest, options);
  const category = String(options.category || "major");
  const list = await fetchAgreementList(client, manifest, metadata.year.id, receivingId, category);
  const reports = reportsFromAgreementList(list);
  const limit = Number(options.limit || reports.length);

  console.log(`Academic year: ${metadata.year.label} (id ${metadata.year.id})`);
  console.log(`Receiving institution id: ${receivingId}`);
  console.log(`Category: ${category}`);
  console.log(`Agreements: ${reports.length}`);
  for (const report of reports.slice(0, limit)) {
    console.log(`${report.key}\t${report.label}`);
  }
}

async function commandFetchOne(client, manifest, options) {
  const key = String(options.key || options._?.[0] || "").trim();
  if (!key) throw new Error("fetch-one requires --key <agreement-key>.");

  const result = await fetchAndNormalizeAgreement(client, manifest, { key, label: options.label || "" }, options);
  writeManifest(manifest);

  const normalized = result.normalized || readJsonFile(result.normalizedPath);
  const firstGroup = normalized.requirementGroups[0] || null;
  const firstSection = firstGroup?.sections?.[0] || null;
  const sample = {
    source: normalized.source,
    sendingInstitution: normalized.sendingInstitution,
    receivingInstitution: normalized.receivingInstitution,
    academicYear: normalized.academicYear,
    agreement: normalized.agreement,
    requirementGroupCount: normalized.requirementGroups.length,
    firstRequirementGroup: firstGroup ? {
      id: firstGroup.id,
      title: firstGroup.title,
      logic: firstGroup.logic,
      sectionCount: firstGroup.sections.length,
      firstSection: firstSection ? {
        id: firstSection.id,
        logic: firstSection.logic,
        receivingCourses: firstSection.receivingCourses,
        sbccArticulations: firstSection.sbccArticulations,
        rawTemplateCellIds: firstSection.rawTemplateCellIds,
      } : null,
    } : null,
    parseErrors: normalized.parseErrors,
  };

  console.log(`Status: ${result.status}`);
  console.log(`Raw cache: ${toRelative(agreementRawPath(key))}`);
  console.log(`Normalized output: ${toRelative(result.normalizedPath)}`);
  console.log(JSON.stringify(sample, null, 2));
}

async function runLimited(tasks, concurrency, worker) {
  const results = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(3, Number(concurrency) || 1));

  async function runWorker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(tasks[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function commandFetchAll(client, manifest, options) {
  const metadata = await getMetadata(client, manifest, options);
  const receivingIdFilter = options["receiving-id"] ? Number(options["receiving-id"]) : null;
  const partners = receivingIdFilter
    ? metadata.transferPartners.filter((partner) => partner.id === receivingIdFilter)
    : metadata.transferPartners;
  const counts = summarizePartnerCounts(metadata.transferPartners);
  const listCategories = parseCsv(options["list-categories"], DEFAULT_LIST_CATEGORIES);
  const fullCategories = new Set(parseCsv(options["full-categories"], DEFAULT_FULL_CATEGORIES));
  const dryRun = parseBoolean(options["dry-run"]);
  const limit = Number(options.limit || 0);
  const report = {
    startedAt: nowIso(),
    completedAt: null,
    dryRun,
    academicYear: metadata.year,
    segments: metadata.requestedSegments,
    receivingInstitutionFilter: receivingIdFilter,
    ucCampusesFound: counts.ucCampusesFound,
    csuCampusesFound: counts.csuCampusesFound,
    campusesSelected: partners.length,
    agreementListsFetched: 0,
    agreementListReportsFound: 0,
    majorAgreementsQueued: 0,
    majorAgreementsFetched: 0,
    agreementsSkippedCached: 0,
    agreementsNormalizedFromCache: 0,
    agreementsWithParseErrors: 0,
    metadataErrors: [],
    parseErrors: [],
    sampleNormalizedOutputPath: null,
  };

  const fullAgreementTasks = [];
  for (const partner of partners) {
    let categories = [];
    try {
      categories = await fetchAgreementCategories(client, manifest, metadata.year.id, partner.id);
    } catch (error) {
      report.metadataErrors.push({
        receivingInstitutionId: partner.id,
        receivingInstitutionName: partner.name,
        stage: "categories",
        message: error.message,
      });
      continue;
    }
    const categoryCodes = new Set((categories || []).filter((category) => category.hasReports !== false).map((category) => category.code));

    for (const category of listCategories) {
      if (!categoryCodes.has(category)) continue;
      let list;
      try {
        list = await fetchAgreementList(client, manifest, metadata.year.id, partner.id, category);
      } catch (error) {
        report.metadataErrors.push({
          receivingInstitutionId: partner.id,
          receivingInstitutionName: partner.name,
          stage: `list:${category}`,
          message: error.message,
        });
        continue;
      }
      const reports = reportsFromAgreementList(list);
      report.agreementListsFetched += 1;
      report.agreementListReportsFound += reports.length;

      if (!fullCategories.has(category)) continue;
      for (const item of reports) {
        fullAgreementTasks.push({
          key: item.key,
          label: item.label,
          ownerInstitutionId: item.ownerInstitutionId,
          category,
          receivingInstitutionId: partner.id,
          receivingInstitutionName: partner.name,
          segment: partner.segment,
        });
      }
    }
  }

  const limitedTasks = limit > 0 ? fullAgreementTasks.slice(0, limit) : fullAgreementTasks;
  report.majorAgreementsQueued = fullAgreementTasks.filter((task) => task.category === "major").length;

  if (dryRun) {
    report.completedAt = nowIso();
    writeRunReport(report, manifest);
    printRunReport(report);
    console.log("Dry run: full agreement downloads were skipped.");
    return;
  }

  const results = await runLimited(limitedTasks, options.concurrency || 1, async (task, index) => {
    try {
      const result = await fetchAndNormalizeAgreement(client, manifest, task, options);
      if (result.status === "skipped") report.agreementsSkippedCached += 1;
      if (result.status === "normalized-from-cache") report.agreementsNormalizedFromCache += 1;
      if (result.status === "fetched" && task.category === "major") report.majorAgreementsFetched += 1;
      if (!report.sampleNormalizedOutputPath && result.normalizedPath) {
        report.sampleNormalizedOutputPath = toRelative(result.normalizedPath);
      }
      if (result.parseErrors?.length) {
        report.agreementsWithParseErrors += 1;
        report.parseErrors.push({ key: task.key, errors: result.parseErrors });
      }
      if ((index + 1) % 10 === 0 || index === limitedTasks.length - 1) {
        console.log(`Processed ${index + 1}/${limitedTasks.length} full agreements.`);
      }
      return result;
    } catch (error) {
      report.agreementsWithParseErrors += 1;
      report.parseErrors.push({ key: task.key, errors: [{ message: error.message }] });
      console.error(`Failed ${task.key}: ${error.message}`);
      return { status: "failed", key: task.key, error };
    }
  });

  report.completedAt = nowIso();
  report.failedAgreements = results.filter((result) => result.status === "failed").length;
  writeRunReport(report, manifest);
  printRunReport(report);
}

function writeRunReport(report, manifest) {
  ensureDir(REPORTS_ROOT);
  const timestampSlug = report.startedAt.replace(/[:.]/g, "-");
  const reportPath = path.join(REPORTS_ROOT, `assist-import-${timestampSlug}.json`);
  writeJsonFile(reportPath, report);
  writeJsonFile(path.join(REPORTS_ROOT, "last-run.json"), report);
  manifest.runs.push({
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    dryRun: report.dryRun,
    academicYearId: report.academicYear.id,
    path: toRelative(reportPath),
  });
  writeManifest(manifest);
}

function printRunReport(report) {
  console.log(`Academic year: ${report.academicYear.label} (id ${report.academicYear.id})`);
  console.log(`UC campuses found: ${report.ucCampusesFound}`);
  console.log(`CSU campuses found: ${report.csuCampusesFound}`);
  console.log(`Campuses selected: ${report.campusesSelected}`);
  console.log(`Agreement lists fetched: ${report.agreementListsFetched}`);
  console.log(`Agreement list reports found: ${report.agreementListReportsFound}`);
  console.log(`Major agreements queued: ${report.majorAgreementsQueued}`);
  console.log(`Major agreements fetched: ${report.majorAgreementsFetched}`);
  console.log(`Agreements normalized from cache: ${report.agreementsNormalizedFromCache}`);
  console.log(`Agreements skipped from cache: ${report.agreementsSkippedCached}`);
  console.log(`Agreements with parse errors: ${report.agreementsWithParseErrors}`);
  console.log(`Metadata/list errors: ${report.metadataErrors?.length || 0}`);
  if (report.sampleNormalizedOutputPath) {
    console.log(`Sample normalized output: ${report.sampleNormalizedOutputPath}`);
  }
}

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));
  if (command === "help" || options.help) {
    printHelp();
    return;
  }

  ensureDir(DATA_ROOT);
  const manifest = readManifest();
  const client = new AssistClient(options);

  if (command === "partners") {
    await commandPartners(client, manifest, options);
    writeManifest(manifest);
    return;
  }
  if (command === "list") {
    await commandList(client, manifest, options);
    writeManifest(manifest);
    return;
  }
  if (command === "fetch-one") {
    await commandFetchOne(client, manifest, options);
    return;
  }
  if (command === "fetch-all") {
    await commandFetchAll(client, manifest, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
