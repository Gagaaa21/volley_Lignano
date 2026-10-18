import type { Repo } from "@/lib/db/repo";
import { isOurTeam, MIN_NAME_SCORE, nameSimilarity, nameTokens } from "@/lib/federation/matching";
import type { Category } from "@/lib/types";

/**
 * Il logo dell'avversaria per il punteggio live (banner del sito e grafiche della diretta). I loghi delle squadre del girone
 * sono già nelle classifiche salvate dalla federazione (`StandingRow.logoUrl`, che il nostro sito serve da /api/federation/logo,
 * più i pochi scelti a mano): qui si trova la riga che corrisponde al nome scritto nella partita («Degano» ~ «DEGANO
 * ROJALKENNEDY»). Nessun logo per chi non è nel girone (amichevoli, tornei) o se il nome è ambiguo: restano le iniziali.
 */

/** L'indirizzo con cui il nostro sito serve il logo di una squadra del portale (vedi /api/federation/logo). */
export function logoProxyUrl(logoUrl: string): string {
  return `/api/federation/logo?u=${encodeURIComponent(logoUrl)}`;
}

export interface LogoTeam {
  /** Il nome della squadra nella classifica. */
  team: string;
  logoUrl?: string | null;
}

export interface PickOptions {
  /** I nomi con cui la nostra squadra compare nel girone: la sua riga non è mai l'avversaria. */
  ourAliases?: string[];
  /** Il logo scelto a mano per una squadra (un indirizzo del nostro sito), che vale più di quello del portale. */
  manualLogo?: (team: string) => string | null;
}

/**
 * Il logo della squadra del girone che corrisponde a `name`: la più somigliante (almeno MIN_NAME_SCORE), e solo se è una
 * sola. A parità vince chi ha le stesse parole del nome scritto; se restano più squadre non si sceglie, meglio le iniziali
 * che il logo sbagliato. Null se la squadra non ha un logo.
 */
export function pickOpponentLogo(rows: readonly LogoTeam[], name: string, options: PickOptions = {}): string | null {
  const typed = nameTokens(name).join(" ");
  if (typed === "") return null;
  const scored = rows
    .filter((row) => !(options.ourAliases && isOurTeam(row.team, options.ourAliases)))
    .map((row) => ({ row, score: nameSimilarity(name, [row.team]) }))
    .filter((entry) => entry.score >= MIN_NAME_SCORE);
  if (scored.length === 0) return null;
  const best = Math.max(...scored.map((entry) => entry.score));
  const top = scored.filter((entry) => entry.score === best);
  const exact = top.filter((entry) => nameTokens(entry.row.team).join(" ") === typed);
  const pool = exact.length === 1 ? exact : top;
  if (pool.length !== 1) return null;
  const { team, logoUrl } = pool[0].row;
  return options.manualLogo?.(team) ?? (logoUrl ? logoProxyUrl(logoUrl) : null);
}

type Store = Pick<Repo, "listFederationSnapshots" | "listFederationSources">;

interface Index {
  at: number;
  /** Quanto resta valido (meno dopo un errore, per riprovare presto). */
  ttl: number;
  byCategory: Map<Category, { rows: LogoTeam[]; aliases: string[] }>;
}

/** Le classifiche si rileggono ogni 10 minuti (dopo un errore, ogni minuto): il punteggio live le chiede a ogni lettura. */
const INDEX_TTL_MS = 10 * 60_000;
const FAILED_TTL_MS = 60_000;
const indexes = new WeakMap<object, Index>();

async function loadIndex(repo: Store, now: number): Promise<Index> {
  const known = indexes.get(repo);
  if (known && now - known.at < known.ttl) return known;
  const byCategory: Index["byCategory"] = new Map();
  let ttl = INDEX_TTL_MS;
  try {
    const [snapshots, sources] = await Promise.all([repo.listFederationSnapshots(), repo.listFederationSources()]);
    for (const snapshot of snapshots) {
      if (!snapshot.girone) continue;
      byCategory.set(snapshot.category, {
        rows: snapshot.girone.standings.map((row) => ({ team: row.team, logoUrl: row.logoUrl ?? null })),
        aliases: sources.find((source) => source.category === snapshot.category)?.teamAliases ?? [],
      });
    }
  } catch (error) {
    // Es. le tabelle della federazione non ci sono ancora su Supabase: niente loghi, e non si insiste a ogni lettura.
    console.error("[federation] classifiche per i loghi non disponibili:", error);
    ttl = FAILED_TTL_MS;
  }
  const index = { at: now, ttl, byCategory };
  indexes.set(repo, index);
  return index;
}

/**
 * Il logo (un indirizzo del nostro sito) dell'avversaria `name` della categoria, o null. Con `category` nulla si cercano
 * tutti i gironi. Le classifiche si tengono in memoria per qualche minuto, quindi di norma non costa letture.
 */
export async function opponentLogoFor(
  repo: Store,
  category: Category | null,
  name: string,
  options: Pick<PickOptions, "manualLogo"> & { now?: number } = {},
): Promise<string | null> {
  if (name.trim() === "") return null;
  const index = await loadIndex(repo, options.now ?? Date.now());
  const categories = category ? [category] : [...index.byCategory.keys()];
  for (const key of categories) {
    const entry = index.byCategory.get(key);
    if (!entry) continue;
    const found = pickOpponentLogo(entry.rows, name, { ourAliases: entry.aliases, manualLogo: options.manualLogo });
    if (found) return found;
  }
  return null;
}
