import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildImportTargets, buildSbccTransferPartners } from "./importAssistAgreements.mjs";

const dataRoot = path.resolve("app/data/assist");
const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const reportPath = path.resolve(option("--report") || path.join(dataRoot, "reports/last-run.json"));
const read = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const report = read(reportPath);
const manifest = read(path.join(dataRoot, "cache-manifest.json"));
const institutions = read(path.join(dataRoot, "raw/metadata/institutions.json"));
const partners = read(path.join(dataRoot, "raw/metadata/sbcc-agreement-partners.json"));
const years = read(path.join(dataRoot, "raw/metadata/academic-years.json"));
const errors = [];
const sourceWarnings = [];
const check = (label, work) => { try { work(); } catch (error) { errors.push({ label, message: error.message }); } };
const parse = (value) => typeof value === "string" ? JSON.parse(value) : value;
const sortedIds = (items) => items.map((item) => String(item.id)).sort();
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const code = (value) => String(value ?? "").trim();
const numeric = (value) => value == null || code(value) === "" ? null : Number(value);
const logic = (value) => ["AND", "OR"].includes(clean(value).toUpperCase()) ? clean(value).toUpperCase() : "UNKNOWN";
let coursesCompared = 0;

function compareAttributes(source, normalized) {
  const expected = (source || []).map((attribute) => typeof attribute === "string"
    ? { content: clean(attribute) }
    : { id: attribute.id ?? null, position: numeric(attribute.position), content: clean(attribute.content ?? attribute.name ?? attribute.description) })
    .filter((attribute) => attribute.content || attribute.id != null);
  assert.deepEqual(normalized, expected, "Attribute or footnote mismatch");
}

function compareAdvisements(source, normalized) {
  assert.deepEqual(normalized, (source || []).map((advisement) => ({
    ...advisement,
    id: advisement.id ?? null, position: numeric(advisement.position),
    content: clean(advisement.content ?? advisement.text ?? advisement.name),
  })), "Advisement mismatch");
}

function compareCourses(source, normalized, extras = null) {
  assert.equal(normalized.length, source.length, "Course count mismatch");
  source.forEach((course, index) => {
    const saved = normalized[index];
    assert.equal(saved.id, course.id ?? null);
    assert.equal(saved.courseIdentifierParentId, course.courseIdentifierParentId ?? null);
    assert.equal(saved.prefix, code(course.prefix), "Course prefix mismatch");
    assert.equal(saved.courseNumber, code(course.courseNumber), "Course number mismatch");
    assert.equal(saved.title, clean(course.courseTitle ?? course.title), "Course title mismatch");
    assert.equal(saved.minUnits, numeric(course.minUnits), "Minimum units mismatch");
    assert.equal(saved.maxUnits, numeric(course.maxUnits), "Maximum units mismatch");
    assert.equal(saved.beginTerm, code(course.begin), "Course start term mismatch");
    assert.equal(saved.endTerm, code(course.end), "Course end term mismatch");
    assert.equal(saved.department, clean(course.department));
    assert.equal(saved.departmentParentId, course.departmentParentId ?? null);
    assert.equal(saved.prefixDescription, clean(course.prefixDescription));
    assert.equal(saved.prefixParentId, course.prefixParentId ?? null);
    compareAttributes(extras?.attributes ?? course.attributes, saved.attributes);
    compareAttributes(extras?.courseAttributes ?? course.courseAttributes, saved.courseAttributes);
    assert.deepEqual(saved.requisites, extras?.requisites ?? course.requisites ?? [], "Course requisite mismatch");
    assert.deepEqual(saved.pathways, course.pathways || [], "Course pathway mismatch");
    for (const field of ["visibleCrossListedCourses", "hiddenCrossListedCourses"]) {
      compareCourses(extras?.[field] ?? course[field] ?? [], saved[field]);
    }
    coursesCompared += 1;
  });
}

function itemCourses(item) {
  if (item.type === "Course") return [item];
  if (item.type === "Series") return item.series?.courses || [];
  throw new Error(`Unsupported sending item type: ${item.type}`);
}

function compareArticulation(source, normalized) {
  if (source) {
    const articulation = source.articulation || source;
    assert.equal(normalized.articulationType, clean(articulation.type));
    compareAttributes(articulation.attributes, normalized.articulationAttributes);
    compareAttributes(articulation.receivingAttributes, normalized.receivingAttributes);
    assert.deepEqual(normalized.receivingTemplateAttributes, source.receivingAttributes ?? null, "Receiving template notes mismatch");
    assert.deepEqual(normalized.templateOverrides, articulation.templateOverrides || [], "Conditional articulation overrides mismatch");
  }
  const sending = source?.articulation?.sendingArticulation ?? source?.sendingArticulation;
  if (!sending) {
    assert.equal(normalized.courses.length, 0);
    assert.equal(normalized.courseGroups.length, 0);
    assert.equal(normalized.noArticulationReason, source ? "NO_SENDING_ARTICULATION_IN_SOURCE" : "NO_ARTICULATION_RECORD_FOR_TEMPLATE_CELL");
    return;
  }
  assert.equal(normalized.noArticulationReason, sending.noArticulationReason ?? null);
  compareAttributes(sending.attributes, normalized.attributes);
  assert.deepEqual(normalized.rawConjunctions, sending.courseGroupConjunctions || []);
  compareCourses(sending.deniedCourses || [], normalized.deniedCourses);
  const groups = [...(sending.items || [])].sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  assert.equal(normalized.courseGroups.length, groups.length, "Sending option-group count mismatch");
  const allCourses = [];
  groups.forEach((group, index) => {
    const saved = normalized.courseGroups[index];
    assert.equal(saved.position, numeric(group.position));
    compareAttributes(group.attributes, saved.attributes);
    assert.equal(saved.logic, logic(group.courseConjunction), "Within-option AND/OR mismatch");
    assert.equal(saved.items.length, (group.items || []).length, "Sending option item count mismatch");
    const items = [...(group.items || [])].sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
    items.forEach((item, itemIndex) => {
      assert.equal(saved.items[itemIndex].type, item.type);
      assert.equal(saved.items[itemIndex].position, numeric(item.position), "Course option order mismatch");
      if (item.type === "Series") assert.equal(saved.items[itemIndex].logic, logic(item.series?.conjunction));
      compareAttributes(item.attributes ?? (item.type === "Series" ? item.seriesAttributes : undefined), saved.items[itemIndex].attributes);
      compareCourses(itemCourses(item), saved.items[itemIndex].courses, item);
    });
    const courses = items.flatMap(itemCourses);
    assert.deepEqual(saved.courses, saved.items.flatMap((item) => item.courses), "Flattened sending group differs from its items");
    allCourses.push(...courses);
  });
  assert.equal(normalized.courses.length, allCourses.length);
  assert.deepEqual(normalized.courses, normalized.courseGroups.flatMap((group) => group.courses), "Flattened articulation differs from its groups");
  const conjunctions = [...new Set((sending.courseGroupConjunctions || []).map((entry) => logic(entry.groupConjunction)))];
  if (conjunctions.length === 1 && conjunctions[0] !== "UNKNOWN") {
    assert.equal(normalized.logic, conjunctions[0], "Between-option AND/OR mismatch");
  } else if (groups.length === 1) {
    assert.equal(normalized.logic, logic(groups[0].courseConjunction));
  } else {
    assert.equal(normalized.logic, "UNKNOWN");
  }
}

check("run status", () => {
  assert.ok(report.completedAt, "Run is still in progress");
  assert.equal(report.dryRun, false, "Inventory-only runs do not establish download completeness");
  assert.equal(report.metadataErrors.length, 0);
  assert.equal(report.failedAgreements, 0);
  assert.equal(report.agreementsWithParseErrors, 0);
});

const targets = buildImportTargets({
  academicYears: years, year: report.academicYear, requestedSegments: report.segments,
  partners, institutions,
  transferPartners: buildSbccTransferPartners(partners, institutions, report.academicYear.id, report.segments),
}, report.fallbackAcademicYear?.id).filter((target) => !report.receivingInstitutionFilter || target.id === report.receivingInstitutionFilter);

check("campus and year selection", () => {
  assert.equal(report.campuses.length, targets.length);
  assert.equal(new Set(report.campuses.map((campus) => campus.receivingInstitutionId)).size, targets.length);
  for (const target of targets) {
    const campus = report.campuses.find((entry) => entry.receivingInstitutionId === target.id);
    assert.ok(campus, `Missing campus ${target.id}`);
    assert.equal(campus.academicYear.id, target.academicYear.id);
  }
});

const expectedKeys = new Set();
const campuses = [];
for (const target of targets) {
  const yearId = target.academicYear.id;
  const campus = {
    id: target.id, name: target.name, academicYear: target.academicYear.label,
    academicYearId: yearId, yearSelection: target.yearSelection,
    listed: 0, verified: 0, agreementsWithoutRequirementGroups: 0,
    agreementsWithUnlinkedSourceArticulations: 0,
  };
  campuses.push(campus);
  check(`campus ${target.id} inventory`, () => {
    const list = read(path.join(dataRoot, `raw/lists/year-${yearId}/receiving-${target.id}/major.json`));
    assert.ok(Array.isArray(list.reports), "Major list must contain a reports array");
    campus.listed = list.reports.length;
    for (const item of list.reports) {
      check(item.key, () => {
        assert.ok(item.key.startsWith(`${yearId}/92/to/${target.id}/Major/`), "Agreement key must match the selected year and institutions");
        assert.ok(!expectedKeys.has(item.key), "Duplicate agreement key");
        expectedKeys.add(item.key);
        const entry = manifest.agreements[item.key];
        assert.ok(entry, "Missing manifest entry");
        const rawText = fs.readFileSync(path.resolve(entry.rawPath), "utf8");
        assert.equal(crypto.createHash("sha256").update(rawText).digest("hex"), entry.contentHash, "Raw hash mismatch");
        const normalized = read(path.resolve(entry.normalizedPath));
        assert.equal(normalized.agreement.key, item.key);
        assert.equal(normalized.sendingInstitution.id, 92);
        assert.equal(normalized.receivingInstitution.id, target.id);
        assert.equal(normalized.academicYear.id, yearId);
        assert.equal(entry.academicYearId, yearId);
        assert.equal(entry.receivingInstitutionId, target.id);
        assert.equal(normalized.parseErrors.length, 0);
        const sourceUrl = new URL(normalized.sourceUrl);
        assert.equal(sourceUrl.searchParams.get("keyName"), item.key);
        assert.equal(sourceUrl.searchParams.get("viewByKey"), item.key, "Source link must select the specific major");
        assert.equal(sourceUrl.searchParams.get("viewBy"), "major");
        assert.equal(sourceUrl.searchParams.get("year"), String(yearId));
        const raw = JSON.parse(rawText).result;
        assert.equal(normalized.agreement.name, clean(raw.name || item.label), "Major name mismatch");
        assert.equal(normalized.agreement.type, clean(raw.type || "Major"));
        assert.equal(normalized.agreement.publishDate, raw.publishDate ?? null, "Publication date mismatch");
        const assets = parse(raw.templateAssets);
        const articulations = parse(raw.articulations);
        assert.ok(Array.isArray(assets));
        assert.ok(Array.isArray(articulations));
        assert.equal(normalized.rawDataReference.templateAssetCount, assets.length);
        assert.equal(normalized.rawDataReference.articulationCount, articulations.length);
        const groups = assets.filter((asset) => asset.area === "Requirements" && asset.type === "RequirementGroup");
        assert.equal(normalized.requirementGroups.length, groups.length, "Requirement-group count mismatch");
        const rawCells = groups.flatMap((group) => (group.sections || []).flatMap((section) => (section.rows || []).flatMap((row) => row.cells || [])));
        const normalizedCells = normalized.requirementGroups.flatMap((group) => group.sections.flatMap((section) => section.receivingItems));
        assert.deepEqual(sortedIds(normalizedCells), sortedIds(rawCells), "Receiving-cell identities mismatch");
        const savedArticulations = normalized.requirementGroups.flatMap((group) => group.sections.flatMap((section) => section.sbccArticulations));
        const articulationById = new Map(articulations.map((record) => [record.templateCellId, record]));
        for (const cell of rawCells) {
          const saved = normalizedCells.find((entry) => entry.id === cell.id);
          assert.ok(["Course", "Series", "Requirement", "CALGETC", "CSUGE", "CSUAI", "IGETC", "GeneralEducation"].includes(cell.type), `Unsupported receiving cell type: ${cell.type}`);
          const courses = cell.type === "Course" ? [cell.course].filter(Boolean)
            : cell.type === "Series" ? cell.series?.courses || []
              : cell.type === "GeneralEducation" ? cell.generalEducationArea?.courses || [] : [];
          compareCourses(courses, saved.courses, cell);
          compareAttributes(cell.attributes, saved.attributes);
          compareAttributes(cell.courseAttributes ?? cell.seriesAttributes, saved.courseAttributes);
          compareAdvisements(cell.advisements, saved.advisements);
          if (cell.type === "Series") assert.equal(saved.logic, logic(cell.series?.conjunction));
          if (cell.type === "Requirement") {
            assert.equal(saved.name, clean(cell.requirement?.name), "Named requirement was lost");
            compareAttributes(cell.requirementAttributes, saved.requirementAttributes);
          }
          if (["CALGETC", "CSUGE", "CSUAI", "IGETC", "GeneralEducation"].includes(cell.type)) {
            const area = cell.type === "GeneralEducation" ? cell.generalEducationArea : cell[cell.type.toLowerCase()];
            assert.equal(saved.name, clean(area?.name), "General-education area name was lost");
            assert.equal(saved.areaCode, code(area?.code), "General-education area code was lost");
            assert.equal(saved.areaType, code(area?.areaType || cell.type));
            if (cell.type === "GeneralEducation") compareAttributes(cell.generalEducationAreaAttributes, saved.generalEducationAreaAttributes);
          }
          const savedArticulation = savedArticulations.find((entry) => entry.receivingCellId === cell.id);
          assert.ok(savedArticulation, "Missing normalized articulation slot");
          compareArticulation(articulationById.get(cell.id), savedArticulation);
        }
        const rawCellIds = new Set(rawCells.map((cell) => cell.id));
        const unlinked = articulations.filter((entry) => !rawCellIds.has(entry.templateCellId));
        assert.deepEqual(normalized.unlinkedArticulations, unlinked, "Unlinked source articulations were not retained");
        if (unlinked.length) {
          const unlinkedIds = new Set(unlinked.map((entry) => entry.templateCellId));
          const foundElsewhere = [];
          const visit = (value) => {
            if (!value || typeof value !== "object") return;
            if (value.id != null && unlinkedIds.has(value.id)) foundElsewhere.push(value.id);
            Object.values(value).forEach(visit);
          };
          visit(assets);
          assert.equal(foundElsewhere.length, 0, "An articulation's template cell exists outside the extracted requirement groups; review extraction coverage");
          campus.agreementsWithUnlinkedSourceArticulations += 1;
          sourceWarnings.push({
            key: item.key, name: normalized.agreement.name,
            type: "SOURCE_ARTICULATION_WITHOUT_TEMPLATE_CELL",
            count: unlinked.length,
            templateCellIds: [...unlinkedIds],
            rawPath: entry.rawPath,
            message: "ASSIST includes these articulation records without matching cells anywhere in its template. The original records are preserved in the raw response; no requirement placement is inferred.",
          });
        }
        for (const group of groups) {
          const normalizedGroup = normalized.requirementGroups.find((entry) => entry.id === group.groupId);
          assert.ok(normalizedGroup, "Missing requirement group identity");
          compareAttributes(group.attributes, normalizedGroup.attributes);
          compareAdvisements(group.advisements, normalizedGroup.advisements);
          assert.equal(normalizedGroup.sections.length, (group.sections || []).length, "Section count mismatch");
          const sections = [...(group.sections || [])].sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
          sections.forEach((section, sectionIndex) => {
            const savedSection = normalizedGroup.sections[sectionIndex];
            compareAttributes(section.attributes, savedSection.attributes);
            compareAdvisements(section.advisements, savedSection.advisements);
            assert.deepEqual(savedSection.selection, normalizedGroup.selection, "Section selection differs from its group");
            assert.deepEqual(savedSection.receivingCourses, savedSection.receivingItems.flatMap((item) => item.courses), "Flattened receiving courses differ from their cells");
            for (const row of section.rows || []) {
              for (const cell of row.cells || []) {
                const savedCell = savedSection.receivingItems.find((item) => item.id === cell.id);
                assert.ok(savedCell, "Receiving cell moved to a different section");
                assert.equal(savedCell.rowPosition, numeric(row.position));
                compareAttributes(row.attributes, savedCell.rowAttributes);
              }
            }
          });
          if (group.instruction?.selectionType) assert.equal(normalizedGroup?.selection?.selectionType, clean(group.instruction.selectionType), "Selection wording was not retained");
          if (group.instruction?.type === "Conjunction") assert.equal(normalizedGroup.selection.logic, logic(group.instruction.conjunction));
          if (group.instruction?.type === "NFromArea") {
            for (const field of ["amount", "toAmount"]) assert.equal(normalizedGroup.selection[field], numeric(group.instruction[field]), `Selection ${field} mismatch`);
            for (const field of ["amountUnitType", "amountQuantifier", "toAmountDeterminer", "areaType"]) assert.equal(normalizedGroup.selection[field], clean(group.instruction[field]));
          }
        }
        const textAssets = assets.filter((asset) => asset.type === "GeneralText").map((asset) => String(asset.content || "")).sort();
        const savedHtml = normalized.notes.filter((note) => note.type === "GeneralText").map((note) => note.contentHtml).sort();
        assert.deepEqual(savedHtml, textAssets, "Agreement notes or original HTML were lost");
        const titleAssets = assets.filter((asset) => asset.type === "GeneralTitle").map((asset) => clean(asset.content)).sort();
        const savedTitles = normalized.notes.filter((note) => note.type === "GeneralTitle").map((note) => note.content).sort();
        assert.deepEqual(savedTitles, titleAssets, "Agreement title notes mismatch");
        if (!groups.length) campus.agreementsWithoutRequirementGroups += 1;
        campus.verified += 1;
      });
    }
    const campusReport = report.campuses.find((entry) => entry.receivingInstitutionId === target.id);
    assert.equal(campusReport.majorAgreementsListed, campus.listed);
    assert.equal(campusReport.agreementsProcessed, campus.listed, "Not every listed agreement was processed");
  });
}

check("complete agreement set", () => {
  assert.equal(expectedKeys.size, report.majorAgreementsQueued);
  assert.equal(campuses.reduce((total, campus) => total + campus.verified, 0), expectedKeys.size);
  const targetIds = new Set(targets.map((target) => target.id));
  const savedKeys = Object.keys(manifest.agreements).filter((key) => targetIds.has(manifest.agreements[key].receivingInstitutionId) && manifest.agreements[key].type === "Major");
  assert.deepEqual(savedKeys.sort(), [...expectedKeys].sort(), "Selected campuses have missing, obsolete, or extra cached agreement keys");
});

const result = {
  checkedAt: new Date().toISOString(), reportPath: path.relative(process.cwd(), reportPath), sendingInstitutionId: 92,
  valid: errors.length === 0, campusCount: targets.length,
  agreementCount: expectedKeys.size,
  verifiedAgreementCount: campuses.reduce((total, campus) => total + campus.verified, 0),
  courseRepresentationsCompared: coursesCompared,
  campuses, errors, sourceWarningCount: sourceWarnings.length, sourceWarnings,
};
if (option("--output")) fs.writeFileSync(path.resolve(option("--output")), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
