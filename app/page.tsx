import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
    // Theme Colors
    const warmBg = "bg-[#FEFDF5]";
    const darkBlueText = "text-[#0f172a]";

    return (
        <div className={`min-h-screen ${warmBg} flex flex-col font-sans text-slate-800`}>
            <Header />

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 space-y-12">

                {/* HERO SECTION: Split Grid */}
                <section className="grid md:grid-cols-2 gap-6">

                    {/* LEFT COLUMN: Welcome Card (Anchors the layout) */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-center items-start hover:shadow-md transition-shadow h-full">
                        <h2 className={`text-3xl font-bold ${darkBlueText} mb-6`}>Welcome to SBCCPlan</h2>
                        <p className="text-slate-600 text-lg leading-relaxed mb-6">
                            The unofficial, student-built website to browse classes and see your professors.
                        </p>
                        <p className="text-slate-500 leading-relaxed">
                            With a clear UI, it is class planning, completely reimagined for the modern student.
                        </p>
                        <p className="text-slate-500 leading-relaxed">
                           THIS WEBSITE IS NOT AFFILIATED WITH SBCC.
                        </p>
                    </div>

                    {/* RIGHT COLUMN: Stacked Cards (Browse + Popular) */}
                    <div className="flex flex-col gap-6">

                        {/* 1. NEW BROWSE ACTIONS CARD (Top Right) */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow flex flex-col justify-center">
                            <h2 className={`text-xl font-semibold mb-6 ${darkBlueText}`}>Spring 2026</h2>

                            {/* The "Two sub-sub tags" as big buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 w-full">
                                <Link
                                    href="/classes?term=spring2026"
                                    className="home-tab flex-1 bg-white border-2 border-[#0f172a] text-[#0f172a] py-4 px-6 rounded-2xl font-bold text-center hover:bg-[#0f172a] hover:text-white transition-all hover:-translate-y-1"
                                >
                                    Browse All Courses
                                </Link>
                                <Link
                                    href="/professors"
                                    className="home-tab flex-1 bg-white border-2 border-[#0f172a] text-[#0f172a] py-4 px-6 rounded-2xl font-bold text-center hover:bg-[#0f172a] hover:text-white transition-all hover:-translate-y-1"
                                >
                                    Browse All Professors
                                </Link>
                            </div>
                        </div>

                        {/* 2. POPULAR SUBJECTS (Moved Down) */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                            <h2 className={`text-lg font-semibold mb-4 ${darkBlueText}`}>Popular Subjects</h2>
                            <div className="flex flex-wrap justify-center items-center gap-2">
                                <Link href="/classes" className="home-tab px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:bg-[#0f172a] hover:text-white transition-colors">
                                    ALL
                                </Link>
                                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                                {['CS', 'MATH', 'ENG', 'PHYS','ART','COMM','BIOL','CHEM','ECON','ACCT'].map((subject) => (
                                    <Link
                                        key={subject}
                                        href={`/classes/${subject}`}
                                        className="home-tab px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:bg-[#0f172a] hover:text-white transition-colors"
                                    >
                                        {subject}
                                    </Link>
                                ))}
                            </div>
                        </div>

                    </div>
                </section>

                {/* Bottom Section: Developer & Feedback */}
                <section className="grid md:grid-cols-2 gap-6">
                    <InfoCard
                        title="Developer"
                        content="Built by a CS Student. Click to see more about the developer and the story of building the website."
                        href="/about"
                    />
                    <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSfzoOHiXmPlOsgrFFCU5DyMayWZOP2TxavUMkZ0jxfCp7b3bA/viewform?usp=dialog"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-2 border-slate-100 rounded-2xl p-6 text-center hover:border-[#0f172a] transition-colors cursor-pointer bg-white group"
                    >
                        <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-[#0f172a] transition-colors">Give me feedback</h3>
                        <p className="text-slate-500">Help me make this website better. Click here to put your feedback.</p>
                    </a>
                </section>

            </main>
        </div>
    );
}

function InfoCard({ title, content, href }: { title: string, content: string, href?: string }) {
    const card = (
        <div className="border-2 border-slate-100 rounded-2xl p-6 text-center hover:border-[#0f172a] transition-colors cursor-pointer bg-white h-full">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-500">{content}</p>
        </div>
    );

    if (href) {
        return <Link href={href} className="block h-full">{card}</Link>;
    }

    return card;
}

