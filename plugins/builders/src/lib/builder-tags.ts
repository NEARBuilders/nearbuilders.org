export const LOCATION_ERROR = 'Enter a country, "City, Country", or Remote';

export type ResolvedLocation = { ok: true; value: string | null } | { ok: false };

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Côte d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
] as const;

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "united states of america": "United States",
  america: "United States",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  "northern ireland": "United Kingdom",
  uae: "United Arab Emirates",
  emirates: "United Arab Emirates",
  korea: "South Korea",
  "republic of korea": "South Korea",
  dprk: "North Korea",
  "russian federation": "Russia",
  "czech republic": "Czechia",
  turkiye: "Turkey",
  holland: "Netherlands",
  "the netherlands": "Netherlands",
  burma: "Myanmar",
  "ivory coast": "Côte d'Ivoire",
  drc: "Democratic Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo",
  "congo kinshasa": "Democratic Republic of the Congo",
  "republic of the congo": "Congo",
  "congo brazzaville": "Congo",
  swaziland: "Eswatini",
  "cape verde": "Cabo Verde",
  "east timor": "Timor-Leste",
  macedonia: "North Macedonia",
  vatican: "Vatican City",
  "holy see": "Vatican City",
  "viet nam": "Vietnam",
  "lao pdr": "Laos",
  "the bahamas": "Bahamas",
  "the gambia": "Gambia",
  "hong kong sar": "Hong Kong",
  macao: "Macau",
  ksa: "Saudi Arabia",
  brasil: "Brazil",
  deutschland: "Germany",
  espana: "Spain",
  "state of palestine": "Palestine",
};

const REMOTE_KEYS = new Set(["remote", "worldwide", "global", "anywhere"]);

const SKILL_CANONICAL: Record<string, string> = {
  ai: "AI",
  near: "NEAR",
  typescript: "TypeScript",
  javascript: "JavaScript",
  react: "React",
  "smart contract": "Smart Contract",
  "smart contracts": "Smart Contracts",
};

export const KNOWN_SKILLS = [
  "AI",
  "JavaScript",
  "NEAR",
  "React",
  "Rust",
  "Smart Contracts",
  "TypeScript",
] as const;

function lookupKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word ? word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase() : word,
    )
    .join(" ");
}

const COUNTRY_BY_KEY = new Map<string, string>();
for (const country of COUNTRIES) {
  COUNTRY_BY_KEY.set(lookupKey(country), country);
}
for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
  COUNTRY_BY_KEY.set(lookupKey(alias), country);
}

function resolveCountry(raw: string): string | undefined {
  return COUNTRY_BY_KEY.get(lookupKey(raw));
}

export function resolveLocation(raw: string | null | undefined): ResolvedLocation {
  if (typeof raw !== "string") return { ok: true, value: null };
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: true, value: null };
  if (REMOTE_KEYS.has(lookupKey(trimmed))) return { ok: true, value: "Remote" };

  const country = resolveCountry(trimmed);
  if (country) return { ok: true, value: country };

  const comma = trimmed.lastIndexOf(",");
  if (comma !== -1) {
    const cityPart = trimmed.slice(0, comma).trim();
    const countryPart = trimmed.slice(comma + 1).trim();
    const resolvedCountry = resolveCountry(countryPart);
    if (cityPart && resolvedCountry) {
      return { ok: true, value: `${titleCaseWords(cityPart)}, ${resolvedCountry}` };
    }
  }

  return { ok: false };
}

export function normalizeLocation(raw: string | null | undefined): string | null {
  const resolved = resolveLocation(raw);
  return resolved.ok ? resolved.value : null;
}

export function locationError(raw: string | null | undefined): string | undefined {
  return resolveLocation(raw).ok ? undefined : LOCATION_ERROR;
}

export function extractCountry(location: string | null | undefined): string | null {
  const resolved = resolveLocation(location);
  if (!resolved.ok || !resolved.value) return null;
  if (resolved.value === "Remote") return "Remote";
  const comma = resolved.value.lastIndexOf(",");
  return comma === -1 ? resolved.value : resolved.value.slice(comma + 1).trim();
}

export function properCaseSkill(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return (
    SKILL_CANONICAL[trimmed.toLocaleLowerCase()] ??
    SKILL_CANONICAL[lookupKey(trimmed)] ??
    titleCaseWords(trimmed)
  );
}

export function parseSkillList(raw: string): string[] {
  return raw
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export function normalizeSkills(
  input: string[] | string,
  existing: readonly string[] = [],
): string[] {
  const values = typeof input === "string" ? parseSkillList(input) : input;
  const catalog = new Map<string, string>();
  for (const skill of [...KNOWN_SKILLS, ...existing]) {
    const canonical = properCaseSkill(skill);
    if (canonical) catalog.set(canonical.toLocaleLowerCase(), canonical);
  }

  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value.trim()) continue;
    const canonical = catalog.get(value.trim().toLocaleLowerCase()) ?? properCaseSkill(value);
    const key = canonical.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.set(key, canonical);
    output.push(canonical);
  }
  return output;
}

export function sortFilterValues(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function valuesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
}

export function countrySuggestions(query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  const countries = [...COUNTRIES, "Remote"];
  if (!needle) return countries.slice(0, 12);
  return countries.filter((country) => country.toLocaleLowerCase().includes(needle)).slice(0, 12);
}

export function skillSuggestions(query: string, existing: readonly string[] = []): string[] {
  const catalog = sortFilterValues([...KNOWN_SKILLS, ...existing]);
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return catalog.slice(0, 12);
  return catalog.filter((skill) => skill.toLocaleLowerCase().includes(needle)).slice(0, 12);
}
