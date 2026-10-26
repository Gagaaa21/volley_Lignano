"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarClock, Lock, MessageSquareText, RotateCcw, Unlock } from "lucide-react";
import { MAX_MATCH_MESSAGE_LENGTH } from "@/lib/availability/reporting";
import type { ReportingView } from "@/lib/availability/reportingView";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { updateMatchReportingAction, type ReportingChange } from "./reporting-actions";

type Editing = "deadline" | "message" | null;

/**
 * Le segnalazioni dei genitori per una partita: come stanno (aperte fino a…, chiuse a mano, non chieste…) e i comandi per
 * cambiarle: chiudere adesso, riaprire fino all'inizio, tornare alla scadenza automatica, sceglierne un'altra, non chiedere niente
 * ai genitori per questa partita, lasciare loro un messaggio. Ogni tocco va al server e la pagina si aggiorna con il risultato.
 */
export function ReportingControls({ view, compact = false }: { view: ReportingView; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deadline, setDeadline] = useState(view.closesAt ?? view.autoDeadline);
  const [message, setMessage] = useState(view.message ?? "");
  // La spunta cambia subito al tocco; se il server rifiuta torna com'era.
  const [ask, setAsk] = useOptimistic(!view.hidden);

  function apply(change: ReportingChange, after?: () => void) {
    setError(null);
    startTransition(async () => {
      if (change.type === "hidden") setAsk(!change.hidden);
      try {
        const result = await updateMatchReportingAction(view.matchId, change);
        if (!result.ok) setError(result.error);
        else after?.();
      } catch {
        setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      }
    });
  }

  const open = view.state.kind === "open";
  const closed = view.state.kind === "closed";

  return (
    <div className={cn("space-y-3", pending && "opacity-70")} data-reporting={view.matchId} data-reporting-state={view.state.kind} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Badge tone={view.tone} data-reporting-status>
          {view.state.kind === "closed" || view.state.kind === "hidden" ? <Lock className="h-3 w-3" aria-hidden /> : null}
          {view.status}
        </Badge>
        {!compact && <span className="text-[12px] text-muted-foreground">{view.source}</span>}
      </div>
      {compact && <p className="text-[12px] leading-relaxed text-muted-foreground">{view.source}</p>}
      {view.paused && view.state.kind !== "hidden" && (
        <p className="text-[12px] text-warning">Le segnalazioni sono sospese per tutte le partite: le scelte qui valgono quando le riattivi.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!view.hidden && open && (
          <Button type="button" size="sm" variant="outline" onClick={() => apply({ type: "close" })} disabled={pending} data-reporting-close>
            <Lock className="h-4 w-4" />
            Chiudi adesso
          </Button>
        )}
        {!view.hidden && closed && (
          <Button type="button" size="sm" variant="outline" onClick={() => apply({ type: "reopen" })} disabled={pending} data-reporting-reopen>
            <Unlock className="h-4 w-4" />
            Riapri fino all&apos;inizio
          </Button>
        )}
        {!view.hidden && view.closesAt && view.autoOpen && (
          <Button type="button" size="sm" variant="quiet" onClick={() => apply({ type: "auto" })} disabled={pending} data-reporting-auto>
            <RotateCcw className="h-4 w-4" />
            Scadenza automatica ({view.autoDeadlineLabel})
          </Button>
        )}
        {!view.hidden && (
          <Button
            type="button"
            size="sm"
            variant={editing === "deadline" ? "soft" : "quiet"}
            onClick={() => setEditing(editing === "deadline" ? null : "deadline")}
            aria-expanded={editing === "deadline"}
            data-reporting-deadline-toggle
          >
            <CalendarClock className="h-4 w-4" />
            Scegli la scadenza
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={editing === "message" ? "soft" : "quiet"}
          onClick={() => setEditing(editing === "message" ? null : "message")}
          aria-expanded={editing === "message"}
          data-reporting-message-toggle
        >
          <MessageSquareText className="h-4 w-4" />
          {view.message ? "Messaggio ai genitori" : "Scrivi ai genitori"}
        </Button>
      </div>

      {editing === "deadline" && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-muted px-3.5 py-3" data-reporting-deadline-editor>
          <label className="min-w-0 flex-1 basis-56">
            <span className="mb-1 block text-[12px] font-semibold text-foreground/80">Si chiudono il</span>
            <Input
              type="datetime-local"
              value={deadline}
              max={view.start}
              onChange={(event) => setDeadline(event.target.value)}
              aria-label="Scadenza delle segnalazioni"
              data-reporting-deadline-input
            />
          </label>
          <Button type="button" size="sm" disabled={pending || !deadline} onClick={() => apply({ type: "deadline", closesAt: deadline.slice(0, 16) }, () => setEditing(null))} data-reporting-deadline-save>
            Salva
          </Button>
          <p className="w-full text-[12px] text-muted-foreground">Al più tardi all&apos;inizio della partita ({view.startLabel}).</p>
        </div>
      )}

      {editing === "message" && (
        <div className="space-y-2 rounded-xl bg-surface-muted px-3.5 py-3" data-reporting-message-editor>
          <Input
            value={message}
            maxLength={MAX_MATCH_MESSAGE_LENGTH}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Es. Partenza in pullman alle 14:30 dal palazzetto"
            aria-label="Messaggio ai genitori per questa partita"
            data-reporting-message-input
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => apply({ type: "message", message }, () => setEditing(null))} data-reporting-message-save>
              Salva
            </Button>
            {view.message && (
              <Button
                type="button"
                size="sm"
                variant="quiet"
                disabled={pending}
                onClick={() => apply({ type: "message", message: "" }, () => {
                  setMessage("");
                  setEditing(null);
                })}
                data-reporting-message-clear
              >
                Togli il messaggio
              </Button>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">Lo vedono i genitori sotto questa partita, nella pagina del loro link.</p>
        </div>
      )}

      {view.message && editing !== "message" && (
        <p className="rounded-xl bg-primary-soft/60 px-3.5 py-2 text-[13px] text-foreground/85" data-reporting-message>
          <span className="font-semibold">Ai genitori:</span> {view.message}
        </p>
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-foreground/85">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-primary)]"
          checked={ask}
          disabled={pending}
          onChange={(event) => apply({ type: "hidden", hidden: !event.target.checked })}
          data-reporting-ask
        />
        Chiedi ai genitori le assenze per questa partita
      </label>

      {view.changed && <p className="text-[12px] text-muted-foreground" data-reporting-changed>{view.changed}</p>}

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive" data-reporting-error>
          {error}
        </p>
      )}
    </div>
  );
}
