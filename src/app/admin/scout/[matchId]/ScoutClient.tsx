"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChartNoAxesColumn,
  Check,
  CloudOff,
  Flag,
  Loader2,
  RotateCcw,
  Settings2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { ScoutBoard } from "@/components/scout/ScoutBoard";
import { SectionTour } from "@/components/tour/SectionTour";
import { getScoutMatchTourSteps } from "@/components/tour/sectionSteps";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { SegmentedButtons } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { defaultNextServer, deriveScout, isMatchDecided, setTarget, suggestedSetEnd, type ScoutSet, type ScoutView } from "@/lib/scout/derive";
import { rallyText } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { summarizeScout } from "@/lib/scout/match";
import type { MatchScout, ScoutData, ScoutSide } from "@/lib/scout/types";
import { ScoutEntry } from "./ScoutEntry";
import { ScoutLog } from "./ScoutLog";
import { ScoutSetup, type ScoutAthlete } from "./ScoutSetup";
import { useScoutSession, type ScoutConflict, type SyncStatus } from "./useScoutSession";
import { useWakeLock } from "./useWakeLock";

export interface ScoutMatchInfo {
  id: string;
  title: string;
  dateLabel: string;
  time: string;
  location: string;
  categoryLabel: string | null;
  isFriendly: boolean;
}

const SYNC_META: Record<SyncStatus, { text: string; tone: BadgeTone }> = {
  saved: { text: "Salvato", tone: "success" },
  saving: { text: "Salvataggio…", tone: "neutral" },
  offline: { text: "Senza rete", tone: "warning" },
  conflict: { text: "Da risolvere", tone: "danger" },
  denied: { text: "Non salvato", tone: "danger" },
  error: { text: "Non salvato", tone: "danger" },
};

function SyncBadge({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const meta = SYNC_META[status];
  const Icon = status === "saved" ? Check : status === "saving" ? Loader2 : status === "offline" ? CloudOff : TriangleAlert;
  return (
    <div className="flex items-center gap-1.5" data-scout-sync={status} aria-live="polite">
      <Badge tone={meta.tone} className="px-2.5 py-1">
        <Icon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} />
        {meta.text}
      </Badge>
      {(status === "offline" || status === "error") && (
        <Button variant="quiet" size="xs" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

function summaryLine(scout: ScoutData | null): string {
  const s = summarizeScout(scout);
  if (s.state === "none") return "nessun punto segnato";
  const sets = s.sets.map((score) => `${score.us}–${score.opp}`).join(", ");
  return `${s.rallies} scambi · set ${s.setsWon.us}–${s.setsWon.opp} (${sets})`;
}

function ConflictDialog({
  conflict,
  onResolve,
}: {
  conflict: ScoutConflict;
  onResolve: (choice: "server" | "mine") => void;
}) {
  const savedAt = conflict.current
    ? new Date(conflict.current.updatedAt).toLocaleString("it-IT", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome",
      })
    : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sea-950/55 p-4 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="scout-conflict-title"
        data-scout-conflict
        className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)]"
      >
        <h2 id="scout-conflict-title" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <TriangleAlert className="h-5 w-5 text-warning" />
          Questa partita è stata modificata altrove
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Un altro dispositivo (o un&apos;altra scheda) ha salvato lo scout di questa partita mentre lo modificavi qui. Scegli quale versione tenere: l&apos;altra
          verrà persa.
        </p>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="rounded-xl bg-surface-muted px-3.5 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Su questo dispositivo</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{summaryLine(conflict.mine)}</dd>
          </div>
          <div className="rounded-xl bg-surface-muted px-3.5 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Salvata sul server{savedAt ? ` il ${savedAt}` : ""}
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {conflict.current ? summaryLine(conflict.current) : "cancellata nel frattempo"}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onResolve("server")} data-scout-conflict-server>
            Usa quella salvata
          </Button>
          <Button onClick={() => onResolve("mine")} data-scout-conflict-mine>
            Tieni la mia
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Il set è arrivato al limite (o si vuole chiuderlo prima): si conferma e si dice chi batte per primo nel prossimo. */
function SetEndPanel({
  view,
  data,
  forced,
  onConfirm,
  onCancel,
}: {
  view: ScoutView;
  data: ScoutData;
  /** Chiusura anticipata: il set non ha ancora raggiunto il limite. */
  forced: boolean;
  onConfirm: (nextServer: ScoutSide) => void;
  onCancel?: () => void;
}) {
  const cur = view.current as ScoutSet;
  const [chosen, setChosen] = useState<ScoutSide | null>(null);
  const tied = cur.score.us === cur.score.opp;
  const winner: ScoutSide = cur.score.us > cur.score.opp ? "us" : "opp";
  const after = { ...view.setsWon, [winner]: view.setsWon[winner] + 1 };
  const decides = !tied && isMatchDecided(data.settings.format, after, view.sets.length);
  const nextServer = chosen ?? defaultNextServer(cur);
  const winnerName = winner === "us" ? "noi" : "loro";

  return (
    <Card className="border-primary/30 bg-primary-soft/40" data-scout-set-end>
      <CardBody className="space-y-3 pt-4 sm:pt-5">
        <div>
          <p className="font-display text-base font-bold text-foreground">
            {forced
              ? `Chiudere il ${cur.n}° set sul ${cur.score.us}–${cur.score.opp}?`
              : `Il ${cur.n}° set è finito ${cur.score.us}–${cur.score.opp}: ${winner === "us" ? "vinto da noi" : "vinto da loro"}`}
          </p>
          {forced && !tied && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Non ha ancora raggiunto i {setTarget(data.settings, cur.n)} punti con due di scarto: si chiude comunque, a favore di {winnerName}.
            </p>
          )}
          {forced && tied && <p className="mt-0.5 text-sm text-destructive">Il set è in parità: non si può chiudere.</p>}
          {decides && !tied && <p className="mt-0.5 text-sm text-muted-foreground">Con questo set la partita è decisa.</p>}
        </div>

        {!decides && !tied && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi batte per primo nel {cur.n + 1}° set?</p>
            <SegmentedButtons
              ariaLabel="Chi batte per primo nel prossimo set"
              value={nextServer}
              onChange={setChosen}
              items={[
                { value: "us", label: "Noi" },
                { value: "opp", label: "Loro" },
              ]}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onConfirm(nextServer)} disabled={tied} data-scout-close-set>
            <Flag className="h-4 w-4" />
            {decides ? "Chiudi il set e la partita" : `Chiudi il ${cur.n}° set`}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Annulla
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function ScoutClient({
  match,
  athletes,
  initial,
  blank,
}: {
  match: ScoutMatchInfo;
  athletes: ScoutAthlete[];
  initial: MatchScout | null;
  blank: ScoutData;
}) {
  const { data, dispatch, status, message, conflict, resolveConflict, reset, retryNow } = useScoutSession({
    matchId: match.id,
    initial,
    blank,
  });
  const view = useMemo(() => deriveScout(data), [data]);
  const suggestion = suggestedSetEnd(view, data.settings);
  const locked = view.decided || data.finished;
  const hasRallies = view.rallies.length > 0;
  // Finché la partita è in corso lo schermo non si spegne.
  useWakeLock(!locked);

  const [setupOpen, setSetupOpen] = useState(data.events.length === 0);
  const [closingSet, setClosingSet] = useState(false);
  // Prima del primo punto la preparazione sta in pagina al posto dei pulsanti (vedi più sotto): la guida segue.
  const inlineSetup = setupOpen && data.events.length === 0;
  const tourSteps = useMemo(() => getScoutMatchTourSteps(match.id, { setup: inlineSetup }), [match.id, inlineSetup]);

  const cur = view.current;
  const canForceClose = !locked && cur !== null && cur.rallies.length > 0 && !suggestion;
  const lastEvent = data.events[data.events.length - 1];
  const lastRally = lastEvent?.type === "rally" ? view.rallies[view.rallies.length - 1] : undefined;
  const lastText = lastRally ? rallyText(lastRally, data.roster) : null;

  function closeSet(nextServer: ScoutSide) {
    dispatch({ type: "endSet", nextServer, at: Date.now(), id: newId() });
    setClosingSet(false);
  }

  function finish() {
    if (!window.confirm("Chiudere la partita adesso? Si può sempre riaprire.")) return;
    dispatch({ type: "finish" });
  }

  async function wipe() {
    if (!window.confirm("Cancellare tutto lo scout di questa partita (giocatrici, numeri e tutti gli scambi)? Non si può annullare.")) return;
    const ok = await reset();
    if (ok) setSetupOpen(true);
    else window.alert("Non sono riuscito a cancellare: controlla la connessione e riprova.");
  }

  const setup = <ScoutSetup data={data} athletes={athletes} dispatch={dispatch} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Intestazione compatta: durante la partita ogni riga in meno è un tocco in meno di scorrimento. */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/scout"
            className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Scout
          </Link>
          <div className="flex items-center gap-1.5">
            <SyncBadge status={status} onRetry={retryNow} />
            <SectionTour steps={tourSteps} />
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display-wide line-clamp-2 text-[1.5rem] leading-[1.1] text-foreground sm:text-[2rem]">{match.title}</h1>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {match.dateLabel} · {match.time}
              {match.categoryLabel ? ` · ${match.categoryLabel}` : ""}
              {match.isFriendly ? " · Amichevole" : ""} · {match.location}
            </p>
          </div>
          <LinkButton href={`/admin/scout/${match.id}/tabellino`} variant="outline" size="sm" className="shrink-0" data-scout-tabellino-link>
            <ChartNoAxesColumn className="h-4 w-4" />
            Tabellino
          </LinkButton>
        </div>
      </header>

      {(status === "offline" || status === "denied" || status === "error") && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground"
          data-scout-sync-message
        >
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            {status === "offline"
              ? "Non riesco a collegarmi. Continua pure a segnare: i punti restano su questo dispositivo e partono da soli appena torna la rete."
              : message}
          </p>
        </div>
      )}

      <div data-tour="section-scout-board">
        <ScoutBoard view={view} settings={data.settings} finished={data.finished} />
      </div>

      {view.decided && (
        <Card className="border-success/30 bg-success-soft/50" data-scout-over>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-4 sm:pt-5">
            <p className="font-display text-base font-bold text-foreground">
              Partita finita {view.setsWon.us}–{view.setsWon.opp} {view.setsWon.us > view.setsWon.opp ? "per noi" : "per loro"}.
            </p>
            <LinkButton href={`/admin/scout/${match.id}/tabellino`} size="sm">
              <ChartNoAxesColumn className="h-4 w-4" />
              Apri il tabellino
            </LinkButton>
          </CardBody>
        </Card>
      )}

      {!view.decided && data.finished && (
        <Card data-scout-over>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-4 sm:pt-5">
            <p className="font-display text-base font-bold text-foreground">Partita chiusa a mano.</p>
            <Button variant="outline" size="sm" onClick={() => dispatch({ type: "reopen" })}>
              <RotateCcw className="h-4 w-4" />
              Riapri
            </Button>
          </CardBody>
        </Card>
      )}

      {!locked && suggestion && <SetEndPanel view={view} data={data} forced={false} onConfirm={closeSet} />}
      {canForceClose && closingSet && (
        <SetEndPanel view={view} data={data} forced onConfirm={closeSet} onCancel={() => setClosingSet(false)} />
      )}

      {inlineSetup && (
        <section aria-label="Prima di cominciare" className="space-y-4" data-tour="section-scout-setup">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Prima di cominciare</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Scegli chi gioca e le regole della gara. Si può cambiare anche dopo.</p>
          </div>
          {setup}
          <Button onClick={() => setSetupOpen(false)} data-scout-start>
            Comincia a segnare i punti
          </Button>
        </section>
      )}

      {!inlineSetup && (
        <>
          <div data-tour="section-scout-entry">
            <ScoutEntry data={data} locked={locked} dispatch={dispatch} />
          </div>

          <div className="flex items-start gap-3" data-scout-last>
            <div className="min-w-0 flex-1 pt-1.5 text-sm leading-snug">
              {lastRally && lastText ? (
                <p className="line-clamp-2 text-muted-foreground">
                  Ultimo:{" "}
                  <b className="tabular text-foreground">
                    {lastRally.score.us}–{lastRally.score.opp}
                  </b>{" "}
                  · punto {lastText.winner === "us" ? "nostro" : "loro"} · {lastText.label}
                  {lastRally.player ? ` · ${lastText.who}` : ""}
                </p>
              ) : lastEvent ? (
                <p className="text-muted-foreground">Ultimo: fine del set</p>
              ) : (
                <p className="text-muted-foreground">Nessun punto ancora.</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "undo" })}
              disabled={data.events.length === 0 && !data.finished}
              className="shrink-0"
              data-scout-undo
            >
              <Undo2 className="h-4 w-4" />
              Annulla ultimo
            </Button>
          </div>

          <div className="flex flex-wrap gap-2" data-tour="section-scout-tools">
            <Button variant="outline" size="xs" onClick={() => setSetupOpen(true)} data-scout-open-setup>
              <Settings2 className="h-3.5 w-3.5" />
              Squadre e regole
            </Button>
            {canForceClose && !closingSet && (
              <Button variant="outline" size="xs" onClick={() => setClosingSet(true)}>
                <Flag className="h-3.5 w-3.5" />
                Chiudi il set adesso
              </Button>
            )}
            {!locked && hasRallies && (
              <Button variant="outline" size="xs" onClick={finish}>
                Chiudi la partita
              </Button>
            )}
          </div>

          <section aria-label="Registro degli scambi" data-tour="section-scout-log">
            <h2 className="mb-2.5 font-display text-lg font-bold text-foreground">Registro</h2>
            <ScoutLog view={view} roster={data.roster} dispatch={dispatch} />
          </section>
        </>
      )}

      {setupOpen && data.events.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setSetupOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Squadre e regole"
            data-scout-sheet="setup"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border-subtle bg-background p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-foreground">Squadre e regole</h2>
              <Button variant="quiet" size="icon-sm" onClick={() => setSetupOpen(false)} aria-label="Chiudi">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {setup}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="danger-ghost" size="sm" onClick={() => void wipe()} data-scout-wipe>
                Azzera lo scout
              </Button>
              <Button onClick={() => setSetupOpen(false)}>Fatto</Button>
            </div>
          </div>
        </div>
      )}

      {conflict && <ConflictDialog conflict={conflict} onResolve={resolveConflict} />}
    </div>
  );
}
