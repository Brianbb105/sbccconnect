'use client';

import Link from "next/link";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { appendTermToHref, getDefaultTermSlug } from "@/lib/terms";

const ANNOUNCEMENT_STORAGE_KEY = "sbccplan-announcement-grade-distribution-assist-v1";
const ANNOUNCEMENT_CHANGE_EVENT = "sbccplan-announcement-change";

let dismissedInMemory = false;

function getAnnouncementSnapshot() {
    if (typeof window === "undefined" || dismissedInMemory) {
        return false;
    }

    try {
        return window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) !== "dismissed";
    } catch {
        return false;
    }
}

function getServerSnapshot() {
    return false;
}

function subscribeToAnnouncement(callback: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener("storage", callback);
    window.addEventListener(ANNOUNCEMENT_CHANGE_EVENT, callback);

    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(ANNOUNCEMENT_CHANGE_EVENT, callback);
    };
}

export default function AnnouncementModal() {
    const isOpen = useSyncExternalStore(
        subscribeToAnnouncement,
        getAnnouncementSnapshot,
        getServerSnapshot,
    );

    const dismissAnnouncement = useCallback(() => {
        dismissedInMemory = true;

        try {
            window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, "dismissed");
        } catch {}

        window.dispatchEvent(new Event(ANNOUNCEMENT_CHANGE_EVENT));
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                dismissAnnouncement();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [dismissAnnouncement, isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
            role="presentation"
        >
            <section
                aria-labelledby="announcement-title"
                aria-modal="true"
                className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
                role="dialog"
            >
                <button
                    aria-label="Close announcement"
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    data-track="announcement_close"
                    onClick={dismissAnnouncement}
                    type="button"
                >
                    <span aria-hidden="true" className="relative h-4 w-4">
                        <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
                        <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
                    </span>
                </button>

                <div className="pr-12">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-red-700">
                        New on SBCCPlan
                    </p>
                    <h2 id="announcement-title" className="text-2xl font-bold leading-tight text-[#0f172a] sm:text-3xl">
                        Plan smarter with grade data and transfer maps
                    </h2>
                    <p className="mt-4 text-base leading-7 text-slate-600">
                        SBCCPlan now includes historical grade distribution details and a beta transfer planner built
                        from cached ASSIST.org articulation agreements.
                    </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-800">Grade distribution</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Open a section page to compare instructor-by-course grade outcomes from previous terms.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-800">Transfer planner</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Pick a school and major to browse SBCC course matches from ASSIST agreements.
                        </p>
                    </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link
                        className="flex-1 rounded-2xl border-2 border-[#0f172a] bg-[#0f172a] px-5 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                        data-track="announcement_browse_classes"
                        href={appendTermToHref("/classes", getDefaultTermSlug())}
                        onClick={dismissAnnouncement}
                    >
                        Browse classes
                    </Link>
                    <Link
                        className="flex-1 rounded-2xl border-2 border-red-700 bg-white px-5 py-3 text-center text-sm font-bold text-red-700 transition hover:-translate-y-0.5 hover:bg-red-50"
                        data-track="announcement_open_planner"
                        href="/planner"
                        onClick={dismissAnnouncement}
                    >
                        Open planner
                    </Link>
                </div>
            </section>
        </div>
    );
}
