import { cleanMetadataValue } from "@/lib/courseMetadata";

interface CourseCatalogDetailsProps {
    description?: string;
    advisories?: string[];
    prerequisites?: string[];
    transferInformation?: string[];
    className?: string;
}

function getLabelAndValue(entry: string) {
    const normalized = cleanMetadataValue(entry);
    const separatorIndex = normalized.indexOf(":");
    if (separatorIndex <= 0) {
        return { label: "", value: normalized };
    }
    return {
        label: cleanMetadataValue(normalized.slice(0, separatorIndex)),
        value: cleanMetadataValue(normalized.slice(separatorIndex + 1)),
    };
}

export default function CourseCatalogDetails({
    description,
    advisories = [],
    prerequisites = [],
    transferInformation = [],
    className = "",
}: CourseCatalogDetailsProps) {
    const cleanDescription = cleanMetadataValue(description);
    const cleanAdvisories = advisories.map((item) => cleanMetadataValue(item)).filter(Boolean);
    const cleanPrerequisites = prerequisites.map((item) => cleanMetadataValue(item)).filter(Boolean);
    const cleanTransferInformation = transferInformation
        .map((item) => cleanMetadataValue(item))
        .filter(Boolean);

    const hasDetails = Boolean(
        cleanDescription
        || cleanAdvisories.length
        || cleanPrerequisites.length
        || cleanTransferInformation.length
    );

    if (!hasDetails) return null;

    return (
        <section className={`mb-6 rounded-xl border border-gray-200 bg-white p-5 ${className}`.trim()}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Course Details</h2>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
                {cleanDescription && (
                    <div className="md:col-span-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">{cleanDescription}</p>
                    </div>
                )}

                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Course Advisory</h3>
                    {cleanAdvisories.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {cleanAdvisories.map((item, index) => (
                                <li key={`${item}-${index}`}>• {item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">No advisory listed.</p>
                    )}
                </div>

                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Prerequisites</h3>
                    {cleanPrerequisites.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {cleanPrerequisites.map((item, index) => (
                                <li key={`${item}-${index}`}>• {item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">No prerequisite requirements listed.</p>
                    )}
                </div>

                {cleanTransferInformation.length > 0 && (
                    <div className="md:col-span-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Transfer Information</h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {cleanTransferInformation.map((item, index) => {
                                const parsed = getLabelAndValue(item);
                                return (
                                    <li key={`${item}-${index}`}>
                                        {parsed.label ? (
                                            <>
                                                <span className="font-semibold text-slate-800">{parsed.label}:</span> {parsed.value}
                                            </>
                                        ) : parsed.value}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
