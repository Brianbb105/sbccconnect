import Image from "next/image";
import Header from "@/components/Header";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#FEFDF5] font-sans text-slate-800">
            <Header />
            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 md:p-10">
                    <div className="grid md:grid-cols-[280px,1fr] gap-8 items-start">
                        <div className="mx-auto md:mx-0 w-full max-w-[280px] rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
                            <Image
                                src="/brian-profile.svg"
                                alt="Brian profile photo"
                                width={280}
                                height={280}
                                className="w-full h-auto block"
                                priority
                            />
                        </div>

                        <div>
                            <h1 className="text-3xl font-bold text-[#0f172a]">About Brian</h1>

                            <p className="text-slate-600 mt-4 leading-relaxed">
                                Hi! I&apos;m Brian - a CS student at SBCC and the person behind this website. I built
                                it because I kept feeling like finding the right class (and figuring out who&apos;s
                                teaching it) takes way more time than it should. So this is my attempt to make browsing
                                courses and professors faster, cleaner, and less stressful - like everything you need
                                in one place.
                            </p>

                            <p className="text-slate-600 mt-4 leading-relaxed">
                                I&apos;m really into coding and AI, and I love the feeling of turning an idea into
                                something real that people can actually use. Outside of school, I&apos;m usually working
                                out, singing, or taking photos. I&apos;m also the kind of person who gets curious about
                                random details and likes optimizing things, which is probably why I enjoy building
                                projects like this.
                            </p>

                            <p className="text-slate-600 mt-4 leading-relaxed">
                                If you&apos;re using the site and have feedback or ideas, I&apos;m always happy to hear them.
                            </p>

                            <p className="text-slate-600 mt-4 leading-relaxed">
                                Website:{" "}
                                <a
                                    href="https://www.brianwumutijiang.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-blue-700 hover:underline"
                                >
                                    www.brianwumutijiang.com
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-3">
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
                </div>
            </main>
        </div>
    );
}
