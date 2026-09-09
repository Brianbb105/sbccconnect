"use client";

import { useState } from 'react';
import type { PlannerAgreement } from '@/lib/assistPlanner';
import { PRIVATE_CATEGORY_LABELS, type PrivateSourceText, type PrivateCourseRow } from '@/lib/privateAssistTypes';

function SourceNotes({ notes }: { notes: PrivateSourceText[] }) {
    return <>{notes.map((note, index) => <div key={index} className="space-y-2 text-sm leading-6 text-slate-700">
        {note.text && <p className="whitespace-pre-line">{note.text}</p>}
        {note.links.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2">{note.links.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">{link.label} ↗</a>)}</div>}
    </div>)}</>;
}

function CourseRow({ row, school, expand }: { row: PrivateCourseRow; school: string; expand: boolean }) {
    return <details open={expand || undefined} className="rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-bold text-slate-900">{row.title}</summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{school}</p>
                {row.receivingText && <p className="whitespace-pre-line text-sm leading-7 text-slate-800">{row.receivingText}</p>}
                <SourceNotes notes={row.notes} />
            </div>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SBCC course matches</p>
                {row.options.length ? row.options.map((option, index) => <div key={index}>
                    {index > 0 && <p className="mb-3 text-xs font-bold text-slate-500">{row.optionLogic || `Course group ${index + 1}`}</p>}
                    <p className="whitespace-pre-line text-sm leading-7 text-slate-900">{option.text || 'No courses listed in this group.'}</p>
                    <div className="mt-2 space-y-2"><SourceNotes notes={option.notes} /></div>
                </div>) : <p className="text-sm text-slate-700">{row.noMatch || 'No SBCC course match is listed.'}</p>}
                {row.options.length > 1 && !row.optionLogic && <p className="text-xs leading-5 text-slate-500">These groups are listed separately in the source. Review ASSIST for any conditions on selecting or combining them.</p>}
                <SourceNotes notes={row.sendingNotes} />
            </div>
        </div>
    </details>;
}

export default function PrivateAssistGuide({ agreement }: { agreement: PlannerAgreement }) {
    const [search, setSearch] = useState('');
    const [expandAll, setExpandAll] = useState(false);
    const guide = agreement.privateGuide!;
    const query = search.replace(/\s/g, '').toLowerCase();
    const matches = (row: PrivateCourseRow) => JSON.stringify(row).replace(/\s/g, '').toLowerCase().includes(query);
    const matchingCount = guide.groups.flatMap(group => group.sections.flatMap(section => section.rows)).filter(matches).length;
    return <section className="space-y-5" aria-label="Private university ASSIST agreement">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-red-700">ASSIST · {agreement.academicYearLabel} · {PRIVATE_CATEGORY_LABELS[guide.category]}</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">{agreement.majorName}</h2>
            <p className="mt-2 text-slate-600">Santa Barbara City College → {agreement.schoolName}</p>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-700">{['dept', 'prefix'].includes(guide.category)
                ? `This report is organized by ${guide.organizedBy === 'SBCC' ? 'SBCC' : 'university'} ${guide.category === 'dept' ? 'department' : 'course prefix'}. It shows course equivalencies; it is not a major requirement checklist.`
                : guide.category === 'breadth' ? 'This agreement covers general education. Check your intended major separately for additional preparation.'
                    : 'Follow the requirements and notes for this specific program and academic year. Some reports describe degree requirements beyond admission preparation.'} An articulation agreement does not guarantee admission.</p>
            <a href={agreement.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">Open this agreement on ASSIST ↗</a>
            {guide.warnings.map(warning => <p key={warning} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{warning}</p>)}
            {guide.notes.length > 0 && <details className="mt-5 rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-bold text-slate-800">Read the university’s agreement notes</summary>
                <div className="mt-4 space-y-4"><SourceNotes notes={guide.notes} /></div>
            </details>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <label htmlFor="private-course-search" className="block text-sm font-semibold text-slate-700">Find a course or requirement</label>
            <input id="private-course-search" value={search} onChange={event => { setSearch(event.target.value); setExpandAll(Boolean(event.target.value.trim())); }} placeholder="For example, MATH 150 or writing" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">{matchingCount} course matches or requirements</p>
                <button type="button" onClick={() => setExpandAll(!expandAll)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{expandAll ? 'Collapse all' : 'Expand all'}</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">AND joins courses taken together; OR separates alternatives. Read the university’s notes above for grades, units, exceptions, and credit conditions.</p>
        </div>
        {guide.groups.map((group, groupIndex) => {
            const sections = group.sections.map(section => ({ ...section, rows: section.rows.filter(matches) })).filter((section, index, all) => {
                if (section.rows.length || !query) return true;
                if (!section.isHeading) return false;
                const nextHeading = all.findIndex((next, nextIndex) => nextIndex > index && next.isHeading);
                return all.slice(index + 1, nextHeading < 0 ? undefined : nextHeading).some(next => next.rows.length);
            });
            if (!sections.length) return null;
            return <section key={groupIndex} className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">{group.title}</h3>
                {group.notes.length > 0 && <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><SourceNotes notes={group.notes} /></div>}
                {sections.map((section, sectionIndex) => <div key={sectionIndex} className="space-y-3">
                    {section.title && <h4 className="text-sm font-bold uppercase tracking-wide text-slate-600">{section.title}</h4>}
                    <SourceNotes notes={section.notes} />
                    {section.rows.map(row => <CourseRow key={`${row.id}-${expandAll}`} row={row} school={agreement.schoolName} expand={expandAll} />)}
                </div>)}
            </section>;
        })}
        {matchingCount === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">{query ? 'No course matches or requirements match that search.' : 'This report lists no course matches or requirement rows. Read the agreement notes and open the official source for details.'}</p>}
    </section>;
}
