"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, CalendarPlus, Check } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { CalendarImportItem } from "@/lib/federation/calendarImport";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { importOfficialCalendarAction, type OfficialResultFormState } from "./official-actions";

const initialState: OfficialResultFormState = {};

function whenLabel(iso: string): string {
  return `${format(parseISO(iso.slice(0, 10)), "EEE d MMM", { locale: it })} · ore ${iso.slice(11, 16)}`;
}

/** Partite del calendario ufficiale che mancano nel sito, con anteprima: un
 * admin spunta quelle da aggiungere e conferma. Quelle con una partita simile
 * già nel sito (data spostata?) partono deselezionate. Quando non manca più
 * nulla resta una riga di conferma, così il messaggio dopo l'aggiunta non sparisce. */
export function OfficialCalendarImport({
  category,
  items,
  alreadyPresent,
  total,
}: {
  category: Category;
  items: CalendarImportItem[];
  alreadyPresent: number;
  total: number;
}) {
  const [state, formAction, pending] = useActionState(importOfficialCalendarAction, initialState);
  // Scelte dell'admin; senza scelta, si aggiungono le partite nuove e non quelle dubbie.
  const [choice, setChoice] = useState<Record<string, boolean>>({});
  const isChecked = (item: CalendarImportItem) => choice[item.official.externalId] ?? item.kind === "new";
  const selected = items.filter(isChecked).length;
  const label = CATEGORY_LABELS[category];

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-official-calendar={category}>
        <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>
          {label}: {total === 1 ? "la partita" : `tutte le ${total} partite`} del calendario ufficiale{" "}
          {total === 1 ? "è già nel sito" : "sono già nel sito"}.
          {state.message && <span className="ml-2 font-semibold text-success">{state.message}</span>}
        </span>
      </p>
    );
  }

  return (
    <form action={formAction} data-official-calendar={category}>
      <input type="hidden" name="category" value={category} />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={category === "U14" ? "u14" : "u15"}>{label}</Badge>
        <p className="text-sm font-semibold text-foreground">
          {items.length === 1 ? "Manca 1 partita" : `Mancano ${items.length} partite`} nel calendario del sito
        </p>
        {alreadyPresent > 0 && <p className="text-xs text-muted-foreground">({alreadyPresent} già presenti)</p>}
      </div>

      <List>
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const { official, side, opponent, kind, similar } = item;
            const id = `cal-${category}-${official.externalId}`;
            return (
              <li key={official.externalId} data-official-game={official.externalId} data-official-kind={kind}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-4 py-3 sm:px-5">
                  <input
                    id={id}
                    type="checkbox"
                    name="externalId"
                    value={official.externalId}
                    checked={isChecked(item)}
                    onChange={(event) =>
                      setChoice((prev) => ({ ...prev, [official.externalId]: event.target.checked }))
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
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {whenLabel(official.date)}
                      {official.round !== null && ` · giornata ${official.round}`}
                      {official.venue && ` · ${official.venue}`}
                    </span>
                    {similar && (
                      <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-warning">
                        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                        Nel sito c&apos;è già «{similar.opponent}» il {whenLabel(similar.matchDate)}: è la stessa
                        partita? Se sì, lasciala deselezionata.
                      </span>
                    )}
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
          description="Una sola notifica a chi segue il calendario, non una per partita."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || selected === 0}>
            <CalendarPlus className="h-4 w-4" />
            {pending ? "Aggiungo…" : selected === 1 ? "Aggiungi 1 partita" : `Aggiungi ${selected} partite`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Dati del portale (avversaria, data, ora, palestra): ritrovo e convocazioni li imposti dopo, partita per
            partita.
          </p>
        </div>
        {state.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
        {state.message && <p className="text-sm font-medium text-success">{state.message}</p>}
      </div>
    </form>
  );
}
