import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';

const BASE = 'https://darsweb.usc.edu';
const ROOT = path.resolve('app/data/usc');
const SCHOOL = 'Santa Barbara City College';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const compact = text => text.replace(/\s+/g, ' ').trim();
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

export function textWithLines(html) {
  const $ = cheerio.load(html, null, false);
  $('script,style,input,select').remove();
  $('br').replaceWith('\n');
  $('p,div,tr,h1,h2,h3,h4,li').each((_, e) => $(e).append('\n'));
  $('td,th').each((_, e) => $(e).append('\t'));
  return $.root().text().replace(/\u00a0/g, ' ').split('\n')
    .map(line => line.trimEnd()).join('\n').trim();
}

export function parseGuide(html, program) {
  const $ = cheerio.load(html);
  const reportText = textWithLines($('#dynamicContent').html() || '');
  if (!reportText.includes('END OF ANALYSIS')) throw new Error('Incomplete USC report');
  if (compact($('#lbSchoolName').text()) !== SCHOOL) throw new Error('Unexpected sending school');
  const code = reportText.match(/PROGRAM CODE:\s*(\S+)/)?.[1];
  if (code !== program.id) throw new Error(`Program mismatch: ${code} vs ${program.id}`);
  const period = reportText.match(/CAT\. YEAR FA(\d{2})\s+THRU SU(\d{2})/);
  if (!period) throw new Error('Missing USC academic year');
  const chunks = reportText.split(/\n_{10,}\n/);
  let internal = false;
  const sections = chunks.map((text, position) => {
    if (/INTERNAL USE ONLY|INTERNAL AUDITING/.test(text)) internal = true;
    return { position, kind: internal ? 'internal-or-closing-source-text' : position < 2 ? 'header' : 'requirements', text };
  });
  return {
    schemaVersion: 1, source: 'USC Transfer Planning Guide',
    sourceUrl: `${BASE}/TPG/Default.aspx`, sendingSchool: SCHOOL,
    receivingSchool: 'University of Southern California', program,
    academicYear: `20${period[1]}-20${period[2]}`,
    sourceProgramLabel: compact($('#lbDegName').text()),
    advisoryText: textWithLines($('#lbHeader').html() || ''),
    advisoryLinks: $('#lbHeader a[href]').map((_, e) => ({
      label: compact($(e).text()), url: new URL($(e).attr('href'), BASE + '/TPG/').href,
    })).get().filter(link => /^https?:\/\//.test(link.url)),
    reportText, sections,
    interpretation: 'Source text and course expressions are preserved. This degree planning guide is not an admission checklist or admission guarantee. Internal audit sections are retained separately and must not be treated as current course equivalencies.',
  };
}

export function parseArticulation(html) {
  const $ = cheerio.load(html);
  const title = compact($('#Label1').text());
  if (!title.includes(SCHOOL)) throw new Error('Unexpected articulation school');
  const period = compact($('#Label5').text());
  const years = period.match(/Fall (\d{4}) - Summer (\d{4})/);
  if (!years) throw new Error('Missing articulation academic year');
  // Preserve every published label and every table cell, including empty tables.
  const sections = $('#Panel2 span[id^="Label"]').map((_, e) => ({
    sourceId: $(e).attr('id'), text: textWithLines($(e).html() || ''),
    tables: $(e).find('table').map((_, table) => ({ rows: $(table).find('tr').map((_, row) => ({
      cells: $(row).children('td,th').map((_, cell) => compact($(cell).text())).get(),
    })).get() })).get(),
  })).get();
  return { schemaVersion: 1, source: 'USC Articulation Agreement',
    sourceUrl: `${BASE}/articagrmt/artic.aspx`, sendingSchool: SCHOOL,
    receivingSchool: 'University of Southern California',
    academicYear: `${years[1]}-${years[2]}`, effectivePeriod: period,
    reportText: textWithLines($('#Panel2').html() || ''), sections };
}

function form(html, overrides) {
  const $ = cheerio.load(html); const body = new URLSearchParams();
  $('input[type=hidden],select').each((_, e) => body.set($(e).attr('name'), $(e).val()));
  for (const [key, value] of Object.entries(overrides)) body.set(key, value);
  return body;
}

export class UscSession {
  jar = new Map();
  async request(url, body, redirects = 0) {
    if (redirects > 8) throw new Error('Too many redirects');
    url = new URL(url, BASE).href;
    const response = await fetch(url, { method: body ? 'POST' : 'GET', body,
      redirect: 'manual', signal: AbortSignal.timeout(60000),
      headers: { Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        'User-Agent': 'SBCCPlan transfer agreement research' } });
    for (const cookie of response.headers.getSetCookie()) {
      const [key, ...value] = cookie.split(';')[0].split('='); this.jar.set(key, value.join('='));
    }
    if ([301, 302, 303].includes(response.status)) {
      return this.request(new URL(response.headers.get('location'), url), undefined, redirects + 1);
    }
    if (!response.ok) throw new Error(`USC HTTP ${response.status}`);
    const html = await response.text();
    if (url.includes('Error.aspx')) throw new Error('USC application error');
    return { url, html };
  }
  async startGuide() {
    const start = await this.request('/TPG/Default.aspx');
    return this.request(start.url, form(start.html, { Button1: 'Continue' }));
  }
  async guide(selection, program) {
    const $ = cheerio.load(selection.html);
    const school = $('#DropDownSchools option').filter((_, e) => $(e).text() === SCHOOL).val();
    if (!school) throw new Error('SBCC missing from USC selector');
    let page = await this.request(selection.url, form(selection.html, {
      DropDownSchools: school, DropDownSchools_hist: '-----', DropDownDPROG: program.id,
      Button1: $('#Button1').val(),
    }));
    if (!page.url.endsWith('/DispWrngCal.aspx')) throw new Error(`Unexpected notice URL ${page.url}`);
    const restrictionsHtml = page.html;
    page = await this.request(page.url, form(page.html, { CheckBox1: 'on', btnContinue: 'Continue' }));
    const started = Date.now();
    while (page.url.includes('DispRprt_wait.aspx') && Date.now() - started < 90000) {
      await sleep(2000); page = await this.request(page.url);
    }
    return { ...page, restrictionsHtml };
  }
}

function saveRaw(relative, html) {
  const file = path.join(ROOT, 'raw', relative + '.html.gz');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gzipSync(html));
  return { path: path.relative(ROOT, file), sha256: hash(html), fetchedAt: new Date().toISOString() };
}

export async function runImport({ limit = Infinity, refresh = false, workers = 2 } = {}) {
  const session = new UscSession();
  let agreement = await session.request('/articagrmt/artic.aspx');
  agreement = await session.request(agreement.url, form(agreement.html, {
    DropDownRegions: '6', DropDownSchools: '-----', btnSubmit: 'Submit',
  }));
  const $ = cheerio.load(agreement.html);
  const school = $('#DropDownSchools option').filter((_, e) => $(e).text() === SCHOOL).val();
  if (!school) throw new Error('SBCC missing from USC articulation selector');
  agreement = await session.request(agreement.url, form(agreement.html, {
    DropDownRegions: '6', DropDownSchools: school, btnSubmit: 'Submit',
  }));
  const articulation = parseArticulation(agreement.html);
  articulation.raw = saveRaw('articulation', agreement.html);
  writeJson(path.join(ROOT, 'normalized/articulation.json'), articulation);
  const selection = await session.startGuide();
  const sel = cheerio.load(selection.html);
  const options = sel('#DropDownDPROG option').map((_, e) => ({
    id: sel(e).val(), label: compact(sel(e).text()),
  })).get().filter(p => p.id !== '-----');
  const programs = [...new Set(options.map(p => p.id))].map(id => ({
    id, labels: options.filter(p => p.id === id).map(p => p.label),
  }));
  const manifest = { sourceUrl: `${BASE}/TPG/Default.aspx`, sendingSchool: SCHOOL,
    fetchedAt: new Date().toISOString(), academicYear: articulation.academicYear,
    selectorRaw: saveRaw('program-selector', selection.html), optionCount: options.length,
    uniqueProgramCount: programs.length, programs, reports: [], failures: [] };
  const manifestPath = path.join(ROOT, 'manifest.json');
  const queue = programs.slice(0, limit);
  async function worker(workerSession, workerSelection) {
  while (queue.length) {
    const program = queue.shift();
    const file = path.join(ROOT, 'normalized/programs', `${program.id}.json`);
    let responseRaw;
    try {
      let parsed;
      if (!refresh && fs.existsSync(file)) {
        parsed = JSON.parse(fs.readFileSync(file));
        const html = gunzipSync(fs.readFileSync(path.join(ROOT, parsed.raw.path))).toString();
        if (hash(html) !== parsed.raw.sha256) throw new Error('Cached source hash mismatch');
        const checked = parseGuide(html, program);
        if (JSON.stringify(checked) !== JSON.stringify(Object.fromEntries(Object.entries(parsed).filter(([k]) => !['raw','restrictionsText'].includes(k))))) throw new Error('Cached normalization differs from source');
      } else {
        const result = await workerSession.guide(workerSelection, program);
        responseRaw = saveRaw(`programs/${program.id}`, result.html);
        parsed = parseGuide(result.html, program);
        parsed.raw = responseRaw;
        parsed.restrictionsText = textWithLines(cheerio.load(result.restrictionsHtml)('body').html() || '');
        writeJson(file, parsed);
      }
      if (parsed.academicYear !== articulation.academicYear) throw new Error('Guide and agreement academic years differ');
      manifest.reports.push({ id: program.id, normalizedPath: path.relative(ROOT, file), raw: parsed.raw });
      console.log(`${manifest.reports.length}/${Math.min(limit, programs.length)} USC ${program.id}`);
    } catch (error) {
      manifest.failures.push({ id: program.id, message: error.message, raw: responseRaw });
      console.error(`USC ${program.id}: ${error.message}`);
    }
    writeJson(manifestPath, manifest);
    await sleep(650);
  }
  }
  const jobs = [worker(session, selection)];
  for (let i = 1; i < workers; i++) {
    const other = new UscSession();
    jobs.push(worker(other, await other.startGuide()));
  }
  await Promise.all(jobs);
  console.log(JSON.stringify({ programs: manifest.uniqueProgramCount, saved: manifest.reports.length, failures: manifest.failures }));
  if (manifest.failures.length) process.exitCode = 1;
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--limit');
  await runImport({ limit: index < 0 ? Infinity : Number(process.argv[index + 1]), refresh: process.argv.includes('--refresh') });
}
