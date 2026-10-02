import { SegmentedLinks } from "@/components/ui/Segmented";
import { CATEGORY_LABELS } from "@/lib/category";
import type { Category } from "@/lib/types";

const OPTIONS: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "U14", label: CATEGORY_LABELS.U14 },
  { value: "U15", label: CATEGORY_LABELS.U15 },
];

export function CategoryFilter({ active, month }: { active: "all" | Category; month: string }) {
  return (
    <SegmentedLinks
      ariaLabel="Filtra per categoria"
      dataTour="public-category-filter"
      stretch
      items={OPTIONS.map((opt) => ({
        href: opt.value === "all" ? `/?month=${month}` : `/?month=${month}&cat=${opt.value}`,
        label: opt.label,
        active: active === opt.value,
      }))}
    />
  );
}
