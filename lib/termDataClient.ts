"use client";

import { useEffect, useState } from "react";
import type { TermSlug } from "@/lib/terms";

type JsonArrayModule<T> = { default: T[] };

type LoaderMap = Record<TermSlug, () => Promise<JsonArrayModule<unknown>>>;

const SECTION_LOADERS: LoaderMap = {
    fall2024: () => import("@/app/data/202530/sections.json"),
    spring2025: () => import("@/app/data/202550/sections.json"),
    summer2025: () => import("@/app/data/202610/sections.json"),
    fall2025: () => import("@/app/data/202630/sections.json"),
    spring2026: () => import("@/app/data/202650/sections.json"),
};

const PROFESSOR_LOADERS: LoaderMap = {
    fall2024: () => import("@/app/data/202530/professors.json"),
    spring2025: () => import("@/app/data/202550/professors.json"),
    summer2025: () => import("@/app/data/202610/professors.json"),
    fall2025: () => import("@/app/data/202630/professors.json"),
    spring2026: () => import("@/app/data/202650/professors.json"),
};

const sectionPromiseCache = new Map<TermSlug, Promise<unknown[]>>();
const professorPromiseCache = new Map<TermSlug, Promise<unknown[]>>();

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

        setState((prev) => ({
            data: null,
            loading: true,
            error: null,
        }));

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
