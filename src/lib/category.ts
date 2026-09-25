import type { Category } from "@/lib/types";

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
