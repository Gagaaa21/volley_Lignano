"use client";

import { CalendarX2, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { categoryBadgeClass, categoryLabel } from "@/lib/category";
import type { Athlete } from "@/lib/types";

/** Elenco convocazioni nello stesso stile della pagina Presenze: righe con
 * nome, categoria e un solo interruttore (convocata sì/no). Sotto il nome di chi
 * non ci sarà c'è l'assenza («Non ci sarà · motivo · nota»), più forte se è
 * convocata: non la toglie da sola, decide lo staff. */
export function CallUpsSection({
  athletes,
  calledUp,
  onToggle,
  onSelectAll,
  onSelectNone,
  absences = {},
}: {
  athletes: Athlete[];
  calledUp: Set<string>;
  onToggle: (athleteId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  /** Le assenze, per atleta: la riga già scritta («Non ci sarà · motivo · nota»). */
  absences?: Record<string, string>;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-foreground/60">
          <span className="font-semibold text-foreground">{calledUp.size}</span> convocate su {athletes.length}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <button type="button" onClick={onSelectAll} className="hover:underline">
            Seleziona tutte
          </button>
          <span className="text-foreground/25">·</span>
          <button type="button" onClick={onSelectNone} className="hover:underline">
            Nessuna
          </button>
        </div>
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-foreground/50">
          Nessuna atleta attiva in anagrafica.
        </div>
      ) : (
        <div className="space-y-2.5">
          {athletes.map((athlete) => {
            const isCalledUp = calledUp.has(athlete.id);
            const absence = absences[athlete.id];
            return (
              <div key={athlete.id} className="rounded-xl border border-border-subtle bg-surface px-4 py-2.5" data-call-up-row={athlete.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium text-foreground">{athlete.fullName}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        categoryBadgeClass(athlete.category),
                      )}
                    >
                      {categoryLabel(athlete.category)}
                    </span>
                  </div>
                  {/* Un solo pulsante per una scelta sì/no: acceso è «Convocata», spento è «Non convocata». */}
                  <button
                    type="button"
                    onClick={() => onToggle(athlete.id)}
                    aria-pressed={isCalledUp}
                    aria-label="Convocata"
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                      isCalledUp ? "bg-primary text-primary-foreground" : "border border-dashed border-border-strong bg-surface text-muted-foreground hover:bg-muted",
                    )}
                    data-call-up-toggle
                  >
                    {isCalledUp ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                    {isCalledUp ? "Convocata" : "Non convocata"}
                  </button>
                </div>
                {absence && (
                  <p
                    className={cn("mt-2 flex items-start gap-1.5 text-[13px] font-semibold", isCalledUp ? "text-destructive" : "text-warning")}
                    data-answer-flag={athlete.id}
                    data-answer-status="absent"
                  >
                    <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {absence}
                      {isCalledUp ? " · ma è convocata" : ""}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
