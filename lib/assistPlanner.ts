import fs from "node:fs";
import path from "node:path";

type AssistInstitution = {
    id?: number | null;
    name?: string | null;
    code?: string | null;
    segment?: string | null;
};

type AssistAcademicYear = {
    id?: number | null;
    label?: string | null;
    fallYear?: number | null;
};

type AssistCourse = {
    id?: string | null;
    courseIdentifierParentId?: number | null;
    prefix?: string | null;
    courseNumber?: string | null;
    title?: string | null;
    minUnits?: number | null;
    maxUnits?: number | null;
    department?: string | null;
    visibleCrossListedCourses?: AssistCourse[] | null;
};

type AssistCourseGroup = {
    position?: number | null;
    logic?: string | null;
    courses?: AssistCourse[] | null;
};

type AssistAttribute = {
    content?: string | null;
};

type AssistReceivingItem = {
    id?: string | null;
    position?: number | null;
    type?: string | null;
    name?: string | null;
    courses?: AssistCourse[] | null;
    attributes?: AssistAttribute[] | null;
    courseAttributes?: AssistAttribute[] | null;
    advisements?: AssistAttribute[] | null;
    rowAttributes?: AssistAttribute[] | null;
};

type AssistArticulation = {
    receivingCellId?: string | null;
    logic?: string | null;
    courses?: AssistCourse[] | null;
    courseGroups?: AssistCourseGroup[] | null;
    noArticulationReason?: string | null;
    attributes?: AssistAttribute[] | null;
    deniedCourses?: AssistCourse[] | null;
};

type AssistSection = {
    id?: string | null;
    position?: number | null;
    logic?: string | null;
    receivingCourses?: AssistCourse[] | null;
    receivingItems?: AssistReceivingItem[] | null;
    sbccArticulations?: AssistArticulation[] | null;
    attributes?: AssistAttribute[] | null;
    advisements?: AssistAttribute[] | null;
};

type AssistRequirementGroup = {
    id?: string | null;
    title?: string | null;
    position?: number | null;
    logic?: string | null;
    sections?: AssistSection[] | null;
    attributes?: AssistAttribute[] | null;
    advisements?: AssistAttribute[] | null;
};

type AssistAgreementFile = {
    sendingInstitution?: AssistInstitution | null;
    receivingInstitution?: AssistInstitution | null;
    academicYear?: AssistAcademicYear | null;
    agreement?: {
        key?: string | null;
        type?: string | null;
        name?: string | null;
        publishDate?: string | null;
    } | null;
    requirementGroups?: AssistRequirementGroup[] | null;
    sourceUrl?: string | null;
};

type AssistPartner = {
    institutionParentId?: number | null;
    institutionName?: string | null;
    code?: string | null;
    isCommunityCollege?: boolean | null;
    receivingYearIds?: number[] | null;
};

type AssistInstitutionMetadata = {
    id?: number | null;
    names?: Array<{
        name?: string | null;
        hideInList?: boolean | null;
    }> | null;
    code?: string | null;
    category?: number | string | null;
};

type AssistMajorReport = {
    label?: string | null;
    key?: string | null;
    ownerInstitutionId?: number | null;
};

export type PlannerCourse = {
    id: string;
    code: string;
    title: string;
    units: string;
    department: string;
    crossListedCodes: string[];
};

export type PlannerOption = {
    id: string;
    logic: string;
    courses: PlannerCourse[];
    noArticulationReason?: string;
};

export type PlannerRequirement = {
    id: string;
    groupTitle: string;
    label: string;
    logic: string;
    category: string;
    ucCourses: PlannerCourse[];
    options: PlannerOption[];
    notes: string[];
    isArticulated: boolean;
};

export type PlannerRequirementGroup = {
    id: string;
    title: string;
    category: string;
    notes: string[];
    requirements: PlannerRequirement[];
};

export type PlannerAgreement = {
    id: string;
    key: string;
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    schoolSegment: string;
    sendingSchoolName: string;
    sendingSchoolCode: string;
    academicYearLabel: string;
    majorName: string;
    agreementType: string;
    publishDate: string;
    sourceUrl: string;
    availableMajorCount: number | null;
    groups: PlannerRequirementGroup[];
    stats: {
        groupCount: number;
        requirementCount: number;
        articulatedCount: number;
        noArticulationCount: number;
        uniqueSbccCourseCount: number;
        sbccSubjectCount: number;
    };
};

export type PlannerSchool = {
    id: string;
    name: string;
    code: string;
    segment: string;
    hasMajorList: boolean;
    majorCount: number | null;
    detailedMajorCount: number;
};

export type PlannerMajor = {
    id: string;
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    label: string;
    key: string;
    hasDetails: boolean;
    agreementId: string | null;
};

export type PlannerData = {
    schools: PlannerSchool[];
    majors: PlannerMajor[];
    agreements: PlannerAgreement[];
    summary: {
        schoolCount: number;
        cachedMajorCount: number;
        detailedAgreementCount: number;
        requirementCount: number;
        sbccCourseCount: number;
    };
};

const ASSIST_NORMALIZED_ROOT = path.join(process.cwd(), "app/data/assist/normalized");
const ASSIST_RAW_LISTS_ROOT = path.join(process.cwd(), "app/data/assist/raw/lists");
const ASSIST_PARTNERS_PATH = path.join(process.cwd(), "app/data/assist/raw/metadata/sbcc-agreement-partners.json");
const ASSIST_INSTITUTIONS_PATH = path.join(process.cwd(), "app/data/assist/raw/metadata/institutions.json");

const INSTITUTION_CATEGORY_SEGMENTS = new Map<number | string, string>([
    [0, "CSU"],
    [1, "UC"],
    [2, "CCC"],
    [5, "Private"],
    ["CSU", "CSU"],
    ["UC", "UC"],
    ["CCC", "CCC"],
    ["PRIVATE", "Private"],
]);

function listJsonFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return listJsonFiles(entryPath);
            return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
        })
        .sort((a, b) => a.localeCompare(b));
}

function readJsonFile<T>(filePath: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    } catch {
        return null;
    }
}

function cleanText(value: unknown): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanCode(value: unknown): string {
    return String(value ?? "").trim();
}

function cleanNote(value: unknown): string {
    return cleanText(value).replace(/\*\*/g, "");
}

function slugify(value: string, fallback = "agreement"): string {
    const slug = value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90);

    return slug || fallback;
}

function schoolIdFrom(value: unknown): string {
    const id = Number(value);
    return Number.isFinite(id) ? String(id) : slugify(cleanText(value), "school");
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

function formatUnits(course: AssistCourse): string {
    const min = typeof course.minUnits === "number" ? course.minUnits : null;
    const max = typeof course.maxUnits === "number" ? course.maxUnits : null;

    if (min != null && max != null && min !== max) return `${min}-${max} units`;
    if (min != null) return `${min} units`;
    if (max != null) return `${max} units`;
    return "";
}

function normalizeLogic(value: unknown): string {
    const logic = cleanCode(value).toUpperCase();
    if (logic === "AND" || logic === "OR") return logic;
    return "";
}

function normalizeCourse(course: AssistCourse, fallbackId: string): PlannerCourse {
    const prefix = cleanCode(course.prefix);
    const courseNumber = cleanCode(course.courseNumber);
    const code = [prefix, courseNumber].filter(Boolean).join(" ") || "Course";
    const crossListedCodes = uniqueStrings(
        (course.visibleCrossListedCourses ?? []).map((crossListedCourse) => {
            const crossPrefix = cleanCode(crossListedCourse.prefix);
            const crossNumber = cleanCode(crossListedCourse.courseNumber);
            return [crossPrefix, crossNumber].filter(Boolean).join(" ");
        }),
    );

    return {
        id: `${course.courseIdentifierParentId ?? course.id ?? fallbackId}`,
        code,
        title: cleanText(course.title),
        units: formatUnits(course),
        department: cleanText(course.department),
        crossListedCodes,
    };
}

function normalizeCourses(courses: AssistCourse[] | null | undefined, fallbackId: string): PlannerCourse[] {
    const byKey = new Map<string, PlannerCourse>();

    (courses ?? []).forEach((course, index) => {
        const normalizedCourse = normalizeCourse(course, `${fallbackId}-${index}`);
        const key = `${normalizedCourse.code}|${normalizedCourse.title}|${normalizedCourse.units}`;
        byKey.set(key, normalizedCourse);
    });

    return Array.from(byKey.values());
}

function attributeTexts(...collections: Array<AssistAttribute[] | null | undefined>): string[] {
    return uniqueStrings(
        collections
            .flatMap((collection) => collection ?? [])
            .map((attribute) => cleanNote(attribute.content))
            .filter((note) => note && note.toUpperCase() !== "REFER TO TOP OF AGREEMENT"),
    );
}

function categoryFrom(title: string, notes: string[]): string {
    const text = `${title} ${notes.join(" ")}`.toLowerCase();

    if (text.includes("required for admission")) return "Required for admission";
    if (text.includes("strongly recommended")) return "Strongly recommended";
    if (text.includes("upper division") || text.includes("not articulated")) return "Upper division";
    if (text.includes("additional")) return "Additional preparation";
    if (text.includes("recommended")) return "Recommended";
    if (text.includes("preparation")) return "Major preparation";
    return "Agreement";
}

function normalizeOptions(articulation: AssistArticulation, requirementId: string, articulationIndex: number): PlannerOption[] {
    const courseGroups = (articulation.courseGroups ?? []).filter((group) => (group.courses ?? []).length > 0);

    if (courseGroups.length > 0) {
        return courseGroups.map((courseGroup, groupIndex) => ({
            id: `${requirementId}-articulation-${articulationIndex}-group-${groupIndex}`,
            logic: normalizeLogic(courseGroup.logic),
            courses: normalizeCourses(courseGroup.courses, `${requirementId}-group-${groupIndex}`),
        }));
    }

    const courses = normalizeCourses(articulation.courses, `${requirementId}-articulation-${articulationIndex}`);

    if (courses.length > 0) {
        if (normalizeLogic(articulation.logic) === "OR") {
            return courses.map((course, courseIndex) => ({
                id: `${requirementId}-articulation-${articulationIndex}-course-${courseIndex}`,
                logic: "",
                courses: [course],
            }));
        }

        return [
            {
                id: `${requirementId}-articulation-${articulationIndex}`,
                logic: normalizeLogic(articulation.logic),
                courses,
            },
        ];
    }

    return [
        {
            id: `${requirementId}-articulation-${articulationIndex}`,
            logic: "",
            courses: [],
            noArticulationReason: cleanText(articulation.noArticulationReason) || "No SBCC articulation listed",
        },
    ];
}

function buildRequirements(group: AssistRequirementGroup, groupIndex: number): PlannerRequirement[] {
    return (group.sections ?? []).flatMap((section, sectionIndex) => {
        const receivingItems =
            section.receivingItems && section.receivingItems.length > 0
                ? section.receivingItems
                : [
                      {
                          id: section.id ?? `${group.id ?? groupIndex}-section-${sectionIndex}`,
                          position: section.position,
                          courses: section.receivingCourses ?? [],
                          attributes: [],
                          courseAttributes: [],
                          advisements: [],
                          rowAttributes: [],
                      },
                  ];

        return receivingItems.map((item, itemIndex) => {
            const requirementId = `${group.id ?? `group-${groupIndex}`}-section-${sectionIndex}-item-${itemIndex}`;
            const articulations = (section.sbccArticulations ?? []).filter((articulation) => {
                if (!item.id) return receivingItems.length === 1;
                return articulation.receivingCellId === item.id;
            });
            const matchedArticulations =
                articulations.length > 0 || receivingItems.length > 1 ? articulations : section.sbccArticulations ?? [];
            const options = matchedArticulations.flatMap((articulation, articulationIndex) =>
                normalizeOptions(articulation, requirementId, articulationIndex),
            );
            const ucCourses = normalizeCourses(item.courses ?? section.receivingCourses, `${requirementId}-uc`);
            const notes = attributeTexts(
                section.attributes,
                section.advisements,
                item.attributes,
                item.courseAttributes,
                item.advisements,
                item.rowAttributes,
                ...matchedArticulations.map((articulation) => articulation.attributes),
            );
            const groupTitle = cleanText(group.title) || "Agreement section";

            return {
                id: requirementId,
                groupTitle,
                label: ucCourses.map((course) => course.code).join(" / ") || cleanText(item.name) || "Requirement",
                logic: normalizeLogic(section.logic),
                category: categoryFrom(groupTitle, notes),
                ucCourses,
                options,
                notes,
                isArticulated: options.some((option) => option.courses.length > 0),
            };
        });
    });
}

function readAvailableMajorCount(academicYearId: number | null | undefined, receivingInstitutionId: number | null | undefined): number | null {
    if (academicYearId == null || receivingInstitutionId == null) return null;

    const majorListPath = path.join(
        ASSIST_RAW_LISTS_ROOT,
        `year-${academicYearId}`,
        `receiving-${receivingInstitutionId}`,
        "major.json",
    );
    const majorList = readJsonFile<{ reports?: unknown[] }>(majorListPath);
    return Array.isArray(majorList?.reports) ? majorList.reports.length : null;
}

function readMajorReportsBySchool(): Map<string, PlannerMajor[]> {
    const majorsBySchool = new Map<string, PlannerMajor[]>();

    listJsonFiles(ASSIST_RAW_LISTS_ROOT)
        .filter((filePath) => path.basename(filePath) === "major.json")
        .forEach((filePath) => {
            const list = readJsonFile<{ reports?: AssistMajorReport[] }>(filePath);
            const reports = Array.isArray(list?.reports) ? list.reports : [];
            const receivingMatch = filePath.match(/receiving-(\d+)/);
            const schoolId = receivingMatch?.[1] ?? "";

            reports.forEach((report, index) => {
                const ownerId = report.ownerInstitutionId ?? Number(schoolId);
                const resolvedSchoolId = schoolIdFrom(ownerId || schoolId);
                const label = cleanText(report.label);
                const key = cleanText(report.key);
                if (!label || !key) return;

                const majors = majorsBySchool.get(resolvedSchoolId) ?? [];
                majors.push({
                    id: key || `${resolvedSchoolId}-${index}`,
                    schoolId: resolvedSchoolId,
                    schoolName: "",
                    schoolCode: "",
                    label,
                    key,
                    hasDetails: false,
                    agreementId: null,
                });
                majorsBySchool.set(resolvedSchoolId, majors);
            });
        });

    return majorsBySchool;
}

function readInstitutionMetadata(): Map<string, AssistInstitutionMetadata> {
    const institutions = readJsonFile<AssistInstitutionMetadata[]>(ASSIST_INSTITUTIONS_PATH) ?? [];
    return new Map(institutions.map((institution) => [schoolIdFrom(institution.id), institution]));
}

function readableInstitutionName(institution: AssistInstitutionMetadata | undefined, fallback: string): string {
    const visibleName = institution?.names?.find((name) => !name.hideInList)?.name ?? institution?.names?.[0]?.name;
    return cleanText(visibleName) || fallback;
}

function schoolSegmentFrom(institution: AssistInstitutionMetadata | undefined): string {
    return INSTITUTION_CATEGORY_SEGMENTS.get(institution?.category ?? "") ?? "";
}

function buildAgreement(data: AssistAgreementFile, filePath: string): PlannerAgreement | null {
    const receivingInstitution = data.receivingInstitution;
    const sendingInstitution = data.sendingInstitution;
    const academicYear = data.academicYear;
    const agreement = data.agreement;
    const majorName = cleanText(agreement?.name);
    const schoolName = cleanText(receivingInstitution?.name);

    if (!majorName || !schoolName) return null;

    const fileSlug = path.basename(filePath, ".json");
    const schoolId = `${receivingInstitution?.id ?? slugify(schoolName, "school")}`;
    const groupData = (data.requirementGroups ?? []).map((group, groupIndex) => {
        const title = cleanText(group.title) || "Agreement section";
        const notes = attributeTexts(group.attributes, group.advisements);
        const requirements = buildRequirements(group, groupIndex);

        return {
            id: group.id ?? `${fileSlug}-group-${groupIndex}`,
            title,
            category: categoryFrom(title, notes),
            notes,
            requirements,
        };
    });
    const allRequirements = groupData.flatMap((group) => group.requirements);
    const sbccCourseCodes = new Set<string>();
    const sbccSubjectCodes = new Set<string>();

    allRequirements.forEach((requirement) => {
        requirement.options.forEach((option) => {
            option.courses.forEach((course) => {
                sbccCourseCodes.add(course.code);
                const subject = course.code.split(" ")[0];
                if (subject) sbccSubjectCodes.add(subject);
            });
        });
    });

    return {
        id: `${schoolId}-${fileSlug}`,
        key: cleanText(agreement?.key),
        schoolId,
        schoolName,
        schoolCode: cleanCode(receivingInstitution?.code),
        schoolSegment: cleanCode(receivingInstitution?.segment),
        sendingSchoolName: cleanText(sendingInstitution?.name) || "Santa Barbara City College",
        sendingSchoolCode: cleanCode(sendingInstitution?.code) || "SBCC",
        academicYearLabel: cleanText(academicYear?.label),
        majorName,
        agreementType: cleanText(agreement?.type) || "Major",
        publishDate: cleanText(agreement?.publishDate),
        sourceUrl: cleanText(data.sourceUrl),
        availableMajorCount: readAvailableMajorCount(academicYear?.id, receivingInstitution?.id),
        groups: groupData,
        stats: {
            groupCount: groupData.length,
            requirementCount: allRequirements.length,
            articulatedCount: allRequirements.filter((requirement) => requirement.isArticulated).length,
            noArticulationCount: allRequirements.filter((requirement) => !requirement.isArticulated).length,
            uniqueSbccCourseCount: sbccCourseCodes.size,
            sbccSubjectCount: sbccSubjectCodes.size,
        },
    };
}

export function getAssistPlannerAgreements(): PlannerAgreement[] {
    return listJsonFiles(ASSIST_NORMALIZED_ROOT)
        .map((filePath) => {
            const data = readJsonFile<AssistAgreementFile>(filePath);
            return data ? buildAgreement(data, filePath) : null;
        })
        .filter((agreement): agreement is PlannerAgreement => agreement !== null)
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName) || a.majorName.localeCompare(b.majorName));
}

export function getAssistPlannerData(): PlannerData {
    const agreements = getAssistPlannerAgreements();
    const partners = readJsonFile<AssistPartner[]>(ASSIST_PARTNERS_PATH) ?? [];
    const institutions = readInstitutionMetadata();
    const majorsBySchool = readMajorReportsBySchool();
    const agreementByKey = new Map(agreements.map((agreement) => [agreement.key, agreement]));
    const agreementSchoolIds = new Set(agreements.map((agreement) => agreement.schoolId));
    const schoolsById = new Map<string, PlannerSchool>();

    partners.forEach((partner) => {
        if (partner.isCommunityCollege) return;
        const schoolId = schoolIdFrom(partner.institutionParentId);
        const institution = institutions.get(schoolId);
        const segment = schoolSegmentFrom(institution);
        if (segment && !["UC", "CSU"].includes(segment)) return;

        const majors = majorsBySchool.get(schoolId) ?? [];
        const detailedMajorCount = agreements.filter((agreement) => agreement.schoolId === schoolId).length;
        const name = readableInstitutionName(institution, cleanText(partner.institutionName));

        schoolsById.set(schoolId, {
            id: schoolId,
            name,
            code: cleanCode(institution?.code ?? partner.code),
            segment,
            hasMajorList: majors.length > 0,
            majorCount: majors.length > 0 ? majors.length : null,
            detailedMajorCount,
        });
    });

    agreements.forEach((agreement) => {
        const current = schoolsById.get(agreement.schoolId);
        if (current) {
            current.detailedMajorCount = Math.max(current.detailedMajorCount, 1);
            current.majorCount = current.majorCount ?? agreement.availableMajorCount;
            current.hasMajorList = current.hasMajorList || Boolean(current.majorCount);
            return;
        }

        schoolsById.set(agreement.schoolId, {
            id: agreement.schoolId,
            name: agreement.schoolName,
            code: agreement.schoolCode,
            segment: agreement.schoolSegment,
            hasMajorList: Boolean(agreement.availableMajorCount),
            majorCount: agreement.availableMajorCount,
            detailedMajorCount: 1,
        });
    });

    const majors = Array.from(majorsBySchool.entries()).flatMap(([schoolId, schoolMajors]) => {
        const school = schoolsById.get(schoolId);
        return schoolMajors.map((major) => {
            const agreement = agreementByKey.get(major.key);
            return {
                ...major,
                schoolName: school?.name ?? "",
                schoolCode: school?.code ?? "",
                hasDetails: Boolean(agreement),
                agreementId: agreement?.id ?? null,
            };
        });
    });

    agreements.forEach((agreement) => {
        if (majors.some((major) => major.key === agreement.key)) return;
        majors.push({
            id: agreement.key || agreement.id,
            schoolId: agreement.schoolId,
            schoolName: agreement.schoolName,
            schoolCode: agreement.schoolCode,
            label: agreement.majorName,
            key: agreement.key,
            hasDetails: true,
            agreementId: agreement.id,
        });
    });

    const schools = Array.from(schoolsById.values())
        .filter((school) => school.segment === "UC" || school.segment === "CSU" || agreementSchoolIds.has(school.id))
        .sort((a, b) => {
            const aReady = a.detailedMajorCount > 0 ? 0 : a.hasMajorList ? 1 : 2;
            const bReady = b.detailedMajorCount > 0 ? 0 : b.hasMajorList ? 1 : 2;
            return aReady - bReady || a.name.localeCompare(b.name);
        });

    return {
        schools,
        majors,
        agreements,
        summary: {
            schoolCount: schools.length,
            cachedMajorCount: majors.length,
            detailedAgreementCount: agreements.length,
            requirementCount: agreements.reduce((sum, agreement) => sum + agreement.stats.requirementCount, 0),
            sbccCourseCount: agreements.reduce((sum, agreement) => sum + agreement.stats.uniqueSbccCourseCount, 0),
        },
    };
}
