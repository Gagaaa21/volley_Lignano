"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChartNoAxesColumn,
  Check,
  CloudOff,
  Flag,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  RotateCcw,
  Settings2,
  TriangleAlert,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useStageFullscreen } from "@/app/admin/livescore/useStageFullscreen";
import { ScoutBoard } from "@/components/scout/ScoutBoard";
import { SectionTour } from "@/components/tour/SectionTour";
import { getScoutMatchTourSteps } from "@/components/tour/scoutSteps";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { SegmentedButtons } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { receptionCourt } from "@/lib/scout/court";
import { currentServer, defaultNextServer, deriveScout, isMatchDecided, setTarget, suggestedSetEnd, type ScoutSet, type ScoutView } from "@/lib/scout/derive";
import { rallyText, touchLabel } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { LEVEL_META, levelOf } from "@/lib/scout/levels";
import { ballOf, receptionOpen } from "@/lib/scout/phases";
import { summarizeScout } from "@/lib/scout/match";
import type { MatchScout, ScoutData, ScoutSide } from "@/lib/scout/types";
import { ScoutBallSide } from "./ScoutBallSide";
import { ScoutCourtStrip } from "./ScoutCourtStrip";
import { ScoutEntry } from "./ScoutEntry";
import type { SavedScoutLineup } from "./ScoutLineupEditor";
import { ScoutLog } from "./ScoutLog";
import { ScoutReception } from "./ScoutReception";
import { ScoutSetup, type ScoutAthlete } from "./ScoutSetup";
import { ScoutTouchEntry } from "./ScoutTouchEntry";
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
    <div className="flex items-center gap-1.5" data-scout-sync={status} data-tour="scout-sync" aria-live="polite">
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
    <Card className="border-primary/30 bg-primary-soft/40" data-scout-set-end data-tour="scout-set-end">
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
  savedLineups,
  initial,
  blank,
  autoGuide = false,
}: {
  match: ScoutMatchInfo;
  athletes: ScoutAthlete[];
  /** Le formazioni salvate in Partite, una per set. */
  savedLineups: SavedScoutLineup[];
  initial: MatchScout | null;
  blank: ScoutData;
  /** Apre la guida passo passo appena la pagina è pronta (link «Avvia la guida» dell'elenco partite). */
  autoGuide?: boolean;
}) {
  const { data, dispatch, status, message, conflict, resolveConflict, reset, retryNow } = useScoutSession({
    matchId: match.id,
    initial,
    blank,
  });
  const view = useMemo(() => deriveScout(data), [data]);
  const level = levelOf(data.settings);
  const suggestion = suggestedSetEnd(view, data.settings);
  const locked = view.decided || data.finished;
  const hasRallies = view.rallies.length > 0;
  // Da che parte del campo è la palla: sul tabellone e sopra i pulsanti per segnare (non a partita finita).
  const ball = useMemo(() => (view.decided || data.finished ? null : ballOf(view, level)), [view, data.finished, level]);
  // Con le ricezioni e la formazione, mentre batte l'avversaria la scheda della ricezione (con il campo) è la parte principale.
  const receptionInFocus = level === "ricezioni" && !locked && receptionCourt(data, view) !== null && receptionOpen(view);
  // Finché la partita è in corso lo schermo non si spegne.
  useWakeLock(!locked);

  // Schermo intero: il riquadro ricopre tutta la finestra (vedi useStageFullscreen) e, su schermi larghi,
  // si divide in due colonne: i comandi per segnare a sinistra; a destra il tabellone (fisso in alto), «In campo» e il registro.
  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isSimulated, toggle: toggleFullscreen } = useStageFullscreen(stageRef);
  const wide = useMediaQuery("(min-width: 1024px)");
  const twoColumns = isFullscreen && wide;

  // Si è già giocato? Una formazione o un cambio scritti prima del primo punto non contano: la preparazione resta aperta.
  const hasPlay = data.events.some((event) => event.type === "rally" || event.type === "touch" || event.type === "setEnd");
  const [setupOpen, setSetupOpen] = useState(!hasPlay);
  const [closingSet, setClosingSet] = useState(false);
  // Prima del primo punto la preparazione sta in pagina al posto dei pulsanti (vedi più sotto): la guida segue.
  const inlineSetup = setupOpen && !hasPlay;

  const cur = view.current;
  const canForceClose = !locked && cur !== null && cur.rallies.length > 0 && !suggestion;
  const setEnding = !locked && Boolean(suggestion);
  const canFinish = !locked && hasRallies;
  const followsLineup = Boolean(view.court.us || view.court.opp);
  const tourSteps = useMemo(
    () =>
      getScoutMatchTourSteps(match.id, {
        setup: inlineSetup,
        setEnding,
        decided: view.decided,
        closed: !view.decided && data.finished,
        canCloseSet: canForceClose,
        canFinish,
        level,
        followsLineup,
      }),
    [match.id, inlineSetup, setEnding, view.decided, data.finished, canForceClose, canFinish, level, followsLineup],
  );
  // Time-out usati da ogni squadra nel set in corso (due per set): sul tabellone e sul sito pubblico.
  const timeoutsUsed = {
    us: view.current?.timeouts.filter((t) => t.side === "us").length ?? 0,
    opp: view.current?.timeouts.filter((t) => t.side === "opp").length ?? 0,
  };
  const lastEvent = data.events[data.events.length - 1];
  // L'ultimo evento ha chiuso uno scambio (un esito scelto a mano, o un tocco con un voto che chiude)? Altrimenti è un tocco in sospeso o la fine di un set.
  const lastRally = lastEvent && lastEvent.type !== "setEnd" ? view.rallies.find((r) => r.id === lastEvent.id) : undefined;
  const lastText = lastRally ? rallyText(lastRally, data.roster) : null;
  const lastPending = lastEvent?.type === "touch" && !lastRally ? view.pending[view.pending.length - 1] : undefined;

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

  const setup = <ScoutSetup data={data} view={view} athletes={athletes} savedLineups={savedLineups} dispatch={dispatch} />;
  const boardEl = (
    <div data-tour="section-scout-board">
      <ScoutBoard
        view={view}
        settings={data.settings}
        finished={data.finished}
        ball={ball}
        compact={isFullscreen}
        timeouts={timeoutsUsed}
        onTimeout={locked ? undefined : (side) => dispatch({ type: "timeout", side, at: Date.now(), id: newId() })}
      />
    </div>
  );
  const courtStrip = <ScoutCourtStrip data={data} view={view} locked={locked} dispatch={dispatch} onEditLineup={() => setSetupOpen(true)} large={twoColumns} />;

  return (
    <div
      ref={stageRef}
      data-scout-stage
      className={cn(
        "w-full",
        // Fuori dallo schermo intero si recupera un po' del margine alto della pagina: ogni riga serve ai pulsanti.
        !isFullscreen && "mx-auto -mt-3 max-w-3xl sm:-mt-5",
        isFullscreen && "overflow-hidden bg-gradient-to-br from-primary-soft via-background to-accent px-2 pb-2 pt-1 sm:px-3 sm:pb-3",
        // Schermo intero vero: lo riempie il browser. Simulato: il riquadro ricopre la finestra.
        isFullscreen && !isSimulated && "h-screen w-screen",
        isSimulated && "fixed inset-0 z-40",
      )}
    >
      <div className={cn(isFullscreen ? "mx-auto flex h-full w-full max-w-[1800px] flex-col gap-2" : "flex flex-col gap-5")}>
        {/* Su iPad e iPhone la barra di stato sfoca la fascia in alto: qui non c'è niente (vedi globals.css). */}
        {isFullscreen && <div aria-hidden className="fullscreen-inset-top" />}
        {/* Intestazione compatta: durante la partita ogni riga in meno è un tocco in meno di scorrimento. */}
        <header className={cn("space-y-2", isFullscreen && "sm:flex sm:items-center sm:gap-3 sm:space-y-0")}>
          <div className={cn("flex items-center justify-between gap-3", isFullscreen && "sm:contents")}>
            <Link
              href="/admin/scout"
              className={cn(
                "-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                isFullscreen && "sm:order-1",
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Scout
            </Link>
            <div className={cn("flex items-center gap-1.5", isFullscreen && "sm:order-4 sm:ml-auto")}>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
                title={
                  isFullscreen
                    ? "Torna alla pagina normale (anche con Esc)"
                    : "Tutto lo Scout a schermo intero: su tablet e computer, i punti da una parte e il registro dall'altra"
                }
                data-scout-fullscreen
                data-tour="scout-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="hidden sm:inline">{isFullscreen ? "Esci" : "Schermo intero"}</span>
              </Button>
              {data.settings.publicLive && (
                <Badge tone="danger" className="px-2.5 py-1" title="Il punteggio è visibile a tutti sul sito" data-scout-live-badge>
                  <Radio className="h-3.5 w-3.5" />
                  Live sul sito
                </Badge>
              )}
              <SyncBadge status={status} onRetry={retryNow} />
              <a
                href="/api/scout/manuale"
                download
                className={buttonVariants({ variant: "quiet", size: "icon-sm", className: "rounded-full" })}
                aria-label="Scarica il manuale d'uso dello Scout (PDF)"
                title="Manuale d'uso (PDF)"
                data-tour="scout-manual"
                data-scout-manual
              >
                <BookOpen className="h-[18px] w-[18px]" />
              </a>
              <SectionTour steps={tourSteps} autoStart={autoGuide} />
            </div>
          </div>
          <div className={cn("flex items-end justify-between gap-3", isFullscreen && "sm:contents")}>
            <div className={cn("min-w-0", isFullscreen && "sm:order-2 sm:flex sm:flex-1 sm:items-baseline sm:gap-3")}>
              <h1
                className={cn(
                  "display-wide line-clamp-2 text-[1.5rem] leading-[1.1] text-foreground sm:text-[1.75rem]",
                  isFullscreen && "sm:line-clamp-1 sm:shrink-0 sm:text-[1.375rem]",
                )}
              >
                {match.title}
              </h1>
              <p className={cn("mt-1 text-[13px] leading-snug text-muted-foreground", isFullscreen && "sm:mt-0 sm:min-w-0 sm:truncate")}>
                {match.dateLabel} · {match.time}
                {match.categoryLabel ? ` · ${match.categoryLabel}` : ""}
                {match.isFriendly ? " · Amichevole" : ""} · {match.location}
                <span data-scout-level-label={level}> · Livello {LEVEL_META[level].label}</span>
              </p>
            </div>
            <LinkButton
              href={`/admin/scout/${match.id}/tabellino`}
              variant="outline"
              size="sm"
              className={cn("shrink-0", isFullscreen && "sm:order-3")}
              data-scout-tabellino-link
              data-tour="scout-tabellino"
            >
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

        {/* Sul telefono e fuori dallo schermo intero è una sola colonna (le fasce sono «contents»); a schermo intero e su
         * schermi larghi diventano due colonne che scorrono per conto loro. */}
        <div
          className={cn(
            isFullscreen ? "grid min-h-0 flex-1 content-start gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden" : "contents",
          )}
          data-scout-columns={isFullscreen ? "fullscreen" : undefined}
        >
          <div className={cn(isFullscreen ? "flex flex-col gap-3 lg:min-h-0" : "contents")} data-scout-main-pane>
            {/* A due colonne tutto scorre in quest'area tranne il piede («Annulla ultimo» e gli strumenti), sempre in fondo e in vista. */}
            <div className={cn(twoColumns ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" : "contents")} data-scout-main-scroll>
            {!twoColumns && boardEl}

            {view.decided && (
              <Card className="border-success/30 bg-success-soft/50" data-scout-over data-tour="scout-over">
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
              <Card data-scout-over data-tour="scout-over">
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
                <Button onClick={() => setSetupOpen(false)} data-scout-start data-tour="scout-start">
                  Comincia a segnare i punti
                </Button>
              </section>
            )}

            {!inlineSetup && (
              <>
                <div data-tour="section-scout-entry" className={cn(twoColumns ? "flex flex-1 flex-col gap-3 short:gap-2" : "space-y-3")}>
                  {!locked && ball && <ScoutBallSide ball={ball} fullscreen={isFullscreen} />}
                  {!twoColumns && courtStrip}
                  {level === "completo" ? (
                    <ScoutTouchEntry data={data} view={view} locked={locked} dispatch={dispatch} compact={twoColumns} />
                  ) : (
                    <>
                      {level === "ricezioni" && <ScoutReception data={data} view={view} locked={locked} dispatch={dispatch} compact={twoColumns} />}
                      <ScoutEntry data={data} locked={locked} dispatch={dispatch} courts={view.court} server={currentServer(view)} compact={twoColumns} lowered={twoColumns && receptionInFocus} />
                    </>
                  )}
                </div>
              </>
            )}
            </div>

            {!inlineSetup && (
              <div className={cn(twoColumns ? "shrink-0 space-y-2.5 short:space-y-2" : "contents")} data-scout-footer>
                <div className="flex items-start gap-3" data-scout-last data-tour="scout-last">
                  <div className={cn("min-w-0 flex-1 pt-1.5 text-sm leading-snug", twoColumns && "pt-2 text-[15px]")}>
                    {lastRally && lastText ? (
                      <p className="line-clamp-2 text-muted-foreground">
                        Ultimo:{" "}
                        <b className="tabular text-foreground">
                          {lastRally.score.us}–{lastRally.score.opp}
                        </b>{" "}
                        · punto {lastText.winner === "us" ? "nostro" : "loro"} · {lastText.label}
                        {lastRally.player ? ` · ${lastText.who}` : ""}
                      </p>
                    ) : lastPending ? (
                      <p className="line-clamp-2 text-muted-foreground" data-scout-last-touch>
                        Ultimo tocco: {touchLabel(lastPending, data.roster)}
                      </p>
                    ) : lastEvent?.type === "lineup" ? (
                      <p className="text-muted-foreground">Ultimo: formazione {lastEvent.side === "us" ? "nostra" : "loro"}</p>
                    ) : lastEvent?.type === "sub" ? (
                      <p className="text-muted-foreground">Ultimo: cambio {lastEvent.side === "us" ? "nostro" : "loro"}</p>
                    ) : lastEvent?.type === "timeout" ? (
                      <p className="text-muted-foreground">Ultimo: time-out {lastEvent.side === "us" ? "nostro" : "loro"}</p>
                    ) : lastEvent ? (
                      <p className="text-muted-foreground">Ultimo: fine del set</p>
                    ) : (
                      <p className="text-muted-foreground">Nessun punto ancora.</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size={twoColumns ? "md" : "sm"}
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
                  {!followsLineup && !locked && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setSetupOpen(true)}
                      title="Segna chi gioca nelle sei posizioni e la libero: rotazioni e cambi si seguono da soli"
                      data-scout-follow-lineup
                    >
                      <Users className="h-3.5 w-3.5" />
                      Segui la formazione
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    aria-pressed={data.settings.publicLive}
                    onClick={() => dispatch({ type: "settings", patch: { publicLive: !data.settings.publicLive } })}
                    title="Mostra o nascondi il punteggio sul sito pubblico (solo punti e set, mai nomi)"
                    data-scout-live-toggle
                    data-tour="scout-live-toggle"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    {data.settings.publicLive ? "Spegni il live sul sito" : "Punteggio live sul sito"}
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
              </div>
            )}
          </div>

          <div className={cn(isFullscreen ? "space-y-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:space-y-0 lg:overflow-y-auto" : "contents")} data-scout-log-pane>
            {/* A due colonne il tabellone sta qui, fisso in alto, con «In campo» sotto: a sinistra restano solo i comandi, tutti in vista. */}
            {twoColumns && <div className="sticky top-0 z-20 shrink-0">{boardEl}</div>}
            {!inlineSetup && twoColumns && courtStrip}
            {!inlineSetup && (
              <section
                aria-label="Registro degli scambi"
                data-tour="section-scout-log"
                // A due colonne il registro prende tutta l'altezza che resta e scorre da solo: tabellone e «In campo» non escono mai di vista.
                className={cn(twoColumns && "flex min-h-[15rem] flex-1 flex-col")}
              >
                <h2 className="mb-2.5 shrink-0 font-display text-lg font-bold text-foreground">Registro</h2>
                <div className={cn(twoColumns && "min-h-0 flex-1 overflow-y-auto pr-1")} data-scout-log-scroll>
                  <ScoutLog view={view} roster={data.roster} level={level} dispatch={dispatch} fill={twoColumns} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {setupOpen && hasPlay && (
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
