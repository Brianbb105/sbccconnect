import './globals.css' // <--- MAKE SURE THIS LINE EXISTS AT THE TOP

export const metadata = {
    title: 'SBCCPlan',
    description: 'SBCC Student Dashboard',
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
        <body>{children}</body>
        </html>
    )
}