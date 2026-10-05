import { findCandidates, autoMatch, ourSide } from "@/lib/federation/matching";
import type { FederationDecision, Girone, OfficialMatch } from "@/lib/federation/types";
import type { Category, Match, MatchInput } from "@/lib/types";

/**
 * Calendario ufficiale → partite del sito. Funzione pura (niente rete né
 * database): confronta le gare del girone in cui gioca la nostra squadra con
 * le partite già inserite e dice quali mancano. Serve a «Aggiungi dal
 * calendario ufficiale»: un admin vede l'elenco e conferma, nulla viene
 * creato da solo e le partite già presenti non si toccano.
 *
 * - "new": nel sito non c'è nessuna partita che somigli a questa gara.
 * - "maybe-duplicate": c'è già una partita con la stessa avversaria e data
 *   vicina (spostamento?): si propone di non aggiungerla, ma l'admin decide.
 * Le gare già nel sito (abbinate dall'admin o riconosciute da sole) non
 * compaiono, e vengono solo contate.
 */

export type CalendarImportKind = "new" | "maybe-duplicate";

export interface CalendarImportItem {
  category: Category;
  official: OfficialMatch;
  side: "home" | "away";
  /** Nome dell'avversaria come scritto dal portale. */
  opponent: string;
  kind: CalendarImportKind;
  /** Solo per "maybe-duplicate": la partita del sito che somiglia a questa gara. */
  similar: Match | null;
}

export interface CalendarImportSet {
  items: CalendarImportItem[];
  /** Gare della nostra squadra nel girone già presenti nel sito. */
  alreadyPresent: number;
  /** Tutte le gare della nostra squadra nel girone. */
  total: number;
}

/** Finestra per segnalare una possibile partita già inserita (date spostate). */
const SIMILAR_WINDOW_DAYS = 14;

export function computeCalendarImport(input: {
  category: Category;
  girone: Girone;
  aliases: string[];
  /** Partite del sito (tutte; si filtrano qui per squadra e categoria). */
  matches: Match[];
  decisions: FederationDecision[];
}): CalendarImportSet {
  const { category, girone, aliases, decisions } = input;

  const pool = input.matches.filter(
    (match) => match.team === "u14u15" && match.category === category && !match.isFriendly && !match.isTournament,
  );
  const byId = new Map(pool.map((match) => [match.id, match]));
  const linked = new Map(
    decisions
      .filter((d) => d.category === category && d.decision === "linked" && d.matchId && byId.has(d.matchId))
      .map((d) => [d.externalId, d.matchId as string]),
  );

  const ours = girone.matches
    .map((official) => ({ official, side: ourSide(official, aliases) }))
    .filter((entry): entry is { official: OfficialMatch; side: "home" | "away" } => entry.side !== null)
    .sort((a, b) => a.official.date.localeCompare(b.official.date));

  const claimed = new Set<string>(linked.values());
  const items: CalendarImportItem[] = [];
  let alreadyPresent = 0;

  for (const { official, side } of ours) {
    if (linked.has(official.externalId)) {
      alreadyPresent++;
      continue;
    }
    const free = pool.filter((match) => !claimed.has(match.id));
    const same = autoMatch(official, free, aliases);
    if (same) {
      claimed.add(same.id);
      alreadyPresent++;
      continue;
    }
    const opponent = side === "home" ? official.away : official.home;
    const similar = findCandidates(official, free, aliases, SIMILAR_WINDOW_DAYS)[0]?.match ?? null;
    items.push({
      category,
      official,
      side,
      opponent,
      kind: similar ? "maybe-duplicate" : "new",
      similar,
    });
  }

  return { items, alreadyPresent, total: ours.length };
}

/** La partita del sito per una gara ufficiale: dati del portale, senza ritrovo,
 * convocazioni né risultato (il risultato arriva dalle proposte, con conferma). */
export function matchInputFromOfficial(category: Category, official: OfficialMatch, side: "home" | "away"): MatchInput {
  const opponent = side === "home" ? official.away : official.home;
  return {
    team: "u14u15",
    category,
    opponent,
    isHome: side === "home",
    isFriendly: false,
    isTournament: false,
    // Il luogo è obbligatorio nel sito: se il portale non lo dice, si lascia un segnaposto da correggere.
    location: official.venue?.trim() || (side === "home" ? "Lignano Sabbiadoro" : "Da definire"),
    matchDate: official.date,
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
  };
}
