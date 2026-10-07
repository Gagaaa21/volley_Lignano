"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, CalendarClock } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { GameChangeItem } from "@/lib/federation/calendarImport";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { updateOfficialGamesAction, type OfficialResultFormState } from "./official-actions";

const initialState: OfficialResultFormState = {};

function whenLabel(iso: string): string {
  return `${format(parseISO(iso.slice(0, 10)), "EEE d MMM", { locale: it })} · ore ${iso.slice(11, 16)}`;
}

function sideLabel(isHome: boolean): string {
  return isHome ? "in casa" : "in trasferta";
}

/** Partite già nel sito che non corrispondono più al portale (data, ora,
 * avversaria o casa/trasferta cambiate): un admin sceglie quali portare a
 * quello che dice il portale. Quelle non scelte restano com'erano (e
 * continuano a essere segnalate). Quando non ne restano, rimane solo il
 * messaggio dell'ultimo aggiornamento. */
export function OfficialGameChanges({ category, changes }: { category: Category; changes: GameChangeItem[] }) {
  const [state, formAction, pending] = useActionState(updateOfficialGamesAction, initialState);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const isChecked = (change: GameChangeItem) => !unchecked[change.official.externalId];
  const selected = changes.filter(isChecked).length;
  const label = CATEGORY_LABELS[category];

  if (changes.length === 0) {
    return state.message ? (
      <p className="text-sm font-semibold text-success" data-official-changes={category}>
        {label}: {state.message}
      </p>
    ) : null;
  }

  return (
    <form action={formAction} data-official-changes={category}>
      <input type="hidden" name="category" value={category} />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={category === "U14" ? "u14" : "u15"}>{label}</Badge>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
          <CalendarClock className="h-4 w-4" aria-hidden />
          {changes.length === 1
            ? "1 partita è cambiata sul portale"
            : `${changes.length} partite sono cambiate sul portale`}
        </p>
      </div>

      <List>
        <ul className="divide-y divide-border">
          {changes.map((change) => {
            const { official, side, opponent, match, changed } = change;
            const id = `change-${category}-${official.externalId}`;
            const differentGame = changed.opponent || changed.side;
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
                  <span className="min-w-0 flex-1 space-y-1 text-sm">
                    <span className="block text-xs text-muted-foreground">
                      Nel sito: <span className="font-semibold text-foreground/80">vs {match.opponent}</span> ·{" "}
                      {sideLabel(match.isHome)} · {whenLabel(match.matchDate)}
                    </span>
                    <span className="flex items-start gap-1.5 text-xs font-semibold text-warning">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        Sul portale:{" "}
                        <span className="font-display text-sm font-bold text-foreground">vs {opponent}</span> ·{" "}
                        {sideLabel(side === "home")} · {whenLabel(official.date)}
                        {differentGame && official.venue ? ` · ${official.venue}` : ""}
                      </span>
                    </span>
                    {differentGame && (
                      <span className="block text-xs text-muted-foreground">
                        {changed.opponent ? "Cambia l'avversaria" : "Cambia casa/trasferta"}
                        {changed.date ? ", la data" : ""} e la palestra.
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
          description="Una sola notifica a chi segue il calendario."
          defaultChecked
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || selected === 0}>
            <CalendarClock className="h-4 w-4" />
            {pending ? "Aggiorno…" : selected === 1 ? "Aggiorna 1 partita" : `Aggiorna ${selected} partite`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Porta il sito a quello che dice il portale: data, ora e, se cambia l&apos;avversaria, anche la palestra.
            Ritrovo, note e convocazioni restano come sono: ricontrollali. Se è giusto quello del sito, deseleziona la
            riga.
          </p>
        </div>
        {state.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
        {state.message && <p className="text-sm font-medium text-success">{state.message}</p>}
      </div>
    </form>
  );
}
