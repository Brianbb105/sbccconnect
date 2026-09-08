"use client";

import { useEffect, useState } from "react";

const responses = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const MAX_CACHED_RESPONSES = 40;

export function loadPlannerResource<T>(url: string): Promise<T> {
    if (responses.has(url)) return Promise.resolve(responses.get(url) as T);
    const existing = pending.get(url);
    if (existing) return existing as Promise<T>;

    const request = fetch(url)
        .then(async (response) => {
            if (!response.ok) throw new Error("We couldn't load this selection. Please try again.");
            const data: unknown = await response.json();
            responses.set(url, data);
            if (responses.size > MAX_CACHED_RESPONSES) {
                responses.delete(responses.keys().next().value!);
            }
            pending.delete(url);
            return data;
        })
        .catch((error: unknown) => {
            // A failed request must be retryable, rather than cached for the session.
            pending.delete(url);
            throw error;
        });
    pending.set(url, request);
    return request as Promise<T>;
}

export function usePlannerResource<T>(url: string | null) {
    const [state, setState] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!url) return;
        let active = true;
        loadPlannerResource<T>(url).then(
            (data) => { if (active) setState({ url, data, error: null }); },
            (error: unknown) => {
                if (active) setState({ url, data: null, error: error instanceof Error ? error.message : "Please try again." });
            },
        );
        return () => { active = false; };
    }, [url, attempt]);

    // Key results to the selection: a slow response for a previous school or major
    // must never appear under the new selection, even before the effect runs.
    const data = url ? (responses.get(url) as T | undefined) ?? (state?.url === url ? state.data : null) : null;
    const error = url && state?.url === url ? state.error : null;
    return {
        data,
        error,
        loading: Boolean(url && !data && !error),
        retry: () => {
            setState(null);
            setAttempt((value) => value + 1);
        },
    };
}
