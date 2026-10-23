"use client";

import { CalendarX2, Check, CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { categoryBadgeClass, categoryLabel } from "@/lib/category";
import type { AnswerStatus } from "@/lib/availability/types";
import type { Athlete } from "@/lib/types";

function ToggleButton({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
        active
          ? tone === "danger"
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  );
}

/** La risposta di un'atleta per la partita («Ci sarà», oppure «Non ci sarà · motivo · nota»); senza risposta non c'è. */
export interface AnswerFlag {
  status: AnswerStatus;
  text: string;
}

/** Elenco convocazioni nello stesso stile della pagina Presenze: righe con
 * nome, categoria e un toggle Convocata/Non convocata. Sotto il nome c'è la
 * risposta dell'atleta (ci sarà, non ci sarà, o ancora nessuna), più forte se è
 * convocata e non c'è: non la toglie da sola, decide lo staff. Senza `answers`
 * (la presenza non è attiva per questa partita) non c'è nessuna riga di risposta. */
export function CallUpsSection({
  athletes,
  calledUp,
  onToggle,
  onSelectAll,
  onSelectNone,
  answers,
}: {
  athletes: Athlete[];
  calledUp: Set<string>;
  onToggle: (athleteId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  answers?: Record<string, AnswerFlag>;
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
            const flag = answers?.[athlete.id];
            return (
              <div key={athlete.id} className="rounded-xl border border-border-subtle bg-surface px-4 py-3.5" data-call-up-row={athlete.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <div className="flex w-full max-w-[220px] gap-1.5 sm:w-auto">
                    <ToggleButton active={isCalledUp} onClick={() => onToggle(athlete.id)}>
                      <span className="flex items-center justify-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Convocata
                      </span>
                    </ToggleButton>
                    <ToggleButton active={!isCalledUp} tone="danger" onClick={() => onToggle(athlete.id)}>
                      <span className="flex items-center justify-center gap-1">
                        <X className="h-3.5 w-3.5" />
                        Non convocata
                      </span>
                    </ToggleButton>
                  </div>
                </div>
                {!answers ? null : flag?.status === "absent" ? (
                  <p
                    className={cn("mt-2 flex items-start gap-1.5 text-[13px] font-semibold", isCalledUp ? "text-destructive" : "text-warning")}
                    data-answer-flag={athlete.id}
                    data-answer-status="absent"
                  >
                    <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {flag.text}
                      {isCalledUp ? " · ma è convocata" : ""}
                    </span>
                  </p>
                ) : flag?.status === "present" ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-success" data-answer-flag={athlete.id} data-answer-status="present">
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {flag.text}
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground" data-answer-flag={athlete.id} data-answer-status="none">
                    <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Nessuna risposta
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
