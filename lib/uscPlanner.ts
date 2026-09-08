import fs from "node:fs";
import path from "node:path";
import type { PlannerAgreement, PlannerMajor, PlannerSchool } from "./assistPlanner";

const ROOT = path.join(process.cwd(), "app/data/usc");
const SCHOOL = { id: "usc", name: "University of Southern California", code: "USC", segment: "Private" };
type Program = { id: string; labels: string[] };
type Guide = {
    program: Program;
    academicYear: string;
    sections: Array<{ position: number; kind: string; text: string }>;
    advisoryText: string;
    advisoryLinks: Array<{ label: string; url: string }>;
    restrictionsText: string;
};
type Manifest = {
    academicYear: string;
    programs: Program[];
    reports: Array<{ id: string; normalizedPath: string }>;
    failures: Array<{ id: string; message: string }>;
};

function programLabel(program: Program) {
    const label = program.labels[0].replace(/\s*\([^()]+\)\s*$/, "");
    const degrees: Record<string, string> = {
        "BACHELOR OF SCIENCE": "BS", "BACHELOR OF ARTS": "BA",
        "BACHELOR OF FINE ARTS": "BFA", "BACHELOR OF MUSIC": "BM",
        "BACHELOR OF ARCHITECTURE": "BArch",
    };
    for (const [prefix, degree] of Object.entries(degrees)) {
        if (label.startsWith(prefix)) {
            const name = label.slice(prefix.length).replace(/^[\s,\-]+/, "").replace(/,/g, ", ")
                .toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
            return `${name} (${degree}) · ${program.id}`;
        }
    }
    return `${label} · ${program.id}`;
}

export function getUscPlannerData(): { schools: PlannerSchool[]; majors: PlannerMajor[]; agreements: PlannerAgreement[] } {
    const file = path.join(ROOT, "manifest.json");
    if (!fs.existsSync(file)) return { schools: [], majors: [], agreements: [] };
    const manifest: Manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    const articulation: { academicYear: string; sections: Array<{ sourceId: string; tables: Array<{ rows: Array<{ cells: string[] }> }> }> } =
        JSON.parse(fs.readFileSync(path.join(ROOT, "normalized/articulation.json"), "utf8"));
    const emptyScienceAreas = [
        { id: "Label13", label: "D (Life Sciences)" }, { id: "LabelGEE", label: "E (Physical Sciences)" },
    ].filter(area => articulation.sections.some(section => section.sourceId === area.id &&
        section.tables.every(table => table.rows.slice(1).every(row => row.cells.every(cell => !cell.trim()))))).map(area => area.label);
    const warnings = emptyScienceAreas.length ? [
        `USC’s ${articulation.academicYear} SBCC agreement currently lists no courses in GE ${emptyScienceAreas.length === 1 ? "category" : "categories"} ${emptyScienceAreas.join(" and ")}. Confirm those areas with USC before choosing courses.`,
    ] : [];
    const reports = new Map(manifest.reports.map(report => [report.id, report]));
    const agreements: PlannerAgreement[] = [];
    const majors: PlannerMajor[] = manifest.programs.map(program => {
        const report = reports.get(program.id);
        const label = programLabel(program);
        const id = `usc-${program.id}`;
        if (report) {
            const guide: Guide = JSON.parse(fs.readFileSync(path.join(ROOT, report.normalizedPath), "utf8"));
            if (guide.program.id !== program.id || guide.academicYear !== manifest.academicYear) {
                throw new Error(`USC guide identity/year mismatch for ${program.id}`);
            }
            agreements.push({
                id, key: id, schoolId: SCHOOL.id, schoolName: SCHOOL.name,
                schoolCode: SCHOOL.code, schoolSegment: SCHOOL.segment,
                sendingSchoolName: "Santa Barbara City College", sendingSchoolCode: "SBCC",
                academicYearLabel: guide.academicYear, majorName: label,
                agreementType: "USC Transfer Planning Guide", publishDate: "",
                sourceUrl: "https://darsweb.usc.edu/TPG/Default.aspx", availableMajorCount: manifest.programs.length,
                groups: [],
                stats: { groupCount: 0, requirementCount: 0, articulatedCount: 0, noArticulationCount: 0, uniqueSbccCourseCount: 0, sbccSubjectCount: 0 },
                uscGuide: {
                    programCode: program.id,
                    sections: guide.sections.filter(section => section.kind === "requirements" && section.text.trim())
                        .map(({ position, text }) => ({ position, text })),
                    advisoryText: guide.advisoryText,
                    advisoryLinks: guide.advisoryLinks,
                    restrictionsText: guide.restrictionsText,
                    warnings,
                },
            });
        }
        return {
            id, schoolId: SCHOOL.id, schoolName: SCHOOL.name, schoolCode: SCHOOL.code,
            label, key: id, hasDetails: Boolean(report), agreementId: report ? id : null,
            ...(report ? {} : { unavailableReason: manifest.failures.some(failure => failure.id === program.id)
                ? "USC lists this program, but its website could not produce a complete guide during the latest import. Check the USC guide directly or ask USC about this program."
                : "This USC guide has not been imported yet." }),
        };
    });
    return { schools: [{ ...SCHOOL, hasMajorList: true, majorCount: majors.length, detailedMajorCount: agreements.length }], majors, agreements };
}
