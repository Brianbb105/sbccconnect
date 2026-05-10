"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
    PlannerAgreement,
    PlannerCourse,
    PlannerData,
    PlannerMajor,
    PlannerOption,
    PlannerRequirement,
    PlannerSchool,
} from "@/lib/assistPlanner";
import { appendTermToHref, DEFAULT_TERM_SLUG } from "@/lib/terms";

type RequirementView = "all" | "required" | "recommended" | "missing";
type PlannerStep = "school" | "major" | "agreement";

export default function AssistPlannerClient({ data }: { data: PlannerData }) {
    const { agreements, majors, schools, summary } = data;
    const [selectedSchoolId, setSelectedSchoolId] = useState("");
    const [selectedMajorId, setSelectedMajorId] = useState("");
    const [schoolSearch, setSchoolSearch] = useState("");
    const [majorSearch, setMajorSearch] = useState("");
    const [step, setStep] = useState<PlannerStep>("school");
    const [requirementView, setRequirementView] = useState<RequirementView>("all");

    const visibleSchools = useMemo(() => {
        const query = schoolSearch.trim().toLowerCase();
        if (!query) return schools;
        return schools.filter((school) => `${school.name} ${school.code} ${school.segment}`.toLowerCase().includes(query));
    }, [schoolSearch, schools]);

    const majorOptions = useMemo(
        () => majors.filter((major) => major.schoolId === selectedSchoolId),
        [majors, selectedSchoolId],
    );
    const visibleMajors = useMemo(() => {
        const query = majorSearch.trim().toLowerCase();
        if (!query) return majorOptions;
        return majorOptions.filter((major) => `${major.label} ${major.schoolCode}`.toLowerCase().includes(query));
    }, [majorOptions, majorSearch]);

    const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? null;
    const selectedMajor = majorOptions.find((major) => major.id === selectedMajorId) ?? null;
    const selectedAgreement =
        agreements.find((agreement) => agreement.id === selectedMajor?.agreementId) ??
        agreements.find((agreement) => agreement.schoolId === selectedSchoolId && agreement.key === selectedMajor?.key) ??
        null;

    const handleSchoolClick = (schoolId: string) => {
        setSelectedSchoolId(schoolId);
        setSelectedMajorId("");
        setMajorSearch("");
        setRequirementView("all");
        setStep("major");
    };

    const handleMajorClick = (majorId: string) => {
        setSelectedMajorId(majorId);
        setRequirementView("all");
        setStep("agreement");
    };

    const goToSchools = () => {
        setStep("school");
        setSelectedSchoolId("");
        setSelectedMajorId("");
        setMajorSearch("");
    };

    const goToMajors = () => {
        setStep("major");
        setSelectedMajorId("");
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
                        Choose a school, choose a major, then open the agreement map for that path. All transfer
                        agreement data shown here is from{" "}
                        <a
                            href="https://www.assist.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[#0f172a] underline decoration-slate-300 underline-offset-4 hover:decoration-[#0f172a]"
                        >
                            ASSIST.org
                        </a>
                        . For accuracy and safety, please verify final requirements on ASSIST.org before planning or
                        submitting transfer coursework.
                    </p>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 md:px-8">
                    <div className="flex flex-wrap gap-2">
                        <SummaryPill value={summary.schoolCount} label="schools" />
                        <SummaryPill value={summary.cachedMajorCount} label="cached majors" />
                        <SummaryPill value={summary.detailedAgreementCount} label="agreements ready" />
                    </div>
                </div>

            </section>

            {step === "school" ? (
                <ChoicePanel
                    title="Choose A Transfer School"
                    description="Start with one school. The major list opens after you pick a destination."
                    searchValue={schoolSearch}
                    searchPlaceholder="Search schools"
                    onSearchChange={setSchoolSearch}
                >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {visibleSchools.map((school) => (
                            <SchoolCard key={school.id} school={school} onClick={() => handleSchoolClick(school.id)} />
                        ))}
                    </div>
                    {visibleSchools.length === 0 ? <EmptyState text="No schools match that search." /> : null}
                </ChoicePanel>
            ) : null}

            {step === "major" && selectedSchool ? (
                <ChoicePanel
                    title={selectedSchool.name}
                    description={
                        selectedSchool.hasMajorList
                            ? "Choose a major to open its agreement."
                            : "This school is available in the partner cache, but its major list is not downloaded yet."
                    }
                    searchValue={majorSearch}
                    searchPlaceholder="Search majors"
                    onSearchChange={setMajorSearch}
                    backLabel="Back To Schools"
                    onBack={goToSchools}
                >
                    {selectedSchool.hasMajorList ? (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                {visibleMajors.map((major) => (
                                    <MajorCard key={major.id} major={major} onClick={() => handleMajorClick(major.id)} />
                                ))}
                            </div>
                            {visibleMajors.length === 0 ? <EmptyState text="No majors match that search." /> : null}
                        </>
                    ) : (
                        <MissingAgreementPanel school={selectedSchool} major={null} />
                    )}
                </ChoicePanel>
            ) : null}

            {step === "agreement" && selectedSchool ? (
                <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:px-6">
                        <button
                            type="button"
                            onClick={goToMajors}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            Back To Majors
                        </button>
                    </div>
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
            ) : null}
        </div>
    );
}

function ChoicePanel({
    children,
    backLabel,
    description,
    onBack,
    onSearchChange,
    searchPlaceholder,
    searchValue,
    title,
}: {
    children: React.ReactNode;
    backLabel?: string;
    description: string;
    onBack?: () => void;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    searchValue: string;
    title: string;
}) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    {onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="mb-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            {backLabel ?? "Back"}
                        </button>
                    ) : null}
                    <h2 className="text-2xl font-bold text-[#0f172a]">{title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
                </div>
                <label className="min-w-0 lg:w-80">
                    <span className="sr-only">{searchPlaceholder}</span>
                    <input
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#0f172a] focus:ring-2 focus:ring-slate-200"
                    />
                </label>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
    return (
        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
            {value} {label}
        </span>
    );
}

function SchoolCard({ onClick, school }: { onClick: () => void; school: PlannerSchool }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0f172a] hover:bg-white hover:shadow-sm"
        >
            <span className="block text-lg font-bold leading-snug text-[#0f172a]">{school.name}</span>
            <span className="mt-2 block text-sm font-semibold text-slate-500">
                {[school.code, school.segment].filter(Boolean).join(" / ") || "Transfer school"}
            </span>
            <span className="mt-4 flex flex-wrap gap-2">
                {school.hasMajorList ? (
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                        {school.majorCount ?? 0} majors
                    </span>
                ) : (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                        Major list pending
                    </span>
                )}
                {school.detailedMajorCount > 0 ? (
                    <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                        {school.detailedMajorCount} ready
                    </span>
                ) : null}
            </span>
        </button>
    );
}

function MajorCard({ major, onClick }: { major: PlannerMajor; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0f172a] hover:bg-white hover:shadow-sm"
        >
            <span className="block text-base font-bold leading-snug text-[#0f172a]">{major.label}</span>
            <span
                className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                    major.hasDetails
                        ? "border-green-200 bg-green-100 text-green-700"
                        : "border-slate-200 bg-white text-slate-500"
                }`}
            >
                {major.hasDetails ? "Requirements ready" : "Agreement not imported"}
            </span>
        </button>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm font-semibold text-slate-500">
            {text}
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
                    <ViewButton active={requirementView === "required"} onClick={() => onRequirementViewChange("required")}>
                        Required
                    </ViewButton>
                    <ViewButton
                        active={requirementView === "recommended"}
                        onClick={() => onRequirementViewChange("recommended")}
                    >
                        Recommended
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
    if (requirementView === "required") return requirement.category === "Required";
    if (requirementView === "recommended") return requirement.category.toLowerCase().includes("recommended");
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
    const hasAlternativeOptions = requirement.options.some((option) => option.optionSetLogic === "OR");

    return (
        <div
            data-requirement-row
            className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,0.95fr)_3rem_minmax(0,1.15fr)] md:items-start md:px-8"
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Receiving course</span>
                    <CategoryBadge category={requirement.category} compact />
                </div>
                <div className="mt-3 space-y-2">
                    {requirement.ucCourses.length > 0 ? (
                        requirement.ucCourses.map((course) => <CoursePill key={course.id} course={course} tone="uc" />)
                    ) : (
                        <AreaRequirementCard label={requirement.label} />
                    )}
                </div>
                {requirement.notes.length > 0 ? (
                    <p className="mt-3 text-sm leading-6 text-slate-500">{requirement.notes.join(" / ")}</p>
                ) : null}
            </div>

            <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center justify-self-start rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-500 md:mt-10 md:justify-self-center"
            >
                <span className="hidden md:inline">→</span>
                <span className="md:hidden">↓</span>
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
                    {hasAlternativeOptions ? (
                        <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                            Choose one option below
                        </span>
                    ) : null}
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
                        {option.logic === "AND" ? "Complete all courses" : "Choose one course"}
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

function AreaRequirementCard({ label }: { label: string }) {
    const displayLabel = label === "Requirement" ? "Area requirement" : label;

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
            <div className="font-bold text-slate-800">{displayLabel}</div>
            <div className="mt-1 text-sm leading-5 text-slate-500">
                ASSIST does not list a specific receiving-school course for this row.
            </div>
        </div>
    );
}

function CoursePill({ course, tone }: { course: PlannerCourse; tone: "uc" | "sbcc" }) {
    const toneClass =
        tone === "uc"
            ? "border-orange-200 bg-orange-100 text-orange-700"
            : "border-slate-200 bg-white text-slate-800";
    const href = tone === "sbcc" ? getSbccCourseHref(course) : null;
    const className = `min-w-0 max-w-full rounded-2xl border px-3 py-2 ${toneClass} ${
        href
            ? "block transition hover:-translate-y-0.5 hover:border-[#0f172a] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            : ""
    }`;
    const content = (
        <>
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
        </>
    );

    if (href) {
        return (
            <Link href={href} className={className} aria-label={`Open ${course.code} sections and CRNs`}>
                {content}
            </Link>
        );
    }

    return (
        <div className={className}>
            {content}
        </div>
    );
}

function getSbccCourseHref(course: PlannerCourse): string | null {
    const code = course.code.trim();
    const subject = code.split(/\s+/)[0];
    if (!subject || !code.includes(" ")) return null;

    return appendTermToHref(`/classes/${encodeURIComponent(subject)}/${encodeURIComponent(code)}`, DEFAULT_TERM_SLUG);
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
    if (category === "Required") return "border-red-200 bg-red-50 text-red-700";
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
