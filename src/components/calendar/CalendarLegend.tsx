import { ListFilter, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CalendarLegendItem {
  icon: LucideIcon;
  label: string;
  badgeClass: string;
}

export function CalendarLegend({ items }: { items: CalendarLegendItem[] }) {
  return (
    <div className="mt-10">
      <p className="eyebrow">
        <ListFilter className="h-3 w-3" />
        Legenda
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5">
        {items.map(({ icon: Icon, label, badgeClass }) => (
          <span
            key={label}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", badgeClass)}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
