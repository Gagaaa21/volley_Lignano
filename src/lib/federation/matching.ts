import type { OfficialMatch } from "@/lib/federation/types";
import type { Match } from "@/lib/types";

/** Parole che non distinguono una squadra dall'altra nei nomi ufficiali
 * («A.S.D.», «Pol.», «Volley», …). Le sigle di una sola lettera vengono
 * scartate a parte (S.C.S.D., R.L., …). */
const STOPWORDS = new Set([
  "asd",
  "ssd",
  "scsd",
  "aps",
  "srl",
  "pol",
  "polisportiva",
  "pallavolo",
  "volley",
  "volleyball",
  "team",
  "societa",
  "sportiva",
  "dilettantistica",
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "il",
  "la",
  "le",
  "lo",
  "da",
]);

/** Parole significative di un nome, in minuscolo e senza accenti né punteggiatura. */
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefisso comune di almeno 4 lettere: «faedis» ~ «faediss», «rojalkenn» ~ «rojalkennedy».
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/** Quanto il nome scritto a mano somiglia a uno dei nomi ufficiali
 * (squadra o società): da 0 a 1. Conta quante parole del nome più corto
 * ritrovo nell'altro, così «Degano» combacia con «DEGANO ROJALKENNEDY». */
export function nameSimilarity(typed: string, officialNames: (string | null)[]): number {
  const a = nameTokens(typed);
  if (a.length === 0) return 0;
  let best = 0;
  for (const officialName of officialNames) {
    if (!officialName) continue;
    const b = nameTokens(officialName);
    if (b.length === 0) continue;
    const shared = a.filter((token) => b.some((other) => tokensMatch(token, other))).length;
    best = Math.max(best, shared / Math.min(a.length, b.length));
  }
  return best;
}

/** Vero se `name` è una delle nostre squadre (alias della configurazione). */
export function isOurTeam(name: string, aliases: string[]): boolean {
  const own = nameTokens(name).join(" ");
  return own !== "" && aliases.some((alias) => nameTokens(alias).join(" ") === own);
}

function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.abs(toUtc(a) - toUtc(b)) / 86_400_000;
}

/** Il nostro lato in una gara ufficiale; null se non ci siamo o se siamo da
 * entrambe le parti (configurazione sbagliata). */
export function ourSide(official: OfficialMatch, aliases: string[]): "home" | "away" | null {
  const home = isOurTeam(official.home, aliases);
  const away = isOurTeam(official.away, aliases);
  if (home === away) return null;
  return home ? "home" : "away";
}

export interface MatchCandidate {
  match: Match;
  /** Somiglianza del nome dell'avversaria, 0..1. */
  score: number;
  /** Giorni di distanza tra la gara ufficiale e la partita del sito. */
  days: number;
}

const MIN_NAME_SCORE = 0.5;
/** Recuperi e spostamenti: la data del sito può differire di qualche giorno. */
export const AUTO_MATCH_WINDOW_DAYS = 3;

/** Partite del sito che potrebbero essere questa gara ufficiale: stesso
 * lato (casa/trasferta), data vicina, avversaria con nome simile. Dalla più
 * somigliante alla più lontana. */
export function findCandidates(
  official: OfficialMatch,
  matches: Match[],
  aliases: string[],
  windowDays = AUTO_MATCH_WINDOW_DAYS,
): MatchCandidate[] {
  const side = ourSide(official, aliases);
  if (!side) return [];
  const opponentNames = side === "home" ? [official.away, official.awayClub] : [official.home, official.homeClub];

  return matches
    .filter((match) => match.isHome === (side === "home"))
    .map((match) => ({
      match,
      score: nameSimilarity(match.opponent, opponentNames),
      days: daysBetween(official.date.slice(0, 10), match.matchDate.slice(0, 10)),
    }))
    .filter((candidate) => candidate.days <= windowDays && candidate.score >= MIN_NAME_SCORE)
    .sort((a, b) => b.score - a.score || a.days - b.days);
}

/** Abbinamento automatico: solo se c'è una sola partita plausibile. Con più
 * candidate (o nessuna) meglio far scegliere a un admin che indovinare. */
export function autoMatch(official: OfficialMatch, matches: Match[], aliases: string[]): Match | null {
  const candidates = findCandidates(official, matches, aliases);
  return candidates.length === 1 ? candidates[0].match : null;
}
