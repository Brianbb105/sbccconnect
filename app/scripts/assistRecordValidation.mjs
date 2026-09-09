// Shared source-to-normalized comparisons, extracted from the existing ASSIST integrity validator.
import assert from "node:assert/strict";
const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const code = value => String(value ?? "").trim();
const numeric = value => value == null || code(value) === "" ? null : Number(value);
const logic = value => ["AND", "OR"].includes(clean(value).toUpperCase()) ? clean(value).toUpperCase() : "UNKNOWN";
let coursesCompared = 0;
export const resetCourseCount = () => { coursesCompared = 0; };
export const getCourseCount = () => coursesCompared;

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
    assert.equal(saved.type, group.type || 'CourseGroup');
    assert.deepEqual(saved.sourceAdvisement, group.advisement ?? null, 'Sending selection instruction mismatch');
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


export { compareAttributes, compareAdvisements, compareCourses, compareArticulation };
