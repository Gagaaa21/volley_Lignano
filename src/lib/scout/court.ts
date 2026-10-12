import { substitutionRuleWarning } from "@/lib/lineup";
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
  const starters = set.rallies.length === 0 ? court.positions : (set.lineups[side]?.positions ?? court.positions);
  return substitutionRuleWarning({
    incoming,
    outgoing: court.positions[position - 1] ?? "",
    position,
    subs: set.subs.filter((sub) => sub.side === side),
    starters,
    limit: SUBSTITUTIONS_PER_SET,
    label: (id) => playerLabel(data.roster, side, id),
  });
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
