import Link from "next/link";
import professors from "../data/202650/professors.json";

type Professor = {
    displayName: string;
    key: string;
};

export default function ProfessorsPage() {
    const list = professors as Professor[];

    return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>Professors</h1>

            <p style={{ opacity: 0.85, marginTop: 0 }}>
                Spring 2026 • {list.length} instructor(s)
            </p>

            {/* Simple client-side search without making this a client page:
          We’ll do a super-light approach using the browser’s built-in find first.
          If you want real live filtering, tell me and we’ll convert this to a client component. */}
            <div
                style={{
                    marginTop: 14,
                    padding: 12,
                    border: "1px solid #333",
                    borderRadius: 12,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Tip</div>
                <div style={{ opacity: 0.9 }}>
                    Use <b>Cmd + F</b> to search names on this page.
                </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                {list.map((p) => (
                    <div
                        key={p.key}
                        style={{
                            border: "1px solid #333",
                            borderRadius: 12,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 700 }}>{p.displayName}</div>
                            <div style={{ opacity: 0.8, fontSize: 13 }}>{p.key}</div>
                        </div>

                        <Link
                            href={`/professor/${encodeURIComponent(p.displayName)}`}
                            style={{ textDecoration: "underline" }}
                        >
                            View →
                        </Link>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 18 }}>
                <Link href="/classes" style={{ textDecoration: "underline" }}>
                    ← Back to classes
                </Link>
            </div>
        </main>
    );
}
