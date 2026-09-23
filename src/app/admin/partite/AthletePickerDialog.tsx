"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Athlete } from "@/lib/types";

/** Finestra di selezione convocata per una posizione/libero, in stile elenco
 * (come la registrazione presenze): usata solo su mobile, dove trascinare è
 * scomodo — su schermi più grandi si usa il trascinamento diretto in campo. */
export function AthletePickerDialog({
  title,
  athletes,
  currentAthleteId,
  occupiedLabels,
  onSelect,
  onClear,
  onClose,
}: {
  title: string;
  athletes: Athlete[];
  currentAthleteId: string | null;
  /** athleteId -> etichetta ("pos. 3" / "Libero 1") per chi è già assegnata altrove in questo set. */
  occupiedLabels: Map<string, string>;
  onSelect: (athleteId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-sea-950/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-5 shadow-[0_-20px_50px_-20px_rgba(9,27,38,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-bold text-foreground">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="shrink-0 rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {currentAthleteId && (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 w-full rounded-xl border border-dashed border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15"
          >
            Svuota questa posizione
          </button>
        )}

        {athletes.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/50">
            Nessuna convocata: selezionale nella sezione &quot;Convocazioni&quot; qui sopra.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {athletes.map((athlete) => {
              const isHere = athlete.id === currentAthleteId;
              const elsewhereLabel = !isHere ? occupiedLabels.get(athlete.id) : undefined;
              return (
                <button
                  key={athlete.id}
                  type="button"
                  onClick={() => onSelect(athlete.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    isHere
                      ? "border-sea-700 bg-sea-700/10"
                      : "border-border-subtle bg-surface hover:border-primary/25 hover:bg-primary/[0.03]",
                  )}
                >
                  <span className="truncate font-medium text-foreground">{athlete.fullName}</span>
                  {isHere ? (
                    <span className="shrink-0 rounded-full bg-sea-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Qui
                    </span>
                  ) : elsewhereLabel ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {elsewhereLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
