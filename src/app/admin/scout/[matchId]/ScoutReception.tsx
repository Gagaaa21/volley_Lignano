"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ScoutAction } from "@/lib/scout/actions";
import { receptionCourt } from "@/lib/scout/court";
import { currentServer, type ScoutView } from "@/lib/scout/derive";
import { playerLabel } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { TOUCH_SKILLS } from "@/lib/scout/touches";
import type { ScoutData, ScoutGrade } from "@/lib/scout/types";
import { GradeDot } from "@/components/scout/GradeChart";
import { CourtBench, CourtPicker } from "./ScoutCourtPicker";
import { GradeButtons, PlayerChips, ZonePicker } from "./ScoutInputParts";
import { FlowSteps } from "./ScoutPhaseBanner";

/**
 * Livello «Con ricezioni»: sopra i pulsanti dei punti, mentre batte
 * l'avversaria, la scheda per segnare la nostra ricezione. Si tocca chi ha
 * ricevuto, il voto e, se si vuole, la zona. Un voto di errore (=) chiude da solo
 * lo scambio con il punto per loro; gli altri lasciano lo scambio aperto, e
 * il punto si segna sotto come sempre.
 *
 * Se si segue la formazione la scheda è in primo piano: a sinistra il campo, dove si
 * tocca chi ha ricevuto (la panchina e «Non so» sotto), a destra i voti grandi e la
 * zona; a due colonne prende tutta l'altezza che resta e i pulsanti dei punti si
 * abbassano. Senza formazione chi ha ricevuto si sceglie da una riga di numeri.
 *
 * Fuori dalle due colonne (pagina normale, telefono, iPad in verticale) la scheda sta
 * subito sotto la fascia della palla e, appena battono loro, la pagina scorre da sola
 * fino a lei: altrimenti, sotto il tabellone, resterebbe oltre il bordo dello schermo.
 */

/**
 * Scorre la pagina (o, a schermo intero in una colonna, l'area che scorre) fino a mettere la scheda subito sotto la fascia
 * della palla, che sta appiccicata in alto: sotto l'intestazione del sito o, a schermo intero, in cima alla finestra.
 * Lo scorrimento si calcola a mano e la scheda non riceve nessuno stile: con `scroll-margin` in linea, a schermo intero in
 * una colonna, la scheda restava vuota (il contenuto non veniva disegnato).
 */
function bringBelowBallStrip(card: HTMLElement, fullscreen: boolean) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let scroller: HTMLElement | null = card.parentElement;
  while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 1)) {
    scroller = scroller.parentElement;
  }
  const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
  const ball = document.querySelector<HTMLElement>("[data-scout-ball]");
  const headerHeight = fullscreen ? 0 : Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--admin-header-h")) || 0;
  const wanted = viewTop + (ball ? headerHeight + ball.offsetHeight : 0) + 8;
  const delta = card.getBoundingClientRect().top - wanted;
  if (Math.abs(delta) < 4) return;
  (scroller ?? window).scrollBy({ top: delta, behavior: reduceMotion ? "auto" : "smooth" });
}

export function ScoutReception({
  data,
  view,
  locked,
  dispatch,
  compact = false,
  fullscreen = false,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
  /** Schermo intero su schermo largo: tessere più basse, meno spazio tra le parti e, sugli schermi bassi, senza frasi di aiuto: lascia posto ai pulsanti dei punti. */
  compact?: boolean;
  /** Schermo intero (anche su telefono o iPad in verticale, in una colonna): la fascia della palla sta in cima alla finestra, non sotto l'intestazione del sito. */
  fullscreen?: boolean;
}) {
  const rallyKey = `${view.rallies.length}`;
  // La scelta vale per lo scambio in cui è stata fatta: appena lo scambio cambia, riparte da zero.
  const [choice, setChoice] = useState<{ key: string; player: string | null | undefined; zone: number | null }>({
    key: rallyKey,
    player: undefined,
    zone: null,
  });
  const current = choice.key === rallyKey ? choice : { key: rallyKey, player: undefined, zone: null };

  const server = locked ? null : currentServer(view);
  const receiving = server === "opp";
  const recorded = view.pending.find((t) => t.skill === "reception" && t.side === "us");
  const meta = TOUCH_SKILLS.reception;
  const court = receptionCourt(data, view);

  // La scheda aperta (da segnare) fuori dalle due colonne: quando si apre, a ogni scambio in cui battono loro e quando si
  // toglie la ricezione con «Cambia», si porta in vista, subito sotto la fascia della palla che resta in alto.
  const open = receiving && !recorded;
  const cardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open || compact) return;
    const card = cardRef.current;
    if (card) bringBelowBallStrip(card, fullscreen);
  }, [open, compact, fullscreen, rallyKey]);

  function record(grade: ScoutGrade) {
    if (current.player === undefined) return;
    dispatch({
      type: "touch",
      input: { side: "us", skill: "reception", player: current.player, grade, zone: current.zone },
      at: Date.now(),
      id: newId(),
    });
    setChoice({ key: rallyKey, player: undefined, zone: null });
  }

  const shell = "rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4";

  if (!receiving) {
    return (
      <section className={cn(shell, "py-2.5 sm:py-3")} aria-label="Ricezione" data-scout-reception="idle" data-tour="scout-reception">
        <p className="text-sm text-muted-foreground">
          <b className="font-bold text-foreground">Ricezione</b> ·{" "}
          {locked ? "partita finita." : "batte la nostra squadra: la segni quando battono loro."}
        </p>
        {!locked && (
          <div className="mt-2">
            <FlowSteps
              steps={[
                { label: "Battuta nostra", state: "now" },
                { label: "Ricevono loro (non si segna)", state: "todo" },
                { label: "Punto, qui sotto", state: "todo" },
              ]}
            />
          </div>
        )}
      </section>
    );
  }

  if (recorded) {
    return (
      <section className={cn(shell, "py-2.5 sm:py-3")} aria-label="Ricezione" data-scout-reception="done" data-tour="scout-reception">
        <div className="flex items-center gap-3">
          <GradeDot grade={recorded.grade} size="lg" />
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <b className="font-bold text-foreground">Ricezione segnata</b>
            <span className="block truncate text-muted-foreground">
              {playerLabel(data.roster, "us", recorded.player)} · {meta.gradeLabels[recorded.grade]}
              {recorded.zone ? ` · zona ${recorded.zone}` : ""}
            </span>
          </p>
          <Button variant="outline" size="xs" onClick={() => dispatch({ type: "removeTouch", id: recorded.id })} data-scout-reception-undo>
            <Undo2 className="h-3.5 w-3.5" />
            Cambia
          </Button>
        </div>
        <div className="mt-2">
          <FlowSteps
            steps={[
              { label: "Battuta loro", state: "done" },
              { label: "Ricezione nostra", state: "done" },
              { label: "Punto, qui sotto", state: "now" },
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ora segna il punto qui sotto, come sempre.</p>
      </section>
    );
  }

  const zoneRow = (
    <details className={cn("group rounded-xl border border-border-subtle bg-surface-muted/50 px-3 py-2", compact && "py-1.5 short:py-1")}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          Zona <span className="font-normal text-muted-foreground">(facoltativa)</span>
        </span>
        <span className="text-xs font-bold text-primary">{current.zone ? `Zona ${current.zone}` : "Scegli"}</span>
      </summary>
      <div className="mt-2 flex justify-center">
        <ZonePicker value={current.zone} onChange={(zone) => setChoice({ ...current, zone })} label="Zona della ricezione" />
      </div>
    </details>
  );

  if (court) {
    const label = "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
    const chosen = current.player === undefined ? " · scegli prima chi" : ` · ${current.player === null ? "non so chi" : playerLabel(data.roster, "us", current.player)}`;
    const choose = (player: string | null) => setChoice({ ...current, player });
    return (
      <section
        className={cn(
          shell,
          "@container border-t-[6px] border-t-primary ring-1 ring-primary/20 shadow-[0_14px_34px_-16px_rgba(11,60,120,0.5)]",
          compact && "flex flex-1 flex-col py-2.5 short:py-2 sm:py-3 sm:short:py-2",
        )}
        aria-label="Ricezione"
        data-scout-reception="open"
        data-scout-reception-court
        data-tour="scout-reception"
        ref={cardRef}
      >
        <div className="shrink-0">
          <h2 className="font-display text-xl font-extrabold leading-none tracking-[-0.01em] text-primary">Ricezione nostra</h2>
          <p className={cn("mt-1 text-xs text-muted-foreground", compact && "short:hidden")}>
            Battono loro. Tocca sul campo chi ha ricevuto e poi il voto; per l&apos;errore (=) il punto va a loro.
          </p>
          {/* A due colonne i passi a pastiglia si tolgono: il titolo e la frase dicono già a che punto si è, e l'altezza serve al campo. */}
          <div className={cn("mt-2", compact && "hidden")}>
            <FlowSteps
              steps={[
                { label: "Battuta loro", state: "done" },
                { label: "Ricezione nostra", state: "now" },
                { label: "Punto, qui sotto", state: "todo" },
              ]}
            />
          </div>
        </div>

        <div className={cn("mt-2.5 grid gap-3 @md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @md:grid-rows-[minmax(0,1fr)]", compact && "min-h-0 flex-1")}>
          <div className="flex min-h-0 min-w-0 flex-col">
            <p className={cn(label, "mb-1.5 shrink-0")}>Chi ha ricevuto</p>
            <div className="min-h-0 flex-1">
              <CourtPicker side="us" court={court} roster={data.roster.us} eligible={data.roster.us} selected={current.player} attr="who" fill={compact} onPick={choose} />
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-2">
            <p className={cn(label, "shrink-0 truncate")}>Voto{chosen}</p>
            <div className="min-h-0 flex-1">
              <GradeButtons skill="reception" layout="grid" onPick={record} disabled={current.player === undefined} testId="reception" compact={compact} />
            </div>
            <div className="shrink-0">{zoneRow}</div>
          </div>
        </div>

        <div className="mt-2 shrink-0">
          <CourtBench
            inline
            side="us"
            court={court}
            roster={data.roster.us}
            eligible={data.roster.us}
            selected={current.player}
            attr="who"
            onPick={choose}
            extra={
              <button
                type="button"
                aria-pressed={current.player === null}
                onClick={() => choose(null)}
                data-scout-who="unknown"
                className={cn(
                  "flex min-h-[2.75rem] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed px-1.5 py-1 text-center transition-colors active:translate-y-px short:min-h-[2.5rem]",
                  current.player === null ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border-strong bg-surface hover:bg-muted",
                )}
              >
                <span className="font-display text-lg font-extrabold leading-none text-muted-foreground">?</span>
                <span className="mt-0.5 text-[11px] font-semibold leading-tight text-muted-foreground">Non so</span>
              </button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        shell,
        "space-y-3 border-t-[6px] border-t-primary ring-1 ring-primary/20 shadow-[0_14px_34px_-16px_rgba(11,60,120,0.5)]",
        compact && "space-y-1.5 py-2.5 sm:py-2.5",
      )}
      aria-label="Ricezione"
      data-scout-reception="open"
      data-tour="scout-reception"
      ref={cardRef}
    >
      <div>
        <h2 className="font-display text-[17px] font-extrabold leading-none tracking-[-0.01em] text-primary">Ricezione nostra</h2>
        <p className={cn("mt-1 text-xs text-muted-foreground", compact && "short:hidden")}>
          Battono loro. Tocca chi ha ricevuto e poi il voto; per l&apos;errore (=) il punto va a loro.
        </p>
        <div className={cn("mt-2", compact && "short:hidden")}>
          <FlowSteps
            steps={[
              { label: "Battuta loro", state: "done" },
              { label: "Ricezione nostra", state: "now" },
              { label: "Punto, qui sotto", state: "todo" },
            ]}
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Chi ha ricevuto</p>
        <PlayerChips
          side="us"
          players={data.roster.us}
          selected={current.player}
          onSelect={(player) => setChoice({ ...current, player })}
          ariaLabel="Chi ha ricevuto"
          court={view.court.us}
          dense={compact}
        />
      </div>

      {zoneRow}

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Voto{current.player === undefined ? " · scegli prima chi ha ricevuto" : ""}
        </p>
        <GradeButtons skill="reception" onPick={record} disabled={current.player === undefined} testId="reception" compact={compact} />
      </div>
    </section>
  );
}
