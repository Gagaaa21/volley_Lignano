import type { Category, TrainingColor } from "@/lib/types";

export const CATEGORY_LABELS: Record<Category, string> = {
  U14: "Under 14",
  U15: "Under 15",
};

export const CATEGORY_DOT: Record<Category, string> = {
  U14: "bg-[var(--color-u14)]",
  U15: "bg-[var(--color-u15)]",
};

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
export const NO_CATEGORY_BADGE = "bg-foreground/8 text-foreground/50";
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
