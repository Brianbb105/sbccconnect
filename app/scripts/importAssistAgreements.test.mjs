import assert from "node:assert/strict";
import test from "node:test";
import { buildImportTargets, buildSbccTransferPartners, normalizeAgreementResponse, normalizeInstruction, normalizeReceivingCell, normalizeSendingArticulation } from "./importAssistAgreements.mjs";

function metadata() {
  const institutions = Array.from({ length: 23 }, (_, index) => ({
    id: index + 1, category: 0, names: [{ name: `CSU ${index + 1}` }],
  }));
  institutions.push({ id: 100, category: 1, names: [{ name: "UC campus" }] });
  const partners = institutions.map((institution) => ({
    institutionParentId: institution.id,
    receivingYearIds: institution.id <= 13 ? [76, 77] : [76],
  }));
  partners.push({ institutionParentId: 1, receivingYearIds: [76, 77] });
  return {
    academicYears: [{ id: 76, fallYear: 2025 }, { id: 77, fallYear: 2026 }, { id: 78, fallYear: 2027 }],
    year: { id: 77, label: "2026-2027", fallYear: 2026 },
    requestedSegments: ["CSU"], institutions, partners,
    transferPartners: buildSbccTransferPartners(partners, institutions, 77, ["CSU"]),
  };
}

test("uses the preferred year for 13 campuses and the fallback only for the other 10", () => {
  const targets = buildImportTargets(metadata(), 76);
  assert.equal(targets.length, 23);
  assert.equal(new Set(targets.map((target) => target.id)).size, 23);
  assert.equal(targets.filter((target) => target.academicYear.id === 77).length, 13);
  assert.equal(targets.filter((target) => target.academicYear.id === 76).length, 10);
  assert.ok(targets.every((target) => target.segment === "CSU"));
  assert.ok(targets.every((target) => target.academicYear.id === (target.id <= 13 ? 77 : 76)));
});

test("without a fallback, preserves the existing single-year selection", () => {
  const targets = buildImportTargets(metadata());
  assert.equal(targets.length, 13);
  assert.ok(targets.every((target) => target.academicYear.id === 77 && target.yearSelection === "preferred"));
});

test("falls back for every eligible campus when the preferred year has no partners", () => {
  const data = metadata();
  data.year = { id: 78, label: "2027-2028", fallYear: 2027 };
  data.transferPartners = [];
  const targets = buildImportTargets(data, 76);
  assert.equal(targets.length, 23);
  assert.ok(targets.every((target) => target.yearSelection === "fallback"));
});

test("rejects equal, newer, and nonexistent fallback years", () => {
  for (const id of [77, 78, 999]) assert.throws(() => buildImportTargets(metadata(), id));
});

test("keeps selection wording for Following and other unrecognized instructions", () => {
  assert.deepEqual(normalizeInstruction({ type: "Following", selectionType: "Complete" }), {
    type: "Following", logic: "UNKNOWN", selectionType: "Complete",
  });
  assert.equal(normalizeInstruction({ type: "Other", selectionType: "Recommended" }).selectionType, "Recommended");
});

test("retains explicit conjunction and numeric selection instructions", () => {
  assert.deepEqual(normalizeInstruction({ type: "Conjunction", conjunction: "or", selectionType: "Complete" }), {
    type: "Conjunction", logic: "OR", selectionType: "Complete",
  });
  const selected = normalizeInstruction({ type: "NFromArea", amount: 2, amountUnitType: "Course", selectionType: "Complete" });
  assert.equal(selected.amount, 2);
  assert.equal(selected.amountUnitType, "Course");
});

test("keeps an absent selection limit distinct from an explicit zero", () => {
  assert.equal(normalizeInstruction({ type: "NFromArea", amount: 1, toAmount: null }).toAmount, null);
  assert.equal(normalizeInstruction({ type: "NFromArea", amount: 1, toAmount: 0 }).toAmount, 0);
  assert.equal(normalizeInstruction({ type: "NFromArea", amount: 1, toAmount: "" }).toAmount, null);
});

test("retains named requirements and their notes without inventing a university course", () => {
  const result = normalizeReceivingCell({
    id: "physics-area", type: "Requirement", requirement: { name: "Physics" },
    requirementAttributes: [{ content: "Complete one listed option" }],
  });
  assert.equal(result.name, "Physics");
  assert.deepEqual(result.courses, []);
  assert.equal(result.requirementAttributes[0].content, "Complete one listed option");
});

test("retains general-education area identities and embedded university courses", () => {
  for (const type of ["CALGETC", "CSUGE", "CSUAI", "IGETC"]) {
    const result = normalizeReceivingCell({ type, [type.toLowerCase()]: { areaType: type, code: "1B", name: "Critical Thinking" } });
    assert.equal(result.name, "Critical Thinking");
    assert.equal(result.areaCode, "1B");
    assert.equal(result.areaType, type);
    assert.deepEqual(result.courses, []);
  }
  const result = normalizeReceivingCell({
    type: "GeneralEducation",
    generalEducationArea: { code: "Subject Area 2", name: "Quantitative Reasoning", courses: [{ prefix: "MATH", courseNumber: "11", courseTitle: "Elementary Statistics", minUnits: 3, maxUnits: 3 }] },
    generalEducationAreaAttributes: [{ content: "See the area requirements" }],
  });
  assert.equal(result.areaCode, "Subject Area 2");
  assert.equal(result.courses[0].title, "Elementary Statistics");
  assert.equal(result.generalEducationAreaAttributes[0].content, "See the area requirements");
});

test("retains conditional options and grade or credit notes attached to articulations", () => {
  const source = {
    templateCellId: "receiving-course",
    receivingAttributes: { type: "Course", courseAttributes: [{ content: "Lower division credit only" }] },
    articulation: {
      type: "Course",
      attributes: [{ content: "Minimum grade required: C or better" }],
      receivingAttributes: [{ content: "Content credit only" }],
      templateOverrides: [{ id: "variant", variantIds: ["option-a"], sendingArticulation: { items: [] } }],
      sendingArticulation: { items: [], attributes: [] },
    },
  };
  const saved = normalizeSendingArticulation(source, source.templateCellId);
  assert.equal(saved.articulationAttributes[0].content, "Minimum grade required: C or better");
  assert.equal(saved.receivingAttributes[0].content, "Content credit only");
  assert.deepEqual(saved.receivingTemplateAttributes, source.receivingAttributes);
  assert.deepEqual(saved.templateOverrides, source.articulation.templateOverrides);
});

test("links directly to the selected major and retains unplaced source records separately", () => {
  const key = "77/92/to/75/Major/example";
  const unlinked = { templateCellId: "absent", articulation: { type: "Course" } };
  const result = normalizeAgreementResponse({ result: {
    type: "Major", name: "Example", academicYear: { id: 77, fallYear: 2026 },
    sendingInstitution: { id: 92 }, receivingInstitution: { id: 75 },
    templateAssets: [], articulations: [unlinked],
  } }, { key });
  const url = new URL(result.sourceUrl);
  assert.equal(url.searchParams.get("viewByKey"), key);
  assert.equal(url.searchParams.get("viewBy"), "major");
  assert.equal(url.searchParams.get("year"), "77");
  assert.deepEqual(result.requirementGroups, []);
  assert.deepEqual(result.unlinkedArticulations, [unlinked]);
});

test("retains structured selection advisements even when the source has no text content", () => {
  const advisement = { type: "NFollowing", amount: 1, amountUnitType: "CourseOrCombination", selectionType: "Complete", position: 0 };
  const saved = normalizeReceivingCell({ type: "Requirement", requirement: { name: "Physics" }, advisements: [advisement] });
  for (const [field, value] of Object.entries(advisement)) assert.deepEqual(saved.advisements[0][field], value);
});

test("orders course choices by ASSIST positions while preserving their conjunction", () => {
  const saved = normalizeSendingArticulation({ sendingArticulation: { items: [{
    position: 0, courseConjunction: "And", items: [
      { type: "Course", prefix: "MATH", courseNumber: "160", position: 1 },
      { type: "Course", prefix: "MATH", courseNumber: "150", position: 0 },
      { type: "Course", prefix: "MATH", courseNumber: "200", position: 2 },
    ],
  }] } }, "calculus");
  assert.deepEqual(saved.courses.map((course) => course.courseNumber), ["150", "160", "200"]);
  assert.deepEqual(saved.courseGroups[0].items.map((item) => item.position), [0, 1, 2]);
  assert.equal(saved.logic, "AND");
});
