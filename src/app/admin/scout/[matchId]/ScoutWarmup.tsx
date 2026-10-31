"use client";

import { format } from "date-fns";
import { Flame, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ScoutAction } from "@/lib/scout/actions";
import type { ScoutData } from "@/lib/scout/types";

/**
 * Il tasto della diretta video prima del via (vedi src/lib/diretta/pregame.ts): finché non lo si preme la grafica mostra solo la
 * copertina (Lignano contro l'avversaria, la telecamera non si vede); premuto, il riscaldamento. Il resto (riscaldamento
 * ufficiale, presentazione, punteggio) lo decide l'orario della partita. Si vede solo con il live acceso e prima del primo punto:
 * dopo non serve più. «Torna alla copertina» rimette la copertina, se lo si è premuto troppo presto.
 *
 * `compact` (la riga degli strumenti, a partita aperta): una striscia «Diretta video» a tutta riga, con quello che va in onda
 * adesso e il tasto accanto, invece di pulsanti sparsi tra gli altri.
 */
export function ScoutWarmup({ data, dispatch, compact = false }: { data: ScoutData; dispatch: (action: ScoutAction) => void; compact?: boolean }) {
  const since = data.settings.warmupAt ?? null;
  const start = () => dispatch({ type: "settings", patch: { warmupAt: Date.now() } });
  const back = () => dispatch({ type: "settings", patch: { warmupAt: null } });

  if (compact) {
    return (
      <div
        className="flex basis-full flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-border-subtle bg-surface px-3 py-2"
        data-scout-warmup-strip
        data-scout-warmup={since === null ? undefined : "on"}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Flame className={cn("h-4 w-4 shrink-0", since === null ? "text-muted-foreground" : "text-accent-foreground")} />
          <span className="text-muted-foreground">Diretta video:</span>
          {since === null ? <span>copertina</span> : <span data-scout-warmup-since>riscaldamento dalle {format(since, "HH:mm")}</span>}
        </span>
        {since === null ? (
          <Button size="xs" onClick={start} title="Nella diretta video: dalla copertina al riscaldamento (con le squadre e l'ora d'inizio, niente punteggio)" data-scout-warmup="start">
            <Flame className="h-3.5 w-3.5" />
            Inizia il riscaldamento
          </Button>
        ) : (
          <Button variant="outline" size="xs" onClick={back} title="Nella diretta video torna la copertina (se il riscaldamento è partito per sbaglio o troppo presto)" data-scout-warmup="stop">
            <Undo2 className="h-3.5 w-3.5" />
            Torna alla copertina
          </Button>
        )}
      </div>
    );
  }

  if (since === null) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={start}
        title="Nella diretta video: dalla copertina al riscaldamento (con le squadre e l'ora d'inizio, niente punteggio)"
        data-scout-warmup="start"
      >
        <Flame className="h-4 w-4" />
        Inizia il riscaldamento
      </Button>
    );
  }

  return (
    <span className="inline-flex w-full flex-wrap items-center gap-2" data-scout-warmup="on">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground" data-scout-warmup-since>
        <Flame className="h-3.5 w-3.5" />
        Riscaldamento dalle {format(since, "HH:mm")}
      </span>
      <Button
        variant="outline"
        size="xs"
        onClick={back}
        title="Nella diretta video torna la copertina (se il riscaldamento è partito per sbaglio o troppo presto)"
        data-scout-warmup="stop"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Torna alla copertina
      </Button>
    </span>
  );
}
