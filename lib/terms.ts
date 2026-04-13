export type TermSlug =
    | "fall2024"
    | "spring2025"
    | "summer2025"
    | "fall2025"
    | "spring2026"
    | "summer2026"
    | "fall2026";

export type TermCode =
    | "202530"
    | "202550"
    | "202610"
    | "202630"
    | "202650"
    | "202710"
    | "202730";

export type TermDefinition = {
    slug: TermSlug;
    code: TermCode;
    label: string;
};

export const SUPPORTED_TERMS: TermDefinition[] = [
    { slug: "fall2026", code: "202730", label: "Fall 2026" },
    { slug: "summer2026", code: "202710", label: "Summer 2026" },
    { slug: "spring2026", code: "202650", label: "Spring 2026" },
    { slug: "fall2025", code: "202630", label: "Fall 2025" },
    { slug: "summer2025", code: "202610", label: "Summer 2025" },
    { slug: "spring2025", code: "202550", label: "Spring 2025" },
    { slug: "fall2024", code: "202530", label: "Fall 2024" },
];

export const DEFAULT_TERM_SLUG: TermSlug = "fall2026";

const TERMS_BY_SLUG = new Map<TermSlug, TermDefinition>(
    SUPPORTED_TERMS.map((term) => [term.slug, term]),
);

const TERMS_BY_CODE = new Map<TermCode, TermDefinition>(
    SUPPORTED_TERMS.map((term) => [term.code, term]),
);

type SearchParamsLike = {
    get(name: string): string | null;
};

export function isSupportedTermSlug(value: string): value is TermSlug {
    return TERMS_BY_SLUG.has(value as TermSlug);
}

export function normalizeTermSlug(value?: string | null): TermSlug {
    if (!value) return DEFAULT_TERM_SLUG;
    const normalized = String(value).trim().toLowerCase();
    return isSupportedTermSlug(normalized) ? normalized : DEFAULT_TERM_SLUG;
}

export function getTermBySlug(slug: TermSlug): TermDefinition {
    return TERMS_BY_SLUG.get(slug) ?? TERMS_BY_SLUG.get(DEFAULT_TERM_SLUG)!;
}

export function getTermByCode(code: string): TermDefinition | null {
    return TERMS_BY_CODE.get(code as TermCode) ?? null;
}

export function getTermFromSearchParams(searchParams?: SearchParamsLike | null): TermDefinition {
    return getTermBySlug(normalizeTermSlug(searchParams?.get("term")));
}

export function appendTermToHref(href: string, term: TermSlug): string {
    const url = new URL(href, "http://localhost");
    url.searchParams.set("term", term);
    return `${url.pathname}${url.search}${url.hash}`;
}
