"use client";

import { Ban, CalendarX2, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { callUpGroup, categoryBadgeClass, categoryLabel } from "@/lib/category";
import type { Athlete, Category } from "@/lib/types";

/** Il titolo di un gruppo dell'elenco (vedi callUpGroup), dalla categoria della prima atleta del gruppo. */
function groupHeading(group: number, athlete: Category | null, match: Category): string {
  if (group === 0) return categoryLabel(match);
  if (group === 1) return `${categoryLabel(athlete)} · giocano anche in ${categoryLabel(match)}`;
  if (group === 2) return categoryLabel(null);
  return `${categoryLabel(athlete)} · non giocano in ${categoryLabel(match)}`;
}

/** Elenco convocazioni nello stesso stile della pagina Presenze: righe con
 * nome, categoria e un solo interruttore (convocata sì/no). Sotto il nome di chi
 * non ci sarà c'è l'assenza («Non ci sarà · motivo · nota»), più forte se è
 * convocata: non la toglie da sola, decide lo staff. Con la categoria della partita l'elenco (già in ordine, vedi
 * orderForCallUps) è diviso in gruppi: prima la categoria della partita, poi le altre che possono giocare; in una partita
 * Under 14 le Under 15 sono in fondo, oscurate e non si possono convocare (una già convocata si può solo togliere). */
export function CallUpsSection({
  athletes,
  matchCategory = null,
  calledUp,
  onToggle,
  onSelectAll,
  onSelectNone,
  absences = {},
}: {
  athletes: Athlete[];
  /** La categoria della partita: decide l'ordine dei gruppi e chi non si può convocare. */
  matchCategory?: Category | null;
  calledUp: Set<string>;
  onToggle: (athleteId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  /** Le assenze, per atleta: la riga già scritta («Non ci sarà · motivo · nota»). */
  absences?: Record<string, string>;
}) {
  const groups = athletes.map((athlete) => callUpGroup(athlete.category, matchCategory));
  const callable = groups.filter((group) => group < 3).length;
  const grouped = matchCategory !== null && new Set(groups).size > 1;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-foreground/60">
          <span className="font-semibold text-foreground">{calledUp.size}</span> convocate su {callable}
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
        <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-muted-foreground">
          Nessuna atleta attiva in anagrafica.
        </div>
      ) : (
        <div className="space-y-2.5">
          {athletes.map((athlete, index) => {
            const isCalledUp = calledUp.has(athlete.id);
            const absence = absences[athlete.id];
            const group = groups[index];
            const blocked = group === 3;
            const heading =
              grouped && matchCategory && group !== groups[index - 1] ? groupHeading(group, athlete.category, matchCategory) : null;
            return (
              <div key={athlete.id} className={cn(heading && index > 0 && "pt-3")}>
                {heading && (
                  <p
                    className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
                    data-call-up-group={group}
                  >
                    {heading}
                  </p>
                )}
                <div
                  className={cn("rounded-xl border border-border-subtle px-4 py-2.5", blocked && !isCalledUp ? "bg-muted/60" : "bg-surface")}
                  data-call-up-row={athlete.id}
                  data-call-up-blocked={blocked || undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={cn("flex min-w-0 items-center gap-2", blocked && !isCalledUp && "opacity-50")}>
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
                      disabled={blocked && !isCalledUp}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                        isCalledUp
                          ? "bg-primary text-primary-foreground"
                          : blocked
                            ? "cursor-not-allowed border border-dashed border-border-subtle bg-transparent text-muted-foreground/70"
                            : "border border-dashed border-border-strong bg-surface text-muted-foreground hover:bg-muted",
                      )}
                      data-call-up-toggle
                    >
                      {isCalledUp ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : blocked ? (
                        <Ban className="h-4 w-4" aria-hidden />
                      ) : (
                        <X className="h-4 w-4" aria-hidden />
                      )}
                      {isCalledUp ? "Convocata" : blocked ? "Non convocabile" : "Non convocata"}
                    </button>
                  </div>
                  {blocked && isCalledUp && matchCategory && (
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-destructive" data-call-up-blocked-warning>
                      <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        {categoryLabel(athlete.category)}: non gioca in {categoryLabel(matchCategory)}, toglila dalle convocate
                      </span>
                    </p>
                  )}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
