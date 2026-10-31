import type { ScoutRally } from "./derive";
import { asksPlayerFor, HOW_META } from "./rules";
import { cleanNumber } from "./actions";
import { GRADE_META, TOUCH_SKILLS } from "./touches";
import type { ScoutPlayer, ScoutRoster, ScoutSide, ScoutTouch } from "./types";

/** Come si chiamano le due squadre a schermo: sempre dal nostro punto di vista. */
export function sideLabel(side: ScoutSide, form: "subject" | "possessive" = "subject"): string {
  if (form === "possessive") return side === "us" ? "nostro" : "loro";
  return side === "us" ? "Noi" : "Loro";
}

/** Per numero di maglia (chi non ce l'ha in fondo), poi per nome. */
export function sortPlayers(players: ScoutPlayer[]): ScoutPlayer[] {
  const rank = (p: ScoutPlayer) => (p.number === null ? Number.POSITIVE_INFINITY : Number(p.number));
  return [...players].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "it"));
}

function abbreviate(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? name.trim() : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Nome corto per i pulsanti: «Giulia B.» da «Giulia Bianchi». Se due
 * giocatrici darebbero lo stesso nome corto si tiene quello intero.
 */
export function shortName(player: ScoutPlayer, roster: ScoutPlayer[]): string {
  const short = abbreviate(player.name);
  const clash = roster.some((other) => other.id !== player.id && abbreviate(other.name) === short);
  return clash ? player.name.trim() : short;
}

/** «Anna (4)», «n. 7» per l'avversaria, o «Non indicata» se nello scambio non si è detto chi. */
export function playerLabel(roster: ScoutRoster, side: ScoutSide, id: string | null): string {
  if (id === null) return "Non indicata";
  const player = roster[side].find((p) => p.id === id);
  if (!player) return "Non indicata";
  if (side === "opp") return player.number ? `n. ${player.number}` : player.name;
  return player.number ? `${player.name} (${player.number})` : player.name;
}

export interface RallyText {
  /** Chi ha fatto il punto. */
  winner: ScoutSide;
  /** Come: «Attacco», «Battuta sbagliata»… */
  label: string;
  /** Chi ha compiuto l'azione. */
  who: string;
  /** Per il muro: l'attacco murato, se si sa chi attaccava. */
  victim: string | null;
}

export function rallyText(rally: Pick<ScoutRally, "winner" | "actor" | "how" | "player" | "victim">, roster: ScoutRoster): RallyText {
  const meta = HOW_META[rally.how];
  const other: ScoutSide = rally.actor === "us" ? "opp" : "us";
  return {
    winner: rally.winner,
    label: meta.label,
    // Rotazione e sanzioni sono della squadra, e per l'avversaria non si chiede chi: nessuna giocatrice da indicare.
    who: !asksPlayerFor(rally.actor, rally.how) && rally.player === null ? "Squadra" : playerLabel(roster, rally.actor, rally.player),
    victim: rally.how === "block" && rally.victim ? playerLabel(roster, other, rally.victim) : null,
  };
}

/** Un tocco a parole: «Noi · Ricezione · Anna (4) · Positiva». */
export function touchLabel(touch: ScoutTouch, roster: ScoutRoster): string {
  const meta = TOUCH_SKILLS[touch.skill];
  const grade = meta.gradeLabels[touch.grade] ?? GRADE_META[touch.grade].name;
  return `${sideLabel(touch.side)} · ${meta.label} · ${playerLabel(roster, touch.side, touch.player)} · ${grade}`;
}

/** Numeri di maglia scritti a mano: «1 4, 7;9» → ["1", "4", "7", "9"], senza doppioni né valori che non sono numeri. */
export function parseJerseyNumbers(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of text.split(/[\s,;.]+/)) {
    const number = cleanNumber(token);
    if (number === null || seen.has(number)) continue;
    seen.add(number);
    result.push(number);
  }
  return result;
}
