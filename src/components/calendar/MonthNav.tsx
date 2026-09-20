import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthParam, shiftMonth } from "@/lib/month";

export function MonthNav({
  monthDate,
  cat,
  basePath = "/",
}: {
  monthDate: Date;
  cat?: string;
  basePath?: string;
}) {
  const prev = formatMonthParam(shiftMonth(monthDate, -1));
  const next = formatMonthParam(shiftMonth(monthDate, 1));
  const current = formatMonthParam(new Date());
  const suffix = cat ? `&cat=${cat}` : "";

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}?month=${prev}${suffix}`}
        aria-label="Mese precedente"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground/70 transition-colors hover:border-primary/30 hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <p className="w-36 text-center font-display text-lg font-bold capitalize text-foreground sm:w-44">
        {format(monthDate, "MMMM yyyy", { locale: it })}
      </p>
      <Link
        href={`${basePath}?month=${next}${suffix}`}
        aria-label="Mese successivo"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground/70 transition-colors hover:border-primary/30 hover:text-primary"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
      <Link
        href={`${basePath}?month=${current}${suffix}`}
        className="ml-1 rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition-colors hover:border-primary/30 hover:text-primary"
      >
        Oggi
      </Link>
    </div>
  );
}
