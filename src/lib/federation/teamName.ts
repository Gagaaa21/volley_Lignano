import { nameTokens } from "@/lib/federation/matching";

/** Parole che non servono per ricavare le iniziali («A.S.D. Pol. …»). */
const SKIP_WORDS = new Set([
  "a",
  "asd",
  "ssd",
  "srl",
  "pol",
  "polisportiva",
  "volley",
  "pallavolo",
  "di",
  "del",
  "della",
]);

/** Iniziali di una squadra, per il segnaposto quando manca il logo. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\./g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  const meaningful = words.filter((word) => !SKIP_WORDS.has(word));
  const picked = (meaningful.length > 0 ? meaningful : words).slice(0, 2);
  return picked.map((word) => word[0]!.toUpperCase()).join("") || "?";
}

/**
 * Loghi scelti a mano per le squadre che nella pagina del girone non ne hanno uno. La
 * chiave indica il file in src/assets/team-logos (vedi manualTeamLogos.ts);
 * il nome si confronta come per gli abbinamenti, quindi maiuscole, «A.S.D.»
 * e simili non contano. Il logo scelto a mano vale più di quello del portale.
 */
const MANUAL_LOGO_TEAMS: { key: string; names: string[] }[] = [
  { key: "factory-volley-faedis", names: ["FACTORY VOLLEY FAEDIS"] },
  // Presi dalla pagina ufficiale della società (udine.federvolley.it, elenco società).
  { key: "pav-bressa", names: ["PAV BRESSA - Multiservice", "PAV BRESSA"] },
  { key: "project-volley-olimpia", names: ["PROJECT VOLLEY OLIMPIA"] },
];

/** Chiave del logo scelto a mano per questa squadra, se c'è. */
export function manualLogoKey(teamName: string): string | null {
  const own = nameTokens(teamName).join(" ");
  if (own === "") return null;
  return MANUAL_LOGO_TEAMS.find((entry) => entry.names.some((name) => nameTokens(name).join(" ") === own))?.key ?? null;
}
