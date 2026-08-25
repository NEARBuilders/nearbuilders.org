const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
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
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
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
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
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
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
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
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Somalia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
] as const;

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  america: "United States",
  uk: "United Kingdom",
  britain: "United Kingdom",
  greatbritain: "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  korea: "South Korea",
  southkorea: "South Korea",
  northkorea: "North Korea",
  russia: "Russia",
  czechrepublic: "Czechia",
  coteivoire: "Ivory Coast",
  cotedivoire: "Ivory Coast",
  holland: "Netherlands",
  vietnam: "Vietnam",
};

const CITY_TO_COUNTRY: Record<string, string> = {
  bangalore: "India",
  bengaluru: "India",
  mumbai: "India",
  bombay: "India",
  delhi: "India",
  newdelhi: "India",
  hyderabad: "India",
  chennai: "India",
  pune: "India",
  kolkata: "India",
  lisbon: "Portugal",
  london: "United Kingdom",
  berlin: "Germany",
  paris: "France",
  nyc: "United States",
  newyork: "United States",
  sanfrancisco: "United States",
  seattle: "United States",
  austin: "United States",
  miami: "United States",
  chicago: "United States",
  losangeles: "United States",
  toronto: "Canada",
  vancouver: "Canada",
  dubai: "United Arab Emirates",
  lagos: "Nigeria",
  nairobi: "Kenya",
  saopaulo: "Brazil",
  riodejaneiro: "Brazil",
  mexicocity: "Mexico",
  tokyo: "Japan",
  seoul: "South Korea",
  amsterdam: "Netherlands",
  barcelona: "Spain",
  madrid: "Spain",
  zurich: "Switzerland",
  stockholm: "Sweden",
  oslo: "Norway",
  copenhagen: "Denmark",
  warsaw: "Poland",
  prague: "Czechia",
  vienna: "Austria",
  rome: "Italy",
  milan: "Italy",
  istanbul: "Turkey",
  cairo: "Egypt",
  capetown: "South Africa",
  johannesburg: "South Africa",
  sydney: "Australia",
  melbourne: "Australia",
  auckland: "New Zealand",
  buenosaires: "Argentina",
  bogota: "Colombia",
  lima: "Peru",
  santiago: "Chile",
};

const REMOTE_KEYS = new Set(["remote", "worldwide", "global", "anywhere", "distributed"]);

const SKILL_CANONICAL: Record<string, string> = {
  ai: "AI",
  ui: "UI",
  ux: "UX",
  css: "CSS",
  html: "HTML",
  sql: "SQL",
  wasm: "WASM",
  nft: "NFT",
  dao: "DAO",
  defi: "DeFi",
  near: "NEAR",
  api: "API",
  sdk: "SDK",
  cli: "CLI",
  graphql: "GraphQL",
  postgresql: "PostgreSQL",
  mongodb: "MongoDB",
  typescript: "TypeScript",
  javascript: "JavaScript",
  nextjs: "Next.js",
  "next.js": "Next.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  reactnative: "React Native",
  "react native": "React Native",
  smartcontract: "Smart Contract",
  smartcontracts: "Smart Contracts",
  "smart contract": "Smart Contract",
  "smart contracts": "Smart Contracts",
};

export const KNOWN_SKILLS = [
  "AI",
  "API",
  "CSS",
  "DeFi",
  "GraphQL",
  "HTML",
  "JavaScript",
  "NEAR",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "React",
  "React Native",
  "Rust",
  "Smart Contracts",
  "SQL",
  "TypeScript",
  "UI",
  "UX",
  "WASM",
] as const;

export const LOCATION_ERROR = 'Enter a country, "City, Country", or Remote';

export type ResolvedLocation = { ok: true; value: string | null } | { ok: false };

function lookupKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const COUNTRY_BY_KEY = new Map<string, string>();
for (const country of COUNTRIES) {
  COUNTRY_BY_KEY.set(lookupKey(country), country);
}
for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
  COUNTRY_BY_KEY.set(lookupKey(alias), country);
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9.]+$/.test(word) && word.length <= 4) return word;
      return word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
    })
    .join(" ");
}

function resolveCountry(raw: string): string | undefined {
  return COUNTRY_BY_KEY.get(lookupKey(raw));
}

export function resolveLocation(raw: string | null | undefined): ResolvedLocation {
  if (typeof raw !== "string") return { ok: true, value: null };
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: true, value: null };

  const compact = lookupKey(trimmed);
  if (REMOTE_KEYS.has(compact)) return { ok: true, value: "Remote" };

  const country = resolveCountry(trimmed);
  if (country) return { ok: true, value: country };

  const cityCountry = CITY_TO_COUNTRY[compact];
  if (cityCountry) return { ok: true, value: `${titleCaseWords(trimmed)}, ${cityCountry}` };

  const comma = trimmed.lastIndexOf(",");
  if (comma !== -1) {
    const cityPart = trimmed.slice(0, comma).trim();
    const countryPart = trimmed.slice(comma + 1).trim();
    const resolvedCountry = resolveCountry(countryPart) ?? CITY_TO_COUNTRY[lookupKey(countryPart)];
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
  if (comma === -1) return resolved.value;
  return resolved.value.slice(comma + 1).trim();
}

export function properCaseSkill(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const mapped =
    SKILL_CANONICAL[trimmed.toLocaleLowerCase()] ?? SKILL_CANONICAL[lookupKey(trimmed)];
  if (mapped) return mapped;
  return titleCaseWords(trimmed);
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
    const trimmed = value.trim();
    if (!trimmed) continue;
    const canonical = catalog.get(trimmed.toLocaleLowerCase()) ?? properCaseSkill(trimmed);
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
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
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
