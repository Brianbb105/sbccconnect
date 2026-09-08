import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import { UscSession, parseGuide, textWithLines } from './importUscAgreements.mjs';

const root = path.resolve('app/data/usc');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [...manifest.failures];
const ids = [...new Set([...failures.map(f => f.id), '2054', '486', '598'])];
const results = [];
const stableText = text => text.replace(/^PREPARED:[^\n]*\n/, '').replace(/\s/g, '');
fs.mkdirSync(path.join(root, 'raw/rechecks'), { recursive: true });
for (const id of ids) {
    const program = manifest.programs.find(p => p.id === id);
    let raw;
    try {
        // Fresh sessions and sequential requests help distinguish source errors from session/report reuse.
        const session = new UscSession();
        const selection = await session.startGuide();
        const response = await session.guide(selection, program);
        raw = { path: `raw/rechecks/${id}.html.gz`, fetchedAt: new Date().toISOString(),
            sha256: crypto.createHash('sha256').update(response.html).digest('hex') };
        fs.writeFileSync(path.join(root, raw.path), gzipSync(response.html));
        const parsed = parseGuide(response.html, program);
        if (parsed.academicYear !== manifest.academicYear) throw new Error('Recheck academic year mismatch');
        const existing = manifest.reports.find(report => report.id === id);
        if (existing) {
            const saved = JSON.parse(fs.readFileSync(path.join(root, existing.normalizedPath), 'utf8'));
            if (stableText(saved.reportText) !== stableText(parsed.reportText)) throw new Error('Live report differs from imported source');
            results.push({ id, status: 'live-match', raw });
        } else {
            parsed.raw = raw;
            parsed.restrictionsText = textWithLines(cheerio.load(response.restrictionsHtml)('body').html() || '');
            const normalizedPath = `normalized/programs/${id}.json`;
            fs.writeFileSync(path.join(root, normalizedPath), JSON.stringify(parsed, null, 2) + '\n');
            manifest.reports.push({ id, normalizedPath, raw });
            manifest.failures = manifest.failures.filter(f => f.id !== id);
            results.push({ id, status: 'recovered', raw, initialFailure: failures.find(f => f.id === id) });
        }
    } catch (error) {
        results.push({ id, status: 'still-unavailable', message: error.message, raw });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/live-recheck.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
    console.log(id, results.at(-1).status);
    await new Promise(resolve => setTimeout(resolve, 1000));
}
if (results.some(result => ['2054', '486', '598'].includes(result.id) && result.status !== 'live-match')) process.exitCode = 1;
