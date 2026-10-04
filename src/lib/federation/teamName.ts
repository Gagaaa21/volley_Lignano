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
