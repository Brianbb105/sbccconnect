import './globals.css' // <--- MAKE SURE THIS LINE EXISTS AT THE TOP

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
  const useDark = theme === 'dark' || (theme === 'auto' && prefersDark);

  root.dataset.theme = theme;
  root.classList.toggle('theme-dark', useDark);
  root.style.colorScheme = useDark ? 'dark' : 'light';
})();
`;

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
        <html lang="en" suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>{children}</body>
        </html>
    )
}
