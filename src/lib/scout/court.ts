import { reentryFor, substitutionRuleWarning } from "@/lib/lineup";
import { SUBSTITUTIONS_PER_SET } from "@/lib/volleyRules";
import { playerLabel, sortPlayers } from "./describe";
import type { ScoutCourt, ScoutView } from "./derive";
import type { ScoutData, ScoutPlayer, ScoutRoster, ScoutSide } from "./types";

/**
 * Piccoli aiuti per le schermate che usano la formazione in campo (vedi
 * ScoutCourt in derive.ts): chi batte, chi sta in panchina, in che ordine
 * proporre le giocatrici e se un cambio rispetta le regole.
 */

/** Quanti cambi si possono fare in un set nel 6 contro 6: 8 dal 2026/2027 (vedi volleyRules.ts, una sola fonte con il Live score). */
export { SUBSTITUTIONS_PER_SET };

/** Chi batte adesso per questa squadra: la giocatrice in posizione 1 (la libero non batte mai). Undefined se non se ne segue la formazione. */
export function serverId(view: ScoutView, side: ScoutSide): string | undefined {
  const id = view.court[side]?.positions[0];
  return id ? id : undefined;
}

/** In che posizione (1…6) gioca adesso, o null se è in panchina. Per la libero è quella di chi sostituisce. */
export function positionOf(court: ScoutCourt | null, id: string): number | null {
  if (!court) return null;
  const index = court.onCourt.indexOf(id);
  return index < 0 ? null : index + 1;
}

/** La panchina: chi è in rosa ma non in campo (la libero entra da sola, non si cambia). */
export function benchOf(roster: ScoutPlayer[], court: ScoutCourt): ScoutPlayer[] {
  const playing = new Set([...court.positions, ...court.onCourt]);
  return sortPlayers(roster.filter((player) => !playing.has(player.id) && player.id !== court.libero));
}

/** Le posizioni come si vedono dalla propria metà campo: davanti (vicino alla rete) 4-3-2, dietro 5-6-1. */
export const COURT_ROWS: readonly (readonly number[])[] = [
  [4, 3, 2],
  [5, 6, 1],
];

/** Come si legge una giocatrice sul campo: il numero di maglia (per noi, in mancanza, l'iniziale). */
export function jerseyLabel(player: ScoutPlayer, side: ScoutSide): string {
  return player.number ?? (side === "us" ? player.name.trim().slice(0, 1).toUpperCase() : "?");
}

/** Una posizione del campo, pronta da disegnare. */
export interface CourtSpot {
  /** 1…6. */
  position: number;
  /** Chi gioca davvero lì (la libero al posto di chi sostituisce). Undefined se la posizione è vuota. */
  player: ScoutPlayer | undefined;
  /** È la libero. */
  libero: boolean;
  /** Si può scegliere per l'azione che si sta segnando (in rosa e tra chi può farla). */
  pickable: boolean;
  /** Seconda linea (5-6-1). */
  back: boolean;
}

/**
 * Il campo in due file da tre (davanti 4-3-2, dietro 5-6-1): chi sta in ogni posizione e se si può scegliere.
 * `eligible` sono quelle che possono fare l'azione (la libero non può murare): le altre si vedono, ma non si toccano.
 */
export function courtSpots(court: ScoutCourt, roster: ScoutPlayer[], eligible: ScoutPlayer[]): CourtSpot[][] {
  const allowed = new Set(eligible.map((player) => player.id));
  return COURT_ROWS.map((row, index) =>
    row.map((position) => {
      const id = court.onCourt[position - 1];
      const player = id ? roster.find((p) => p.id === id) : undefined;
      return {
        position,
        player,
        libero: player !== undefined && player.id === court.libero,
        pickable: player !== undefined && allowed.has(player.id),
        back: index === 1,
      };
    }),
  );
}

/** Il campo su cui si segna la ricezione: si segue la formazione nostra e c'è almeno una giocatrice in rosa. Altrimenti null (si sceglie da una riga di numeri). */
export function receptionCourt(data: ScoutData, view: ScoutView): ScoutCourt | null {
  return data.roster.us.length > 0 ? view.court.us : null;
}

/** Chi può fare l'azione e non è in campo (la panchina da cui scegliere), per numero di maglia. */
export function benchOptions(eligible: ScoutPlayer[], court: ScoutCourt): ScoutPlayer[] {
  return sortPlayers(eligible).filter((player) => positionOf(court, player.id) === null);
}

export interface OrderedPlayer {
  player: ScoutPlayer;
  /** Posizione in campo (1…6), null in panchina. */
  position: number | null;
}

/** Prima chi è in campo, nell'ordine delle posizioni, poi le altre per numero di maglia. Senza formazione, solo per numero. */
export function orderByCourt(players: ScoutPlayer[], court: ScoutCourt | null): OrderedPlayer[] {
  const sorted = sortPlayers(players);
  if (!court) return sorted.map((player) => ({ player, position: null }));
  const playing = sorted
    .map((player) => ({ player, position: positionOf(court, player.id) }))
    .filter((entry): entry is OrderedPlayer & { position: number } => entry.position !== null)
    .sort((a, b) => a.position - b.position);
  const bench = sorted.filter((player) => positionOf(court, player.id) === null).map((player) => ({ player, position: null }));
  return [...playing, ...bench];
}

/** Avvertimento sul cambio che si sta per fare, null se è regolare (vedi substitutionRuleWarning in lineup.ts). */
export function substitutionWarningFor(
  data: ScoutData,
  view: ScoutView,
  side: ScoutSide,
  position: number,
  incoming: string,
): string | null {
  const court = view.court[side];
  const set = view.current;
  if (!court || !set) return null;
  const starters = set.lineups[side]?.positions ?? court.positions;
  return substitutionRuleWarning({
    incoming,
    outgoing: court.positions[position - 1] ?? "",
    subs: set.subs.filter((sub) => sub.side === side),
    starters,
    limit: SUBSTITUTIONS_PER_SET,
    label: (id) => playerLabel(data.roster, side, id),
  });
}

/**
 * Se `incoming` è una titolare uscita in questo set che può ancora rientrare: chi l'ha sostituita e dove si trova
 * adesso (la posizione da scegliere come «chi esce»). Rientra al posto della sostituta, non nella posizione in cui è
 * uscita: nel frattempo la squadra può aver ruotato.
 */
export function reentryOfPlayer(
  view: ScoutView,
  side: ScoutSide,
  incoming: string,
): { replacedBy: string; position: 1 | 2 | 3 | 4 | 5 | 6 } | null {
  const court = view.court[side];
  const set = view.current;
  if (!court || !set) return null;
  const starters = set.lineups[side]?.positions ?? court.positions;
  const found = reentryFor({ player: incoming, subs: set.subs.filter((sub) => sub.side === side), starters });
  if (!found) return null;
  const index = court.positions.indexOf(found.replacedBy);
  return index < 0 ? null : { replacedBy: found.replacedBy, position: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 };
}

/** Cambi fatti da una squadra nel set in corso. */
export function substitutionsUsed(view: ScoutView, side: ScoutSide): number {
  return view.current?.subs.filter((sub) => sub.side === side).length ?? 0;
}

// ── tabellino e PDF ─────────────────────────────────────────────────────

/** Come si scrive una giocatrice nelle tabelle: il numero di maglia (per noi, in mancanza, il nome). */
function tableLabel(roster: ScoutRoster, side: ScoutSide, id: string | null | undefined): string {
  if (!id) return "–";
  const player = roster[side].find((p) => p.id === id);
  if (!player) return "?";
  return player.number ?? (side === "us" ? player.name : "?");
}

/** La formazione con cui è cominciato un set, per una squadra. */
export interface StartingLineupRow {
  set: number;
  side: ScoutSide;
  /** Chi era in posizione 1…6 (numeri di maglia). */
  positions: string[];
  libero: string | null;
}

export interface SubstitutionRow {
  set: number;
  side: ScoutSide;
  position: number;
  out: string;
  in: string;
  score: { us: number; opp: number };
}

/**
 * Formazioni di partenza e cambi di ogni set, per il tabellino (solo i set
 * giocati, o uno solo). Vuoto se non si è mai seguita la formazione.
 */
export function lineupSummary(
  view: ScoutView,
  roster: ScoutRoster,
  only: number | null = null,
): { starts: StartingLineupRow[]; subs: SubstitutionRow[] } {
  const starts: StartingLineupRow[] = [];
  const subs: SubstitutionRow[] = [];
  for (const set of view.sets) {
    if (set.rallies.length === 0 || (only !== null && set.n !== only)) continue;
    for (const side of ["us", "opp"] as const) {
      const court = set.lineups[side];
      if (court) {
        starts.push({
          set: set.n,
          side,
          positions: court.positions.map((id) => tableLabel(roster, side, id)),
          libero: court.libero ? tableLabel(roster, side, court.libero) : null,
        });
      }
    }
    for (const sub of set.subs) {
      subs.push({
        set: set.n,
        side: sub.side,
        position: sub.position,
        out: tableLabel(roster, sub.side, sub.out),
        in: tableLabel(roster, sub.side, sub.in),
        score: sub.score,
      });
    }
  }
  return { starts, subs };
}
