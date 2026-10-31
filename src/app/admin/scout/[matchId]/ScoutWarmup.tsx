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
 */
export function ScoutWarmup({ data, dispatch, compact = false }: { data: ScoutData; dispatch: (action: ScoutAction) => void; compact?: boolean }) {
  const since = data.settings.warmupAt ?? null;
  const start = () => dispatch({ type: "settings", patch: { warmupAt: Date.now() } });
  const back = () => dispatch({ type: "settings", patch: { warmupAt: null } });

  if (since === null) {
    return (
      <Button
        variant={compact ? "outline" : "primary"}
        size={compact ? "xs" : "sm"}
        onClick={start}
        title="Nella diretta video: dalla copertina al riscaldamento (con le squadre e l'ora d'inizio, niente punteggio)"
        data-scout-warmup="start"
      >
        <Flame className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Inizia il riscaldamento
      </Button>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", !compact && "w-full")} data-scout-warmup="on">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-accent font-semibold text-accent-foreground",
          compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        )}
        data-scout-warmup-since
      >
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
