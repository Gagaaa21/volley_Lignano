import type { CourtPosition, LiveScorePlayers } from "@/lib/types";

/**
 * Geometria del campo e rotazione, uguali per Live score e Scout: dove sta
 * ogni posizione dal 2 contro 2 al 6 contro 6, come si disegna una metà campo e
 * come si ruota. Niente di tutto questo conosce punti, set o formazioni.
 */

// ── Disposizione in campo ──────────────────────────────────────────────

/**
 * Dove sta ogni posizione, vista da chi guarda la rete: `depth` 0 è la fila a
 * rete (più alta = più lontana), `lateral` va da sinistra a destra, `span` è
 * quante «corsie» laterali occupa (per centrare una giocatrice tra due).
 */
export interface CourtSlot {
  position: CourtPosition;
  depth: number;
  lateral: number;
  span: number;
}

export interface CourtLayout {
  /** Larghezza relativa di ogni fila, dalla rete al fondo. */
  depthWeights: number[];
  /** Quante corsie laterali ha la metà campo. */
  lanes: number;
  slots: CourtSlot[];
  /** Linea dei 3 metri tra la fila a rete e il fondo (solo con due file). */
  attackLine: boolean;
}

const slot = (position: CourtPosition, depth: number, lateral: number, span = 1): CourtSlot => ({
  position,
  depth,
  lateral,
  span,
});

/**
 * Le disposizioni dei vari formati. Numerazione come nella pallavolo a 6: la 1
 * è chi batte, e a ogni rotazione ognuna passa al numero prima (la 2 va in 1,
 * la 1 nell'ultimo) girando in senso orario.
 * - 6: rete 4-3-2, fondo 5-6-1.
 * - 5: rete 4-3-2, fondo 5-1.
 * - 4: a rombo — 3 a rete, 4 a sinistra, 2 a destra, 1 in fondo.
 * - 3: a triangolo — 2 a rete, 3 dietro a sinistra, 1 dietro a destra.
 * - 2: affiancate — 2 a sinistra, 1 a destra (battono a turno).
 */
const COURT_LAYOUTS: Record<LiveScorePlayers, CourtLayout> = {
  6: {
    depthWeights: [1, 2],
    lanes: 3,
    attackLine: true,
    slots: [slot(4, 0, 0), slot(3, 0, 1), slot(2, 0, 2), slot(5, 1, 0), slot(6, 1, 1), slot(1, 1, 2)],
  },
  5: {
    depthWeights: [1, 2],
    lanes: 6,
    attackLine: true,
    slots: [slot(4, 0, 0, 2), slot(3, 0, 2, 2), slot(2, 0, 4, 2), slot(5, 1, 0, 3), slot(1, 1, 3, 3)],
  },
  4: {
    depthWeights: [1, 1, 1],
    lanes: 2,
    attackLine: false,
    slots: [slot(3, 0, 0, 2), slot(4, 1, 0), slot(2, 1, 1), slot(1, 2, 0, 2)],
  },
  3: {
    depthWeights: [1, 2],
    lanes: 2,
    attackLine: true,
    slots: [slot(2, 0, 0, 2), slot(3, 1, 0), slot(1, 1, 1)],
  },
  2: {
    depthWeights: [1],
    lanes: 2,
    attackLine: false,
    slots: [slot(2, 0, 0), slot(1, 0, 1)],
  },
};

export function courtLayout(players: LiveScorePlayers): CourtLayout {
  return COURT_LAYOUTS[players];
}

/** Una cella della metà campo nel tabellone orizzontale (rete al centro). */
export interface HalfCourtCell {
  position: CourtPosition;
  /** Colonna e riga della griglia CSS (da 1). */
  column: number;
  row: number;
  rowSpan: number;
  /** Lato della cella su cui passa la linea dei 3 metri, se c'è. */
  attackLineSide: "left" | "right" | null;
}

/**
 * La metà campo pronta da disegnare. La squadra a sinistra guarda verso destra
 * (rete a destra, la sua sinistra in alto); quella a destra guarda verso
 * sinistra, e tutto si capovolge.
 */
export function halfCourtGrid(
  players: LiveScorePlayers,
  side: "left" | "right",
): { columns: string; rows: number; cells: HalfCourtCell[] } {
  const layout = courtLayout(players);
  const depths = layout.depthWeights.length;
  const weights = side === "left" ? [...layout.depthWeights].reverse() : layout.depthWeights;
  const cells = layout.slots.map((s) => {
    const column = side === "left" ? depths - s.depth : s.depth + 1;
    const row = side === "left" ? s.lateral + 1 : layout.lanes - s.lateral - s.span + 1;
    const isBackRow = layout.attackLine && s.depth === 1;
    return {
      position: s.position,
      column,
      row,
      rowSpan: s.span,
      attackLineSide: isBackRow ? (side === "left" ? "right" : "left") : null,
    } satisfies HalfCourtCell;
  });
  return { columns: weights.map((w) => `${w}fr`).join(" "), rows: layout.lanes, cells };
}

/** Le posizioni «a rete»: la libero, se c'è, esce quando chi sostituisce ci
 * arriva. A 4 (rombo) solo la 3, a 3 (triangolo) solo la 2. */
export function frontPositions(players: LiveScorePlayers): CourtPosition[] {
  return courtLayout(players)
    .slots.filter((s) => s.depth === 0)
    .map((s) => s.position);
}

/** Nel 2 contro 2 le giocatrici sono affiancate, senza seconda linea: la libero non c'è. */
export function hasLiberoOption(players: LiveScorePlayers): boolean {
  return players > 2;
}

/** Una rotazione: chi era in posizione 2 diventa la nuova battitrice
 * (posizione 1), chi era in posizione 1 va nell'ultima, e così via — il giro
 * in senso orario della pallavolo, con qualunque numero di giocatrici. */
export function rotateOnce(positions: string[]): string[] {
  if (positions.length === 0) return positions;
  return [...positions.slice(1), positions[0]];
}

/** Porta la formazione a `players` posizioni, tenendo i nomi già scritti
 * nelle posizioni che restano. */
export function resizePositions(positions: string[], players: LiveScorePlayers): string[] {
  return Array.from({ length: players }, (_, i) => positions[i] ?? "");
}
