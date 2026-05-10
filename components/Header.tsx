'use client'

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import SBCCPlanLogo from "@/components/SBCCPlanLogo";
import { appendTermToHref, getTermFromSearchParams } from "@/lib/terms";

const THEME_STORAGE_KEY = "sbcc-theme-preference";

type ThemePreference = "light" | "dark" | "auto";

function isThemePreference(value: string): value is ThemePreference {
    return value === "light" || value === "dark" || value === "auto";
}

function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = theme === "dark" || (theme === "auto" && prefersDark) ? "dark" : "light";
    const useDark = resolvedTheme === "dark";

    root.dataset.theme = theme;
    root.dataset.themeResolved = resolvedTheme;
    root.classList.toggle("theme-dark", useDark);
    root.style.colorScheme = useDark ? "dark" : "only light";
}

function getInitialTheme(): ThemePreference {
    if (typeof window === "undefined") return "light";

    const rootTheme = document.documentElement.dataset.theme;
    if (rootTheme && isThemePreference(rootTheme)) {
        return rootTheme;
    }

    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored && isThemePreference(stored)) {
            return stored;
        }
    } catch {}

    return "light";
}

export default function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);

    useEffect(() => {
        applyTheme(theme);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {}
    }, [theme]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemThemeChange = () => {
            if (document.documentElement.dataset.theme === "auto") {
                applyTheme("auto");
            }
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleSystemThemeChange);
        } else {
            mediaQuery.addListener(handleSystemThemeChange);
        }

        return () => {
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", handleSystemThemeChange);
            } else {
                mediaQuery.removeListener(handleSystemThemeChange);
            }
        };
    }, []);

    const handleThemeChange = (nextTheme: ThemePreference) => {
        setTheme(nextTheme);
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/");
    };

    return (
        <>
            <header className="bg-white text-slate-800 shadow-sm border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
                    <Link
                        href="/"
                        data-track="header_logo"
                        className="hidden md:block text-3xl font-bold tracking-tight hover:opacity-70 transition text-[#0f172a]"
                    >
                        SBCCPlan
                    </Link>

                    <div className="flex w-full items-center gap-3 md:flex-1 md:max-w-xl">
                        <Link
                            href="/"
                            data-track="header_mobile_logo"
                            aria-label="SBCCPlan home"
                            className="md:hidden rounded-2xl transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            <SBCCPlanLogo iconClassName="h-11 w-11" />
                        </Link>
                        <Suspense fallback={<div className="flex-1 max-w-xl w-full" />}>
                            <SearchBar />
                        </Suspense>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
                        <Suspense fallback={<HeaderNavLinksFallback />}>
                            <HeaderNavLinks />
                        </Suspense>

                        <label className="sr-only" htmlFor="theme-select">Theme</label>
                        <div className="relative">
                            <select
                                id="theme-select"
                                value={theme}
                                suppressHydrationWarning
                                onChange={(event) => handleThemeChange(event.target.value as ThemePreference)}
                                className="px-4 pr-10 h-10 rounded-full font-bold transition-all text-sm bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0f172a] border border-slate-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="auto">Auto</option>
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                                ▾
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {pathname !== "/" && (
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <button
                        data-track="back_button"
                        onClick={handleBack}
                        className="px-4 h-10 rounded-full font-bold transition-all text-sm bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0f172a] border border-slate-200"
                    >
                        ← Go Back
                    </button>
                </div>
            )}
        </>
    );
}

function HeaderNavLinks() {
    const searchParams = useSearchParams();
    const currentTerm = getTermFromSearchParams(searchParams);

    return (
        <nav className="flex items-center gap-4 md:gap-6 font-medium text-sm md:text-base text-slate-600">
            <Link href={appendTermToHref("/classes", currentTerm.slug)} data-track="nav_classes" className="hover:text-[#0f172a] transition">Classes</Link>
            <Link href={appendTermToHref("/professors", currentTerm.slug)} data-track="nav_professors" className="hover:text-[#0f172a] transition">Professors</Link>
            <Link href="/planner" data-track="nav_planner" className="hover:text-[#0f172a] transition">Planner</Link>
            <Link href="/about" data-track="nav_about" className="hover:text-[#0f172a] transition">About</Link>
        </nav>
    );
}

function HeaderNavLinksFallback() {
    return (
        <nav className="flex items-center gap-4 md:gap-6 font-medium text-sm md:text-base text-slate-600">
            <Link href="/classes" data-track="nav_classes" className="hover:text-[#0f172a] transition">Classes</Link>
            <Link href="/professors" data-track="nav_professors" className="hover:text-[#0f172a] transition">Professors</Link>
            <Link href="/planner" data-track="nav_planner" className="hover:text-[#0f172a] transition">Planner</Link>
            <Link href="/about" data-track="nav_about" className="hover:text-[#0f172a] transition">About</Link>
        </nav>
    );
}
