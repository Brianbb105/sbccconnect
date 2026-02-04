// app/layout.tsx
import "./globals.css";

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body>
        <header className="topbar">
            <div className="container topbarInner">
                <div className="brand">SBCC Connect</div>
                <nav className="nav">
                    <a href="/">Home</a>
                    <a href="/classes">Classes</a>
                    <a href="/professors">Professors</a>
                </nav>
            </div>
        </header>

        <main className="container page">{children}</main>
        </body>
        </html>
    );
}
