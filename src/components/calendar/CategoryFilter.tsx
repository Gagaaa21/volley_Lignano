import Link from "next/link";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS } from "@/lib/category";
import type { Category } from "@/lib/types";

const OPTIONS: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "U14", label: CATEGORY_LABELS.U14 },
  { value: "U15", label: CATEGORY_LABELS.U15 },
];

export function CategoryFilter({ active, month }: { active: "all" | Category; month: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-sm shadow-sea-950/5">
      {OPTIONS.map((opt) => {
        const href = opt.value === "all" ? `/?month=${month}` : `/?month=${month}&cat=${opt.value}`;
        const isActive = active === opt.value;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              isActive ? "bg-sea-700 text-white shadow-sm" : "text-foreground/60 hover:bg-surface-muted",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
