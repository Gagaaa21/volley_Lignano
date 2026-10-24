import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "./category";
import type { MatchInput, SetScore, TournamentGame } from "./types";

/**
 * Le notifiche push delle partite, mirate: dicono che cosa è cambiato (l'orario, il luogo, il ritrovo, il risultato, le
 * convocazioni…) invece di un generico «Partita modificata», e non partono se non è cambiato niente che interessi a chi segue
 * il calendario. Funzioni pure: le usano le azioni del server per mandarle e il modulo della partita per mostrare in anteprima
 * quella che partirà.
 */

export interface MatchNotice {
  title: string;
  body: string;
}

type MatchFacts = Pick<
  MatchInput,
  "team" | "category" | "opponent" | "isHome" | "isFriendly" | "isTournament" | "location" | "matchDate" | "meetingTime" | "meetingLocation" | "notes"
>;

/** «U15 @ Pol. Codroipo»: «vs» in casa, «@» in trasferta; per un torneo solo il suo nome (non c'è un'avversaria sola). */
export function matchupLabel(match: Pick<MatchFacts, "category" | "opponent" | "isHome" | "isFriendly" | "isTournament">): string {
  const prefix = match.isFriendly ? "Amichevole " : "";
  const category = match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL;
  if (match.isTournament) return `${prefix}${category} · ${match.opponent}`;
  return `${prefix}${category} ${match.isHome ? "vs" : "@"} ${match.opponent}`;
}

/** «mer 28 ottobre» */
function dayLabel(matchDate: string): string {
  return format(parseISO(matchDate.slice(0, 10)), "EEE d MMMM", { locale: it });
}

/** «mer 28 ottobre, 18:00» */
export function whenLabel(matchDate: string): string {
  return `${dayLabel(matchDate)}, ${matchDate.slice(11, 16)}`;
}

/** Dove porta la notifica: il calendario della squadra, sul mese della partita e (per l'U14/U15) sulla sua categoria. */
export function matchNoticeUrl(match: Pick<MatchFacts, "team" | "category" | "matchDate">): string {
  const month = match.matchDate.slice(0, 7);
  if (match.team === "minivolley") return `/minivolley?month=${month}`;
  return match.category ? `/?month=${month}&cat=${match.category}` : `/?month=${month}`;
}

/** Due avvisi sulla stessa partita si sostituiscono sul telefono: resta solo l'ultimo. */
export function matchNoticeTag(matchId: string): string {
  return `partita-${matchId}`;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function shorten(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function meetingText(match: Pick<MatchFacts, "meetingTime" | "meetingLocation">): string {
  const time = clean(match.meetingTime);
  const place = clean(match.meetingLocation);
  if (!time && !place) return "ritrovo come la partita";
  return ["ritrovo", time && `alle ${time}`, place && `a ${place}`].filter(Boolean).join(" ");
}

export function newMatchNotice(match: MatchFacts): MatchNotice {
  return { title: "Nuova partita", body: `${matchupLabel(match)} · ${whenLabel(match.matchDate)} · ${match.location}` };
}

export function deletedMatchNotice(match: MatchFacts): MatchNotice {
  return { title: "Partita tolta dal calendario", body: `${matchupLabel(match)} · ${whenLabel(match.matchDate)}: non è più in calendario.` };
}

type ChangeKind = "data" | "orario" | "luogo" | "ritrovo" | "squadre" | "nota";

const TITLES: Record<ChangeKind, string> = {
  data: "Cambio data",
  orario: "Cambio orario",
  luogo: "Cambio luogo",
  ritrovo: "Ritrovo aggiornato",
  squadre: "Partita aggiornata",
  nota: "Nota sulla partita",
};

/** Che cosa è cambiato, nell'ordine in cui conta per chi deve esserci. */
export function matchChanges(before: MatchFacts, after: MatchFacts): ChangeKind[] {
  const kinds: ChangeKind[] = [];
  if (before.matchDate.slice(0, 10) !== after.matchDate.slice(0, 10)) kinds.push("data");
  else if (before.matchDate.slice(11, 16) !== after.matchDate.slice(11, 16)) kinds.push("orario");
  if (clean(before.location) !== clean(after.location)) kinds.push("luogo");
  if (clean(before.meetingTime) !== clean(after.meetingTime) || clean(before.meetingLocation) !== clean(after.meetingLocation)) kinds.push("ritrovo");
  if (
    clean(before.opponent) !== clean(after.opponent) ||
    before.category !== after.category ||
    before.isHome !== after.isHome ||
    before.isFriendly !== after.isFriendly ||
    before.isTournament !== after.isTournament
  ) {
    kinds.push("squadre");
  }
  // Una nota nuova o cambiata interessa; una nota tolta no.
  if (clean(after.notes) && clean(before.notes) !== clean(after.notes)) kinds.push("nota");
  return kinds;
}

/**
 * L'avviso per una partita modificata: il titolo dice che cosa è cambiato («Cambio orario», «Cambiano data e luogo»…), il
 * testo il nuovo valore (e quello di prima per data e orario). Null se non è cambiato niente che interessi a chi segue.
 */
export function matchChangeNotice(before: MatchFacts, after: MatchFacts): MatchNotice | null {
  const kinds = matchChanges(before, after);
  if (kinds.length === 0) return null;

  const parts: string[] = [];
  for (const kind of kinds) {
    if (kind === "data") {
      const sameTime = before.matchDate.slice(11, 16) === after.matchDate.slice(11, 16);
      parts.push(`si gioca ${whenLabel(after.matchDate)} (prima ${sameTime ? dayLabel(before.matchDate) : whenLabel(before.matchDate)})`);
    } else if (kind === "orario") {
      parts.push(`si gioca alle ${after.matchDate.slice(11, 16)} (prima ${before.matchDate.slice(11, 16)})`);
    } else if (kind === "luogo") {
      parts.push(`nuovo luogo: ${clean(after.location)}`);
    } else if (kind === "ritrovo") {
      parts.push(meetingText(after));
    } else if (kind === "squadre") {
      if (before.isHome !== after.isHome) parts.push(after.isHome ? "ora in casa" : "ora in trasferta");
      if (before.isFriendly !== after.isFriendly) parts.push(after.isFriendly ? "ora è un'amichevole" : "ora è di campionato");
    } else if (kind === "nota") {
      parts.push(`nota: ${shorten(clean(after.notes))}`);
    }
  }
  // Data e orario si dicono sempre: chi legge solo «Cambio luogo» deve sapere di quale partita si parla.
  if (!kinds.includes("data") && !kinds.includes("orario")) parts.unshift(whenLabel(after.matchDate));

  const labels = kinds.filter((kind) => kind !== "squadre").map((kind) => (kind === "ritrovo" ? "ritrovo" : kind));
  const title =
    kinds.length === 1
      ? TITLES[kinds[0]]
      : labels.length >= 2
        ? `Cambiano ${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`
        : "Partita aggiornata";
  return { title, body: `${matchupLabel(after)} · ${parts.join(" · ")}` };
}

export interface MatchResultFacts {
  setScores: SetScore[] | null;
  resultSetsWon: number | null;
  resultSetsLost: number | null;
  tournamentGames: TournamentGame[] | null;
}

function partials(scores: SetScore[]): string {
  return scores.map((set) => `${set.us}-${set.them}`).join(" ");
}

function sameResult(a: MatchResultFacts, b: MatchResultFacts): boolean {
  return JSON.stringify([a.setScores ?? [], a.tournamentGames ?? []]) === JSON.stringify([b.setScores ?? [], b.tournamentGames ?? []]);
}

/** L'avviso del risultato: «Vinta 3-1» con i parziali. Null se il risultato non c'è o non è cambiato. */
export function resultNotice(match: MatchFacts, before: MatchResultFacts, after: MatchResultFacts): MatchNotice | null {
  if (sameResult(before, after)) return null;
  const matchup = matchupLabel(match);
  if (match.isTournament) {
    const played = (after.tournamentGames ?? []).filter((game) => game.setScores.length > 0);
    if (played.length === 0) return null;
    const games = played.map((game) => {
      const won = game.setScores.filter((set) => set.us > set.them).length;
      const lost = game.setScores.length - won;
      return `${won > lost ? "vinta" : "persa"} ${won}-${lost} con ${game.opponent}`;
    });
    return { title: "Risultati del torneo", body: shorten(`${matchup}: ${games.join(", ")}`, 160) };
  }
  if (after.resultSetsWon === null || after.resultSetsLost === null) return null;
  const won = after.resultSetsWon > after.resultSetsLost;
  const score = `${after.resultSetsWon}-${after.resultSetsLost}`;
  const detail = after.setScores && after.setScores.length > 0 ? ` (${partials(after.setScores)})` : "";
  return { title: `${won ? "Vinta" : "Persa"} ${score}`, body: `${matchup} · ${dayLabel(match.matchDate)}${detail}` };
}

/** L'avviso delle convocazioni: quante sono e il ritrovo (mai i nomi). Null se la lista non è cambiata o è vuota. */
export function callUpsNotice(match: MatchFacts, before: readonly string[], after: readonly string[]): MatchNotice | null {
  if (after.length === 0) return null;
  const same = before.length === after.length && after.every((id) => before.includes(id));
  if (same) return null;
  const meeting = clean(match.meetingTime) || clean(match.meetingLocation) ? ` · ${meetingText(match)}` : "";
  return {
    title: before.length === 0 ? "Convocazioni pronte" : "Convocazioni aggiornate",
    body: `${matchupLabel(match)} · ${whenLabel(match.matchDate)} · ${after.length === 1 ? "1 convocata" : `${after.length} convocate`}${meeting}`,
  };
}
