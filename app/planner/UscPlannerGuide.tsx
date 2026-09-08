"use client";

import { useState } from "react";
import type { PlannerAgreement } from "@/lib/assistPlanner";

function isGeneralEducation(text: string) {
    return /COMPOSITION\/WRITING|GENERAL EDUCATION|FOREIGN LANGUAGE|LANGUAGE REQUIREMENT/.test(text.split(/\d\)/)[0]);
}

export default function UscPlannerGuide({ agreement }: { agreement: PlannerAgreement }) {
    const [view, setView] = useState<"major" | "general">("major");
    const [search, setSearch] = useState("");
    const guide = agreement.uscGuide!;
    const query = search.replace(/\s/g, "").toLowerCase();
    const sections = guide.sections.filter(section => isGeneralEducation(section.text) === (view === "general"))
        .filter(section => section.text.replace(/\s/g, "").toLowerCase().includes(query));
    return (
        <section className="space-y-5" aria-label="USC transfer planning guide">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-red-700">USC Transfer Planning Guide · {agreement.academicYearLabel}</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{agreement.majorName}</h2>
                <p className="mt-2 text-slate-600">Santa Barbara City College → University of Southern California</p>
                <p className="mt-5 max-w-3xl leading-7 text-slate-700">
                    This guide shows courses that can apply toward a USC degree. It includes requirements completed after transfer,
                    so you do not need to finish every section before applying. It does not guarantee admission.
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
                    <a href={agreement.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-slate-900 px-4 py-3 text-white">Open USC planning guide ↗</a>
                    <a href="https://darsweb.usc.edu/articagrmt/artic.aspx" target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-300 px-4 py-3 text-slate-800">SBCC–USC articulation agreement ↗</a>
                    <a href="https://admission.usc.edu/prospective-students/how-to-apply/transfer-students/" target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-300 px-4 py-3 text-slate-800">USC admission requirements ↗</a>
                </div>
                <p className="mt-3 text-sm text-slate-500">On USC’s site, select Santa Barbara City College and program {guide.programCode}.</p>
                {guide.warnings.map(warning => <p key={warning} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{warning}</p>)}
                {guide.advisoryText && <details className="mt-4 rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer font-semibold text-slate-800">USC’s advising notes</summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{guide.advisoryText}</p>
                    <div className="mt-3 flex flex-wrap gap-4">{guide.advisoryLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-900 underline">{link.label} ↗</a>)}</div>
                </details>}
                <details className="mt-3 rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer font-semibold text-slate-800">Credit restrictions from USC</summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{guide.restrictionsText}</p>
                </details>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap gap-2" aria-label="Guide section">
                    {([['major', 'Major and degree requirements'], ['general', 'General education and writing']] as const).map(([id, label]) => (
                        <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); setSearch(""); }}
                            className={`rounded-full border px-4 py-2 text-sm font-bold ${view === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{label}</button>
                    ))}
                </div>
                <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="usc-course-search">Find a course or requirement</label>
                <input id="usc-course-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="For example, MATH150 or calculus"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900" />
                <p className="mt-4 text-sm leading-6 text-slate-600">An asterisk (*) marks an SBCC course. “OR” separates alternatives; “&amp;” joins courses that must be taken together. “No course equivalents available” means this guide lists no match for that requirement. Check the full articulation agreement for combinations that grant additional USC equivalencies. <a href="https://darsweb.usc.edu/TPG/notes/legend.html" target="_blank" rel="noopener noreferrer" className="font-semibold underline">USC’s notation guide ↗</a></p>
            </div>
            {sections.map(section => {
                const heading = section.text.trim().split('\n')[0].trim().replace(/:$/, "");
                return <details key={section.position} open={Boolean(search.trim()) || undefined} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <summary className="cursor-pointer text-base font-bold leading-6 text-slate-900">{heading}</summary>
                    <pre className="mt-4 whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-700">{section.text.split('\n').map(line => line.trim()).join('\n')}</pre>
                </details>;
            })}
            {sections.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">{search ? "No sections match that search." : "USC lists no sections in this category for this program. Check the source guide for details."}</p>}
        </section>
    );
}
