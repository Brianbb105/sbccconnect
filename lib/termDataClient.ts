"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_TERMS, type TermSlug } from "@/lib/terms";

type JsonArrayModule<T> = { default: T[] };

type LoaderMap = Record<TermSlug, () => Promise<JsonArrayModule<unknown>>>;

const SECTION_LOADERS: LoaderMap = {
    fall2024: () => import("@/app/data/202530/sections.json"),
    spring2025: () => import("@/app/data/202550/sections.json"),
    summer2025: () => import("@/app/data/202610/sections.json"),
    fall2025: () => import("@/app/data/202630/sections.json"),
    spring2026: () => import("@/app/data/202650/sections.json"),
    summer2026: () => import("@/app/data/202710/sections.json"),
    fall2026: () => import("@/app/data/202730/sections.json"),
};

const PROFESSOR_LOADERS: LoaderMap = {
    fall2024: () => import("@/app/data/202530/professors.json"),
    spring2025: () => import("@/app/data/202550/professors.json"),
    summer2025: () => import("@/app/data/202610/professors.json"),
    fall2025: () => import("@/app/data/202630/professors.json"),
    spring2026: () => import("@/app/data/202650/professors.json"),
    summer2026: () => import("@/app/data/202710/professors.json"),
    fall2026: () => import("@/app/data/202730/professors.json"),
};

const sectionPromiseCache = new Map<TermSlug, Promise<unknown[]>>();
const professorPromiseCache = new Map<TermSlug, Promise<unknown[]>>();
let allProfessorsPromiseCache: Promise<unknown[]> | null = null;

function getCachedArray(
    cache: Map<TermSlug, Promise<unknown[]>>,
    term: TermSlug,
    loader: () => Promise<JsonArrayModule<unknown>>,
): Promise<unknown[]> {
    const existing = cache.get(term);
    if (existing) return existing;

    const next = loader().then((mod) => (Array.isArray(mod.default) ? mod.default : []));
    cache.set(term, next);
    return next;
}

export function loadSectionsForTerm<T>(term: TermSlug): Promise<T[]> {
    return getCachedArray(sectionPromiseCache, term, SECTION_LOADERS[term]) as Promise<T[]>;
}

export function loadProfessorsForTerm<T>(term: TermSlug): Promise<T[]> {
    return getCachedArray(professorPromiseCache, term, PROFESSOR_LOADERS[term]) as Promise<T[]>;
}

type ProfessorLike = {
    displayName?: string;
    key?: string;
};

export type ProfessorWithTerms<T> = T & {
    terms: TermSlug[];
};

function normalizeProfessorIdentity(professor: ProfessorLike): string {
    return String(professor.key || professor.displayName || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function sortProfessorRows<T extends ProfessorLike>(rows: ProfessorWithTerms<T>[]): ProfessorWithTerms<T>[] {
    return rows.sort((a, b) => {
        const aName = String(a.displayName || a.key || "");
        const bName = String(b.displayName || b.key || "");
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
}

export function loadAllProfessors<T extends ProfessorLike>(): Promise<Array<ProfessorWithTerms<T>>> {
    if (allProfessorsPromiseCache) {
        return allProfessorsPromiseCache as Promise<Array<ProfessorWithTerms<T>>>;
    }

    allProfessorsPromiseCache = Promise.all(
        SUPPORTED_TERMS.map((term) =>
            loadProfessorsForTerm<T>(term.slug).then((rows) => ({ term: term.slug, rows })),
        ),
    ).then((termRows) => {
        const byIdentity = new Map<string, ProfessorWithTerms<T>>();

        for (const { term, rows } of termRows) {
            for (const professor of rows) {
                const identity = normalizeProfessorIdentity(professor);
                if (!identity) continue;

                const existing = byIdentity.get(identity);
                if (existing) {
                    if (!existing.terms.includes(term)) {
                        existing.terms.push(term);
                    }
                    continue;
                }

                byIdentity.set(identity, {
                    ...professor,
                    terms: [term],
                });
            }
        }

        return sortProfessorRows(Array.from(byIdentity.values()));
    });

    return allProfessorsPromiseCache as Promise<Array<ProfessorWithTerms<T>>>;
}

type TermDataState<T> = {
    data: T[] | null;
    loading: boolean;
    error: string | null;
};

function useTermDataLoader<T>(
    term: TermSlug,
    load: (term: TermSlug) => Promise<T[]>,
): TermDataState<T> {
    const [state, setState] = useState<TermDataState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;
            setState({
                data: null,
                loading: true,
                error: null,
            });
        });

        load(term)
            .then((rows) => {
                if (cancelled) return;
                setState({
                    data: rows,
                    loading: false,
                    error: null,
                });
            })
            .catch((error) => {
                if (cancelled) return;
                setState({
                    data: [],
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to load term data.",
                });
            });

        return () => {
            cancelled = true;
        };
    }, [term, load]);

    return state;
}

export function useTermSections<T>(term: TermSlug): TermDataState<T> {
    return useTermDataLoader(term, loadSectionsForTerm<T>);
}

export function useTermProfessors<T>(term: TermSlug): TermDataState<T> {
    return useTermDataLoader(term, loadProfessorsForTerm<T>);
}

export function useAllProfessors<T extends ProfessorLike>(): TermDataState<ProfessorWithTerms<T>> {
    const [state, setState] = useState<TermDataState<ProfessorWithTerms<T>>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        loadAllProfessors<T>()
            .then((rows) => {
                if (cancelled) return;
                setState({
                    data: rows,
                    loading: false,
                    error: null,
                });
            })
            .catch((error) => {
                if (cancelled) return;
                setState({
                    data: [],
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to load professor data.",
                });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
