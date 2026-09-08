import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import * as cheerio from 'cheerio';
import { parseArticulation, parseGuide } from './importUscAgreements.mjs';
import { getUscPlannerData } from '../../lib/uscPlanner.ts';

const root = path.resolve('app/data/usc');
const raw = relative => gunzipSync(fs.readFileSync(path.join(root, 'raw', relative + '.html.gz'))).toString();

test('course combinations and both USC equivalents survive the articulation import', () => {
    const agreement = parseArticulation(raw('articulation'));
    const rows = agreement.sections.find(s => s.sourceId === 'Label17').tables.flatMap(t => t.rows);
    assert.ok(rows.some(row => row.cells[1] === 'MATH 210 with MATH 220' && row.cells[2] === 'MATH225 and MATH245'));
    assert.ok(rows.some(row => row.cells[1] === 'MATH 150' && row.cells[2] === 'MATH125'));
    assert.equal(rows.length, 25);
});

test('the guide parser rejects wrong schools, wrong program IDs, and incomplete responses', () => {
    const html = raw('programs/224');
    assert.throws(() => parseGuide(html, { id: '365', labels: [] }), /Program mismatch/);
    const $ = cheerio.load(html);
    $('#lbSchoolName').text('Another College');
    assert.throws(() => parseGuide($.html(), { id: '224', labels: [] }), /Unexpected sending school/);
    assert.throws(() => parseGuide('<html>USC system error</html>', { id: '224', labels: [] }), /Incomplete/);
});

test('USC programs use their own source and exclude internal audit text from student requirements', () => {
    const data = getUscPlannerData();
    assert.equal(data.schools[0].id, 'usc');
    assert.equal(data.majors.length, 263);
    assert.equal(new Set(data.majors.map(major => major.id)).size, data.majors.length);
    for (const agreement of data.agreements) {
        assert.equal(agreement.academicYearLabel, '2026-2027');
        assert.ok(agreement.sourceUrl.startsWith('https://darsweb.usc.edu/'));
        assert.ok(agreement.uscGuide.sections.length > 0);
        assert.ok(agreement.uscGuide.sections.every(s => !/INTERNAL USE ONLY|INTERNAL AUDITING/.test(s.text)));
        assert.ok(agreement.uscGuide.warnings.some(warning => warning.includes('D (Life Sciences) and E (Physical Sciences)')));
    }
    for (const major of data.majors.filter(major => !major.hasDetails)) {
        assert.equal(major.agreementId, null);
        assert.ok(major.unavailableReason);
    }
});
