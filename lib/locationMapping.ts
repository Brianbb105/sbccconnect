const BUILDING_CODE_TO_NAME: Record<string, string> = {
    A: "Administration",
    BC: "Business/Communications",
    "BIKE SHOP": "Bike Shop",
    BKSHOP: "Bike Shop",
    BNC: "East Campus Classrooms",
    C: "365 Loma Alta Drive",
    "CAMPUS SAFETY": "Campus Safety Office",
    CC: "Campus Center",
    CLRC: "Cartwright Learning Resources Center",
    CS: "Campus Store",
    DAN: "ECC 4",
    DM: "Drama/Music",
    EBS: "Earth & Biological Sciences",
    ECC: "East Campus Classrooms",
    "ECOC 1": "East Campus Office Center I",
    "ECOC 2": "East Campus Office Center II",
    "ECOC 3": "East Campus Office Center III",
    "ECOC-2": "East Campus Office Center II",
    "ECOC-3": "East Campus Office Center III",
    FO: "Facilities and Operations",
    GDR: "School of Culinary Arts",
    GT: "Garvin Theatre",
    H: "Humanities",
    IDC: "Interdisciplinary Center",
    IE: "International Education Center",
    JSB: "School of Culinary Arts",
    L: "Luria Library",
    "LA PLAYA": "La Playa Stadium",
    LCP: "Luria Conference/Press Center",
    LFC: "Campus Store",
    LPLAYA: "La Playa Stadium",
    LRC: "Luria Library",
    MDT: "Marine Diving Technologies",
    MTBLDG: "Marine Diving Technologies",
    OE: "Administration",
    PE: "Sports Pavilion",
    PS: "Physical Science",
    SCA: "School of Culinary Arts",
    SS: "Student Services",
    WCC: "West Campus Center",
    WCSS: "Business Communication",
};

const EXACT_LOCATION_ALIASES: Record<string, string> = {
    "LFC LFC": "Campus Store",
    PLNTRM: "Planetarium",
};

const NO_MAP_LOCATION_VALUES = new Set(["", "TBA", "UNKNOWN", "CHECK LINK", "STAFF", "SBFF"]);

const SORTED_CODES = Object.keys(BUILDING_CODE_TO_NAME).sort((a, b) => b.length - a.length);

function cleanLocation(value?: string) {
    return String(value || "").trim().replace(/\s+/g, " ");
}

function toLookupKey(value?: string) {
    return cleanLocation(value).toUpperCase();
}

export function getDisplayLocation(location?: string) {
    const cleaned = cleanLocation(location);
    if (!cleaned) return "";

    const exactAlias = EXACT_LOCATION_ALIASES[toLookupKey(cleaned)];
    if (exactAlias) return exactAlias;

    const normalized = toLookupKey(cleaned);
    for (const code of SORTED_CODES) {
        const mappedBuilding = BUILDING_CODE_TO_NAME[code];
        if (normalized === code) return mappedBuilding;
        if (normalized.startsWith(`${code} `) || normalized.startsWith(`${code}-`)) {
            const remainder = cleaned.slice(code.length).replace(/^[\s-]+/, "").trim();
            if (!remainder || toLookupKey(remainder) === code) return mappedBuilding;
            return `${mappedBuilding} ${remainder}`;
        }
    }

    return cleaned;
}

export function buildSbccGoogleMapsUrl(location?: string) {
    const mappedLocation = getDisplayLocation(location);
    const normalized = toLookupKey(mappedLocation);
    if (NO_MAP_LOCATION_VALUES.has(normalized)) return "";
    if (/(ONLINE|ZOOM|WEB|REMOTE|HOURS\/WEEK)/i.test(normalized)) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mappedLocation} Santa Barbara City College Santa Barbara CA`)}`;
}
