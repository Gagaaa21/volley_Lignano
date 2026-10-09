import {
  computeCalendarImport,
  type GameChangeKinds,
  type OrphanMatch,
} from "@/lib/federation/calendarImport";
import { ourSide } from "@/lib/federation/matching";
import { computeProposals, orientResult, type OrientedResult } from "@/lib/federation/proposals";
import type { FederationDecision, Girone, OfficialMatch } from "@/lib/federation/types";
import type { Category, Match } from "@/lib/types";

/**
 * Vista unica «Portale FIPAV»: per ogni gara ufficiale della nostra squadra
 * un solo stato, con la partita del sito che le corrisponde. Mette insieme
 * calendario (partite da aggiungere o cambiate) e risultati (da confermare)
 * così una stessa gara non compare mai in due elenchi diversi con due
 * domande diverse. Funzione pura: niente rete né database.
 *
 * Stati, in ordine di «quanto serve un admin»:
 * - "result": giocata, la partita del sito non ha risultato → conferma.
 * - "conflict": giocata, nel sito c'è un risultato diverso (resta il vostro).
 * - "changed": da giocare, nel sito ha data, avversaria o casa/trasferta diverse.
 * - "maybe-same": nel sito non risulta, ma c'è una partita simile in un altro
 *   giorno: è la stessa (da collegare) o un'altra (da aggiungere)?
 * - "played-missing": giocata e nel sito non c'è nulla di simile.
 * - "to-add": da giocare e nel sito manca (facoltativo, non è un errore).
 * - "waiting-sets": giocata, il portale non ha ancora pubblicato i parziali.
 * - "ok": nel sito e uguale al portale.
 * - "dismissed": un admin ha scelto di ignorarla.
 */

export type PortalGameStatus =
  | "result"
  | "conflict"
  | "changed"
  | "maybe-same"
  | "played-missing"
  | "to-add"
  | "waiting-sets"
  | "ok"
  | "dismissed";

export interface PortalGame {
  category: Category;
  official: OfficialMatch;
  side: "home" | "away";
  /** Avversaria come scritta dal portale. */
  opponent: string;
  status: PortalGameStatus;
  /** Partita del sito che corrisponde a questa gara (abbinata o riconosciuta). */
  match: Match | null;
  /** Solo "maybe-same": la partita del sito che le somiglia. */
  similar: Match | null;
  /** Solo "changed": cosa è diverso. */
  changed: GameChangeKinds | null;
  /** Risultato ufficiale visto dalla nostra parte; null se non ancora giocata. */
  result: OrientedResult | null;
  /** Solo "played-missing": partite del sito libere e vicine nel tempo, da collegare a mano. */
  candidates: Match[];
}

export interface PortalCategoryView {
  category: Category;
  /** Tutte le gare della nostra squadra, in ordine di data. */
  games: PortalGame[];
  /** Partite del sito (non giocate) senza nessuna gara ufficiale corrispondente. */
  orphans: OrphanMatch[];
  /** Nel girone non compare nessuna delle nostre squadre: probabile nome sbagliato. */
  aliasesNotFound: boolean;
}

/** Gli stati che chiedono una decisione a un admin (le partite da aggiungere no: sono facoltative). */
export const TODO_STATUSES: readonly PortalGameStatus[] = [
  "result",
  "conflict",
  "changed",
  "maybe-same",
  "played-missing",
];

export function computePortalView(input: {
  category: Category;
  girone: Girone;
  aliases: string[];
  /** Partite del sito (tutte; si filtrano per squadra e categoria più avanti). */
  matches: Match[];
  decisions: FederationDecision[];
}): PortalCategoryView {
  const { category, girone, aliases, decisions } = input;
  const calendar = computeCalendarImport(input);
  const proposals = computeProposals(input);

  const dismissedIds = new Set(
    decisions.filter((d) => d.category === category && d.decision === "dismissed").map((d) => d.externalId),
  );
  const proposalById = new Map(proposals.proposals.map((p) => [p.official.externalId, p]));
  const itemById = new Map(calendar.items.map((item) => [item.official.externalId, item]));
  const changeById = new Map(calendar.changes.map((change) => [change.official.externalId, change]));
  const presentById = new Map(calendar.present.map((entry) => [entry.official.externalId, entry.match]));

  const ours = girone.matches
    .map((official) => ({ official, side: ourSide(official, aliases) }))
    .filter((entry): entry is { official: OfficialMatch; side: "home" | "away" } => entry.side !== null)
    .sort((a, b) => a.official.date.localeCompare(b.official.date));

  const games: PortalGame[] = ours.map(({ official, side }) => {
    const opponent = side === "home" ? official.away : official.home;
    const result = orientResult(official, side);
    const base: PortalGame = {
      category,
      official,
      side,
      opponent,
      status: "ok",
      match: presentById.get(official.externalId) ?? null,
      similar: null,
      changed: null,
      result,
      candidates: [],
    };

    if (dismissedIds.has(official.externalId)) return { ...base, status: "dismissed" };

    const proposal = proposalById.get(official.externalId);
    const item = itemById.get(official.externalId);

    if (result) {
      // Gara giocata: decidono le proposte di risultato.
      if (!proposal) return base; // risultato del sito uguale a quello ufficiale
      if (proposal.kind === "new") return { ...base, status: "result", match: proposal.match };
      if (proposal.kind === "conflict") return { ...base, status: "conflict", match: proposal.match };
      if (proposal.kind === "no-sets") return { ...base, status: "waiting-sets", match: proposal.match };
      // Nessuna partita del sito abbinata.
      if (item?.kind === "maybe-duplicate" && item.similar) {
        return { ...base, status: "maybe-same", match: null, similar: item.similar };
      }
      return { ...base, status: "played-missing", match: null, candidates: proposal.candidates };
    }

    // Gara da giocare: decide il calendario.
    const change = changeById.get(official.externalId);
    if (change) return { ...base, status: "changed", match: change.match, changed: change.changed };
    if (item?.kind === "maybe-duplicate" && item.similar) {
      return { ...base, status: "maybe-same", match: null, similar: item.similar };
    }
    if (item) return { ...base, status: "to-add", match: null };
    return base;
  });

  return { category, games, orphans: calendar.orphans, aliasesNotFound: proposals.aliasesNotFound };
}

/** Quante cose chiedono una decisione a un admin: gare da sistemare più partite del sito senza gara ufficiale. */
export function portalTodoCount(view: PortalCategoryView): number {
  return view.games.filter((game) => TODO_STATUSES.includes(game.status)).length + view.orphans.length;
}

/** Gare del portale a cui si può collegare una partita del sito: quelle che nel sito non hanno ancora una partita. */
export function linkableGames(view: PortalCategoryView): PortalGame[] {
  return view.games.filter(
    (game) => game.status === "to-add" || game.status === "maybe-same" || game.status === "played-missing",
  );
}
