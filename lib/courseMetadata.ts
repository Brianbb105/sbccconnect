export interface CourseMetadataSource {
    courseDescription?: string;
    advisoriesText?: string;
    advisories?: string[];
    prerequisitesText?: string;
    prerequisites?: string[];
    transferInformationText?: string;
    transferInformation?: string[];
}

export function cleanMetadataValue(value?: string) {
    return String(value || "").trim();
}

function uniqueValues(values: string[]) {
    return Array.from(new Set(values));
}

function normalizeValues(values: string[]) {
    return uniqueValues(values.map((value) => cleanMetadataValue(value)).filter(Boolean));
}

const PREREQ_LABEL_RE = /^(?:prerequisite(?:s)?|pre-?req(?:uisite)?(?:s)?|corequisite(?:s)?|co-?req(?:uisite)?(?:s)?)\s*:?\s*/i;
const ADVISORY_LABEL_RE = /^(?:course advisory|advisory|recommended preparation)\s*:?\s*/i;
const ADVISORY_ANYWHERE_RE = /\b(?:course advisory|advisory|recommended preparation)\b/i;
const PREREQ_SPLIT_RE = /(?:\s*;\s*|\s*\|\s*|\.\s+(?=(?:[A-Z]{2,6}\s*\d{1,3}[A-Z]?|Prereq|Prerequisite|Corequisite)))/i;
const COURSE_CODE_RE = /\b[A-Z]{2,8}\s*\d{1,4}[A-Z]?\b/;
const CONNECTOR_ONLY_RE = /^(?:and|or|and\/or|\/|&)\.?$/i;
const PREREQ_HINT_RE = /\b(?:eligibility|eligible|placement|qualification|minimum grade|completion|concurrent|corequisite|prerequisite|department approval|consent|recommended preparation)\b/i;
const NARRATIVE_START_RE = /(?:Students?|Student|Work|Attend|Learn|Develop|Designed|Focuses|Introduces|Covers|Provides|Explores|Includes|Emphasizes|The course|This course|Second|Basic|Study|Topics|Limitation|Deadlines?)\b/i;

function splitPrerequisiteText(text?: string) {
    const fallbackText = cleanMetadataValue(text);
    if (!fallbackText) return [];
    return fallbackText.split(PREREQ_SPLIT_RE);
}

function trimConnectorEdges(item: string) {
    return item
        .replace(/^(?:and|or|and\/or)\b[\s,]*/i, "")
        .replace(/[\s,;]*(?:and|or|and\/or)\.?$/i, "")
        .trim();
}

function stripNarrativeTail(item: string) {
    let normalized = cleanMetadataValue(item);
    if (!normalized) return "";

    const firstPeriodIndex = normalized.indexOf(".");
    if (firstPeriodIndex > 0) {
        const head = cleanMetadataValue(normalized.slice(0, firstPeriodIndex));
        const tail = cleanMetadataValue(normalized.slice(firstPeriodIndex + 1));
        if (head && tail && COURSE_CODE_RE.test(head) && !COURSE_CODE_RE.test(tail) && !PREREQ_HINT_RE.test(tail)) {
            normalized = head;
        }
    }

    const sentenceNarrativeIndex = normalized.search(new RegExp(`\\.\\s+(?=${NARRATIVE_START_RE.source})`, "i"));
    if (sentenceNarrativeIndex >= 0) {
        normalized = normalized.slice(0, sentenceNarrativeIndex + 1);
    } else {
        const inlineNarrativeIndex = normalized.search(new RegExp(`\\s+(?=${NARRATIVE_START_RE.source})`, "i"));
        if (inlineNarrativeIndex > 0) {
            const head = normalized.slice(0, inlineNarrativeIndex);
            if (COURSE_CODE_RE.test(head)) {
                normalized = head;
            }
        }
    }

    return trimConnectorEdges(normalized.replace(/[;,.]\s*$/, ""));
}

function looksLikePrerequisiteValue(item: string) {
    const normalized = cleanMetadataValue(item);
    if (!normalized || CONNECTOR_ONLY_RE.test(normalized)) return false;
    return COURSE_CODE_RE.test(normalized) || PREREQ_HINT_RE.test(normalized);
}

function normalizePrerequisiteItem(item: string) {
    const normalized = cleanMetadataValue(item).replace(PREREQ_LABEL_RE, "").replace(/^[:\-]\s*/, "");
    return stripNarrativeTail(normalized);
}

function normalizeAdvisoryItem(item: string) {
    const normalized = cleanMetadataValue(item)
        .replace(PREREQ_LABEL_RE, "")
        .replace(ADVISORY_LABEL_RE, "")
        .replace(/^[:\-]\s*/, "");
    return stripNarrativeTail(normalized);
}

export function extractPrerequisites(source?: CourseMetadataSource) {
    if (!source) return [];
    const rawPrerequisites = (Array.isArray(source.prerequisites) && source.prerequisites.length > 0)
        ? source.prerequisites
        : splitPrerequisiteText(source.prerequisitesText);

    return normalizeValues(
        rawPrerequisites
            .map((item) => normalizePrerequisiteItem(item))
            .filter((item) => item && !ADVISORY_ANYWHERE_RE.test(item) && looksLikePrerequisiteValue(item))
    );
}

export function extractAdvisories(source?: CourseMetadataSource) {
    if (!source) return [];

    const advisoryCandidates: string[] = [];
    if (Array.isArray(source.advisories) && source.advisories.length > 0) {
        advisoryCandidates.push(...source.advisories);
    }

    const fallbackAdvisories = cleanMetadataValue(source.advisoriesText);
    if (fallbackAdvisories) {
        advisoryCandidates.push(...fallbackAdvisories.split(/(?:\s*;\s*|\s*\|\s*)/i));
    }

    const rawPrerequisites = (Array.isArray(source.prerequisites) && source.prerequisites.length > 0)
        ? source.prerequisites
        : splitPrerequisiteText(source.prerequisitesText);
    rawPrerequisites.forEach((item) => {
        if (ADVISORY_ANYWHERE_RE.test(cleanMetadataValue(item))) {
            advisoryCandidates.push(item);
        }
    });

    return normalizeValues(
        advisoryCandidates
            .map((item) => normalizeAdvisoryItem(item))
            .filter((item) => item && !CONNECTOR_ONLY_RE.test(item) && (COURSE_CODE_RE.test(item) || PREREQ_HINT_RE.test(item) || NARRATIVE_START_RE.test(item) || item.length <= 80))
    );
}

export function extractTransferInformation(source?: CourseMetadataSource) {
    if (!source) return [];
    if (Array.isArray(source.transferInformation) && source.transferInformation.length > 0) {
        return normalizeValues(source.transferInformation);
    }

    const fallbackText = cleanMetadataValue(source.transferInformationText);
    if (!fallbackText) return [];

    const withMarkers = fallbackText.replace(
        /(Transfer Information|SBCC General Education|Grading Options|Hours)\s*:/gi,
        "\n$1:"
    );

    return normalizeValues(withMarkers.split(/\s*\|\s*|\n+/));
}
