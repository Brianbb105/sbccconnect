"use client";

import { useMemo, useState } from "react";
import type {
    PlannerAgreement,
    PlannerCourse,
    PlannerData,
    PlannerMajor,
    PlannerOption,
    PlannerRequirement,
    PlannerSchool,
} from "@/lib/assistPlanner";

type RequirementView = "all" | "admission" | "missing";

export default function AssistPlannerClient({ data }: { data: PlannerData }) {
    const { agreements, majors, schools, summary } = data;
    const defaultSchoolId = useMemo(() => defaultSchool(schools)?.id ?? "", [schools]);
    const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId);
    const majorOptions = useMemo(
        () => majors.filter((major) => major.schoolId === selectedSchoolId),
        [majors, selectedSchoolId],
    );
    const defaultMajorId = useMemo(() => defaultMajor(majorOptions)?.id ?? "", [majorOptions]);
    const [selectedMajorId, setSelectedMajorId] = useState(defaultMajorId);
    const [requirementView, setRequirementView] = useState<RequirementView>("all");

    const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? null;
    const selectedMajor =
        majorOptions.find((major) => major.id === selectedMajorId) ?? defaultMajor(majorOptions) ?? null;
    const selectedAgreement =
        agreements.find((agreement) => agreement.id === selectedMajor?.agreementId) ??
        agreements.find((agreement) => agreement.schoolId === selectedSchoolId && agreement.key === selectedMajor?.key) ??
        null;

    const handleSchoolChange = (schoolId: string) => {
        const nextMajors = majors.filter((major) => major.schoolId === schoolId);
        setSelectedSchoolId(schoolId);
        setSelectedMajorId(defaultMajor(nextMajors)?.id ?? "");
        setRequirementView("all");
    };

    const handleMajorChange = (majorId: string) => {
        setSelectedMajorId(majorId);
        setRequirementView("all");
    };

    if (schools.length === 0) {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-[#0f172a]">Transfer Planner</h1>
                    <span className="term-new-pill rounded-full border px-3 py-1 text-xs font-bold uppercase">
                        Beta
                    </span>
                </div>
                <p className="mt-3 max-w-3xl text-slate-600">
                    No ASSIST transfer partner data is available yet. Run the ASSIST importer, then refresh this page.
                </p>
            </section>
        );
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="p-6 md:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-700">ASSIST transfer map</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-bold leading-tight text-[#0f172a] md:text-4xl">
                            Transfer Planner
                        </h1>
                        <span className="term-new-pill rounded-full border px-3 py-1 text-xs font-bold uppercase">
                            Beta
                        </span>
                    </div>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                        Choose a transfer school, choose a major, then review the SBCC courses that satisfy the ASSIST
                        agreement.
                    </p>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 md:px-8">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricTile label="Schools" value={summary.schoolCount.toString()} />
                        <MetricTile label="Cached majors" value={summary.cachedMajorCount.toString()} />
                        <MetricTile label="Detailed agreements" value={summary.detailedAgreementCount.toString()} />
                        <MetricTile label="Requirements ready" value={summary.requirementCount.toString()} />
                    </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 p-6 md:grid-cols-2 md:p-8">
                    <SelectField
                        label="1. Transfer school"
                        value={selectedSchoolId}
                        onChange={handleSchoolChange}
                        helpText={schoolHelpText(selectedSchool)}
                    >
                        {schools.map((school) => (
                            <option key={school.id} value={school.id}>
                                {school.name}
                                {school.code ? ` (${school.code})` : ""}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="2. Major"
                        value={selectedMajor?.id ?? ""}
                        onChange={handleMajorChange}
                        helpText={majorHelpText(selectedSchool, majorOptions, selectedMajor)}
                        disabled={majorOptions.length === 0}
                    >
                        {majorOptions.length > 0 ? (
                            majorOptions.map((major) => (
                                <option key={major.id} value={major.id}>
                                    {major.label}
                                    {major.hasDetails ? "" : " (requirements not imported)"}
                                </option>
                            ))
                        ) : (
                            <option value="">No cached majors for this school</option>
                        )}
                    </SelectField>
                </div>
            </section>

            {selectedAgreement ? (
                <AgreementCard
                    agreement={selectedAgreement}
                    requirementView={requirementView}
                    onRequirementViewChange={setRequirementView}
                />
            ) : (
                <MissingAgreementPanel school={selectedSchool} major={selectedMajor} />
            )}
        </div>
    );
}

function defaultSchool(schools: PlannerSchool[]): PlannerSchool | null {
    return (
        schools.find((school) => school.detailedMajorCount > 0) ??
        schools.find((school) => school.hasMajorList) ??
        schools[0] ??
        null
    );
}

function defaultMajor(majors: PlannerMajor[]): PlannerMajor | null {
    return majors.find((major) => major.hasDetails) ?? majors[0] ?? null;
}

function schoolHelpText(school: PlannerSchool | null): string {
    if (!school) return "Select a school to continue.";
    if (school.hasMajorList) {
        return `${school.majorCount ?? 0} cached majors. ${school.detailedMajorCount} have full requirements ready.`;
    }
    return "This school is in the ASSIST partner cache, but its major list has not been downloaded yet.";
}

function majorHelpText(
    school: PlannerSchool | null,
    majors: PlannerMajor[],
    selectedMajor: PlannerMajor | null,
): string {
    if (!school) return "Select a school first.";
    if (majors.length === 0) return "No local major list for this school yet.";
    if (!selectedMajor) return "Select a major to see requirements.";
    if (selectedMajor.hasDetails) return "Full ASSIST requirements are ready below.";
    return "This major label is cached, but its full requirement agreement has not been imported yet.";
}

function SelectField({
    children,
    disabled = false,
    helpText,
    label,
    onChange,
    value,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    helpText: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label className="min-w-0">
            <span className="block text-sm font-bold text-[#0f172a]">{label}</span>
            <select
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#0f172a] focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
                {children}
            </select>
            <span className="mt-2 block text-sm leading-6 text-slate-500">{helpText}</span>
        </label>
    );
}

function MetricTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-[#0f172a]">{value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
        </div>
    );
}

function MissingAgreementPanel({
    major,
    school,
}: {
    major: PlannerMajor | null;
    school: PlannerSchool | null;
}) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-8">
            <h2 className="text-2xl font-bold text-[#0f172a]">Requirements Not Ready Yet</h2>
            <p className="mt-3 max-w-3xl text-slate-600 leading-7">
                {major
                    ? `${major.label} is listed for ${school?.name ?? "this school"}, but the local ASSIST cache does not include the full agreement details yet.`
                    : `${school?.name ?? "This school"} does not have a cached major list in the local ASSIST data yet.`}
            </p>
        </section>
    );
}

function AgreementCard({
    agreement,
    onRequirementViewChange,
    requirementView,
}: {
    agreement: PlannerAgreement;
    onRequirementViewChange: (view: RequirementView) => void;
    requirementView: RequirementView;
}) {
    const visibleGroups = agreement.groups
        .map((group) => ({
            ...group,
            requirements: group.requirements.filter((requirement) => requirementMatchesView(requirement, requirementView)),
        }))
        .filter((group) => group.requirements.length > 0);

    return (
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 md:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            <span>{agreement.sendingSchoolCode || "SBCC"}</span>
                            <span>to</span>
                            <span>{agreement.schoolCode || agreement.schoolName}</span>
                            <span>{agreement.academicYearLabel}</span>
                        </div>
                        <h2 className="mt-2 text-2xl font-bold leading-tight text-[#0f172a]">{agreement.majorName}</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {agreement.schoolName}
                            {agreement.publishDate ? ` / Published ${formatDate(agreement.publishDate)}` : ""}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
                        <CompactStat label="Rows" value={agreement.stats.requirementCount} />
                        <CompactStat label="Matched" value={agreement.stats.articulatedCount} />
                        <CompactStat label="No match" value={agreement.stats.noArticulationCount} />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ViewButton active={requirementView === "all"} onClick={() => onRequirementViewChange("all")}>
                        All rows
                    </ViewButton>
                    <ViewButton active={requirementView === "admission"} onClick={() => onRequirementViewChange("admission")}>
                        Admission
                    </ViewButton>
                    <ViewButton active={requirementView === "missing"} onClick={() => onRequirementViewChange("missing")}>
                        No articulation
                    </ViewButton>
                    {agreement.sourceUrl ? (
                        <a
                            href={agreement.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-[#0f172a] hover:text-[#0f172a]"
                        >
                            Open ASSIST agreement
                        </a>
                    ) : null}
                </div>
            </div>

            {visibleGroups.length > 0 ? (
                <div>
                    {visibleGroups.map((group) => (
                        <div key={group.id} className="border-b border-slate-200 last:border-b-0">
                            <div className="flex flex-col gap-2 px-5 py-4 md:px-8">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-[#0f172a]">{group.title}</h3>
                                    <CategoryBadge category={group.category} />
                                </div>
                                {group.notes.length > 0 ? (
                                    <p className="text-sm leading-6 text-slate-500">{group.notes.join(" / ")}</p>
                                ) : null}
                            </div>

                            <div className="divide-y divide-slate-200">
                                {group.requirements.map((requirement) => (
                                    <RequirementRow key={requirement.id} requirement={requirement} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-6 py-8 text-sm text-slate-500">No rows in this agreement match the active view.</div>
            )}
        </article>
    );
}

function requirementMatchesView(requirement: PlannerRequirement, requirementView: RequirementView): boolean {
    if (requirementView === "admission") return requirement.category === "Required for admission";
    if (requirementView === "missing") return !requirement.isArticulated;
    return true;
}

function ViewButton({
    active,
    children,
    onClick,
}: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-10 rounded-full border px-4 text-sm font-bold transition ${
                active
                    ? "border-[#0f172a] bg-[#0f172a] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
        >
            {children}
        </button>
    );
}

function CompactStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-lg font-bold text-[#0f172a]">{value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        </div>
    );
}

function RequirementRow({ requirement }: { requirement: PlannerRequirement }) {
    return (
        <div className="grid gap-4 px-5 py-5 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Receiving course</span>
                    <CategoryBadge category={requirement.category} compact />
                </div>
                <div className="mt-3 space-y-2">
                    {requirement.ucCourses.length > 0 ? (
                        requirement.ucCourses.map((course) => <CoursePill key={course.id} course={course} tone="uc" />)
                    ) : (
                        <p className="text-sm text-slate-500">{requirement.label}</p>
                    )}
                </div>
                {requirement.notes.length > 0 ? (
                    <p className="mt-3 text-sm leading-6 text-slate-500">{requirement.notes.join(" / ")}</p>
                ) : null}
            </div>

            <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">SBCC path</span>
                    <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${
                            requirement.isArticulated
                                ? "border-green-200 bg-green-100 text-green-700"
                                : "border-red-200 bg-red-50 text-red-700"
                        }`}
                    >
                        {requirement.isArticulated ? "Articulated" : "No articulation"}
                    </span>
                </div>
                <div className="space-y-3">
                    {requirement.options.length > 0 ? (
                        requirement.options.map((option, index) => (
                            <ArticulationOption
                                key={option.id}
                                option={option}
                                optionNumber={requirement.options.length > 1 ? index + 1 : null}
                            />
                        ))
                    ) : (
                        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                            No SBCC path listed.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ArticulationOption({
    option,
    optionNumber,
}: {
    option: PlannerOption;
    optionNumber: number | null;
}) {
    if (option.courses.length === 0) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {option.noArticulationReason || "No SBCC articulation listed"}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                {optionNumber ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Option {optionNumber}
                    </span>
                ) : null}
                {option.logic ? (
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                        {option.logic === "AND" ? "Complete all" : "Choose one"}
                    </span>
                ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
                {option.courses.map((course) => (
                    <CoursePill key={course.id} course={course} tone="sbcc" />
                ))}
            </div>
        </div>
    );
}

function CoursePill({ course, tone }: { course: PlannerCourse; tone: "uc" | "sbcc" }) {
    const toneClass =
        tone === "uc"
            ? "border-orange-200 bg-orange-100 text-orange-700"
            : "border-slate-200 bg-white text-slate-800";

    return (
        <div className={`min-w-0 max-w-full rounded-2xl border px-3 py-2 ${toneClass}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-bold">{course.code}</span>
                {course.units ? <span className="text-xs font-semibold opacity-80">{course.units}</span> : null}
            </div>
            {course.title ? <div className="mt-1 break-words text-sm leading-5 opacity-90">{course.title}</div> : null}
            {course.crossListedCodes.length > 0 ? (
                <div className="mt-1 text-xs font-semibold opacity-75">
                    Cross-listed: {course.crossListedCodes.join(", ")}
                </div>
            ) : null}
        </div>
    );
}

function CategoryBadge({ category, compact = false }: { category: string; compact?: boolean }) {
    const className = categoryClass(category);

    return (
        <span
            className={`rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] ${className} ${
                compact ? "tracking-[0.1em]" : ""
            }`}
        >
            {category}
        </span>
    );
}

function categoryClass(category: string): string {
    if (category === "Required for admission") return "border-red-200 bg-red-50 text-red-700";
    if (category === "Strongly recommended") return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if (category === "Upper division") return "border-purple-200 bg-purple-100 text-purple-700";
    if (category === "Recommended") return "border-green-200 bg-green-100 text-green-700";
    if (category === "Additional preparation") return "border-blue-200 bg-blue-100 text-blue-700";
    return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}
