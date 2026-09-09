import * as cheerio from 'cheerio';
import type { PrivateAssistGuide, PrivateCourseRow, PrivateSourceText, PrivateAgreementCategory } from './privateAssistTypes';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown) => value == null ? '' : String(value);
const words = (value: unknown) => string(value).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const quantifier = (value: unknown) => value === 'None' || !value ? '' : words(value);
const logic = (value: unknown) => ['AND', 'OR'].includes(string(value).toUpperCase()) ? string(value).toUpperCase() : '';

export function sourceText(value: unknown): PrivateSourceText {
    const $ = cheerio.load(string(value));
    $('script, style').remove();
    const links: PrivateSourceText['links'] = [];
    $('a[href]').each((_, anchor) => {
        try {
            const url = new URL($(anchor).attr('href')!, 'https://www.assist.org');
            if (['https:', 'http:'].includes(url.protocol)) links.push({ label: $(anchor).text().trim() || 'Source link', url: url.toString() });
        } catch { /* Invalid source links remain plain text. */ }
    });
    $('br').replaceWith('\n');
    $('p, div, li, h1, h2, h3, h4, tr').each((_, element) => { $(element).append('\n'); });
    $('td, th').each((_, element) => { $(element).append(' | '); });
    return { text: $.text().replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(), links };
}

function amount(value: unknown, unit: unknown) {
    const count = value == null ? '' : string(value);
    let name = words(unit);
    if (Number(value) > 1 && name === 'course or combination') name = 'courses or combinations';
    else if (Number(value) > 1 && !name.endsWith('s')) name += 's';
    return `${count} ${name}`.trim();
}

// Mirrors the selection/advisement vocabulary used by ASSIST's public report UI.
export function selectionText(value: unknown, scope = 'sections') {
    const rule = object(value);
    if (!Object.keys(rule).length) return '';
    if (['Conjunction', 'NFromConjunction', 'NToNFromConjunction'].includes(string(rule.type)) && !logic(rule.conjunction)) {
        throw new Error(`Unsupported ASSIST section conjunction: ${rule.conjunction}`);
    }
    const action = string(rule.selectionType || 'Complete');
    const conjunctionScope = `${logic(rule.conjunction) === 'AND' ? 'every' : 'any'} ${scope === 'rows' ? 'row' : 'section'} in this group`;
    const quantity = amount(rule.amount, rule.amountUnitType);
    let text = '';
    switch (rule.type) {
        case 'Following': case 'CompleteFollowing': text = `${action} the following`; break;
        case 'Conjunction': text = `${action} ${conjunctionScope}`; break;
        case 'NFromConjunction': text = `${action} ${quantifier(rule.amountQuantifier)} ${quantity} from ${conjunctionScope}`; break;
        case 'NToNFromConjunction': text = `${action} ${string(rule.fromAmount)}–${amount(rule.toAmount, rule.unitType)} from ${conjunctionScope}`; break;
        case 'NFromArea': {
            const of = ['Any', 'Each'].includes(string(rule.toAmountDeterminer)) || Number(rule.toAmount) >= 1 ? 'of' : '';
            text = `${action} ${quantifier(rule.amountQuantifier)} ${quantity} from ${quantifier(rule.toAmountDeterminer)} ${Number(rule.toAmount) >= 1 ? rule.toAmount : ''} ${of} the following ${quantifier(rule.areaType)}`;
            break;
        }
        case 'NOrUnits': text = `${action} ${quantity} or ${amount(rule.toAmount, rule.toAmountUnitType)}`; break;
        case 'NFromFollowing': text = `${action} ${rule.amount} from the following`; break;
        case 'NInNDifferentAreas': text = `${action} ${quantity} in ${rule.areaAmount} different ${quantifier(rule.areaType)}`; break;
        case 'NInAnyNAreas': text = `${action} ${quantity} from any ${rule.areaAmount} of the following ${quantifier(rule.areaType)}`; break;
        case 'AdditionalNToReach': text = `${action} additional units to reach ${rule.amount} total`; break;
        case 'NFromUnits': text = `${action} ${quantifier(rule.amountQuantifier)} ${quantity} from this section`; break;
        case 'NFollowing': text = `${action} ${quantity} from the following`; break;
        case 'NToNFollowing': text = `${action} ${rule.fromAmount}–${amount(rule.toAmount, rule.unitType)} from the following`; break;
        case 'CompleteAllCourses': text = 'Complete all courses from this section'; break;
        default: throw new Error(`Unsupported ASSIST selection rule: ${rule.type}`);
    }
    return text.replace(/\s+/g, ' ').trim();
}

function notes(...collections: unknown[]): PrivateSourceText[] {
    return collections.flatMap(list).map(value => {
        if (typeof value === 'string') return sourceText(value);
        const note = object(value);
        const content = note.content ?? note.text ?? note.name;
        return sourceText(content || (note.type ? selectionText(note) : ''));
    }).filter(note => note.text || note.links.length);
}

function courseText(value: unknown): string {
    const course = object(value);
    const code = `${string(course.prefix)} ${string(course.courseNumber)}`.trim();
    const units = course.minUnits != null && course.maxUnits != null && course.minUnits !== course.maxUnits ? `${course.minUnits}–${course.maxUnits}` : string(course.minUnits ?? course.maxUnits);
    const crossListings = list(course.visibleCrossListedCourses).map(value => { const c = object(value); return `${c.prefix} ${c.courseNumber}`; });
    const lines = [`${code} — ${string(course.title)}${units ? ` (${units} units)` : ''}`];
    if (crossListings.length) lines.push(`Also listed as: ${crossListings.join(', ')}`);
    if (course.beginTerm || course.endTerm) lines.push(`Course validity: ${string(course.beginTerm) || 'start not listed'}${course.endTerm ? ` through ${course.endTerm}` : ' onward'}`);
    return lines.join('\n');
}

function coursesText(value: unknown, conjunction: unknown) {
    const courses = list(value).map(courseText);
    return courses.join(logic(conjunction) ? `\n${logic(conjunction)}\n` : '\n');
}

function courseNotes(value: unknown): PrivateSourceText[] {
    return list(value).flatMap(value => {
        const course = object(value);
        const output = notes(course.attributes, course.courseAttributes);
        for (const requisite of list(course.requisites)) {
            const r = object(requisite);
            const c = object(r.course || requisite);
            output.push(sourceText(`${words(r.requisiteType || r.type || 'Course condition')}: ${string(r.content || r.description) || [c.prefix, c.courseNumber, c.courseTitle || c.title].filter(Boolean).join(' ') || 'See ASSIST for this course condition.'}`));
        }
        return output;
    });
}

function row(receivingValue: unknown, sendingValue: unknown, id: string): PrivateCourseRow {
    const receiving = object(receivingValue), sending = object(sendingValue);
    let instructions: string[] = [];
    const options = list(sending.courseGroups).flatMap(value => {
        const group = object(value);
        if (group.type === 'Advisement') {
            instructions.push(selectionText(group.sourceAdvisement));
            return [];
        }
        const items = list(group.items).map(value => {
            const item = object(value);
            const courseList = coursesText(item.courses, item.logic);
            return [string(item.name), item.type === 'Series' && list(item.courses).length > 1 ? `(\n${courseList}\n)` : courseList].filter(Boolean).join('\n');
        });
        const option = {
            text: [...instructions, items.join(logic(group.logic) ? `\n${logic(group.logic)}\n` : '\n')].filter(Boolean).join('\n'),
            notes: [...notes(group.attributes), ...list(group.items).flatMap(value => { const item = object(value); return [...notes(item.attributes), ...courseNotes(item.courses)]; })],
        };
        instructions = [];
        return [option];
    });
    const sendingNotes = notes(sending.attributes, sending.articulationAttributes, sending.receivingAttributes);
    sendingNotes.push(...instructions.map(sourceText));
    if (list(sending.deniedCourses).length) sendingNotes.push(sourceText(`Courses explicitly denied for this articulation:\n${coursesText(sending.deniedCourses, '')}`));
    if (list(sending.templateOverrides).length) sendingNotes.push(sourceText('ASSIST includes conditional variations for this course match. Open the official agreement to review those conditions before selecting courses.'));
    const templateNotes = object(sending.receivingTemplateAttributes);
    const noMatch = ['NO_ARTICULATION_RECORD_FOR_TEMPLATE_CELL', 'NO_SENDING_ARTICULATION_IN_SOURCE'].includes(string(sending.noArticulationReason))
        ? 'ASSIST lists no SBCC course match for this requirement.' : string(sending.noArticulationReason);
    return {
        id, title: [receiving.areaCode, receiving.name].filter(Boolean).join(' — ') || list(receiving.courses).map(value => { const c = object(value); return `${c.prefix} ${c.courseNumber}`; }).join(' / ') || 'Requirement',
        receivingText: coursesText(receiving.courses, receiving.logic),
        notes: [...notes(receiving.attributes, receiving.courseAttributes, receiving.requirementAttributes, receiving.generalEducationAreaAttributes, receiving.rowAttributes, receiving.advisements, templateNotes.attributes, templateNotes.courseAttributes, templateNotes.seriesAttributes, templateNotes.generalEducationAreaAttributes), ...courseNotes(receiving.courses)],
        sendingNotes, options, optionLogic: logic(sending.logic), noMatch,
    };
}

export function formatPrivateGuide(value: unknown): PrivateAssistGuide {
    const data = object(value);
    const category = data.category as PrivateAgreementCategory;
    const groups = list(data.requirementGroups).map((value, groupIndex) => {
        const group = object(value);
        const instruction = selectionText(group.sourceInstruction, group.hideSectionLetters ? 'rows' : 'sections');
        let sectionLetter = 0;
        return {
            title: sourceText(group.title).text || `Group ${groupIndex + 1}`,
            notes: [...(instruction ? [sourceText(instruction)] : []), ...notes(group.attributes, group.advisements)],
            sections: list(group.sections).map((value, sectionIndex) => {
                const section = object(value);
                const articulations = list(section.sbccArticulations).map(object);
                const isHeading = section.sourceType === 'SectionHeader';
                return {
                    title: isHeading ? sourceText(section.sourceHeading).text : group.hideSectionLetters ? '' : `Section ${String.fromCharCode(65 + sectionLetter++)}`,
                    isHeading,
                    notes: notes(section.attributes, section.advisements),
                    rows: list(section.receivingItems).map((value, index) => {
                        const cell = object(value);
                        return row(cell, articulations.find(item => item.receivingCellId === cell.id), `${groupIndex}-${sectionIndex}-${index}`);
                    }),
                };
            }),
        };
    });
    if (list(data.courseEquivalencies).length) groups.push({ title: 'Course equivalencies', notes: [], sections: [{ title: '', isHeading: false, notes: [], rows: list(data.courseEquivalencies).map((value, index) => { const item = object(value); return row(item.receiving, item.sending, `course-${index}`); }) }] });
    const warnings: string[] = [];
    if (list(data.unlinkedArticulations).length) warnings.push('ASSIST includes additional articulation records without matching requirement positions. They are retained in the source archive; check the official report for clarification.');
    return { category, organizedBy: string(object(data.agreement).type).startsWith('Sending') ? 'SBCC' : 'university',
        notes: list(data.notes).map(value => { const note = object(value); return sourceText(note.contentHtml || note.content); }).filter(note => note.text || note.links.length), groups, warnings };
}
