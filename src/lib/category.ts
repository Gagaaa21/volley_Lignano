import type { Category, MinivolleyGroup, TrainingColor } from "@/lib/types";

export const CATEGORY_LABELS: Record<Category, string> = {
  U14: "Under 14",
  U15: "Under 15",
};

export const CATEGORY_DOT: Record<Category, string> = {
  U14: "bg-[var(--color-u14)]",
  U15: "bg-[var(--color-u15)]",
};

/** Sigla corta, per le etichette strette (una cella del calendario, una riga d'elenco). */
export const CATEGORY_SHORT: Record<Category, string> = {
  U14: "U14",
  U15: "U15",
};

/** Etichetta piena (testo bianco): la categoria si legge anche da lontano e senza distinguere i colori. */
export const CATEGORY_SOLID: Record<Category, string> = {
  U14: "bg-[var(--color-u14-solid)]",
  U15: "bg-[var(--color-u15-solid)]",
};

/** Gli stessi due colori pieni, per i PDF (RGB 0-255). */
export const CATEGORY_RGB: Record<Category, [number, number, number]> = {
  U14: [15, 118, 110],
  U15: [109, 40, 217],
};

/** Il filtro «?cat=» delle pagine: U14, U15 oppure tutte (qualunque altro valore). */
export function parseCategoryFilter(value: string | null | undefined): "all" | Category {
  return value === "U14" || value === "U15" ? value : "all";
}

export const CATEGORY_BADGE: Record<Category, string> = {
  U14: "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]",
  U15: "bg-[var(--color-u15-soft)] text-[var(--color-u15-strong)]",
};

export const TRAINING_BADGE = "bg-[var(--color-training-soft)] text-[var(--color-training-strong)]";
export const TRAINING_DOT = "bg-[var(--color-training)]";

/** Colore scelto per una regola di allenamento, per distinguerla dalle
 * altre sul calendario (vedi TrainingColor in lib/types.ts). Fisse (non
 * legate al tema sea/sand di U14U15 o Minivolley, che cambiano da sito a
 * sito): lo stesso colore deve restare riconoscibile ovunque. */
export const TRAINING_COLOR_LABELS: Record<TrainingColor, string> = {
  amber: "Ambra",
  blue: "Blu",
  green: "Verde",
  teal: "Ciano",
  violet: "Viola",
  pink: "Rosa",
  orange: "Arancione",
  slate: "Grigio",
};

export const TRAINING_COLOR_BADGE: Record<TrainingColor, string> = {
  amber: "bg-[var(--color-training-amber-soft)] text-[var(--color-training-amber-strong)]",
  blue: "bg-[var(--color-training-blue-soft)] text-[var(--color-training-blue-strong)]",
  green: "bg-[var(--color-training-green-soft)] text-[var(--color-training-green-strong)]",
  teal: "bg-[var(--color-training-teal-soft)] text-[var(--color-training-teal-strong)]",
  violet: "bg-[var(--color-training-violet-soft)] text-[var(--color-training-violet-strong)]",
  pink: "bg-[var(--color-training-pink-soft)] text-[var(--color-training-pink-strong)]",
  orange: "bg-[var(--color-training-orange-soft)] text-[var(--color-training-orange-strong)]",
  slate: "bg-[var(--color-training-slate-soft)] text-[var(--color-training-slate-strong)]",
};

export const TRAINING_COLOR_DOT: Record<TrainingColor, string> = {
  amber: "bg-[var(--color-training-amber)]",
  blue: "bg-[var(--color-training-blue)]",
  green: "bg-[var(--color-training-green)]",
  teal: "bg-[var(--color-training-teal)]",
  violet: "bg-[var(--color-training-violet)]",
  pink: "bg-[var(--color-training-pink)]",
  orange: "bg-[var(--color-training-orange)]",
  slate: "bg-[var(--color-training-slate)]",
};

export function trainingBadgeClass(color: TrainingColor): string {
  return TRAINING_COLOR_BADGE[color];
}

export function trainingDotClass(color: TrainingColor): string {
  return TRAINING_COLOR_DOT[color];
}

export const NO_CATEGORY_LABEL = "Senza categoria";
export const NO_CATEGORY_BADGE = "bg-foreground/8 text-muted-foreground";
export const NO_CATEGORY_DOT = "bg-foreground/25";

/** Etichetta di una partita senza categoria (Minivolley, che non ha la
 * distinzione U14/U15): usata al posto di NO_CATEGORY_LABEL nei contesti
 * dove "Senza categoria" suonerebbe come un dato mancante invece che una
 * scelta di design. */
export const MATCH_NO_CATEGORY_LABEL = "Partita";

export function categoryLabel(category: Category | null): string {
  return category ? CATEGORY_LABELS[category] : NO_CATEGORY_LABEL;
}

export function categoryBadgeClass(category: Category | null): string {
  return category ? CATEGORY_BADGE[category] : NO_CATEGORY_BADGE;
}

export function categoryDotClass(category: Category | null): string {
  return category ? CATEGORY_DOT[category] : NO_CATEGORY_DOT;
}

/**
 * Chi si può convocare in una partita di quella categoria: in Under 15 giocano anche le Under 14 (più giovani), in Under 14 le
 * Under 15 no. Senza categoria (della partita o dell'atleta) non si esclude nessuna.
 */
export function canPlayInCategory(athlete: Category | null, match: Category | null): boolean {
  return !(match === "U14" && athlete === "U15");
}

/**
 * Il gruppo di un'atleta nell'elenco delle convocazioni: 0 la categoria della partita, 1 l'altra categoria che può giocare
 * (le Under 14 in una partita Under 15), 2 senza categoria, 3 chi non può giocare (le Under 15 in una partita Under 14).
 * Una partita senza categoria tiene tutte insieme.
 */
export function callUpGroup(athlete: Category | null, match: Category | null): 0 | 1 | 2 | 3 {
  if (!match) return 0;
  if (!canPlayInCategory(athlete, match)) return 3;
  if (athlete === match) return 0;
  return athlete ? 1 : 2;
}

/** L'elenco delle convocazioni con prima la categoria della partita (vedi callUpGroup); dentro ogni gruppo l'ordine resta quello di partenza. */
export function orderForCallUps<T extends { category: Category | null }>(athletes: readonly T[], match: Category | null): T[] {
  return athletes
    .map((athlete, index) => ({ athlete, index, group: callUpGroup(athlete.category, match) }))
    .sort((a, b) => a.group - b.group || a.index - b.index)
    .map(({ athlete }) => athlete);
}

export const MINIVOLLEY_GROUP_LABELS: Record<MinivolleyGroup, string> = {
  lignano: "CDA Lignano",
  san_michele: "CDA San Michele",
};

/** Riusa due tinte già esistenti in TRAINING_COLOR_BADGE/DOT invece di
 * definirne di nuove: le due palette (categoria allenamenti, gruppo
 * Minivolley) non compaiono mai nella stessa vista, niente rischio di
 * confusione visiva. */
export const MINIVOLLEY_GROUP_BADGE: Record<MinivolleyGroup, string> = {
  lignano: TRAINING_COLOR_BADGE.blue,
  san_michele: TRAINING_COLOR_BADGE.teal,
};

export const MINIVOLLEY_GROUP_DOT: Record<MinivolleyGroup, string> = {
  lignano: TRAINING_COLOR_DOT.blue,
  san_michele: TRAINING_COLOR_DOT.teal,
};

export const NO_GROUP_LABEL = "Senza gruppo";
export const NO_GROUP_BADGE = "bg-foreground/8 text-muted-foreground";
export const NO_GROUP_DOT = "bg-foreground/25";

export function groupLabel(group: MinivolleyGroup | null): string {
  return group ? MINIVOLLEY_GROUP_LABELS[group] : NO_GROUP_LABEL;
}

export function groupBadgeClass(group: MinivolleyGroup | null): string {
  return group ? MINIVOLLEY_GROUP_BADGE[group] : NO_GROUP_BADGE;
}

export function groupDotClass(group: MinivolleyGroup | null): string {
  return group ? MINIVOLLEY_GROUP_DOT[group] : NO_GROUP_DOT;
}
