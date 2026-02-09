'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

export default function Header() {
    const router = useRouter();
    const pathname = usePathname();

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
                <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <Link
                        href="/"
                        className="text-3xl font-bold tracking-tight hover:opacity-70 transition text-[#0f172a]"
                    >
                        SBCCPlan
                    </Link>

                    <SearchBar />

                    <nav className="flex items-center gap-6 font-medium text-sm md:text-base text-slate-600">
                        <Link href="/classes" className="hover:text-[#0f172a] transition">Classes</Link>
                        <Link href="/professors" className="hover:text-[#0f172a] transition">Professors</Link>
                        <Link href="/planner" className="hover:text-[#0f172a] transition">Planner</Link>
                        <Link href="/about" className="hover:text-[#0f172a] transition">About</Link>
                    </nav>
                </div>
            </header>

            {pathname !== "/" && (
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <button
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
