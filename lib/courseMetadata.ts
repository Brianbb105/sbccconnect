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

export function extractPrerequisites(source?: CourseMetadataSource) {
    if (!source) return [];
    if (Array.isArray(source.prerequisites) && source.prerequisites.length > 0) {
        return normalizeValues(source.prerequisites);
    }

    const fallbackText = cleanMetadataValue(source.prerequisitesText);
    if (!fallbackText) return [];

    return normalizeValues(
        fallbackText.split(
            /(?:\s*;\s*|\s*\|\s*|\.\s+(?=(?:[A-Z]{2,6}\s*\d{1,3}[A-Z]?|Prereq|Prerequisite|Corequisite)))/i
        )
    );
}

export function extractAdvisories(source?: CourseMetadataSource) {
    if (!source) return [];
    if (Array.isArray(source.advisories) && source.advisories.length > 0) {
        return normalizeValues(source.advisories);
    }

    const fallbackText = cleanMetadataValue(source.advisoriesText);
    if (!fallbackText) return [];

    return normalizeValues(fallbackText.split(/(?:\s*;\s*|\s*\|\s*)/i));
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
