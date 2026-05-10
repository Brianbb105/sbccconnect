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
            { url: '/sbccplan-logo.svg', type: 'image/svg+xml' },
        ],
        shortcut: ['/sbccplan-logo.svg'],
        apple: [
            { url: '/sbccplan-logo.svg', type: 'image/svg+xml' },
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
        <Analytics />
        </body>
        </html>
    )
}
