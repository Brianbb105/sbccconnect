import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PRIVATE_ROOT, PRIVATE_IDS, CATEGORY_TYPES, read, save, digest, selectPrivateTargets, normalizePrivateAgreement, extractCollectionReport } from './importPrivateAssistAgreements.mjs';
import { compareAttributes, compareAdvisements, compareCourses, compareArticulation, getCourseCount } from './assistRecordValidation.mjs';

const manifest = read(path.join(PRIVATE_ROOT, 'manifest.json'));
const inProgress = process.argv.includes('--in-progress');
const errors = [], warnings = [];
const check = (label, work) => { try { work(); } catch (error) { errors.push({ label, message: error.message }); } };
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const abs = relative => path.join(PRIVATE_ROOT, relative);
const expectedKeys = new Set();
let verified = 0, flatRecords = 0, templateCells = 0;
const bySchool = manifest.schools.map(school => ({ id: school.id, name: school.name, year: school.academicYear.label, categories: school.categoryCounts, verified: 0 }));

function checkSource(reference) {
    assert.equal(digest(fs.readFileSync(abs(reference.path))), reference.sha256, `Source hash: ${reference.path}`);
}

function compareReceiving(cell, saved) {
    assert.equal(saved.type, cell.type);
    const courses = cell.type === 'Course' ? [cell.course].filter(Boolean) : cell.type === 'Series' ? cell.series?.courses || [] : cell.type === 'GeneralEducation' ? cell.generalEducationArea?.courses || [] : [];
    compareCourses(courses, saved.courses, cell);
    compareAttributes(cell.attributes, saved.attributes);
    compareAttributes(cell.courseAttributes ?? cell.seriesAttributes, saved.courseAttributes);
    compareAdvisements(cell.advisements, saved.advisements);
    if (cell.type === 'Series') assert.equal(saved.logic, clean(cell.series?.conjunction).toUpperCase() || 'UNKNOWN');
    if (cell.type === 'Requirement') {
        assert.equal(saved.name, clean(cell.requirement?.name));
        compareAttributes(cell.requirementAttributes, saved.requirementAttributes);
    }
    if (['GeneralEducation', 'CALGETC', 'CSUGE', 'CSUAI', 'IGETC'].includes(cell.type)) {
        const area = cell.type === 'GeneralEducation' ? cell.generalEducationArea : cell[cell.type.toLowerCase()];
        assert.equal(saved.name, clean(area?.name));
        assert.equal(saved.areaCode, String(area?.code ?? '').trim());
        if (cell.type === 'GeneralEducation') compareAttributes(cell.generalEducationAreaAttributes, saved.generalEducationAreaAttributes);
    }
    assert.ok(['Course', 'Series', 'Requirement', 'GeneralEducation', 'CALGETC', 'CSUGE', 'CSUAI', 'IGETC'].includes(cell.type), `Unsupported receiving type ${cell.type}`);
}

check('import status and school scope', () => {
    if (!inProgress) {
    assert.ok(manifest.completedAt);
    assert.equal(manifest.partial, false);
    }
    assert.deepEqual(manifest.failures, []);
    assert.equal(manifest.schools.length, 15);
    assert.deepEqual(manifest.schools.map(school => school.id).sort((a, b) => a - b), PRIVATE_IDS);
});
for (const source of Object.values(manifest.sources)) check(source.path, () => checkSource(source));
check('newest published year for each school', () => {
    const targets = selectPrivateTargets(read(abs(manifest.sources.institutions.path)), read(abs(manifest.sources.partners.path)), read(abs(manifest.sources.years.path)));
    assert.deepEqual(manifest.schools.map(school => [school.id, school.academicYear]), targets.map(school => [school.id, school.academicYear]));
});

for (const school of manifest.schools) {
    check(`${school.name} category coverage`, () => {
        checkSource(school.categoriesSource);
        const categories = read(abs(school.categoriesSource.path));
        const published = categories.filter(category => category.hasReports).map(category => category.code).sort();
        assert.deepEqual(Object.keys(school.listSources).sort(), published);
        for (const [category, reference] of Object.entries(school.listSources)) {
            checkSource(reference);
            const list = read(abs(reference.path));
            assert.equal(list.reports.length, school.categoryCounts[category]);
            for (const report of list.reports) {
                assert.ok(!expectedKeys.has(report.key), 'Duplicate inventory key');
                expectedKeys.add(report.key);
                const task = manifest.reports.find(task => task.key === report.key);
                assert.ok(task, 'Inventory report missing from manifest');
                assert.equal(task.category, category);
                assert.equal(task.schoolId, school.id);
                assert.equal(task.yearId, school.academicYear.id);
                assert.equal(task.label, report.label);
                assert.equal(task.ownerInstitutionId, report.ownerInstitutionId);
                const type = report.key.split('/')[4];
                assert.ok([CATEGORY_TYPES[category], ...(['dept', 'prefix'].includes(category) ? [`Sending${CATEGORY_TYPES[category]}`] : [])].includes(type));
                assert.equal(type.startsWith('Sending') ? 92 : school.id, report.ownerInstitutionId, 'Report ownership differs from its key');
            }
        }
    });
}

for (const task of manifest.reports.filter(task => !inProgress || manifest.agreements[task.key])) check(task.key, () => {
    const entry = manifest.agreements[task.key];
    assert.ok(entry, 'Missing downloaded agreement');
    assert.equal(digest(fs.readFileSync(abs(entry.rawPath))), entry.sha256, 'Agreement source hash mismatch');
    const sourceResponse = read(abs(entry.rawPath));
    const collection = entry.collectionKey ? extractCollectionReport(sourceResponse, task, entry.collectionKey) : null;
    const raw = collection?.response || sourceResponse;
    const source = raw.result;
    const saved = read(abs(entry.normalizedPath));
    assert.equal(saved.agreement.key, task.key);
    assert.equal(saved.sendingInstitution.id, 92);
    assert.equal(saved.receivingInstitution.id, task.schoolId);
    assert.equal(saved.academicYear.id, task.yearId);
    assert.equal(saved.agreement.type, source.type);
    assert.equal(saved.agreement.name, clean(source.name || task.label));
    assert.equal(saved.agreement.publishDate, source.publishDate);
    if (collection) {
        const reference = manifest.collections[entry.collectionKey];
        assert.equal(reference.rawPath, entry.rawPath);
        assert.equal(reference.sha256, entry.sha256);
        assert.equal(entry.collectionGroupIndex, collection.reference.groupIndex);
        assert.deepEqual(saved.sourceCollection, collection.reference);
        assert.equal(saved.agreement.publishDate, null, 'A collection publication date must not become an individual-report date');
    }
    assert.deepEqual(saved.parseErrors, []);
    const url = new URL(saved.sourceUrl);
    assert.equal(url.searchParams.get('viewBy'), task.category);
    assert.equal(url.searchParams.get('viewByKey'), task.key);
    assert.equal(url.searchParams.get('viewSendingAgreements'), String(source.type.startsWith('Sending')));
    const articulations = parse(source.articulations);
    const assets = parse(source.templateAssets);
    assert.equal(saved.rawDataReference.articulationCount, articulations.length);
    if (['dept', 'prefix'].includes(task.category)) {
        assert.equal(saved.courseEquivalencies.length, articulations.length);
        assert.deepEqual(saved.unlinkedArticulations, []);
        articulations.forEach((record, index) => {
            const item = saved.courseEquivalencies[index];
            assert.equal(item.sourceIndex, index);
            compareReceiving(record, item.receiving);
            compareArticulation(record, item.sending);
            flatRecords += 1;
        });
    } else {
        const groups = assets.filter(asset => asset.area === 'Requirements' && asset.type === 'RequirementGroup');
        assert.equal(saved.requirementGroups.length, groups.length);
        const matched = new Set();
        for (const group of groups) {
            const target = saved.requirementGroups.find(item => item.id === group.groupId);
            assert.ok(target, 'Missing requirement group');
            assert.deepEqual(target.sourceInstruction, group.instruction ?? null, 'Selection amounts or conditions were lost');
            compareAttributes(group.attributes, target.attributes);
            compareAdvisements(group.advisements, target.advisements);
            assert.equal(target.sections.length, (group.sections || []).length);
            const sections = [...group.sections].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
            sections.forEach((section, index) => {
                const targetSection = target.sections[index];
                compareAttributes(section.attributes, targetSection.attributes);
                compareAdvisements(section.advisements, targetSection.advisements);
                assert.equal(targetSection.sourceType, section.type);
                if (section.type === 'SectionHeader') assert.equal(targetSection.sourceHeading, String(section.content || ''));
                const cells = (section.rows || []).flatMap(row => row.cells);
                assert.equal(targetSection.receivingItems.length, cells.length);
                for (const row of section.rows || []) for (const cell of row.cells) {
                    const receiving = targetSection.receivingItems.find(item => item.id === cell.id);
                    assert.ok(receiving, 'Missing or relocated receiving cell');
                    compareReceiving(cell, receiving);
                    compareAttributes(row.attributes, receiving.rowAttributes);
                    const record = articulations.find(record => record.templateCellId === cell.id);
                    compareArticulation(record, targetSection.sbccArticulations.find(item => item.receivingCellId === cell.id));
                    matched.add(cell.id);
                    templateCells += 1;
                }
            });
        }
        const unlinked = articulations.filter(record => !matched.has(record.templateCellId));
        assert.deepEqual(saved.unlinkedArticulations, unlinked);
        if (unlinked.length) {
            const ids = new Set(unlinked.map(record => record.templateCellId));
            const found = [];
            const visit = value => { if (!value || typeof value !== 'object') return; if (value.id != null && ids.has(value.id)) found.push(value.id); Object.values(value).forEach(visit); };
            visit(assets);
            assert.deepEqual(found, [], 'Unlinked records have template cells outside extracted groups');
            warnings.push({ key: task.key, kind: 'Source articulation without template cell', count: unlinked.length });
        }
        assert.deepEqual(saved.notes.filter(note => note.type === 'GeneralText').map(note => note.contentHtml).sort(), assets.filter(asset => asset.type === 'GeneralText').map(asset => String(asset.content || '')).sort(), 'Original agreement notes were lost');
    }
    // In addition to independent source-field comparisons, detect stale prepared guide output.
    const regenerated = normalizePrivateAgreement(raw, task, abs(entry.rawPath));
    if (collection) { regenerated.sourceCollection = collection.reference; regenerated.sourceApiUrl = manifest.collections[entry.collectionKey].sourceApiUrl; }
    delete regenerated.lastCheckedAt;
    const comparable = { ...saved };
    delete comparable.lastCheckedAt;
    assert.deepEqual(comparable, regenerated, 'Normalized or prepared guide differs from the source conversion');
    const displayedRows = saved.plannerGuide.groups.flatMap(group => group.sections.flatMap(section => section.rows)).length;
    const expectedRows = saved.courseEquivalencies?.length ?? saved.requirementGroups.flatMap(group => group.sections.flatMap(section => section.receivingItems)).length;
    assert.equal(displayedRows, expectedRows, 'Planner omitted course or requirement rows');
    verified += 1;
    bySchool.find(school => school.id === task.schoolId).verified += 1;
});

check('complete report coverage', () => {
    assert.equal(expectedKeys.size, manifest.reports.length);
    if (inProgress) { assert.equal(verified, Object.keys(manifest.agreements).length); return; }
    assert.deepEqual(Object.keys(manifest.agreements).sort(), [...expectedKeys].sort());
    assert.equal(verified, expectedKeys.size);
});
for (const [key, reference] of Object.entries(manifest.collections || {})) check(`collection ${key}`, () => {
    assert.equal(digest(fs.readFileSync(abs(reference.rawPath))), reference.sha256);
    const groups = parse(read(abs(reference.rawPath)).result.articulations);
    const entries = Object.values(manifest.agreements).filter(entry => entry.collectionKey === key);
    if (!inProgress) assert.deepEqual(entries.map(entry => entry.collectionGroupIndex).sort((a, b) => a - b), groups.map((_, index) => index), 'Combined export contains omitted or duplicated groups');
});
check('unchanged UC, CSU, and USC source data', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'app/data/assist', 'app/data/usc'], { encoding: 'utf8' }).trim();
    assert.equal(changed, '', `Existing data changed: ${changed}`);
});
const result = { checkedAt: new Date().toISOString(), valid: !inProgress && errors.length === 0, downloadedDataValid: errors.length === 0, inProgress, manifestSha256: digest(fs.readFileSync(path.join(PRIVATE_ROOT, 'manifest.json'))),
    schoolCount: manifest.schools.length, expectedReports: expectedKeys.size, verifiedReports: verified, courseRepresentationsCompared: getCourseCount(),
    flatCourseRecords: flatRecords, templateCells, schools: bySchool, errors, sourceWarnings: warnings };
save(path.join(PRIVATE_ROOT, `reports/${inProgress ? 'progress-validation' : 'validation'}.json`), result);
console.log(JSON.stringify({ ...result, schools: undefined, sourceWarnings: `${warnings.length} source warnings` }, null, 2));
if (errors.length) process.exitCode = 1;
