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
