import './globals.css' // <--- MAKE SURE THIS LINE EXISTS AT THE TOP
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { Analytics } from "@vercel/analytics/react"

const themeInitScript = `
(() => {
  const storageKey = 'sbcc-theme-preference';
  const validThemes = ['light', 'dark', 'auto'];
  const root = document.documentElement;
  let theme = 'light';

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    if (storedTheme && validThemes.includes(storedTheme)) {
      theme = storedTheme;
    }
  } catch {}

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = theme === 'dark' || (theme === 'auto' && prefersDark) ? 'dark' : 'light';
  const useDark = resolvedTheme === 'dark';

  root.dataset.theme = theme;
  root.dataset.themeResolved = resolvedTheme;
  root.classList.toggle('theme-dark', useDark);
  root.style.colorScheme = useDark ? 'dark' : 'only light';
})();
`;

export const metadata = {
    title: 'SBCCPlan',
    description: 'SBCC Student Dashboard',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/sbccplan-logo.png', type: 'image/png', sizes: '512x512' },
            { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        ],
        shortcut: ['/favicon.ico'],
        apple: [
            { url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
        ],
    },
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
        <AnalyticsTracker />
        {children}
        <footer className="bg-gray-50 px-6 pb-8 pt-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            THIS WEBSITE IS NOT AFFILIATED WITH SBCC.
        </footer>
        <Analytics />
        </body>
        </html>
    )
}
