import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PRIVATE_IDS, selectPrivateTargets, normalizePrivateAgreement, extractCollectionReport } from './importPrivateAssistAgreements.mjs';
import { selectionText, sourceText } from '../../lib/privateAssistFormatting.ts';

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/private-assist/${name}.json`, import.meta.url)));
const task = (key, category, schoolId = 201, yearId = 76) => ({ key, category, schoolId, yearId });

test('chooses each named private school’s newest receiving year, regardless of metadata order', () => {
    const institutions = PRIVATE_IDS.map(id => ({ id, category: 5, names: [{ name: `School ${id}` }] }));
    const partners = PRIVATE_IDS.map((id, index) => ({ institutionParentId: id, receivingYearIds: index < 4 ? [75, 77, 76] : index === 14 ? [75] : [76, 75] }));
    const years = [{ id: 75, code: '2024-2025' }, { id: 77, code: '2026-2027' }, { id: 76, code: '2025-2026' }];
    const selected = selectPrivateTargets(institutions, partners, years);
    assert.equal(selected.filter(school => school.academicYear.id === 77).length, 4);
    assert.equal(selected.filter(school => school.academicYear.id === 76).length, 10);
    assert.equal(selected.filter(school => school.academicYear.id === 75).length, 1);
    partners[0].receivingYearIds = [];
    assert.throws(() => selectPrivateTargets(institutions, partners, years), /No published SBCC receiving year/);
});

test('university and SBCC department views keep university courses on the receiving side', () => {
    const university = normalizePrivateAgreement(fixture('clu-department'), task('76/92/to/201/Department/14579', 'dept'), '');
    assert.equal(university.courseEquivalencies.length, 18);
    const film = university.plannerGuide.groups[0].sections[0].rows[0];
    assert.match(film.receivingText, /FILM 101/);
    assert.match(film.options[0].text, /FS 101/);
    assert.match(film.options[1].text, /FS 101H/);
    const sbcc = normalizePrivateAgreement(fixture('clu-sbcc-department'), task('76/92/to/201/SendingDepartment/2779', 'dept'), '');
    assert.equal(sbcc.plannerGuide.organizedBy, 'SBCC');
    assert.equal(new URL(sbcc.sourceUrl).searchParams.get('viewSendingAgreements'), 'true');
    assert.match(sbcc.plannerGuide.groups[0].sections[0].rows[0].receivingText, /COMM 101/);
    assert.match(sbcc.plannerGuide.groups[0].sections[0].rows[0].options[0].text, /COMM 171/);
    assert.deepEqual(sbcc.unlinkedArticulations, []);
});

test('GE areas, institutional notes, and numeric selection conditions reach the planner', () => {
    const data = normalizePrivateAgreement(fixture('lmu-ge'), task('77/92/to/209/GeneralEducation/0871e499-b499-47c8-aeeb-08dee801f7e7', 'breadth', 209, 77), '');
    const rows = data.plannerGuide.groups.flatMap(group => group.sections.flatMap(section => section.rows));
    assert.equal(rows.length, 13);
    assert.ok(rows.some(row => row.title.includes('FFYS') && row.title.includes('First Year Seminar')));
    assert.ok(data.plannerGuide.notes.some(note => note.text.includes('31 units') && note.text.includes('55 units')));
    assert.equal(data.plannerGuide.groups[0].notes[0].text, 'Complete 1 course from each 1 of the following areas');
    assert.ok(data.plannerGuide.notes.some(note => note.links.length));
});

test('source identity errors and unhandled report shapes cannot become valid planner agreements', () => {
    assert.throws(() => normalizePrivateAgreement(fixture('clu-department'), task('76/92/to/209/Department/14579', 'dept', 209), ''), /Wrong receiving institution/);
    assert.throws(() => normalizePrivateAgreement(fixture('clu-department'), task('77/92/to/201/Department/14579', 'dept', 201, 77), ''), /Wrong academic year/);
    const raw = fixture('clu-department');
    raw.result.articulations = JSON.stringify([{ type: 'Unknown' }]);
    assert.throws(() => normalizePrivateAgreement(raw, task('76/92/to/201/Department/14579', 'dept'), ''), /Unsupported course report/);
});

test('selection formatting preserves quantities and course combinations', () => {
    assert.equal(selectionText({ type: 'NFollowing', selectionType: 'Complete', amount: 2, amountUnitType: 'CourseOrCombination' }), 'Complete 2 courses or combinations from the following');
    assert.equal(selectionText({ type: 'NFromUnits', selectionType: 'Complete', amountQuantifier: 'AtLeast', amount: 6, amountUnitType: 'Unit' }), 'Complete at least 6 units from this section');
    assert.throws(() => selectionText({ type: 'UnrecognizedRule' }), /Unsupported ASSIST selection rule/);
    assert.throws(() => selectionText({ type: 'Conjunction', conjunction: 'Unknown' }), /Unsupported ASSIST section conjunction/);
});

test('headings remain visible without being counted as course requirements', () => {
    const raw = fixture('lmu-ge');
    const assets = JSON.parse(raw.result.templateAssets);
    const group = assets.find(asset => asset.type === 'RequirementGroup');
    group.sections.unshift({ type: 'SectionHeader', content: 'FOUNDATIONS', position: -1, attributes: [] });
    raw.result.templateAssets = JSON.stringify(assets);
    const saved = normalizePrivateAgreement(raw, task('77/92/to/209/GeneralEducation/example', 'breadth', 209, 77), '');
    assert.equal(saved.plannerGuide.groups[0].sections[0].title, 'FOUNDATIONS');
    assert.equal(saved.plannerGuide.groups[0].sections[0].isHeading, true);
    assert.equal(saved.plannerGuide.groups.flatMap(group => group.sections.flatMap(section => section.rows)).length, 13);
});

test('nested course alternatives retain their grouping inside an AND combination', () => {
    const raw = fixture('clu-department');
    const records = JSON.parse(raw.result.articulations);
    const sourceCourse = records[0].sendingArticulation.items[0].items[0];
    records[0].sendingArticulation.items = [{ type: 'CourseGroup', position: 0, courseConjunction: 'And', items: [
        { type: 'Series', position: 0, series: { conjunction: 'Or', courses: [{ ...sourceCourse, prefix: 'MATH', courseNumber: '150' }, { ...sourceCourse, prefix: 'MATH', courseNumber: '160' }] } },
        { ...sourceCourse, position: 1, prefix: 'CS', courseNumber: '130' },
    ] }];
    raw.result.articulations = JSON.stringify(records);
    const saved = normalizePrivateAgreement(raw, task('76/92/to/201/Department/14579', 'dept'), '');
    const text = saved.plannerGuide.groups[0].sections[0].rows[0].options[0].text;
    assert.match(text, /^\(\nMATH 150[\s\S]+\nOR\nMATH 160[\s\S]+\n\)\nAND\nCS 130/);
});

test('source notes preserve paragraph boundaries and safe links without executing source HTML', () => {
    const note = sourceText('<p>Minimum grade: C</p><p>Read <a href="https://www.assist.org/">ASSIST</a>.</p><a href="javascript:alert(1)">unsafe</a><script>bad()</script>');
    assert.match(note.text, /Minimum grade: C\nRead/);
    assert.equal(note.links.length, 1);
    assert.equal(note.links[0].url, 'https://www.assist.org/');
    assert.ok(!note.text.includes('bad()'));
});

test('sending selection instructions apply to the following courses instead of creating empty options', () => {
    const data = normalizePrivateAgreement(fixture('cdu-math'), task('76/92/to/204/Department/15097', 'dept', 204), '');
    const rows = data.plannerGuide.groups[0].sections[0].rows;
    const statistics = rows.find(row => row.title === 'MTH 150');
    assert.equal(statistics.options.length, 2);
    assert.equal(statistics.optionLogic, 'OR');
    assert.match(statistics.options[0].text, /MATH 117A[\s\S]+\nAND\nMATH 117B/);
    assert.match(statistics.options[1].text, /^Select 1 course from the following\nSOC 125[\s\S]+\nOR\nSTAT C1000/);
    const calculus = rows.find(row => row.title === 'MTH 230');
    assert.equal(calculus.options.length, 1);
    assert.match(calculus.options[0].text, /^Select 1 course from the following\nMATH 130/);
    assert.ok(rows.every(row => row.options.every(option => option.text)));
});

test('combined exports retain exact report-group records and distinguish collection publication dates', () => {
    const individual = fixture('clu-department').result;
    const group = { name: individual.name, articulations: JSON.parse(individual.articulations) };
    const collection = { result: { ...individual, type: 'AllDepartments', name: 'All Departments', articulations: [group] } };
    const selected = { ...task('76/92/to/201/Department/14579', 'dept'), label: individual.name };
    const extracted = extractCollectionReport(collection, selected, '76/92/to/201/AllDepartments');
    assert.deepEqual(extracted.response.result.articulations, JSON.parse(individual.articulations));
    assert.equal(extracted.response.result.publishDate, null);
    assert.equal(extracted.reference.publishDate, individual.publishDate);
    assert.throws(() => extractCollectionReport(collection, { ...selected, label: 'Missing department' }, '76/92/to/201/AllDepartments'), { code: 'INDIVIDUAL_REPORT_REQUIRED' });
    collection.result.articulations.push(group);
    assert.throws(() => extractCollectionReport(collection, { ...selected, label: individual.name }, '76/92/to/201/AllDepartments'), { code: 'INDIVIDUAL_REPORT_REQUIRED' });
    assert.throws(() => extractCollectionReport(collection, selected, '76/92/to/209/AllDepartments'), /Wrong report collection/);
});
