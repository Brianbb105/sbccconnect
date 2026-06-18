import Image from "next/image";
import Header from "@/components/Header";

const gradeDistributionSourceUrl = "https://drive.google.com/file/d/14PA08lbndnpFWiJiHnBzkGk-q2J2TXfB/view?usp=sharing";

type AboutSection = {
    title: string;
    paragraphs: readonly string[];
    sourceLink?: {
        prefix: string;
        href: string;
        label: string;
    };
};

const aboutSections: readonly AboutSection[] = [
    {
        title: "About SBCCPlan",
        paragraphs: [
            "SBCCPlan is an unofficial, student-built website that helps SBCC students browse courses, professors, schedules, grade distributions, and planning tools — all in one place.",
            "I started building it because course planning felt more complicated than it needed to be. Finding the right class usually meant jumping between multiple tabs just to compare options, check a professor, and see what fit your schedule. SBCCPlan is my attempt to make that process simpler and more student-friendly.",
        ],
    },
    {
        title: "About Planner",
        paragraphs: [
            "The Planner helps students explore transfer requirements and UC articulation agreements. Data is sourced from ASSIST.org and organized to make transfer pathways easier to browse and understand.",
            "This feature is currently in beta — some information may be incomplete, outdated, or inaccurate. Always verify important transfer requirements through ASSIST.org, official college resources, and an academic counselor before making final decisions. The Planner is meant to make planning easier, not to replace official advising.",
        ],
    },

    {
        title: "About Class Schedule",
        paragraphs: [
            "The Class Schedule lets students browse SBCC courses in a cleaner, more organized way. Data comes from SBCC's official class schedule and updates approximately every 10 minutes.",
            "During registration, availability can change quickly — always confirm with the official SBCC registration system before making any decisions.",
        ],
    },
    {
        title: "About Professors",
        paragraphs: [
            "The Professors section shows instructor information alongside available course sections. Names and assignments are based on SBCC's official schedule data.",
            "Ratings and reviews come from Rate My Professors and are included as third-party reference only — they don't reflect my personal opinions.",
        ],
    },
    {
        title: "About Grade Distribution",
        paragraphs: [
            "The Grade Distribution feature is built from official data provided by SBCC through a California Public Records Act request I filed on April 7, 2026. The data was received on June 5, 2026.",
            "This data comes directly from SBCC — nothing has been modified or estimated. To protect student privacy, sections with fewer than 20 students may not be displayed, and individual letter-grade counts may be hidden when fewer than 10 students received that grade. SBCC Plan does not attempt to reverse-calculate any masked information.",
            "Grade distribution data isn't something SBCC students have had easy access to before. My goal is to make historical course outcomes more transparent while still respecting privacy.",
            "Currently the feature covers Spring 2025, Summer 2025, and Fall 2025. I plan to add earlier terms over time. Use this as one helpful reference when choosing classes — not the only one.",
        ],
        sourceLink: {
            prefix: "The original data is available here:",
            href: gradeDistributionSourceUrl,
            label: "View the original grade distribution data",
        },
    },
] as const;

const developerParagraphs = [
    "SBCCPlan was built by Brian Wumutijiang, a second-year Computer Science student at Santa Barbara City College.",
    "At SBCC, I work as a tutor and teaching assistant for math and CS courses, and also help students at the Learning Resources Center. Through those roles I've seen firsthand how much students need clearer tools for planning, registration, and transfer prep — and that's what keeps me motivated to keep building this.",
    "Outside of school and coding, I enjoy singing, working out, photography, and working on projects that make student life a little easier.",
] as const;

function AboutCard({ title, paragraphs, sourceLink }: AboutSection) {
    return (
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 md:p-10">
            <h1 className="text-2xl md:text-3xl font-bold text-[#0f172a]">{title}</h1>
            <div className="mt-5 space-y-4">
                {paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-slate-600 leading-relaxed">
                        {paragraph}
                    </p>
                ))}
                {sourceLink ? (
                    <p className="text-slate-600 leading-relaxed">
                        {sourceLink.prefix}{" "}
                        <a
                            href={sourceLink.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                        >
                            {sourceLink.label}
                        </a>
                    </p>
                ) : null}
            </div>
        </section>
    );
}

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            <Header />
            <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
                {aboutSections.map((section) => (
                    <AboutCard
                        key={section.title}
                        title={section.title}
                        paragraphs={section.paragraphs}
                        sourceLink={section.sourceLink}
                    />
                ))}

                <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 md:p-10">
                    <div className="grid md:grid-cols-[220px,1fr] gap-8 items-start">
                        <div className="mx-auto md:mx-0 w-full max-w-[220px]">
                            <div className="relative mx-auto h-[180px] w-[180px] rounded-full bg-gradient-to-br from-sky-200 via-blue-100 to-indigo-200 p-1 shadow-lg md:h-[220px] md:w-[220px]">
                                <div className="relative h-full w-full overflow-hidden rounded-full border border-white/80 bg-white">
                                    <Image
                                        src="/brian-personal.png"
                                        alt="Brian profile photo"
                                        fill
                                        sizes="(min-width: 768px) 220px, 180px"
                                        className="object-cover object-[center_30%]"
                                        priority
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-[#0f172a]">About the Developer</h1>

                            <div className="mt-5 space-y-4">
                                {developerParagraphs.map((paragraph) => (
                                    <p key={paragraph} className="text-slate-600 leading-relaxed">
                                        {paragraph}
                                    </p>
                                ))}
                            </div>

                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-3">
                        <a
                            href="https://www.brianwumutijiang.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="max-w-full break-all rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-center font-semibold text-sky-700 transition-colors hover:border-sky-600 hover:bg-sky-600 hover:text-white"
                        >
                            brianwumutijiang.com
                        </a>
                        <a
                            href="https://www.linkedin.com/in/brian-wumutijiang-00318430b/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                        >
                            LinkedIn
                        </a>
                        <a
                            href="https://www.instagram.com/brian_wumutijiang/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 font-semibold hover:bg-fuchsia-600 hover:text-white hover:border-fuchsia-600 transition-colors"
                        >
                            Instagram
                        </a>
                        <a
                            href="mailto:ywumutijiang@pipeline.sbcc.edu"
                            className="px-4 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                        >
                            ywumutijiang@pipeline.sbcc.edu
                        </a>
                    </div>
                </section>
            </main>
        </div>
    );
}
