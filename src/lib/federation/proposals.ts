import { autoMatch, ourSide } from "@/lib/federation/matching";
import type { FederationDecision, Girone, OfficialMatch } from "@/lib/federation/types";
import type { Category, Match, SetScore } from "@/lib/types";

/**
 * Proposte di risultato: confronto tra le gare ufficiali del girone e le
 * partite inserite nel sito. Funzione pura (niente rete né database): le
 * decisioni degli admin e le partite arrivano come argomenti, così si prova
 * a fondo. Il risultato ufficiale non viene mai scritto da qui: questo è
 * solo l'elenco di ciò che un admin può confermare.
 *
 * - "new": la partita del sito non ha risultato, quello ufficiale sì.
 * - "conflict": la partita ha già un risultato diverso (vince il vostro:
 *   si segnala soltanto la differenza).
 * - "no-sets": risultato ufficiale senza parziali leggibili, ancora da attendere.
 * - "unmatched": gara giocata senza una partita del sito abbinata.
 * Se il risultato del sito coincide con l'ufficiale non c'è nulla da proporre.
 */

export type ProposalKind = "new" | "conflict" | "no-sets" | "unmatched";

/** Risultato visto dalla nostra parte (us = noi, them = avversaria). */
export interface OrientedResult {
  us: number;
  them: number;
  sets: SetScore[] | null;
}

export interface Proposal {
  category: Category;
  official: OfficialMatch;
  side: "home" | "away";
  result: OrientedResult;
  kind: ProposalKind;
  /** Partita del sito abbinata (automaticamente o da un admin). */
  match: Match | null;
  /** Solo per "unmatched": partite del sito vicine nel tempo tra cui scegliere. */
  candidates: Match[];
  /** Abbinamento scelto in precedenza da un admin (non indovinato). */
  linkedByAdmin: boolean;
}

export interface ProposalSet {
  proposals: Proposal[];
  /** Gare con risultato che un admin ha scelto di ignorare (si possono ripristinare). */
  dismissed: Proposal[];
  /** Nel girone non compare nessuna delle nostre squadre: probabile alias sbagliato. */
  aliasesNotFound: boolean;
}

/** Finestra, in giorni, per proporre una partita del sito da abbinare a mano. */
const MANUAL_CANDIDATE_WINDOW_DAYS = 14;

export function orientResult(official: OfficialMatch, side: "home" | "away"): OrientedResult | null {
  if (official.homeSets === null || official.awaySets === null) return null;
  const us = side === "home" ? official.homeSets : official.awaySets;
  const them = side === "home" ? official.awaySets : official.homeSets;
  const sets = official.sets
    ? official.sets.map((set) =>
        side === "home" ? { us: set.home, them: set.away } : { us: set.away, them: set.home },
      )
    : null;
  return { us, them, sets };
}

export function sameResult(match: Match, result: OrientedResult): boolean {
  if (match.resultSetsWon !== result.us || match.resultSetsLost !== result.them) return false;
  if (result.sets && match.setScores) {
    const saved = match.setScores;
    return (
      result.sets.length === saved.length &&
      result.sets.every((set, i) => set.us === saved[i].us && set.them === saved[i].them)
    );
  }
  return true;
}

function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.abs(toUtc(a) - toUtc(b)) / 86_400_000;
}

export function computeProposals(input: {
  category: Category;
  girone: Girone;
  aliases: string[];
  /** Partite del sito (tutte; si filtrano qui per squadra e categoria). */
  matches: Match[];
  decisions: FederationDecision[];
}): ProposalSet {
  const { category, girone, aliases, decisions } = input;

  // Solo partite di campionato della squadra e categoria giuste: amichevoli
  // e tornei non hanno dati ufficiali.
  const pool = input.matches.filter(
    (match) => match.team === "u14u15" && match.category === category && !match.isFriendly && !match.isTournament,
  );
  const byId = new Map(pool.map((match) => [match.id, match]));
  const decisionByGame = new Map(decisions.filter((d) => d.category === category).map((d) => [d.externalId, d]));

  const ours = girone.matches
    .map((official) => ({ official, side: ourSide(official, aliases) }))
    .filter((entry): entry is { official: OfficialMatch; side: "home" | "away" } => entry.side !== null)
    .sort((a, b) => a.official.date.localeCompare(b.official.date));

  const aliasesNotFound = girone.matches.length > 0 && ours.length === 0;

  const claimed = new Set<string>();
  for (const decision of decisionByGame.values()) {
    if (decision.decision === "linked" && decision.matchId && byId.has(decision.matchId)) claimed.add(decision.matchId);
  }

  const proposals: Proposal[] = [];
  const dismissed: Proposal[] = [];

  for (const { official, side } of ours) {
    const result = orientResult(official, side);
    if (!result) continue; // gara non ancora giocata

    const decision = decisionByGame.get(official.externalId);
    if (decision?.decision === "dismissed") {
      dismissed.push({
        category,
        official,
        side,
        result,
        kind: "unmatched",
        match: null,
        candidates: [],
        linkedByAdmin: false,
      });
      continue;
    }

    let match: Match | null = null;
    let linkedByAdmin = false;
    if (decision?.decision === "linked" && decision.matchId) {
      match = byId.get(decision.matchId) ?? null;
      linkedByAdmin = match !== null;
    }
    if (!match) {
      match = autoMatch(
        official,
        pool.filter((candidate) => !claimed.has(candidate.id)),
        aliases,
      );
      if (match) claimed.add(match.id);
    }

    if (!match) {
      proposals.push({
        category,
        official,
        side,
        result,
        kind: "unmatched",
        match: null,
        candidates: [],
        linkedByAdmin: false,
      });
      continue;
    }

    const hasResult = match.resultSetsWon !== null && match.resultSetsLost !== null;
    if (hasResult && sameResult(match, result)) continue; // già a posto

    const kind: ProposalKind = hasResult ? "conflict" : result.sets ? "new" : "no-sets";
    proposals.push({ category, official, side, result, kind, match, candidates: [], linkedByAdmin });
  }

  // Alle gare senza partita abbinata si offrono le partite libere vicine nel tempo.
  for (const proposal of proposals) {
    if (proposal.kind !== "unmatched") continue;
    proposal.candidates = pool
      .filter((match) => !claimed.has(match.id))
      .filter(
        (match) =>
          daysBetween(proposal.official.date.slice(0, 10), match.matchDate.slice(0, 10)) <=
          MANUAL_CANDIDATE_WINDOW_DAYS,
      )
      .sort(
        (a, b) =>
          daysBetween(proposal.official.date.slice(0, 10), a.matchDate.slice(0, 10)) -
          daysBetween(proposal.official.date.slice(0, 10), b.matchDate.slice(0, 10)),
      );
  }

  proposals.sort((a, b) => b.official.date.localeCompare(a.official.date));
  dismissed.sort((a, b) => b.official.date.localeCompare(a.official.date));
  return { proposals, dismissed, aliasesNotFound };
}
