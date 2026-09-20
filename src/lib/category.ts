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

export function categoryLabel(category: Category | null): string {
  return category ? CATEGORY_LABELS[category] : NO_CATEGORY_LABEL;
}

export function categoryBadgeClass(category: Category | null): string {
  return category ? CATEGORY_BADGE[category] : NO_CATEGORY_BADGE;
}
