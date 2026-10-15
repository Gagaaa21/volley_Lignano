import type { HTMLAttributes } from "react";
import { CATEGORY_LABELS, CATEGORY_SHORT, CATEGORY_SOLID } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { Category } from "@/lib/types";

const SIZES = {
  xs: "rounded px-1 py-px text-[10px] leading-[14px]",
  sm: "rounded-md px-1.5 py-0.5 text-[11px] leading-4",
  md: "rounded-lg px-2.5 py-1 text-xs leading-4",
} as const;

/**
 * L'etichetta piena della categoria di una partita: «U14» in verde acqua, «U15» in viola, testo bianco. Sta accanto a ogni
 * partita di ogni elenco (calendario, area tecnici, Scout, pronostici…), così Under 14 e Under 15 si distinguono a colpo
 * d'occhio e anche senza vedere i colori. `long` scrive «Under 14» al posto della sigla. Senza categoria (partite che non ne
 * hanno) non disegna niente.
 */
export function CategoryTag({
  category,
  size = "sm",
  long = false,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, "children"> & { category: Category | null; size?: keyof typeof SIZES; long?: boolean }) {
  if (!category) return null;
  const name = CATEGORY_LABELS[category];
  return (
    <span
      data-category-tag={category}
      title={name}
      {...(long ? {} : { role: "img", "aria-label": name })}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-extrabold uppercase tracking-[0.04em] text-white",
        CATEGORY_SOLID[category],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {long ? name : CATEGORY_SHORT[category]}
    </span>
  );
}
