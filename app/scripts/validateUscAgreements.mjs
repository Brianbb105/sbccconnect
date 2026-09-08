import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import { parseArticulation, parseGuide } from './importUscAgreements.mjs';

const root = path.resolve('app/data/usc');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const squeeze = value => value.replace(/\s/g, '');
const manifest = read('manifest.json');
const report = { checkedAt: new Date().toISOString(), programOptions: manifest.optionCount,
  distinctPrograms: manifest.uniqueProgramCount, validGuides: manifest.reports.length,
  sourceFailures: [], validationErrors: [], articulationEquivalencyRows: 0,
  checks: ['Complete selector coverage', 'SHA-256 source hashes', 'School, program and year identity',
    'Every source text character preserved except whitespace', 'All articulation sections and table cells',
    'Internal audit sections excluded from planner requirements'] };

function source(record) {
  const html = gunzipSync(fs.readFileSync(path.join(root, record.path))).toString();
  assert.equal(crypto.createHash('sha256').update(html).digest('hex'), record.sha256);
  return html;
}
function check(name, callback) {
  try { callback(); } catch (error) { report.validationErrors.push({ name, message: error.message }); }
}
check('selector coverage', () => {
  const $ = cheerio.load(source(manifest.selectorRaw));
  const ids = $('#DropDownDPROG option').map((_, e) => $(e).val()).get().filter(id => id !== '-----');
  assert.equal(ids.length, manifest.optionCount);
  assert.equal(new Set(ids).size, manifest.uniqueProgramCount);
  assert.deepEqual(new Set(ids), new Set(manifest.programs.map(p => p.id)));
  const completedIds = [...manifest.reports, ...manifest.failures].map(item => item.id);
  assert.equal(new Set(completedIds).size, completedIds.length);
  assert.deepEqual(new Set(completedIds), new Set(ids));
});
check('articulation', () => {
  const agreement = read('normalized/articulation.json');
  const html = source(agreement.raw);
  const $ = cheerio.load(html);
  assert.equal(squeeze(agreement.reportText), squeeze($('#Panel2').text()));
  const { raw, ...data } = agreement;
  assert.ok(raw);
  assert.deepEqual(data, parseArticulation(html));
  assert.equal(agreement.academicYear, manifest.academicYear);
  for (const section of agreement.sections) {
    assert.equal(squeeze(section.text), squeeze($(`[id="${section.sourceId}"]`).text()));
    const rows = $(`[id="${section.sourceId}"] table tr`).toArray();
    assert.equal(section.tables.flatMap(t => t.rows).length, rows.length);
  }
  report.articulationEquivalencyRows = agreement.sections.find(s => s.sourceId === 'Label17').tables.flatMap(t => t.rows).length - 1;
});
for (const item of manifest.reports) check(item.id, () => {
  const data = read(item.normalizedPath);
  const html = source(item.raw);
  const $ = cheerio.load(html);
  assert.equal(squeeze(data.reportText), squeeze($('#dynamicContent').text()));
  assert.equal(squeeze(data.sections.map(s => s.text).join('')).replace(/_{10,}/g, ''), squeeze(data.reportText).replace(/_{10,}/g, ''));
  const { raw, restrictionsText, ...normalized } = data;
  assert.deepEqual(raw, item.raw);
  assert.ok(restrictionsText.includes('restrictions and limitations'));
  assert.deepEqual(normalized, parseGuide(html, manifest.programs.find(p => p.id === item.id)));
  assert.equal(data.academicYear, manifest.academicYear);
  assert.ok(data.sections.filter(s => s.kind === 'requirements').every(s => !/INTERNAL USE ONLY|INTERNAL AUDITING/.test(s.text)));
});
for (const item of manifest.failures) check(`failed-source-${item.id}`, () => {
  const html = item.raw ? source(item.raw) : '';
  const $ = cheerio.load(html);
  report.sourceFailures.push({ id: item.id, labels: manifest.programs.find(p => p.id === item.id)?.labels,
    reason: $('#lbError').text().trim() || item.message, raw: item.raw });
});
const livePath = path.join(root, 'reports/live-recheck.json');
if (fs.existsSync(livePath)) {
  const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
  report.liveRechecks = live.results.map(({ id, status }) => ({ id, status }));
  for (const item of live.results) check(`live-recheck-${item.id}`, () => {
    const html = source(item.raw);
    if (item.initialFailure?.raw) source(item.initialFailure.raw);
    if (item.status === 'still-unavailable') {
      assert.throws(() => parseGuide(html, manifest.programs.find(p => p.id === item.id)));
    } else {
      const parsed = parseGuide(html, manifest.programs.find(p => p.id === item.id));
      const saved = read(manifest.reports.find(r => r.id === item.id).normalizedPath);
      const stable = text => squeeze(text.replace(/^PREPARED:[^\n]*\n/, ''));
      assert.equal(stable(parsed.reportText), stable(saved.reportText));
    }
  });
}
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.validationErrors.length) process.exitCode = 1;
