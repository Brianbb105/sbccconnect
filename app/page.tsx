import Link from "next/link";

export default function HomePage() {
    return (
        <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 800, margin: "0 auto" }}>

            {/* Title Section */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, marginBottom: 8 }}>SBCC Connect</h1>
                <p style={{ opacity: 0.85, marginTop: 0 }}>
                    Spring 2026 • Select a category below to get started.
                </p>
            </div>

            {/* Navigation Cards Container */}
            <div style={{ display: "grid", gap: 16 }}>

                {/* Card 1: Classes */}
                <Link href="/classes" style={{ textDecoration: "none", color: "inherit" }}>
                    <div
                        style={{
                            border: "1px solid #333",
                            borderRadius: 12,
                            padding: 24, // Bigger padding for the "Big Rectangle" feel
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                        }}
                        // Optional: Simple hover effect using onMouseOver/Out if you move to client component,
                        // but standard CSS in a global file is usually better for hovers.
                        // For now, this is clean and static.
                    >
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                                Classes
                            </div>
                            <div style={{ opacity: 0.8 }}>
                                Browse sections, times, and availability
                            </div>
                        </div>

                        <div style={{ fontSize: 18, fontWeight: 500 }}>
                            View →
                        </div>
                    </div>
                </Link>

                {/* Card 2: Professors */}
                <Link href="/professors" style={{ textDecoration: "none", color: "inherit" }}>
                    <div
                        style={{
                            border: "1px solid #333",
                            borderRadius: 12,
                            padding: 24,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                                Professors
                            </div>
                            <div style={{ opacity: 0.8 }}>
                                Find instructor contact info and details
                            </div>
                        </div>

                        <div style={{ fontSize: 18, fontWeight: 500 }}>
                            View →
                        </div>
                    </div>
                </Link>

            </div>
        </main>
    );
}