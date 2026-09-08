import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AssistClient } from "./importAssistAgreements.mjs";

const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const read = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const reportPath = path.resolve(option("--report") || "app/data/assist/reports/last-run.json");
const report = read(reportPath);
if (report.dryRun || !report.completedAt) throw new Error("Live comparison requires a completed full import report.");
const manifest = read("app/data/assist/cache-manifest.json");
const client = new AssistClient({});
const embeddedFields = new Set(["receivingInstitution", "sendingInstitution", "academicYear", "catalogYear", "templateAssets", "articulations"]);

function canonical(value, field = "") {
  if (embeddedFields.has(field) && typeof value === "string" && ["{", "["].includes(value.trimStart()[0])) value = JSON.parse(value);
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key], key)]));
  }
  return value;
}

const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const result = { startedAt: new Date().toISOString(), completedAt: null, reportPath: path.relative(process.cwd(), reportPath), samples: [], errors: [] };
for (const campus of report.campuses) {
  const id = campus.receivingInstitutionId;
  const year = campus.academicYear.id;
  const list = read(`app/data/assist/raw/lists/year-${year}/receiving-${id}/major.json`);
  const sample = [...list.reports].sort((left, right) => left.key.localeCompare(right.key))[0];
  if (!sample) {
    result.errors.push({ id, year, message: "No major agreement is available to sample." });
    continue;
  }
  try {
    const entry = manifest.agreements[sample.key];
    const cached = read(entry.rawPath);
    const url = new URL("https://www.assist.org/api/articulation/Agreements");
    url.searchParams.set("Key", sample.key);
    const live = JSON.parse(await client.requestText(url.toString()));
    const cachedHash = digest(cached);
    const liveHash = digest(live);
    const matches = cachedHash === liveHash;
    result.samples.push({
      receivingInstitutionId: id, receivingInstitutionName: campus.receivingInstitutionName,
      academicYear: campus.academicYear.label, key: sample.key, label: sample.label,
      checkedAt: new Date().toISOString(), matches, cachedHash, liveHash, sourceApiUrl: url.toString(),
    });
    if (!matches) result.errors.push({ key: sample.key, message: "Live ASSIST content differs from the cached response." });
    console.log(`${matches ? "Match" : "DIFF"}: ${campus.receivingInstitutionName}, ${campus.academicYear.label}: ${sample.label}`);
  } catch (error) {
    result.errors.push({ key: sample.key, message: error.message });
  }
}
result.completedAt = new Date().toISOString();
result.valid = result.errors.length === 0 && result.samples.length === report.campuses.length;
if (option("--output")) fs.writeFileSync(path.resolve(option("--output")), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ valid: result.valid, samplesCompared: result.samples.length, errors: result.errors }));
if (!result.valid) process.exitCode = 1;
