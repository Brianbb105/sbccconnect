export default async function ProfessorPage({
                                                params,
                                            }: {
    params: Promise<{ name: string }>;
}) {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);
    const rmpQuery = encodeURIComponent(`${decodedName} Santa Barbara City College`);

    return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>{decodedName}</h1>

            <a
                href={`https://www.ratemyprofessors.com/search/professors/0?q=${rmpQuery}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline" }}
            >
                Search on RateMyProfessors →
            </a>

            <div style={{ marginTop: 18 }}>
                <a href="/classes" style={{ textDecoration: "underline" }}>
                    ← Back to classes
                </a>
            </div>
        </main>
    );
}

