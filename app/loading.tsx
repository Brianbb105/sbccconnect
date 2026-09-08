import Header from "@/components/Header";

export default function Loading() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />
            <main className="mx-auto max-w-6xl px-6 py-12" aria-busy="true">
                <p role="status" className="text-lg font-semibold text-slate-600">Loading page…</p>
                <div aria-hidden="true" className="mt-6 h-48 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
            </main>
        </div>
    );
}
