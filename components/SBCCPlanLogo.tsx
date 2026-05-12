import Image from "next/image";

type SBCCPlanLogoProps = {
    className?: string;
    iconClassName?: string;
};

export default function SBCCPlanLogo({
    className = "",
    iconClassName = "h-12 w-12",
}: SBCCPlanLogoProps) {
    return (
        <Image
            src="/sbccplan-logo.png"
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            className={`shrink-0 object-contain ${iconClassName} ${className}`}
        />
    );
}
