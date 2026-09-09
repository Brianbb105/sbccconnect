import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
    getAssistPlannerData,
    getAssistPlannerCatalog,
    getAssistPlannerSchoolMajors,
    getAssistPlannerAgreementIds,
    getAssistPlannerAgreement,
} from "../../lib/assistPlanner.ts";
import { loadPlannerResource } from "../../lib/plannerDataClient.ts";

test("the initial catalog stays small and contains no majors or agreement details", () => {
    const catalog = getAssistPlannerCatalog();
    assert.ok(catalog.schools.length > 0);
    assert.ok(!("agreements" in catalog));
    assert.ok(!("majors" in catalog));
    assert.ok(Buffer.byteLength(JSON.stringify(catalog)) < 20_000);
});

test("every school and agreement is preserved across the lazy loading boundary", () => {
    const original = getAssistPlannerData();
    const catalog = getAssistPlannerCatalog();
    assert.deepEqual(catalog.schools.filter(school => school.segment === "UC" || school.segment === "CSU"), original.schools);
    assert.equal(catalog.summary.schoolCount, original.summary.schoolCount + 16);
    assert.deepEqual(getAssistPlannerAgreementIds().filter(id => !id.startsWith("usc-") && !id.startsWith("private-assist-")), original.agreements.map((agreement) => agreement.id));
    for (const school of original.schools) {
        const majors = getAssistPlannerSchoolMajors(school.id);
        assert.deepEqual(majors, original.majors.filter((major) => major.schoolId === school.id));
        for (const major of majors) {
            if (!major.hasDetails) continue;
            assert.equal(getAssistPlannerAgreement(major.agreementId)?.schoolId, school.id);
        }
    }
    for (const agreement of original.agreements) {
        assert.deepEqual(getAssistPlannerAgreement(agreement.id), agreement);
    }
});

test("unknown selections never fall back to another school or agreement", () => {
    for (const id of ["unknown", "", "../../cache-manifest.json"]) {
        assert.equal(getAssistPlannerSchoolMajors(id), null);
        assert.equal(getAssistPlannerAgreement(id), null);
    }
});

test("all 15 private-school inventories and prepared source guides survive planner loading", () => {
    const root = path.resolve("app/data/assist-private");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    const catalog = getAssistPlannerCatalog();
    assert.equal(manifest.schools.length, 15);
    for (const sourceSchool of manifest.schools) {
        const school = catalog.schools.find(school => school.id === String(sourceSchool.id));
        assert.equal(school?.segment, "PRIVATE");
        assert.equal(school?.academicYearLabel, sourceSchool.academicYear.label);
        assert.deepEqual(school?.agreementCategories, sourceSchool.categoryCounts);
        const majors = getAssistPlannerSchoolMajors(String(sourceSchool.id));
        const reports = manifest.reports.filter(report => report.schoolId === sourceSchool.id);
        assert.deepEqual(majors.map(major => major.key).sort(), reports.map(report => report.key).sort());
        for (const report of reports) {
            const major = majors.find(major => major.key === report.key);
            const guide = getAssistPlannerAgreement(major.agreementId);
            const source = JSON.parse(fs.readFileSync(path.join(root, manifest.agreements[report.key].normalizedPath), "utf8"));
            assert.equal(major.agreementCategory, report.category);
            assert.equal(guide.schoolId, String(report.schoolId));
            assert.equal(guide.academicYearLabel, source.academicYear.label);
            assert.equal(guide.sourceUrl, source.sourceUrl);
            assert.deepEqual(guide.privateGuide, source.plannerGuide);
        }
    }
});

test("client requests are deduplicated, cached, bounded, and retryable after failure", async (t) => {
    let requests = 0;
    let fail = false;
    t.mock.method(globalThis, "fetch", async () => {
        requests += 1;
        return Response.json({ label: "Selected agreement" }, { status: fail ? 503 : 200 });
    });
    const [first, duplicate] = await Promise.all([
        loadPlannerResource("/test/selected"), loadPlannerResource("/test/selected"),
    ]);
    assert.deepEqual(first, duplicate);
    await loadPlannerResource("/test/selected");
    assert.equal(requests, 1);

    fail = true;
    await assert.rejects(loadPlannerResource("/test/retry"));
    fail = false;
    assert.deepEqual(await loadPlannerResource("/test/retry"), first);
    assert.equal(requests, 3);

    for (let i = 0; i < 40; i += 1) await loadPlannerResource(`/test/other-${i}`);
    await loadPlannerResource("/test/selected");
    assert.equal(requests, 44, "old entries are evicted instead of retaining all agreements");
});
