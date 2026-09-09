import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PlannerAgreement, PlannerMajor, PlannerSchool } from './assistPlanner';
import type { PrivateAgreementCategory, PrivateAssistGuide } from './privateAssistTypes';

const ROOT = path.join(process.cwd(), 'app/data/assist-private');
type Report = { key: string; label: string; category: PrivateAgreementCategory; schoolId: number; yearId: number; ownerInstitutionId: number };
type Manifest = {
    completedAt: string | null; partial: boolean; failures: unknown[];
    schools: Array<{ id: number; name: string; code: string; academicYear: { id: number; label: string }; categoryCounts: Record<PrivateAgreementCategory, number> }>;
    reports: Report[];
    agreements: Record<string, { normalizedPath: string }>;
};
type AgreementFile = { agreement: { key: string; name: string; type: string; publishDate: string | null }; academicYear: { id: number; label: string }; receivingInstitution: { id: number }; sourceUrl: string; plannerGuide: PrivateAssistGuide };

export function getPrivateAssistPlannerData(): { schools: PlannerSchool[]; majors: PlannerMajor[]; agreements: PlannerAgreement[] } {
    const manifestPath = path.join(ROOT, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { schools: [], majors: [], agreements: [] };
    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    const manifest: Manifest = JSON.parse(manifestText);
    if (!manifest.completedAt || manifest.partial || manifest.failures.length || Object.keys(manifest.agreements).length !== manifest.reports.length) {
        throw new Error('The private-university import is incomplete. Finish the import and validation before building the planner.');
    }
    const validationPath = path.join(ROOT, 'reports/validation.json');
    const validation = fs.existsSync(validationPath) ? JSON.parse(fs.readFileSync(validationPath, 'utf8')) : null;
    if (!validation?.valid || validation.manifestSha256 !== createHash('sha256').update(manifestText).digest('hex')) {
        throw new Error('Validate the current private-university import before building the planner.');
    }
    const schools: PlannerSchool[] = manifest.schools.map(school => {
        const count = manifest.reports.filter(report => report.schoolId === school.id).length;
        return { id: String(school.id), name: school.name, code: school.code, segment: 'PRIVATE', hasMajorList: true,
            majorCount: count, detailedMajorCount: count, agreementCategories: school.categoryCounts, academicYearLabel: school.academicYear.label };
    });
    const agreements: PlannerAgreement[] = [];
    const majors: PlannerMajor[] = manifest.reports.map(report => {
        const school = schools.find(school => school.id === String(report.schoolId))!;
        const entry = manifest.agreements[report.key];
        if (!entry) throw new Error(`Missing private agreement: ${report.key}`);
        const data: AgreementFile = JSON.parse(fs.readFileSync(path.join(ROOT, entry.normalizedPath), 'utf8'));
        if (data.agreement.key !== report.key || data.academicYear.id !== report.yearId || data.receivingInstitution.id !== report.schoolId) throw new Error(`Private agreement identity mismatch: ${report.key}`);
        const id = `private-assist-${path.basename(entry.normalizedPath, '.json')}`;
        const guide = data.plannerGuide;
        if (!guide) throw new Error(`Missing prepared private guide: ${report.key}`);
        const rows = guide.groups.flatMap(group => group.sections.flatMap(section => section.rows));
        agreements.push({ id, key: report.key, schoolId: school.id, schoolName: school.name, schoolCode: school.code, schoolSegment: 'PRIVATE',
            sendingSchoolName: 'Santa Barbara City College', sendingSchoolCode: 'SBCC', academicYearLabel: data.academicYear.label,
            majorName: data.agreement.name, agreementType: data.agreement.type, publishDate: data.agreement.publishDate ?? '',
            sourceUrl: data.sourceUrl, availableMajorCount: school.agreementCategories?.major ?? 0, groups: [], privateGuide: guide,
            stats: { groupCount: guide.groups.length, requirementCount: rows.length, articulatedCount: rows.filter(row => row.options.length).length,
                noArticulationCount: rows.filter(row => !row.options.length).length, uniqueSbccCourseCount: 0, sbccSubjectCount: 0 } });
        return { id, schoolId: school.id, schoolName: school.name, schoolCode: school.code, label: report.label,
            key: report.key, hasDetails: true, agreementId: id, agreementCategory: report.category, organizedBy: guide.organizedBy };
    });
    return { schools, majors, agreements };
}
