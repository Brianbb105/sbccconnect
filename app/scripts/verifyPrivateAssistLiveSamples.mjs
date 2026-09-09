import fs from 'node:fs';
import path from 'node:path';
import { AssistClient } from './importAssistAgreements.mjs';
import { PRIVATE_ROOT, read, save, digest, extractCollectionReport } from './importPrivateAssistAgreements.mjs';

const manifest = read(path.join(PRIVATE_ROOT, 'manifest.json'));
if (!manifest.completedAt || manifest.partial || manifest.failures.length) throw new Error('Complete the import before live comparison.');
const validation = read(path.join(PRIVATE_ROOT, 'reports/validation.json'));
if (!validation.valid || validation.manifestSha256 !== digest(fs.readFileSync(path.join(PRIVATE_ROOT, 'manifest.json')))) throw new Error('Validate this import before live comparison.');
const embedded = new Set(['receivingInstitution', 'sendingInstitution', 'academicYear', 'catalogYear', 'templateAssets', 'articulations']);
function canonical(value, key = '') {
    if (embedded.has(key) && typeof value === 'string' && /^[\[{]/.test(value.trimStart())) value = JSON.parse(value);
    if (Array.isArray(value)) return value.map(item => canonical(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], key)]));
    return value;
}
const contentHash = value => digest(JSON.stringify(canonical(value)));
const samplesBySchoolAndType = new Map();
for (const report of [...manifest.reports].sort((a, b) => a.key.localeCompare(b.key))) {
    const key = `${report.schoolId}/${report.key.split('/')[4]}`;
    if (!samplesBySchoolAndType.has(key)) samplesBySchoolAndType.set(key, report);
}
const result = { startedAt: new Date().toISOString(), completedAt: null, manifestSha256: validation.manifestSha256,
    sampling: 'One deterministic report per university and source report type, including SBCC-organized views',
    expectedSamples: samplesBySchoolAndType.size, samples: [], errors: [], valid: false };
const client = new AssistClient({});
for (const sample of samplesBySchoolAndType.values()) {
    try {
        const entry = manifest.agreements[sample.key];
        const reportApiUrl = entry.reportApiUrl || entry.sourceApiUrl;
        const text = await client.requestText(reportApiUrl);
        const raw = JSON.parse(text);
        let cached = read(path.join(PRIVATE_ROOT, entry.rawPath));
        let live = raw;
        if (entry.collectionKey) {
            const fields = ['academicYear', 'sendingInstitution', 'receivingInstitution', 'catalogYear', 'articulations'];
            const extracted = extractCollectionReport(cached, sample, entry.collectionKey).response.result;
            cached = Object.fromEntries(fields.map(field => [field, extracted[field]]));
            live = Object.fromEntries(fields.map(field => [field, raw.result[field]]));
        }
        const cachedHash = contentHash(cached);
        const liveHash = contentHash(live);
        const relativePath = `reports/live-samples/${digest(sample.key).slice(0, 16)}.json`;
        save(path.join(PRIVATE_ROOT, relativePath), raw);
        const matches = cachedHash === liveHash;
        result.samples.push({ schoolId: sample.schoolId, category: sample.category, type: sample.key.split('/')[4], key: sample.key, label: sample.label,
            checkedAt: new Date().toISOString(), matches, cachedHash, liveHash, rawPath: relativePath, sourceApiUrl: reportApiUrl,
            comparisonScope: entry.collectionKey ? 'All course-articulation records plus institution, academic-year and catalog metadata; collection publication date excluded' : 'Complete individual agreement response' });
        if (!matches) result.errors.push({ key: sample.key, message: 'Live source differs from the saved agreement.' });
        console.log(`${matches ? 'Match' : 'DIFFERENCE'}: ${sample.schoolId}, ${sample.key.split('/')[4]}, ${sample.label}`);
    } catch (error) { result.errors.push({ key: sample.key, message: error.message }); }
    save(path.join(PRIVATE_ROOT, 'reports/live-validation.json'), result);
}
result.completedAt = new Date().toISOString();
result.valid = result.errors.length === 0 && result.samples.length === result.expectedSamples;
save(path.join(PRIVATE_ROOT, 'reports/live-validation.json'), result);
console.log(JSON.stringify({ valid: result.valid, samples: result.samples.length, schools: new Set(result.samples.map(sample => sample.schoolId)).size, errors: result.errors }));
if (!result.valid) process.exitCode = 1;
