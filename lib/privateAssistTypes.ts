export type PrivateAgreementCategory = 'major' | 'breadth' | 'dept' | 'prefix';
export type PrivateSourceText = { text: string; links: Array<{ label: string; url: string }> };
export type PrivateCourseOption = { text: string; notes: PrivateSourceText[] };
export type PrivateCourseRow = {
    id: string;
    title: string;
    receivingText: string;
    notes: PrivateSourceText[];
    sendingNotes: PrivateSourceText[];
    options: PrivateCourseOption[];
    optionLogic: string;
    noMatch: string;
};
export type PrivateGuideSection = {
    title: string;
    notes: PrivateSourceText[];
    sections: Array<{ title: string; isHeading: boolean; notes: PrivateSourceText[]; rows: PrivateCourseRow[] }>;
};
export type PrivateAssistGuide = {
    category: PrivateAgreementCategory;
    organizedBy: 'SBCC' | 'university';
    notes: PrivateSourceText[];
    groups: PrivateGuideSection[];
    warnings: string[];
};

export const PRIVATE_CATEGORY_LABELS: Record<PrivateAgreementCategory, string> = {
    major: 'Major agreements', breadth: 'General education', dept: 'Departments', prefix: 'Course prefixes',
};
