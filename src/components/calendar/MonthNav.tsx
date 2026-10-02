import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthParam, shiftMonth } from "@/lib/month";
import { cn } from "@/lib/cn";

/** Navigazione mese (stesso schema dei calendari più diffusi): "Oggi",
 * frecce precedente/successivo raggruppate, nome del mese. Tutto via link
 * con querystring, nessun JS: funziona anche nei Server Component. */
export function MonthNav({
  monthDate,
  cat,
  basePath = "/",
  className,
}: {
  monthDate: Date;
  cat?: string;
  basePath?: string;
  className?: string;
}) {
  const prev = formatMonthParam(shiftMonth(monthDate, -1));
  const next = formatMonthParam(shiftMonth(monthDate, 1));
  const current = formatMonthParam(new Date());
  const isCurrent = formatMonthParam(monthDate) === current;
  const suffix = cat ? `&cat=${cat}` : "";

  const arrowClass =
    "grid h-9 w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Link
        href={`${basePath}?month=${current}${suffix}`}
        scroll={false}
        aria-disabled={isCurrent || undefined}
        className={cn(
          "inline-flex h-9 items-center rounded-xl border border-border-strong/80 bg-surface px-3 text-sm font-semibold shadow-xs transition-colors",
          isCurrent ? "pointer-events-none text-muted-foreground/70" : "text-foreground hover:bg-muted",
        )}
      >
        Oggi
      </Link>
      <div className="inline-flex overflow-hidden rounded-xl border border-border-strong/80 bg-surface shadow-xs">
        <Link href={`${basePath}?month=${prev}${suffix}`} scroll={false} aria-label="Mese precedente" className={arrowClass}>
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Link>
        <span aria-hidden className="w-px bg-border" />
        <Link href={`${basePath}?month=${next}${suffix}`} scroll={false} aria-label="Mese successivo" className={arrowClass}>
          <ChevronRight className="h-[18px] w-[18px]" />
        </Link>
      </div>
      <p className="ml-0.5 font-display text-lg font-bold capitalize leading-none text-foreground sm:text-xl">
        {format(monthDate, "MMMM yyyy", { locale: it })}
      </p>
    </div>
  );
}
