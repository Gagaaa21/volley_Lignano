"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, CalendarClock } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { DateChangeItem } from "@/lib/federation/calendarImport";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { updateOfficialDatesAction, type OfficialResultFormState } from "./official-actions";

const initialState: OfficialResultFormState = {};

function whenLabel(iso: string): string {
  return `${format(parseISO(iso.slice(0, 10)), "EEE d MMM", { locale: it })} · ore ${iso.slice(11, 16)}`;
}

/** Partite già nel sito la cui data o ora sul portale è cambiata (gara
 * spostata): un admin sceglie quali portare alla data ufficiale. Quelle non
 * scelte restano com'erano (e continuano a essere segnalate). Quando non ne
 * restano, rimane solo il messaggio dell'ultimo aggiornamento. */
export function OfficialDateChanges({ category, changes }: { category: Category; changes: DateChangeItem[] }) {
  const [state, formAction, pending] = useActionState(updateOfficialDatesAction, initialState);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const isChecked = (change: DateChangeItem) => !unchecked[change.official.externalId];
  const selected = changes.filter(isChecked).length;
  const label = CATEGORY_LABELS[category];

  if (changes.length === 0) {
    return state.message ? (
      <p className="text-sm font-semibold text-success" data-official-dates={category}>
        {label}: {state.message}
      </p>
    ) : null;
  }

  return (
    <form action={formAction} data-official-dates={category}>
      <input type="hidden" name="category" value={category} />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={category === "U14" ? "u14" : "u15"}>{label}</Badge>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
          <CalendarClock className="h-4 w-4" aria-hidden />
          {changes.length === 1
            ? "1 partita ha cambiato data o ora sul portale"
            : `${changes.length} partite hanno cambiato data o ora sul portale`}
        </p>
      </div>

      <List>
        <ul className="divide-y divide-border">
          {changes.map((change) => {
            const { official, side, opponent, match } = change;
            const id = `date-${category}-${official.externalId}`;
            return (
              <li key={official.externalId} data-official-game={official.externalId}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-4 py-3 sm:px-5">
                  <input
                    id={id}
                    type="checkbox"
                    name="externalId"
                    value={official.externalId}
                    checked={isChecked(change)}
                    onChange={(event) =>
                      setUnchecked((prev) => ({ ...prev, [official.externalId]: !event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-display text-sm font-bold text-foreground">vs {opponent}</span>
                      <Badge tone={side === "home" ? "success" : "neutral"}>
                        {side === "home" ? "in casa" : "in trasferta"}
                      </Badge>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="text-muted-foreground">Nel sito: {whenLabel(match.matchDate)}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="font-semibold text-warning">Sul portale: {whenLabel(official.date)}</span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </List>

      <div className="mt-3 space-y-3">
        <Toggle
          name="notify"
          label="Avvisa con una notifica"
          description="Una sola notifica a chi segue il calendario."
          defaultChecked
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || selected === 0}>
            <CalendarClock className="h-4 w-4" />
            {pending ? "Aggiorno…" : selected === 1 ? "Aggiorna 1 data" : `Aggiorna ${selected} date`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Cambia solo data e ora: palestra, ritrovo e convocazioni restano come sono. Se la data giusta è quella del
            sito, deseleziona la riga.
          </p>
        </div>
        {state.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
        {state.message && <p className="text-sm font-medium text-success">{state.message}</p>}
      </div>
    </form>
  );
}
