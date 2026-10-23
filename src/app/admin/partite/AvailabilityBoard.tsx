"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { answerOrder, countAnswers } from "@/lib/availability/rules";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  ANSWERED_BY_PHRASES,
  MAX_NOTE_LENGTH,
  type AbsenceReason,
  type AnswerStatus,
  type AnsweredBy,
} from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { setStaffAnswerAction } from "./availability-actions";

export interface BoardAthlete {
  id: string;
  name: string;
  /** È tra le convocate della partita. */
  calledUp: boolean;
}

/** La risposta di un'atleta, com'è scritta adesso; `when` è già in italiano («23 ott, 10:02», «adesso»). */
export interface BoardAnswer {
  status: AnswerStatus;
  reason: AbsenceReason | null;
  note: string | null;
  by: AnsweredBy;
  when: string;
}

type Change = { athleteId: string; answer: BoardAnswer | null };

function applyChange(answers: Record<string, BoardAnswer>, change: Change): Record<string, BoardAnswer> {
  const next = { ...answers };
  if (change.answer) next[change.athleteId] = change.answer;
  else delete next[change.athleteId];
  return next;
}

const GROUPS: { status: AnswerStatus | null; title: string; tone: "danger" | "neutral" | "success" }[] = [
  { status: "absent", title: "Non ci sono", tone: "danger" },
  { status: null, title: "Senza risposta", tone: "neutral" },
  { status: "present", title: "Ci sono", tone: "success" },
];

/**
 * Chi viene alla partita: tutte le atlete, con la risposta di ognuna (la scrivono i genitori dal loro link, o la scrive
 * l'allenatore) e un selettore per cambiarla con un tocco: «Ci sarà», «Non ci sarà» o «Nessuna». La modifica si vede subito e
 * intanto va al server; se il server la rifiuta torna com'era e lo dice. Chi è segnalata «Non ci sarà» ha anche motivo e nota.
 * Non tocca le convocazioni: se una convocata non c'è lo dice, e decide l'allenatore.
 */
export function AvailabilityBoard({
  matchId,
  athletes,
  answers,
  familyLinksHref,
}: {
  matchId: string;
  athletes: BoardAthlete[];
  answers: Record<string, BoardAnswer>;
  /** Dove si preparano i link per i genitori, se chi guarda può andarci. */
  familyLinksHref: string | null;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(answers, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setAnswer(athleteId: string, status: AnswerStatus | null, reason: AbsenceReason | null, note: string) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({
        athleteId,
        answer: status
          ? {
              status,
              reason: status === "absent" ? reason : null,
              note: status === "absent" ? note.trim() || null : null,
              by: "staff",
              when: "adesso",
            }
          : null,
      });
      try {
        const result = await setStaffAnswerAction(matchId, athleteId, status, reason, note);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      }
    });
  }

  const counts = countAnswers(
    athletes.map((athlete) => athlete.id),
    Object.entries(optimistic).map(([athleteId, answer]) => ({ athleteId, status: answer.status })),
  );
  const rows = athletes
    .map((athlete) => ({ athlete, answer: optimistic[athlete.id] ?? null }))
    .sort(
      (a, b) =>
        answerOrder(a.answer?.status ?? null) - answerOrder(b.answer?.status ?? null) || a.athlete.name.localeCompare(b.athlete.name, "it"),
    );

  return (
    <Card className="mb-6" data-match-availability data-saving={saving ? "true" : "false"} aria-busy={saving}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="icon-chip h-10 w-10 shrink-0">
              <CalendarCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Chi viene</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                La risposta di ogni atleta: la scrivono i genitori dal loro link, e la puoi cambiare tu con un tocco.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-availability-counts>
            <Badge tone="success" data-count-present={counts.present}>
              {counts.present} ci {counts.present === 1 ? "sarà" : "saranno"}
            </Badge>
            <Badge tone={counts.absent > 0 ? "danger" : "neutral"} data-count-absent={counts.absent}>
              {counts.absent} non {counts.absent === 1 ? "c'è" : "ci sono"}
            </Badge>
            <Badge tone="neutral" data-count-none={counts.none}>
              {counts.none} senza risposta
            </Badge>
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
          GROUPS.map((group) => {
            const members = rows.filter(({ answer }) => (answer?.status ?? null) === group.status);
            if (members.length === 0) return null;
            return (
              <section key={group.status ?? "none"} data-availability-group={group.status ?? "none"}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{group.title}</h3>
                  <Badge tone={group.tone}>{members.length}</Badge>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {members.map(({ athlete, answer }) => (
                    <AnswerRow
                      // Dopo ogni cambiamento la riga riparte con i valori nuovi (e il modulo del motivo chiuso).
                      key={`${athlete.id}-${answer?.status ?? "none"}-${answer?.reason ?? ""}-${answer?.note ?? ""}`}
                      athlete={athlete}
                      answer={answer}
                      onChange={(status, reason, note) => setAnswer(athlete.id, status, reason, note)}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

function Segment({
  active,
  tone,
  onClick,
  answer,
  children,
}: {
  active: boolean;
  tone: "success" | "danger" | "neutral";
  onClick: () => void;
  answer: string;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 transition-colors first:rounded-l-[0.65rem] last:rounded-r-[0.65rem]",
        active
          ? tone === "success"
            ? "bg-success text-white"
            : tone === "danger"
              ? "bg-destructive text-white"
              : "bg-foreground/80 text-white"
          : "text-foreground/70 hover:bg-surface-muted",
      )}
      data-answer={answer}
    >
      {children}
    </button>
  );
}

function AnswerRow({
  athlete,
  answer,
  onChange,
}: {
  athlete: BoardAthlete;
  answer: BoardAnswer | null;
  onChange: (status: AnswerStatus | null, reason: AbsenceReason | null, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const status = answer?.status ?? null;
  const absentAndCalledUp = status === "absent" && athlete.calledUp;
  const details = answer ? [answer.reason ? ABSENCE_REASON_LABELS[answer.reason] : null, answer.note].filter(Boolean).join(" · ") : "";

  return (
    <li className={cn("px-4 py-3", absentAndCalledUp && "bg-destructive/5")} data-availability-row={athlete.id} data-availability-state={status ?? "none"}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {athlete.name}
            {athlete.calledUp && <Badge tone={absentAndCalledUp ? "danger" : "primary"}>Convocata</Badge>}
          </p>
          {answer && (
            <p className="text-[12px] text-muted-foreground" data-availability-by>
              Risposta {ANSWERED_BY_PHRASES[answer.by]} · {answer.when}
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label={`Risposta di ${athlete.name}`}
          className="inline-flex shrink-0 divide-x divide-border-strong/60 overflow-hidden rounded-xl border border-border-strong/80 bg-surface text-[13px] font-semibold"
        >
          <Segment active={status === "present"} tone="success" answer="present" onClick={() => status !== "present" && onChange("present", null, "")}>
            Ci sarà
          </Segment>
          <Segment active={status === "absent"} tone="danger" answer="absent" onClick={() => status !== "absent" && onChange("absent", null, "")}>
            Non ci sarà
          </Segment>
          <Segment active={status === null} tone="neutral" answer="none" onClick={() => status !== null && onChange(null, null, "")}>
            Nessuna
          </Segment>
        </div>
      </div>

      {absentAndCalledUp && (
        <p className="mt-2 text-[13px] font-semibold text-destructive" data-availability-called-up>
          È tra le convocate: decidi tu se toglierla dalle convocazioni.
        </p>
      )}

      {status === "absent" && answer && !editing && (
        <p className="mt-2 text-sm text-foreground/75" data-availability-details>
          {details || "Nessun motivo indicato"}
          <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-primary hover:underline" data-availability-edit>
            {details ? "Modifica" : "Aggiungi motivo"}
          </button>
        </p>
      )}
      {status === "absent" && answer && editing && (
        <AbsenceEditor
          answer={answer}
          onSave={(reason, note) => {
            setEditing(false);
            onChange("absent", reason, note);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}

/** Motivo (a scelta, si toglie toccando ancora) e nota di un'assenza. */
function AbsenceEditor({
  answer,
  onSave,
  onCancel,
}: {
  answer: BoardAnswer;
  onSave: (reason: AbsenceReason | null, note: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<AbsenceReason | null>(answer.reason);
  const [note, setNote] = useState(answer.note ?? "");

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
