import { autoMatch, findCandidates, MIN_NAME_SCORE, nameSimilarity, ourSide } from "@/lib/federation/matching";
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
 * compaiono nell'elenco da aggiungere, e vengono solo contate. Se per una di
 * queste il portale dice altro (data o ora, ma anche avversaria o casa /
 * trasferta: la federazione a volte rivede il calendario mantenendo i
 * numeri di gara e cambiando gli abbinamenti) finisce tra le «partite
 * cambiate», da aggiornare con un clic. Le partite del sito abbinate a un
 * numero di gara che ora è di altre squadre sono «orfane»: si segnalano.
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

/** Cosa è cambiato sul portale rispetto a una partita già nel sito. */
export interface GameChangeKinds {
  /** Data o ora diverse. */
  date: boolean;
  /** Un'altra squadra avversaria. */
  opponent: boolean;
  /** Da casa a trasferta o viceversa. */
  side: boolean;
}

/** Partita del sito che non corrisponde più alla gara ufficiale (non ancora giocata). */
export interface GameChangeItem {
  category: Category;
  official: OfficialMatch;
  side: "home" | "away";
  /** Avversaria secondo il portale. */
  opponent: string;
  match: Match;
  changed: GameChangeKinds;
}

/** Partita del sito abbinata a un numero di gara che ora è di altre squadre. */
export interface OrphanMatch {
  match: Match;
  externalId: string;
}

export interface CalendarImportSet {
  items: CalendarImportItem[];
  /** Partite già nel sito con data, ora, avversaria o campo diversi dal portale (non ancora giocate). */
  changes: GameChangeItem[];
  /** Partite del sito abbinate a una gara ufficiale che non è più della nostra squadra. */
  orphans: OrphanMatch[];
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
  const changes: GameChangeItem[] = [];
  let alreadyPresent = 0;

  /** Una gara già giocata (o con risultato nel sito) non ha più nulla da correggere. */
  const noteChange = (match: Match, official: OfficialMatch, side: "home" | "away") => {
    if (match.resultSetsWon !== null || official.homeSets !== null) return;
    const opponent = side === "home" ? official.away : official.home;
    const opponentClub = side === "home" ? official.awayClub : official.homeClub;
    const changed: GameChangeKinds = {
      date: match.matchDate.slice(0, 16) !== official.date.slice(0, 16),
      opponent: nameSimilarity(match.opponent, [opponent, opponentClub]) < MIN_NAME_SCORE,
      side: match.isHome !== (side === "home"),
    };
    if (!changed.date && !changed.opponent && !changed.side) return;
    changes.push({ category, official, side, opponent, match, changed });
  };

  for (const { official, side } of ours) {
    const linkedId = linked.get(official.externalId);
    if (linkedId) {
      alreadyPresent++;
      noteChange(byId.get(linkedId)!, official, side);
      continue;
    }
    const free = pool.filter((match) => !claimed.has(match.id));
    const same = autoMatch(official, free, aliases);
    if (same) {
      claimed.add(same.id);
      alreadyPresent++;
      noteChange(same, official, side);
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

  // Partite abbinate a un numero di gara che ora non è più una gara della nostra squadra.
  const oursIds = new Set(ours.map((entry) => entry.official.externalId));
  const knownIds = new Set(girone.matches.map((official) => official.externalId));
  const orphans: OrphanMatch[] = [];
  for (const [externalId, matchId] of linked) {
    if (oursIds.has(externalId) || !knownIds.has(externalId)) continue;
    const match = byId.get(matchId)!;
    if (match.resultSetsWon !== null) continue;
    orphans.push({ match, externalId });
  }
  orphans.sort((a, b) => a.match.matchDate.localeCompare(b.match.matchDate));

  return { items, changes, orphans, alreadyPresent, total: ours.length };
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
