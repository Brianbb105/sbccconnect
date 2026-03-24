import { writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";


const TERM = (process.argv[2] || "202710").trim();
const url = `https://banner.sbcc.edu/ords/ssb/pw_pub_sched.p_search?term=${TERM}`;

console.log("Fetching:", url);

const res = await fetch(url);
if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
}

const html = await res.text();
const $ = cheerio.load(html);

// Banner commonly uses sel_instr for instructor dropdown
const select = $('select[name="sel_instr"]');
if (!select.length) {
    throw new Error('Could not find Instructor dropdown: select[name="sel_instr"]');
}

const rawNames = select
    .find("option")
    .map((_, opt) => $(opt).text().trim())
    .get();

const bad = new Set(["<all>", "", "Staff", "Pending", "TBA"]);
const names = Array.from(
    new Set(
        rawNames
            .filter((n) => !bad.has(n))
            .map((n) => n.replace(/\s+/g, " ").trim())
    )
).sort((a, b) => a.localeCompare(b));

// IMPORTANT: writes into app/data/<TERM>
const outDir = path.join("app", "data", TERM);
mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, "professors.json");
writeFileSync(
    outPath,
    JSON.stringify(
        names.map((displayName) => ({
            displayName,
            key: displayName.toLowerCase(),
        })),
        null,
        2
    )
);

console.log(`✅ Saved ${names.length} instructors to ${outPath}`);
