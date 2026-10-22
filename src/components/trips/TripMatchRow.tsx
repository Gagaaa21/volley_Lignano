import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { MapPin } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CategoryTag } from "@/components/ui/CategoryTag";
import type { Match } from "@/lib/types";

/** Una riga dell'elenco trasferte: data in grande a sinistra, partita e luogo al centro, stato e azione. */
export function TripMatchRow({ match, status, action, ...rest }: { match: Match; status?: ReactNode; action: ReactNode } & { [attribute: `data-${string}`]: string | undefined }) {
  const date = parseISO(match.matchDate.slice(0, 10));
  return (
    <div className="flex flex-col px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5" {...rest}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="w-11 shrink-0 text-center">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {format(date, "EEE", { locale: it })}
          </span>
          <span className="display-wide tabular block text-[1.375rem] leading-7 text-foreground">{format(date, "d")}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {format(date, "MMM", { locale: it })}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-foreground">{matchTitle(match)}</span>
            <CategoryTag category={match.category} long />
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="tabular shrink-0 font-semibold text-foreground/75">{match.matchDate.slice(11, 16)}</span>
            <MapPin className="ml-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{match.location}</span>
          </p>
          {status}
        </div>
      </div>
      <div className="mt-2.5 pl-[3.75rem] sm:mt-0 sm:pl-0">{action}</div>
    </div>
  );
}
