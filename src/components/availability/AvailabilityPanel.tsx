"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarX2, Clock, MapPin, Pencil, Undo2 } from "lucide-react";
import { clearUnavailableAction, reportUnavailableAction } from "@/app/disponibilita/[codice]/actions";
import { cn } from "@/lib/cn";
import { describeUnavailability } from "@/lib/availability/rules";
import {
  MAX_NOTE_LENGTH,
  UNAVAILABILITY_REASONS,
  UNAVAILABILITY_REASON_LABELS,
  type ReportedBy,
  type UnavailabilityReason,
} from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";

/** Cosa sa la pagina di una partita: solo quello che serve a mostrarla (mai chi è convocata né altro). */
export interface FamilyReport {
  reason: UnavailabilityReason | null;
  note: string | null;
  reportedBy: ReportedBy;
}

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
  /** Il genitore può ancora cambiare (fino all'inizio della partita). */
  open: boolean;
  report: FamilyReport | null;
}

type Change = { type: "set"; matchId: string; report: FamilyReport } | { type: "clear"; matchId: string };

function applyChange(items: FamilyMatchItem[], change: Change): FamilyMatchItem[] {
  return items.map((item) =>
    item.matchId !== change.matchId ? item : { ...item, report: change.type === "set" ? change.report : null },
  );
}

/**
 * Le partite in programma di un'atleta con, per ognuna, «Non ci sarà»: un tocco, il motivo a scelta e una nota breve se si
 * vuole; poi si può modificare o togliere. Cambia subito sullo schermo e intanto va al server; se il server rifiuta torna
 * com'era e lo dice. Chi ha il link può cambiare ogni partita finché non comincia, anche una segnalazione scritta dallo staff.
 */
export function AvailabilityPanel({ token, items }: { token: string; items: FamilyMatchItem[] }) {
  const [optimistic, applyOptimistic] = useOptimistic(items, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<{ matchId: string; message: string } | null>(null);

  function run(matchId: string, change: Change, call: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      try {
        const result = await call();
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
          saving={saving}
          onReport={(reason, note) =>
            run(item.matchId, { type: "set", matchId: item.matchId, report: { reason, note: note.trim() || null, reportedBy: "parent" } }, () =>
              reportUnavailableAction(token, item.matchId, reason, note),
            )
          }
          onClear={() => run(item.matchId, { type: "clear", matchId: item.matchId }, () => clearUnavailableAction(token, item.matchId))}
        />
      ))}
    </ul>
  );
}

function MatchCard({
  item,
  error,
  saving,
  onReport,
  onClear,
}: {
  item: FamilyMatchItem;
  error: string | null;
  saving: boolean;
  onReport: (reason: UnavailabilityReason | null, note: string) => void;
  onClear: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<UnavailabilityReason | null>(null);
  const [note, setNote] = useState("");
  const report = item.report;
  const byStaff = report?.reportedBy === "staff";

  /** Apre il modulo: vuoto per una segnalazione nuova, con quello che c'è già per modificarla. */
  function startAsking() {
    setReason(report?.reason ?? null);
    setNote(report?.note ?? "");
    setAsking(true);
  }

  function confirm() {
    onReport(reason, note);
    setAsking(false);
  }

  return (
    <li data-availability-match={item.matchId} data-availability-state={report ? "unavailable" : "available"}>
      <Card className={cn("px-4 py-4 sm:px-5", report && "border-destructive/30")}>
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

        {report && (
          <div className="mt-3 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm" data-availability-report>
            <p className="flex items-center gap-2 font-bold text-destructive">
              <CalendarX2 className="h-4 w-4 shrink-0" aria-hidden />
              Non ci sarà
            </p>
            <p className="mt-0.5 text-foreground/75">{describeUnavailability(report)}</p>
            {byStaff && <p className="mt-1 text-[13px] text-muted-foreground">Inserita dall&apos;allenatore{item.open ? ": puoi cambiarla tu." : "."}</p>}
          </div>
        )}

        {report && item.open && !asking && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={startAsking} data-availability-edit>
              <Pencil className="h-4 w-4" />
              Modifica
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClear} data-availability-clear>
              <Undo2 className="h-4 w-4" />
              Torna disponibile
            </Button>
          </div>
        )}

        {!report && item.open && !asking && (
          <Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" onClick={startAsking} data-availability-open>
            <CalendarX2 className="h-4 w-4" />
            Non ci sarà
          </Button>
        )}

        {!item.open && (
          <p className="mt-3 text-[13px] text-muted-foreground" data-availability-closed>
            La partita è già cominciata: da qui non si può più cambiare.
          </p>
        )}

        {asking && (
          <div className="mt-3 space-y-3 rounded-xl bg-surface-muted px-3.5 py-3.5" data-availability-form>
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-foreground/80">Il motivo (se vuoi dirlo)</legend>
              <div className="flex flex-wrap gap-2">
                {UNAVAILABILITY_REASONS.map((key) => (
                  <label
                    key={key}
                    className={cn(
                      "cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-ring/50",
                      reason === key
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong/80 bg-surface text-foreground hover:bg-surface-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name={`reason-${item.matchId}`}
                      className="sr-only"
                      checked={reason === key}
                      onChange={() => setReason(key)}
                      data-reason={key}
                    />
                    {UNAVAILABILITY_REASON_LABELS[key]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor={`note-${item.matchId}`}>Una nota per l&apos;allenatore (facoltativa)</Label>
              <Input
                id={`note-${item.matchId}`}
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                autoComplete="off"
                placeholder="Es. torna domenica sera"
                onChange={(event) => setNote(event.target.value)}
                data-availability-note
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={confirm} disabled={saving} data-availability-confirm>
                {report ? "Salva le modifiche" : "Conferma: non ci sarà"}
              </Button>
              <Button type="button" variant="quiet" onClick={() => setAsking(false)}>
                Annulla
              </Button>
            </div>
          </div>
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
