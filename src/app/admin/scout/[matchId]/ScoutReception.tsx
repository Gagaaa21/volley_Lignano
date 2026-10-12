"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ScoutAction } from "@/lib/scout/actions";
import { currentServer, type ScoutView } from "@/lib/scout/derive";
import { playerLabel } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { TOUCH_SKILLS } from "@/lib/scout/touches";
import type { ScoutData, ScoutGrade } from "@/lib/scout/types";
import { GradeDot } from "@/components/scout/GradeChart";
import { GradeButtons, PlayerChips, ZonePicker } from "./ScoutInputParts";
import { FlowSteps } from "./ScoutPhaseBanner";

/**
 * Livello «Con ricezioni»: sopra i pulsanti dei punti, mentre batte
 * l'avversaria, la striscia per segnare la nostra ricezione. Si tocca chi ha
 * ricevuto, il voto e, se si vuole, la zona. Un voto di errore (=) chiude da solo
 * lo scambio con il punto per loro; gli altri lasciano lo scambio aperto, e
 * il punto si segna sotto come sempre.
 */

export function ScoutReception({
  data,
  view,
  locked,
  dispatch,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
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

  return (
    <section className={cn(shell, "space-y-3 border-t-4 border-t-primary")} aria-label="Ricezione" data-scout-reception="open" data-tour="scout-reception">
      <div>
        <h2 className="font-display text-[17px] font-extrabold leading-none tracking-[-0.01em] text-primary">Ricezione nostra</h2>
        <p className="mt-1 text-xs text-muted-foreground">Battono loro. Tocca chi ha ricevuto e poi il voto; per l&apos;errore (=) il punto va a loro.</p>
        <div className="mt-2">
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
        />
      </div>

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

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Voto{current.player === undefined ? " · scegli prima chi ha ricevuto" : ""}
        </p>
        <GradeButtons skill="reception" onPick={record} disabled={current.player === undefined} testId="reception" />
      </div>
    </section>
  );
}
