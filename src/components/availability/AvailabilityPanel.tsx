"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarX2, Check, Clock, MapPin, X } from "lucide-react";
import { answerAction } from "@/app/disponibilita/[codice]/actions";
import { cn } from "@/lib/cn";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  MAX_NOTE_LENGTH,
  type AbsenceReason,
  type AnsweredBy,
  type AnswerStatus,
} from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";

/** La risposta di una partita, com'è scritta adesso: cosa, chi l'ha scritta e quando (già in italiano, «23 ott, 10:02» o «adesso»). */
export interface FamilyAnswer {
  status: AnswerStatus;
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
  /** Il genitore può ancora rispondere (fino all'inizio della partita). */
  open: boolean;
  /** Nessuna risposta ancora = null. */
  answer: FamilyAnswer | null;
}

type Change = { matchId: string; answer: FamilyAnswer };

function applyChange(items: FamilyMatchItem[], change: Change): FamilyMatchItem[] {
  return items.map((item) => (item.matchId === change.matchId ? { ...item, answer: change.answer } : item));
}

/**
 * Le partite in programma di un'atleta, ognuna con due pulsanti: «Ci sarà» e «Non ci sarà». Si tocca e basta, senza conferme: la
 * risposta cambia subito sullo schermo e intanto va al server (se il server rifiuta torna com'era e lo dice). Con «Non ci sarà»
 * si può dire anche perché e scrivere una nota. Si cambia risposta quando si vuole, anche se l'aveva scritta l'allenatore, finché
 * la partita non comincia.
 */
export function AvailabilityPanel({ token, items }: { token: string; items: FamilyMatchItem[] }) {
  const [optimistic, applyOptimistic] = useOptimistic(items, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<{ matchId: string; message: string } | null>(null);

  function answer(matchId: string, status: AnswerStatus, reason: AbsenceReason | null, note: string) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({
        matchId,
        answer: {
          status,
          reason: status === "absent" ? reason : null,
          note: status === "absent" ? note.trim() || null : null,
          by: "parent",
          when: "adesso",
        },
      });
      try {
        const result = await answerAction(token, matchId, status, reason, note);
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
          onAnswer={(status, reason, note) => answer(item.matchId, status, reason, note)}
        />
      ))}
    </ul>
  );
}

function MatchCard({
  item,
  error,
  onAnswer,
}: {
  item: FamilyMatchItem;
  error: string | null;
  onAnswer: (status: AnswerStatus, reason: AbsenceReason | null, note: string) => void;
}) {
  const answer = item.answer;
  const status = answer?.status ?? null;

  return (
    <li data-availability-match={item.matchId} data-availability-state={status ?? "none"}>
      <Card className={cn("px-4 py-4 sm:px-5", status === "present" && "border-success/40", status === "absent" && "border-destructive/40")}>
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

        <div role="group" aria-label="Ci sarà o non ci sarà" className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={status === "present"}
            disabled={!item.open}
            onClick={() => status !== "present" && onAnswer("present", null, "")}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl border text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
              status === "present"
                ? "border-success bg-success text-white shadow-xs"
                : "border-border-strong/80 bg-surface text-foreground hover:bg-surface-muted",
            )}
            data-answer="present"
          >
            <Check className="h-5 w-5" aria-hidden />
            Ci sarà
          </button>
          <button
            type="button"
            aria-pressed={status === "absent"}
            disabled={!item.open}
            onClick={() => status !== "absent" && onAnswer("absent", null, "")}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl border text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
              status === "absent"
                ? "border-destructive bg-destructive text-white shadow-xs"
                : "border-border-strong/80 bg-surface text-foreground hover:bg-surface-muted",
            )}
            data-answer="absent"
          >
            <X className="h-5 w-5" aria-hidden />
            Non ci sarà
          </button>
        </div>

        <p className="mt-2 text-[13px] text-muted-foreground" data-availability-status>
          {answer ? `${answer.by === "parent" ? "La tua risposta" : "Risposta dell'allenatore"} · ${answer.when}` : "Non hai ancora risposto."}
        </p>

        {answer?.status === "absent" && item.open && (
          // Il campo della nota riparte da quella salvata quando cambia (per esempio se la cambia l'allenatore).
          <AbsenceDetails key={answer.note ?? ""} answer={answer} onChange={(reason, note) => onAnswer("absent", reason, note)} />
        )}
        {answer?.status === "absent" && !item.open && (answer.reason || answer.note) && (
          <p className="mt-2 text-sm text-foreground/75" data-availability-details-readonly>
            {[answer.reason ? ABSENCE_REASON_LABELS[answer.reason] : null, answer.note].filter(Boolean).join(" · ")}
          </p>
        )}

        {!item.open && (
          <p className="mt-2 text-[13px] text-muted-foreground" data-availability-closed>
            La partita è già cominciata: da qui non si può più cambiare.
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

/** Con «Non ci sarà»: perché (a scelta, si toglie toccando ancora) e una nota breve, tutto facoltativo. */
function AbsenceDetails({ answer, onChange }: { answer: FamilyAnswer; onChange: (reason: AbsenceReason | null, note: string) => void }) {
  const [draft, setDraft] = useState(answer.note ?? "");
  const changed = draft.trim() !== (answer.note ?? "");

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-muted px-3.5 py-3.5" data-availability-details>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-foreground/80">Se vuoi dirlo, perché?</legend>
        <div className="flex flex-wrap gap-2">
          {ABSENCE_REASONS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={answer.reason === key}
              onClick={() => onChange(answer.reason === key ? null : key, draft)}
              className={cn(
                "rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                answer.reason === key
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
          placeholder="Una nota per l'allenatore (facoltativa)"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && changed) {
              event.preventDefault();
              onChange(answer.reason, draft);
            }
          }}
          data-availability-note
        />
        {changed && (
          <Button type="button" className="shrink-0" onClick={() => onChange(answer.reason, draft)} data-availability-note-save>
            Salva
          </Button>
        )}
      </div>
    </div>
  );
}
