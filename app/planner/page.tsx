import Header from "@/components/Header";
import { getAssistPlannerData } from "@/lib/assistPlanner";
import AssistPlannerClient from "./AssistPlannerClient";

const registrationSchedule = [
    {
        id: "priority-support-programs",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Foster youth</strong>,{" "}
                <strong className="font-semibold text-slate-900">homeless youth</strong>,{" "}
                <strong className="font-semibold text-slate-900">veterans</strong>,{" "}
                <strong className="font-semibold text-slate-900">student parents</strong>, Rising Scholars, DSPS,
                EOPS, CalWORKs
            </>
        ),
        summer: "Apr 7, 2026, 8:30 AM",
        fall: "Apr 23, 2026, 8:30 AM",
    },
    {
        id: "athletes-promise-umoja",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Student athletes</strong>, eligible Promise
                students, eligible Umoja students
            </>
        ),
        summer: "Apr 8, 2026, 8:30 AM",
        fall: "Apr 27, 2026, 8:30 AM",
    },
    {
        id: "asg-officers",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Associated Student Government officers</strong>
            </>
        ),
        summer: "Apr 8, 2026, 1:00 PM",
        fall: "Apr 28, 2026, 8:30 AM",
    },
    {
        id: "continuing-students",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Continuing students</strong>
            </>
        ),
        summer: "Apr 9, 2026, 8:30 AM",
        fall: "Apr 29, 2026, 8:30 AM",
    },
    {
        id: "first-semester-students",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Currently enrolled first-semester students</strong>
            </>
        ),
        summer: "Apr 13, 2026, 8:30 AM",
        fall: "May 4, 2026, 8:30 AM",
    },
    {
        id: "local-high-school-graduates",
        group: (
            <>
                <strong className="font-semibold text-slate-900">New-to-college</strong> local high school graduates
            </>
        ),
        summer: "Apr 14, 2026, 8:30 AM",
        fall: "May 26, 2026, 8:30 AM",
    },
    {
        id: "new-to-college-complete-steps",
        group: (
            <>
                <strong className="font-semibold text-slate-900">New-to-college students</strong> with orientation,
                placement, and class planning completed
            </>
        ),
        summer: "Apr 15, 2026, 8:30 AM",
        fall: "Jun 15, 2026, 8:30 AM",
    },
    {
        id: "transfer-returning-students",
        group: (
            <>
                <strong className="font-semibold text-slate-900">New transfer</strong> and{" "}
                <strong className="font-semibold text-slate-900">returning students</strong>
            </>
        ),
        summer: "Apr 16, 2026, 8:30 AM",
        fall: "Jun 22, 2026, 8:30 AM",
    },
    {
        id: "middle-college-ccap",
        group: (
            <>
                <strong className="font-semibold text-slate-900">SBCC Middle College</strong> and local{" "}
                <strong className="font-semibold text-slate-900">CCAP dual enrollment</strong>
            </>
        ),
        summer: "Apr 17, 2026, 8:30 AM",
        fall: "Jun 24, 2026, 8:30 AM",
    },
    {
        id: "personal-enrichment-lost-priority",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Personal enrichment students</strong> / students who
                lost priority enrollment
            </>
        ),
        summer: "Apr 20, 2026, 8:30 AM",
        fall: "Jun 29, 2026, 8:30 AM",
    },
    {
        id: "other-dual-enrollment",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Other dual enrollment students</strong>
            </>
        ),
        summer: "Apr 21, 2026, 8:30 AM",
        fall: "Jul 1, 2026, 8:30 AM",
    },
    {
        id: "noncredit-education",
        group: (
            <>
                <strong className="font-semibold text-slate-900">Tuition-free noncredit education</strong>
            </>
        ),
        summer: "Apr 22, 2026, 8:00 AM",
        fall: "Jul 7, 2026, 8:00 AM",
    },
] as const;

export default function PlannerPage() {
    const assistPlannerData = getAssistPlannerData();

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />
            <main className="max-w-6xl mx-auto px-6 py-12">
                <AssistPlannerClient data={assistPlannerData} />

                <section className="mt-10 rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm md:px-8">
                    <h2 className="text-2xl font-bold text-[#0f172a]">Registration Dates</h2>
                    <p className="mt-3 max-w-3xl text-slate-600 leading-relaxed">
                        Summer 2026 and Fall 2026 registration windows by student group. All times shown in Pacific Time.
                    </p>
                </section>

                <div className="mt-6 space-y-6">
                    <TermTable
                        title="Summer 2026 Registration Dates"
                        entries={registrationSchedule.map((entry) => ({
                            id: `${entry.id}-summer`,
                            group: entry.group,
                            date: entry.summer,
                        }))}
                    />
                    <TermTable
                        title="Fall 2026 Registration Dates"
                        entries={registrationSchedule.map((entry) => ({
                            id: `${entry.id}-fall`,
                            group: entry.group,
                            date: entry.fall,
                        }))}
                    />
                </div>
            </main>
        </div>
    );
}

function TermTable({
    title,
    entries,
}: {
    title: string;
    entries: ReadonlyArray<{
        id: string;
        group: (typeof registrationSchedule)[number]["group"];
        date: string;
    }>;
}) {
    return (
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-5 md:px-8">
                <h2 className="text-2xl font-bold text-[#0f172a]">{title}</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                    <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                            <th className="px-6 py-4 text-sm font-semibold text-slate-700 md:px-8">Group</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-700">Registration Opens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-slate-200 last:border-b-0 align-top">
                                <td className="px-6 py-4 text-sm leading-6 text-slate-700 md:px-8">
                                    {entry.group}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-800 whitespace-nowrap">
                                    {entry.date}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
