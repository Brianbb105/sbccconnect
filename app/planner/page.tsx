import Header from "@/components/Header";

export default function PlannerPage() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-[#0f172a]">Planner</h1>
                    <p className="text-slate-600 mt-4 leading-relaxed">
                        This page is still a work under progress.
                    </p>
                    <p className="text-slate-500 mt-3 leading-relaxed">
                        This placeholder keeps the same header, spacing, and color system as the rest of SBCCPlan.
                    </p>
                </div>
            </main>
        </div>
    );
}
