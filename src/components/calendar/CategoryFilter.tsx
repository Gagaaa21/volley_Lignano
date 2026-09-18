import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/category";
import type { Category } from "@/lib/types";

const OPTIONS: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "U14", label: CATEGORY_LABELS.U14 },
  { value: "U15", label: CATEGORY_LABELS.U15 },
];

export function CategoryFilter({ active, month }: { active: "all" | Category; month: string }) {
  return (
    <div className="nav-rail w-fit">
      {OPTIONS.map((opt) => {
        const href = opt.value === "all" ? `/?month=${month}` : `/?month=${month}&cat=${opt.value}`;
        const isActive = active === opt.value;
        return (
          <Link key={opt.value} href={href} data-active={isActive ? "true" : undefined} className="nav-tile">
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
