"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { AlertTriangle, CalendarX2, Link2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  ANSWERED_BY_PHRASES,
  MAX_NOTE_LENGTH,
  REPORT_CLOSES_DAYS_BEFORE,
  type AbsenceReason,
  type AnsweredBy,
} from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { setStaffAbsenceAction } from "./availability-actions";

export interface BoardAthlete {
  id: string;
  name: string;
  /** È tra le convocate della partita. */
  calledUp: boolean;
}

/** L'assenza di un'atleta, com'è scritta adesso; `when` è già in italiano («23 ott, 10:02», «adesso»). */
export interface BoardAbsence {
  reason: AbsenceReason | null;
  note: string | null;
  by: AnsweredBy;
  when: string;
}

type Change = { athleteId: string; absence: BoardAbsence | null };

function applyChange(absences: Record<string, BoardAbsence>, change: Change): Record<string, BoardAbsence> {
  const next = { ...absences };
  if (change.absence) next[change.athleteId] = change.absence;
  else delete next[change.athleteId];
  return next;
}

/**
 * Le assenze della partita: chi non ci sarà (lo segnalano i genitori dal loro link, fino a 5 giorni prima, oppure lo scrive
 * l'allenatore), con motivo e nota, e sotto le altre atlete per segnarne una con un tocco. Chi non è segnata ci sarà. La modifica
 * si vede subito e intanto va al server; se il server la rifiuta torna com'era e lo dice. Non tocca le convocazioni: se una
 * convocata non c'è lo dice, e decide l'allenatore.
 */
export function AvailabilityBoard({
  matchId,
  athletes,
  absences,
  familyLinksHref,
}: {
  matchId: string;
  athletes: BoardAthlete[];
  absences: Record<string, BoardAbsence>;
  /** Dove si preparano i link per i genitori, se chi guarda può andarci. */
  familyLinksHref: string | null;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(absences, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setAbsence(athleteId: string, absence: { reason: AbsenceReason | null; note: string } | null) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({
        athleteId,
        absence: absence ? { reason: absence.reason, note: absence.note.trim() || null, by: "staff", when: "adesso" } : null,
      });
      try {
        const result = await setStaffAbsenceAction(matchId, athleteId, absence !== null, absence?.reason ?? null, absence?.note ?? "");
        if (!result.ok) setError(result.error);
      } catch {
        setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      }
    });
  }

  const absent = athletes.filter((athlete) => optimistic[athlete.id]);
  const present = athletes.filter((athlete) => !optimistic[athlete.id]);

  return (
    <Card className="mb-6" data-match-availability data-saving={saving ? "true" : "false"} aria-busy={saving}>
      <CardHeader className="pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icon-chip h-10 w-10 shrink-0">
            <CalendarX2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <CardTitle>Assenze</CardTitle>
              <Badge tone={absent.length > 0 ? "danger" : "neutral"} data-count-absent={absent.length}>
                {absent.length === 0 ? "Nessuna assenza" : absent.length === 1 ? "1 non c'è" : `${absent.length} non ci sono`}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Le segnalano i genitori dal loro link (fino a {REPORT_CLOSES_DAYS_BEFORE} giorni prima) oppure tu, sempre. Chi non è segnata ci sarà.
            </p>
          </div>
        </div>
        {familyLinksHref && (
          <Link href={familyLinksHref} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Link per i genitori
          </Link>
        )}
      </CardHeader>
      <CardBody className="space-y-5">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" data-availability-error>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {athletes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
            Nessuna atleta attiva per questa partita.
          </p>
        ) : (
          <>
            {absent.length > 0 && (
              <section data-availability-group="absent">
                <h3 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Non ci sono</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {absent.map((athlete) => {
                    const absence = optimistic[athlete.id];
                    return (
                      <AbsentRow
                        // Dopo ogni cambiamento la riga riparte con i valori nuovi (e il modulo del motivo chiuso).
                        key={`${athlete.id}-${absence.reason ?? ""}-${absence.note ?? ""}`}
                        athlete={athlete}
                        absence={absence}
                        onSave={(reason, note) => setAbsence(athlete.id, { reason, note })}
                        onClear={() => setAbsence(athlete.id, null)}
                      />
                    );
                  })}
                </ul>
              </section>
            )}

            {present.length > 0 && (
              <section data-availability-group="present">
                <h3 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Segna chi non ci sarà</h3>
                <div className="flex flex-wrap gap-2">
                  {present.map((athlete) => (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => setAbsence(athlete.id, { reason: null, note: "" })}
                      aria-label={`${athlete.name}: non ci sarà`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong/80 bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-destructive/50 hover:text-destructive"
                      data-absence-mark={athlete.id}
                    >
                      <X className="h-3.5 w-3.5 text-destructive/70" aria-hidden />
                      {athlete.name}
                      {athlete.calledUp && <span className="text-[11px] font-semibold text-primary">· convocata</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function AbsentRow({
  athlete,
  absence,
  onSave,
  onClear,
}: {
  athlete: BoardAthlete;
  absence: BoardAbsence;
  onSave: (reason: AbsenceReason | null, note: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const details = [absence.reason ? ABSENCE_REASON_LABELS[absence.reason] : null, absence.note].filter(Boolean).join(" · ");

  return (
    <li className={cn("px-4 py-3", athlete.calledUp && "bg-destructive/5")} data-availability-row={athlete.id} data-availability-state="absent">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {athlete.name}
            {athlete.calledUp && <Badge tone="danger">Convocata</Badge>}
          </p>
          <p className="text-[12px] text-muted-foreground" data-availability-by>
            Segnalata {ANSWERED_BY_PHRASES[absence.by]} · {absence.when}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onClear} data-absence-clear>
          Ci sarà: togli
        </Button>
      </div>

      {athlete.calledUp && (
        <p className="mt-2 text-[13px] font-semibold text-destructive" data-availability-called-up>
          È tra le convocate: decidi tu se toglierla dalle convocazioni.
        </p>
      )}

      {!editing ? (
        <p className="mt-2 text-sm text-foreground/75" data-availability-details>
          {details || "Nessun motivo indicato"}
          <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-primary hover:underline" data-availability-edit>
            {details ? "Modifica" : "Aggiungi motivo"}
          </button>
        </p>
      ) : (
        <AbsenceEditor
          absence={absence}
          onSave={(reason, note) => {
            setEditing(false);
            onSave(reason, note);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}

/** Motivo (a scelta, si toglie toccando ancora) e nota di un'assenza. */
function AbsenceEditor({
  absence,
  onSave,
  onCancel,
}: {
  absence: BoardAbsence;
  onSave: (reason: AbsenceReason | null, note: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<AbsenceReason | null>(absence.reason);
  const [note, setNote] = useState(absence.note ?? "");

  return (
    <div className="mt-2 space-y-3 rounded-xl bg-surface-muted px-3.5 py-3.5" data-availability-editor>
      <div className="flex flex-wrap gap-2">
        {ABSENCE_REASONS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={reason === key}
            onClick={() => setReason(reason === key ? null : key)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
              reason === key ? "border-primary bg-primary-soft text-primary" : "border-border-strong/80 bg-surface text-foreground hover:bg-surface-muted",
            )}
            data-availability-reason={key}
          >
            {ABSENCE_REASON_LABELS[key]}
          </button>
        ))}
      </div>
      <Input
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        autoComplete="off"
        aria-label="Nota"
        placeholder="Una nota (facoltativa)"
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave(reason, note);
          }
        }}
        data-availability-note
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onSave(reason, note)} data-availability-save>
          Salva
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
