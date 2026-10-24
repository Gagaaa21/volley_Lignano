"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarX2, Clock, Lock, MapPin, Undo2, X } from "lucide-react";
import { clearAbsenceAction, reportAbsenceAction } from "@/app/disponibilita/[codice]/actions";
import { cn } from "@/lib/cn";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  MAX_NOTE_LENGTH,
  REPORT_CLOSES_DAYS_BEFORE,
  type AbsenceReason,
  type AnsweredBy,
} from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";

/** L'assenza segnalata per una partita, com'è scritta adesso: motivo, nota, chi l'ha scritta e quando (già in italiano). */
export interface FamilyAbsence {
  reason: AbsenceReason | null;
  note: string | null;
  by: AnsweredBy;
  when: string;
}

/** Cosa sa la pagina di una partita: solo quello che serve a mostrarla (mai chi è convocata né altro). */
export interface FamilyMatchItem {
  matchId: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  place: string;
  homeAway: "Casa" | "Trasferta";
  /** «Amichevole» o «Torneo», se non è una partita di campionato. */
  kind: string | null;
  meeting: string | null;
  /** Il genitore può ancora segnalare (fino a 5 giorni prima della partita). */
  open: boolean;
  /** Fino a quando si può segnalare, già in italiano («lunedì 19 ottobre, ore 18:00»). */
  deadline: string;
  /** Nessuna assenza = null: ci sarà. */
  absence: FamilyAbsence | null;
}

type Change = { matchId: string; absence: FamilyAbsence | null };

function applyChange(items: FamilyMatchItem[], change: Change): FamilyMatchItem[] {
  return items.map((item) => (item.matchId === change.matchId ? { ...item, absence: change.absence } : item));
}

/**
 * Le prossime partite di un'atleta. Si chiede una cosa sola: se non ci sarà. Un tocco su «Non ci sarà» e l'assenza è segnalata
 * (senza conferme: cambia subito sullo schermo e intanto va al server; se il server rifiuta torna com'era e lo dice); poi, se si
 * vuole, il perché e una nota, oppure «Annulla». Si può fare fino a 5 giorni prima della partita; dopo, la partita resta visibile ma
 * chiusa, e per avvisare si scrive all'allenatore.
 */
export function AvailabilityPanel({ token, items }: { token: string; items: FamilyMatchItem[] }) {
  const [optimistic, applyOptimistic] = useOptimistic(items, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<{ matchId: string; message: string } | null>(null);

  function change(matchId: string, absence: { reason: AbsenceReason | null; note: string } | null) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({
        matchId,
        absence: absence ? { reason: absence.reason, note: absence.note.trim() || null, by: "parent", when: "adesso" } : null,
      });
      try {
        const result = absence
          ? await reportAbsenceAction(token, matchId, absence.reason, absence.note)
          : await clearAbsenceAction(token, matchId);
        if (!result.ok) setError({ matchId, message: result.error });
      } catch {
        setError({ matchId, message: "Non sono riuscito a salvare: controlla la connessione e riprova." });
      }
    });
  }

  if (optimistic.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Nessuna partita in programma"
        description="Quando l'allenatore inserisce le prossime partite le trovi qui."
      />
    );
  }

  return (
    <ul className="space-y-3" data-availability-board data-saving={saving ? "true" : "false"} aria-busy={saving}>
      {optimistic.map((item) => (
        <MatchCard
          key={item.matchId}
          item={item}
          error={error?.matchId === item.matchId ? error.message : null}
          onReport={(reason, note) => change(item.matchId, { reason, note })}
          onClear={() => change(item.matchId, null)}
        />
      ))}
    </ul>
  );
}

function MatchCard({
  item,
  error,
  onReport,
  onClear,
}: {
  item: FamilyMatchItem;
  error: string | null;
  onReport: (reason: AbsenceReason | null, note: string) => void;
  onClear: () => void;
}) {
  const absence = item.absence;

  return (
    <li data-availability-match={item.matchId} data-availability-state={absence ? "absent" : "none"}>
      <Card className={cn("px-4 py-4 sm:px-5", absence && "border-destructive/40")}>
        <p className="font-display text-base font-bold leading-snug text-foreground">
          {item.dateLabel} · {item.timeLabel}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-foreground/85">
          {item.title}
          <Badge tone={item.homeAway === "Casa" ? "primary" : "neutral"}>{item.homeAway}</Badge>
          {item.kind && <Badge tone="gold">{item.kind}</Badge>}
        </p>
        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.place}
        </p>
        {item.meeting && (
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Ritrovo {item.meeting}
          </p>
        )}

        {absence ? (
          <div className="mt-4">
            <p className="flex items-center gap-2 rounded-xl bg-destructive px-3.5 py-2.5 text-[15px] font-bold text-white">
              <X className="h-5 w-5 shrink-0" aria-hidden />
              Non ci sarà
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground" data-availability-status>
              {absence.by === "parent" ? "Segnalata da te" : "Segnata dall'allenatore"} · {absence.when}
            </p>
            {item.open ? (
              <>
                {/* Il campo della nota riparte da quella salvata quando cambia (per esempio se la cambia l'allenatore). */}
                <AbsenceDetails key={absence.note ?? ""} absence={absence} onChange={onReport} />
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onClear} data-absence-clear>
                  <Undo2 className="h-4 w-4" />
                  Annulla: ci sarà
                </Button>
              </>
            ) : (
              (absence.reason || absence.note) && (
                <p className="mt-2 text-sm text-foreground/75" data-availability-details-readonly>
                  {[absence.reason ? ABSENCE_REASON_LABELS[absence.reason] : null, absence.note].filter(Boolean).join(" · ")}
                </p>
              )
            )}
          </div>
        ) : item.open ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onReport(null, "")}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-surface text-[15px] font-bold text-destructive transition hover:bg-destructive/5 sm:w-auto sm:px-6"
              data-absence-report
            >
              <X className="h-5 w-5" aria-hidden />
              Non ci sarà
            </button>
            <p className="mt-2 text-[13px] text-muted-foreground" data-availability-status>
              Se ci sarà non devi fare niente.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-muted-foreground" data-availability-status>
            Nessuna assenza segnalata.
          </p>
        )}

        {item.open ? (
          <p className="mt-3 text-[13px] text-muted-foreground" data-availability-deadline>
            Puoi segnalarlo fino a {item.deadline}.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted-foreground" data-availability-closed>
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Segnalazioni chiuse ({REPORT_CLOSES_DAYS_BEFORE} giorni prima della partita): per avvisare, scrivi all&apos;allenatore.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive" data-availability-error>
            {error}
          </p>
        )}
      </Card>
    </li>
  );
}

/** Dopo «Non ci sarà»: perché (a scelta, si toglie toccando ancora) e una nota breve, tutto facoltativo. */
function AbsenceDetails({ absence, onChange }: { absence: FamilyAbsence; onChange: (reason: AbsenceReason | null, note: string) => void }) {
  const [draft, setDraft] = useState(absence.note ?? "");
  const changed = draft.trim() !== (absence.note ?? "");

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-muted px-3.5 py-3.5" data-availability-details>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-foreground/80">Se vuoi dirlo, perché?</legend>
        <div className="flex flex-wrap gap-2">
          {ABSENCE_REASONS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={absence.reason === key}
              onClick={() => onChange(absence.reason === key ? null : key, draft)}
              className={cn(
                "rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                absence.reason === key
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border-strong/80 bg-surface text-foreground hover:bg-surface-muted",
              )}
              data-availability-reason={key}
            >
              {ABSENCE_REASON_LABELS[key]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          autoComplete="off"
          aria-label="Una nota per l'allenatore"
          placeholder="Una nota (facoltativa)"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && changed) {
              event.preventDefault();
              onChange(absence.reason, draft);
            }
          }}
          data-availability-note
        />
        {changed && (
          <Button type="button" className="shrink-0" onClick={() => onChange(absence.reason, draft)} data-availability-note-save>
            Salva
          </Button>
        )}
      </div>
    </div>
  );
}
