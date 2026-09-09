import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AssistClient, buildSbccTransferPartners, normalizeAgreementResponse, normalizeReceivingCell, normalizeSendingArticulation } from './importAssistAgreements.mjs';
import { formatPrivateGuide } from '../../lib/privateAssistFormatting.ts';

export const PRIVATE_IDS = [201, 204, 206, 207, 209, 213, 214, 215, 217, 220, 222, 224, 227, 228, 230];
export const CATEGORY_TYPES = { major: 'Major', breadth: 'GeneralEducation', dept: 'Department', prefix: 'Prefix' };
export const PRIVATE_ROOT = path.resolve('app/data/assist-private');
const manifestPath = path.join(PRIVATE_ROOT, 'manifest.json');
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function save(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
    fs.renameSync(temporary, file);
}
const apiUrl = (pathname, params = {}) => {
    const url = new URL(pathname, 'https://www.assist.org');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    return url.toString();
};
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;

function preserveSendingInstructions(record, saved) {
    const sending = (record?.articulation || record)?.sendingArticulation;
    const groups = [...(sending?.items || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    saved.courseGroups.forEach((group, index) => {
        assert.ok(['CourseGroup', 'Advisement'].includes(group.type), `Unsupported sending group: ${group.type}`);
        group.sourceAdvisement = groups[index]?.advisement ?? null;
        if (group.type === 'Advisement') assert.ok(group.sourceAdvisement, 'Missing sending selection instruction');
    });
}

export function selectPrivateTargets(institutions, partners, academicYears) {
    const years = academicYears.map(year => ({ id: Number(year.Id ?? year.id), fallYear: Number(year.FallYear ?? year.fallYear ?? year.code?.slice(0, 4)), label: year.code }));
    const available = buildSbccTransferPartners(partners, institutions, null, ['PRIVATE']);
    return PRIVATE_IDS.map(id => {
        const school = available.find(school => school.id === id);
        assert.ok(school, `No SBCC private-school partner record for ${id}`);
        const year = years.filter(year => school.receivingYearIds.includes(year.id)).sort((a, b) => b.fallYear - a.fallYear)[0];
        assert.ok(year, `No published SBCC receiving year for ${school.name}`);
        return { ...school, academicYear: { ...year, label: year.label || `${year.fallYear}-${year.fallYear + 1}` } };
    });
}

export function normalizePrivateAgreement(response, task, rawPath) {
    const normalized = normalizeAgreementResponse(response, { key: task.key, label: task.label, segment: 'PRIVATE', rawPath });
    assert.equal(normalized.sendingInstitution.id, 92, 'Wrong sending institution');
    assert.equal(normalized.receivingInstitution.id, task.schoolId, 'Wrong receiving institution');
    assert.equal(normalized.academicYear.id, task.yearId, 'Wrong academic year');
    const type = task.key.split('/')[4];
    assert.equal(normalized.agreement.type, type, 'Wrong agreement type');
    assert.equal(normalized.parseErrors.length, 0, 'Malformed embedded source fields');
    const source = response.result;
    const assets = parse(source.templateAssets);
    const articulations = parse(source.articulations);
    assert.ok(Array.isArray(articulations), 'Articulations must be an array');
    const flat = ['dept', 'prefix'].includes(task.category);
    if (flat) {
        assert.ok(assets == null || Array.isArray(assets) && assets.length === 0, 'Unexpected template in course report');
        normalized.courseEquivalencies = articulations.map((record, index) => {
            assert.ok(['Course', 'Series'].includes(record.type), `Unsupported course report record: ${record.type}`);
            const id = `source-row-${index}`;
            const sending = normalizeSendingArticulation(record, id);
            preserveSendingInstructions(record, sending);
            return { sourceIndex: index, receiving: normalizeReceivingCell({ ...record, id }), sending };
        });
        // Department/prefix reports directly pair receiving courses with sending articulations.
        // They have no requirement template and therefore have no unlinked template cells.
        normalized.unlinkedArticulations = [];
    } else {
        assert.ok(Array.isArray(assets), 'A major/GE report must include its requirement template');
        for (const group of normalized.requirementGroups) {
            const sourceGroup = assets.find(asset => asset.type === 'RequirementGroup' && asset.groupId === group.id);
            group.sourceInstruction = sourceGroup?.instruction ?? null;
            const sourceSections = [...(sourceGroup?.sections || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
            group.sections.forEach((section, index) => {
                section.sourceType = sourceSections[index].type;
                section.sourceHeading = sourceSections[index].type === 'SectionHeader' ? String(sourceSections[index].content || '') : '';
                section.sbccArticulations.forEach(saved => preserveSendingInstructions(articulations.find(record => record.templateCellId === saved.receivingCellId), saved));
            });
        }
    }
    normalized.category = task.category;
    normalized.receivingInstitution.segment = 'PRIVATE';
    const sourceUrl = new URL(normalized.sourceUrl);
    sourceUrl.searchParams.set('viewBy', task.category);
    sourceUrl.searchParams.set('viewByKey', task.key);
    sourceUrl.searchParams.set('viewSendingAgreements', String(type.startsWith('Sending')));
    normalized.sourceUrl = sourceUrl.toString();
    normalized.plannerGuide = formatPrivateGuide(normalized);
    return normalized;
}

export function extractCollectionReport(response, task, collectionKey) {
    const source = response.result;
    const expectedType = { Department: 'AllDepartments', SendingDepartment: 'AllSendingDepartments', Prefix: 'AllPrefixes', SendingPrefix: 'AllSendingPrefixes' }[task.key.split('/')[4]];
    assert.ok(expectedType && collectionKey === `${task.yearId}/92/to/${task.schoolId}/${expectedType}`, 'Wrong report collection');
    assert.equal(source?.type, expectedType, 'Unexpected collection response type');
    const groups = parse(source.articulations);
    assert.ok(Array.isArray(groups), 'Missing collection groups');
    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    const matches = groups.map((group, index) => ({ group, index })).filter(({ group }) => clean(group.name) === clean(task.label));
    if (matches.length !== 1) {
        const error = new Error(`Collection must contain one unambiguous group for ${task.label}`);
        error.code = 'INDIVIDUAL_REPORT_REQUIRED';
        throw error;
    }
    const { group, index } = matches[0];
    assert.ok(Array.isArray(group.articulations), 'Missing collection course records');
    return {
        response: { result: { ...source, type: task.key.split('/')[4], name: group.name,
            // The combined report has its own publication date; it is not an individual-report date.
            publishDate: null, templateAssets: null, articulations: group.articulations } },
        reference: { key: collectionKey, groupIndex: index, groupName: group.name, publishDate: source.publishDate },
    };
}

async function fetchSnapshot(client, relativePath, url) {
    const result = await client.fetchJsonCached(url, path.join(PRIVATE_ROOT, relativePath), { force: true });
    return { data: result.data, reference: { path: relativePath, url, sha256: result.hash, fetchedAt: new Date().toISOString() } };
}

async function inventory(client) {
    const sources = {};
    const values = {};
    for (const [name, pathname] of [['institutions', '/api/institutions'], ['partners', '/api/institutions/92/agreements'], ['years', '/api/AcademicYears']]) {
        const snapshot = await fetchSnapshot(client, `raw/metadata/${name}.json`, apiUrl(pathname));
        values[name] = snapshot.data;
        sources[name] = snapshot.reference;
    }
    const schools = selectPrivateTargets(values.institutions, values.partners, values.years);
    const reports = [];
    for (const school of schools) {
        const params = { receivingInstitutionId: school.id, sendingInstitutionId: 92, academicYearId: school.academicYear.id };
        const relative = `raw/lists/year-${school.academicYear.id}/receiving-${school.id}`;
        const categories = await fetchSnapshot(client, `${relative}/categories.json`, apiUrl('/api/agreements/categories', params));
        assert.ok(Array.isArray(categories.data), `Invalid category list for ${school.name}`);
        school.categoriesSource = categories.reference;
        school.categoryCounts = {};
        school.listSources = {};
        for (const category of ['breadth', 'major', 'dept', 'prefix']) {
            if (!categories.data.some(item => item.code === category && item.hasReports)) continue;
            const list = await fetchSnapshot(client, `${relative}/${category}.json`, apiUrl('/api/agreements', { ...params, categoryCode: category }));
            assert.ok(Array.isArray(list.data.reports), `Invalid ${category} list for ${school.name}`);
            assert.ok(list.data.reports.length, `Published ${category} category has an empty list for ${school.name}`);
            school.listSources[category] = list.reference;
            school.categoryCounts[category] = list.data.reports.length;
            for (const report of list.data.reports) {
                const type = report.key.split('/')[4];
                const allowedTypes = [CATEGORY_TYPES[category], ...(['dept', 'prefix'].includes(category) ? [`Sending${CATEGORY_TYPES[category]}`] : [])];
                assert.ok(report.key.startsWith(`${school.academicYear.id}/92/to/${school.id}/`) && allowedTypes.includes(type), `Inventory key mismatch: ${report.key}`);
                reports.push({ ...report, category, schoolId: school.id, yearId: school.academicYear.id });
            }
        }
        assert.ok(Object.keys(school.categoryCounts).length, `No published categories for ${school.name}`);
        console.log(`Inventory: ${school.name}, ${school.academicYear.label}: ${JSON.stringify(school.categoryCounts)}`);
    }
    assert.equal(new Set(reports.map(report => report.key)).size, reports.length, 'Duplicate report keys');
    const manifest = { source: 'ASSIST', sendingInstitutionId: 92, inventoryCheckedAt: new Date().toISOString(), sources, schools, reports, agreements: {}, failures: [], completedAt: null };
    if (fs.existsSync(manifestPath)) manifest.agreements = read(manifestPath).agreements;
    save(manifestPath, manifest);
    return manifest;
}

export async function runPrivateImport(args = process.argv.slice(2)) {
    if (args.includes('--rebuild-guides-only')) {
        const manifest = read(manifestPath);
        assert.ok(manifest.completedAt && !manifest.partial && !manifest.failures.length, 'Complete the source import first');
        save(path.join(PRIVATE_ROOT, 'reports/validation.json'), { valid: false, reason: 'Prepared guides rebuilt; source validation must run again.' });
        for (const task of manifest.reports) {
            const entry = manifest.agreements[task.key];
            const rawPath = path.join(PRIVATE_ROOT, entry.rawPath);
            assert.equal(digest(fs.readFileSync(rawPath)), entry.sha256, 'Cached source hash mismatch');
            const raw = read(rawPath);
            const collection = entry.collectionKey ? extractCollectionReport(raw, task, entry.collectionKey) : null;
            const normalized = normalizePrivateAgreement(collection?.response || raw, task, rawPath);
            if (collection) {
                normalized.sourceCollection = collection.reference;
                normalized.sourceApiUrl = manifest.collections[entry.collectionKey].sourceApiUrl;
            }
            save(path.join(PRIVATE_ROOT, entry.normalizedPath), normalized);
        }
        console.log(`Rebuilt ${manifest.reports.length} guides from unchanged source snapshots. Run source validation before building.`);
        return;
    }
    const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
    const client = new AssistClient({ 'delay-ms': option('--delay-ms') || 6500 });
    const manifest = !fs.existsSync(manifestPath) || args.includes('--refresh-inventory') ? await inventory(client) : read(manifestPath);
    if (args.includes('--inventory-only')) return;
    manifest.completedAt = null;
    manifest.failures = [];
    manifest.startedAt = new Date().toISOString();
    const limit = Number(option('--limit') || 0);
    // Fetch the small GE and major sets first, then the overlapping course-report views.
    const order = ['breadth', 'major', 'dept', 'prefix'];
    const tasks = [...manifest.reports].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    const collectionCache = new Map();
    manifest.collections ||= {};
    const useCollections = !args.includes('--individual-course-reports');
    let processed = 0;
    for (const task of limit ? tasks.slice(0, limit) : tasks) {
        try {
            const hash = digest(task.key).slice(0, 16);
            let rawRelative = `raw/agreements/year-${task.yearId}/receiving-${task.schoolId}/${task.category}/${hash}.json`;
            const existing = manifest.agreements[task.key];
            let collection;
            let collectionKey;
            let individualFallbackReason;
            if (useCollections && ['dept', 'prefix'].includes(task.category)) {
                const school = manifest.schools.find(school => school.id === task.schoolId);
                const list = read(path.join(PRIVATE_ROOT, school.listSources[task.category].path));
                collectionKey = list.allReports?.find(report => report.ownerInstitutionId === task.ownerInstitutionId)?.key;
                if (!collectionKey) individualFallbackReason = 'The published list has no combined export for this report owner.';
                if (collectionKey) {
                    rawRelative = `raw/collections/year-${task.yearId}/receiving-${task.schoolId}/${digest(collectionKey).slice(0, 16)}.json`;
                    if (!collectionCache.has(collectionKey)) {
                        const url = apiUrl('/api/articulation/Agreements', { Key: collectionKey });
                        const rawPath = path.join(PRIVATE_ROOT, rawRelative);
                        const prior = manifest.collections[collectionKey];
                        if (prior && fs.existsSync(rawPath)) assert.equal(digest(fs.readFileSync(rawPath)), prior.sha256, 'Cached collection hash mismatch');
                        const fetched = await client.fetchJsonCached(url, rawPath);
                        manifest.collections[collectionKey] = { key: collectionKey, rawPath: rawRelative, sourceApiUrl: url, sha256: fetched.hash,
                            fetchedAt: fetched.fromCache ? prior?.fetchedAt || null : new Date().toISOString() };
                        collectionCache.set(collectionKey, fetched);
                        console.log(`Collection: ${school.name}, ${collectionKey.split('/')[4]}`);
                    }
                    try {
                        collection = extractCollectionReport(collectionCache.get(collectionKey).data, task, collectionKey);
                    } catch (error) {
                        if (error.code !== 'INDIVIDUAL_REPORT_REQUIRED') throw error;
                        individualFallbackReason = error.message;
                    }
                }
                if (!collection) {
                    rawRelative = `raw/agreements/year-${task.yearId}/receiving-${task.schoolId}/${task.category}/${hash}.json`;
                    console.log(`Individual fallback: ${task.key}`);
                }
            }
            const rawPath = path.join(PRIVATE_ROOT, rawRelative);
            if (!collection && existing && !existing.collectionKey && fs.existsSync(rawPath)) assert.equal(digest(fs.readFileSync(rawPath)), existing.sha256, 'Cached source hash mismatch');
            const reportApiUrl = apiUrl('/api/articulation/Agreements', { Key: task.key });
            const response = collection ? collectionCache.get(collectionKey) : await client.fetchJsonCached(reportApiUrl, rawPath);
            const normalized = normalizePrivateAgreement(collection?.response || response.data, task, rawPath);
            if (collection) {
                normalized.sourceCollection = collection.reference;
                normalized.sourceApiUrl = manifest.collections[collectionKey].sourceApiUrl;
            }
            const normalizedPath = `normalized/year-${task.yearId}/receiving-${task.schoolId}/${task.category}/${hash}.json`;
            save(path.join(PRIVATE_ROOT, normalizedPath), normalized);
            manifest.agreements[task.key] = { ...task, rawPath: rawRelative, normalizedPath, sha256: response.hash,
                sourceUrl: normalized.sourceUrl, sourceApiUrl: normalized.sourceApiUrl, reportApiUrl,
                ...(collection ? { collectionKey, collectionGroupIndex: collection.reference.groupIndex } : {}),
                ...(individualFallbackReason ? { individualFallbackReason } : {}),
                fetchedAt: collection ? manifest.collections[collectionKey].fetchedAt : response.fromCache ? existing?.fetchedAt || null : new Date().toISOString() };
        } catch (error) {
            delete manifest.agreements[task.key];
            manifest.failures.push({ key: task.key, message: error.message });
            console.error(`Failed ${task.key}: ${error.message}`);
        }
        processed += 1;
        manifest.processed = processed;
        manifest.updatedAt = new Date().toISOString();
        save(manifestPath, manifest);
        if (processed % 10 === 0 || processed === tasks.length) console.log(`Processed ${processed}/${tasks.length}; errors ${manifest.failures.length}`);
    }
    manifest.completedAt = new Date().toISOString();
    manifest.partial = Boolean(limit && limit < tasks.length);
    const expectedKeys = new Set(manifest.reports.map(report => report.key));
    manifest.agreements = Object.fromEntries(Object.entries(manifest.agreements).filter(([key]) => expectedKeys.has(key)));
    save(manifestPath, manifest);
    console.log(JSON.stringify({ completedAt: manifest.completedAt, processed, expected: tasks.length, failures: manifest.failures.length, partial: manifest.partial }));
    if (manifest.failures.length || manifest.partial) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    runPrivateImport().catch(error => { console.error(error); process.exitCode = 1; });
}
