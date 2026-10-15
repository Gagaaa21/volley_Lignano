"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ScoutAction } from "@/lib/scout/actions";
import { receptionCourt } from "@/lib/scout/court";
import { currentServer, type ScoutView } from "@/lib/scout/derive";
import { playerLabel } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { receptionOpen } from "@/lib/scout/phases";
import { TOUCH_SKILLS } from "@/lib/scout/touches";
import type { ScoutData, ScoutGrade } from "@/lib/scout/types";
import { GradeDot } from "@/components/scout/GradeChart";
import { CourtBench, CourtPicker } from "./ScoutCourtPicker";
import { GradeButtons, PlayerChips, ZonePicker } from "./ScoutInputParts";
import { FlowSteps } from "./ScoutPhaseBanner";
import { Sheet } from "./ScoutSheet";

/**
 * Livello «Con ricezioni»: quando batte l'avversaria la nostra ricezione si segna in una finestra che si apre da sola,
 * come quelle dei tasti dei punti: chi ha ricevuto, il voto e, se si vuole, la zona. Se si segue la formazione chi ha
 * ricevuto si tocca sul campo (la panchina e «Non so» sotto), altrimenti da una riga di numeri. Un voto di errore (=)
 * chiude da solo lo scambio con il punto per loro; gli altri lasciano lo scambio aperto, e il punto si segna come sempre.
 *
 * In pagina resta una riga sola: «Ricezione nostra» con il pulsante per riaprire la finestra (se è stata chiusa a mano,
 * per esempio con «Salta la ricezione»: quello scambio si segna solo con il punto), poi «Ricezione segnata» con «Cambia».
 */

export function ScoutReception({
  data,
  view,
  locked,
  paused = false,
  dispatch,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  /** Il set è finito e si aspetta di chiuderlo: niente ricezione (e niente finestra) finché non comincia quello dopo. */
  paused?: boolean;
  dispatch: (action: ScoutAction) => void;
}) {
  // Lo scambio in corso: la scelta fatta e la finestra chiusa a mano valgono solo per questo scambio.
  const rallyKey = `${view.sets.length}:${view.current?.rallies.length ?? 0}`;
  const [choice, setChoice] = useState<{ key: string; player: string | null | undefined; zone: number | null }>({
    key: rallyKey,
    player: undefined,
    zone: null,
  });
  const current = choice.key === rallyKey ? choice : { key: rallyKey, player: undefined, zone: null };
  // La finestra chiusa a mano: resta chiusa per questo scambio. Per riaprirla c'è il pulsante in pagina, che la toglie da qui,
  // così se la ricezione si segna e poi si toglie (con «Cambia» o «Annulla ultimo») la finestra si riapre da sola.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const active = !locked && !paused;
  const receiving = active && currentServer(view) === "opp";
  const recorded = view.pending.find((t) => t.skill === "reception" && t.side === "us");
  const meta = TOUCH_SKILLS.reception;
  const court = receptionCourt(data, view);

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

  if (paused) return null;

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
            <span className="block line-clamp-2 text-muted-foreground">
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

  // Da segnare: in pagina la riga con il pulsante e, sopra, la finestra (a meno che sia stata chiusa a mano).
  const windowOpen = receptionOpen(view) && dismissedKey !== rallyKey;
  const label = "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
  const chosen = current.player === undefined ? " · scegli prima chi" : ` · ${current.player === null ? "non so chi" : playerLabel(data.roster, "us", current.player)}`;
  const choose = (player: string | null) => setChoice({ ...current, player });
  const dismiss = () => setDismissedKey(rallyKey);

  const zoneRow = (
    <details className="group rounded-xl border border-border-subtle bg-surface-muted/50 px-3 py-2">
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

  return (
    <>
      <section
        className="rounded-2xl border border-border border-t-[6px] border-t-primary bg-card p-3 shadow-[0_14px_34px_-16px_rgba(11,60,120,0.5)] ring-1 ring-primary/20 sm:p-4"
        aria-label="Ricezione"
        data-scout-reception="prompt"
        data-tour="scout-reception"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-extrabold leading-none tracking-[-0.01em] text-primary">Ricezione nostra</h2>
            <p className="mt-1 text-xs text-muted-foreground">Battono loro: segna chi ha ricevuto e con che voto.</p>
          </div>
          <Button onClick={() => setDismissedKey(null)} data-scout-reception-open>
            Segna la ricezione
          </Button>
        </div>
      </section>

      {windowOpen && (
        <Sheet
          title="Ricezione nostra"
          subtitle={`Battono loro · tocca ${court ? "sul campo " : ""}chi ha ricevuto e poi il voto; per l'errore (=) il punto va a loro.`}
          onClose={dismiss}
          testId="reception"
          wide
          closeOnBackdrop={false}
        >
          <div className="@container" data-scout-reception="open" data-scout-reception-court={court ? true : undefined}>
            <div className="mb-3">
              <FlowSteps
                steps={[
                  { label: "Battuta loro", state: "done" },
                  { label: "Ricezione nostra", state: "now" },
                  { label: "Poi il punto", state: "todo" },
                ]}
              />
            </div>
            {court ? (
              <>
                <div className="grid gap-3 @md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className={cn(label, "mb-1.5")}>Chi ha ricevuto</p>
                    <CourtPicker side="us" court={court} roster={data.roster.us} eligible={data.roster.us} selected={current.player} attr="who" onPick={choose} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className={cn(label, "truncate")}>Voto{chosen}</p>
                    <GradeButtons skill="reception" layout="grid" onPick={record} disabled={current.player === undefined} testId="reception" />
                    {zoneRow}
                  </div>
                </div>
                <div className="mt-3">
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
                          "flex min-h-[2.75rem] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed px-1.5 py-1 text-center transition-colors active:translate-y-px",
                          current.player === null ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border-strong bg-surface hover:bg-muted",
                        )}
                      >
                        <span className="font-display text-lg font-extrabold leading-none text-muted-foreground">?</span>
                        <span className="mt-0.5 text-[11px] font-semibold leading-tight text-muted-foreground">Non so</span>
                      </button>
                    }
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className={cn(label, "mb-1.5")}>Chi ha ricevuto</p>
                  <PlayerChips side="us" players={data.roster.us} selected={current.player} onSelect={choose} ariaLabel="Chi ha ricevuto" court={view.court.us} />
                </div>
                {zoneRow}
                <div>
                  <p className={cn(label, "mb-1.5")}>Voto{chosen}</p>
                  <GradeButtons skill="reception" onPick={record} disabled={current.player === undefined} testId="reception" />
                </div>
              </div>
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={dismiss} data-scout-reception-skip>
              Salta la ricezione: segno solo il punto
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
