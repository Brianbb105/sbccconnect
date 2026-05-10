type SBCCPlanLogoProps = {
    className?: string;
    iconClassName?: string;
};

export default function SBCCPlanLogo({
    className = "",
    iconClassName = "h-12 w-12",
}: SBCCPlanLogoProps) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 64 64"
            className={`shrink-0 ${iconClassName} ${className}`}
        >
            <defs>
                <linearGradient id="sbcc-logo-bg" x1="9" y1="8" x2="55" y2="56" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8068ff" />
                    <stop offset="0.55" stopColor="#2f75d6" />
                    <stop offset="1" stopColor="#1fb6aa" />
                </linearGradient>
                <linearGradient id="sbcc-logo-paper" x1="20" y1="15" x2="42" y2="49" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" />
                    <stop offset="1" stopColor="#f8fbff" />
                </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="17" fill="url(#sbcc-logo-bg)" />
            <rect x="18" y="14" width="28" height="36" rx="8" fill="url(#sbcc-logo-paper)" />
            <path d="M25 34.5 30.2 39.8 40 28" stroke="#a6192e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    );
}
