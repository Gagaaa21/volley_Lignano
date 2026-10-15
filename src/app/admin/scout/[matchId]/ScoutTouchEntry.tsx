"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import { currentServer, type ScoutView } from "@/lib/scout/derive";
import { newId } from "@/lib/scout/id";
import { serverId } from "@/lib/scout/court";
import { canDo } from "@/lib/scout/rules";
import { describeNext, TOUCH_SKILL_ORDER, TOUCH_SKILLS } from "@/lib/scout/touches";
import { tracksSetsOf } from "@/lib/scout/phases";
import type { ScoutData, ScoutGrade, ScoutSide, ScoutTouchSkill } from "@/lib/scout/types";
import { ScoutEntry } from "./ScoutEntry";
import { GradeButtons, PlayerChips, ZonePicker } from "./ScoutInputParts";
import { ScoutPhaseBanner } from "./ScoutPhaseBanner";

/**
 * Livello «Completo»: si segna ogni tocco della palla, nell'ordine in cui
 * avviene. Per ogni tocco tre scelte — cosa (si propone da solo), chi e il voto —
 * e il punto si assegna quando un voto chiude lo scambio (un ace, un errore,
 * un attacco a terra, un muro vincente). Per i falli fischiati e per chi
 * perde il filo c'è sempre l'altra strada: i pulsanti dei punti, in fondo.
 */

/** Chi ha battuto per ultima nella stessa squadra, se ha continuato a battere: è di nuovo lei. */
function lastServerPlayer(view: ScoutView, side: ScoutSide): string | null | undefined {
  const cur = view.current;
  const last = cur?.rallies[cur.rallies.length - 1];
  if (!last || last.server !== side || last.winner !== side) return undefined;
  const serve = last.touches.find((t) => t.skill === "serve" && t.side === side);
  if (serve) return serve.player;
  if (last.how === "ace" && last.actor === side) return last.player;
  return undefined;
}

/** Chi ha alzato per ultima in questo set per quella squadra. */
function lastSetterPlayer(view: ScoutView, side: ScoutSide): string | null | undefined {
  for (let i = view.pending.length - 1; i >= 0; i--) {
    const t = view.pending[i];
    if (t.skill === "set" && t.side === side) return t.player;
  }
  const rallies = view.current?.rallies ?? [];
  for (let r = rallies.length - 1; r >= 0; r--) {
    const touches = rallies[r].touches;
    for (let i = touches.length - 1; i >= 0; i--) {
      if (touches[i].skill === "set" && touches[i].side === side) return touches[i].player;
    }
  }
  return undefined;
}

function defaultPlayer(view: ScoutView, skill: ScoutTouchSkill, side: ScoutSide): string | null | undefined {
  // Con la formazione, batte chi è in posizione 1; senza, si propone chi ha battuto per ultima.
  if (skill === "serve") return serverId(view, side) ?? lastServerPlayer(view, side);
  if (skill === "set") return lastSetterPlayer(view, side);
  return undefined;
}

interface Selection {
  /** In che punto dello scambio è stata fatta la scelta: se cambia, la scelta decade e si riparte dal suggerimento. */
  key: string;
  skill: ScoutTouchSkill;
  side: ScoutSide;
  player: string | null | undefined;
  zone: number | null;
}

export function ScoutTouchEntry({
  data,
  view,
  locked,
  dispatch,
  compact = false,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
  /** Schermo intero su schermo largo: meno spazio tra le parti, tessere più basse e senza frasi di aiuto, per vedere tutto senza scorrere. */
  compact?: boolean;
}) {
  const key = `${view.rallies.length}:${view.pending.length}`;
  const server = currentServer(view) ?? "us";
  // Se in questa partita si segnano anche le alzate, dopo la ricezione e la difesa si propone l'alzata.
  const tracksSets = tracksSetsOf(view);
  const hint = describeNext(view.pending, server, tracksSets);
  const suggestion = hint.next;
  const [chosen, setChosen] = useState<Selection | null>(null);
  const sel = chosen && chosen.key === key ? chosen : null;

  const skill = sel?.skill ?? suggestion.skill;
  const side = sel?.side ?? suggestion.side;
  const player = sel ? sel.player : defaultPlayer(view, skill, side);
  const zone = sel?.zone ?? null;
  const meta = TOUCH_SKILLS[skill];

  function select(patch: Partial<Pick<Selection, "skill" | "side" | "player" | "zone">>) {
    const nextSkill = patch.skill ?? skill;
    const nextSide = patch.side ?? side;
    const changedTarget = nextSkill !== skill || nextSide !== side;
    setChosen({
      key,
      skill: nextSkill,
      side: nextSide,
      // Cambiando fondamentale o squadra, chi e zona si rifanno (la serie dei pulsanti è un'altra).
      player: "player" in patch ? patch.player : changedTarget ? defaultPlayer(view, nextSkill, nextSide) : player,
      zone: "zone" in patch ? (patch.zone ?? null) : changedTarget ? null : zone,
    });
  }

  function pickSkill(next: ScoutTouchSkill) {
    // Scegliere il fondamentale suggerito porta anche la sua squadra; un altro lascia quella in uso.
    select({ skill: next, side: next === suggestion.skill ? suggestion.side : side });
  }

  function commit(grade: ScoutGrade) {
    if (player === undefined || locked) return;
    dispatch({ type: "touch", input: { side, skill, player, grade, zone }, at: Date.now(), id: newId() });
    setChosen(null);
  }

  /** L'avversaria con quel numero: si aggiunge alla rosa e si sceglie subito. */
  function addOpponent(number: string) {
    const added = opponentPlayer(number);
    dispatch({ type: "addPlayer", side: "opp", player: added });
    select({ player: added.id });
  }

  const players = data.roster[side].filter((p) => canDo(skill === "block" ? "block" : "attack", p.libero));
  const serving = server;
  const open = view.pending.length > 0;

  return (
    <>
      <section
        aria-label="Scambio in corso"
        data-scout-touch-entry
        data-tour="scout-touch-entry"
        className={cn("space-y-3.5 rounded-2xl border border-border border-t-4 border-t-primary bg-card p-3 shadow-card sm:p-4", compact && "space-y-2 short:space-y-1.5 sm:p-3")}
      >
        <header className={cn("space-y-2", compact && "space-y-1.5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-[17px] font-extrabold leading-none tracking-[-0.01em] text-foreground">Scambio in corso</h2>
            <p className="text-xs text-muted-foreground">
              {locked ? "Partita finita." : open ? `${view.pending.length} ${view.pending.length === 1 ? "tocco segnato" : "tocchi segnati"}` : `Batte ${serving === "us" ? "la nostra squadra" : "l'avversaria"}`}
            </p>
          </div>
          <ScoutPhaseBanner pending={view.pending} roster={data.roster} hint={hint} serverId={serverId(view, server)} locked={locked} compact={compact} />
        </header>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">1 · Cosa è successo</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="group" aria-label="Fondamentale" data-tour="scout-touch-skill">
            {TOUCH_SKILL_ORDER.map((id) => {
              const on = id === skill;
              const suggested = id === suggestion.skill;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  aria-pressed={on}
                  onClick={() => pickSkill(id)}
                  data-scout-skill={id}
                  data-scout-suggested={suggested ? "true" : undefined}
                  className={cn(
                    "relative flex min-h-[3rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1 text-center transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border-subtle bg-surface text-foreground hover:bg-muted",
                  )}
                >
                  <span className="font-display text-base font-extrabold leading-none">{TOUCH_SKILLS[id].letter}</span>
                  <span className="mt-0.5 max-w-full truncate text-[11px] font-semibold leading-tight">{TOUCH_SKILLS[id].label}</span>
                  {suggested && !on && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 text-[9px] font-bold uppercase leading-4 tracking-wide text-primary-foreground" title="Il prossimo tocco più probabile">
                      prossimo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">2 · Chi</p>
            <div role="group" aria-label="Squadra" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5" data-tour="scout-touch-side">
              {(["us", "opp"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  aria-pressed={side === id}
                  onClick={() => select({ side: id })}
                  data-scout-side={id}
                  className={cn(
                    "rounded-md px-3 py-1 text-[13px] font-bold transition-colors",
                    side === id ? (id === "us" ? "bg-primary text-primary-foreground" : "bg-sand-400 text-sand-900") : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id === "us" ? "Noi" : "Loro"}
                </button>
              ))}
            </div>
          </div>
          <PlayerChips
            key={side}
            side={side}
            players={players}
            selected={player}
            onSelect={(next) => select({ player: next })}
            onAddNumber={side === "opp" ? addOpponent : undefined}
            ariaLabel={`Chi: ${meta.label.toLowerCase()} ${side === "us" ? "nostra" : "loro"}`}
            court={view.court[side]}
            dense={compact}
          />
        </div>

        {meta.zone && (
          <details className="group rounded-xl border border-border-subtle bg-surface-muted/50 px-3 py-2" data-tour="scout-touch-zone">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
              <span>
                {meta.zone} <span className="font-normal text-muted-foreground">(facoltativa)</span>
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                {zone ? `Zona ${zone}` : "Scegli"}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="mt-2 flex justify-center">
              <ZonePicker value={zone} onChange={(next) => select({ zone: next })} label={meta.zone} />
            </div>
          </details>
        )}

        <div data-tour="scout-touch-grade">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            3 · Voto · {meta.label} {side === "us" ? "nostra" : "loro"}
            {player === undefined && !locked ? " · scegli prima chi" : ""}
          </p>
          <GradeButtons skill={skill} onPick={commit} disabled={locked || player === undefined} testId="touch" compact={compact} />
          {/* A due colonne (schermo intero) la frase si toglie: i pulsanti dei voti già dicono quali chiudono lo scambio. */}
          <p className={cn("mt-1.5 text-xs text-muted-foreground", compact && "hidden")}>
            Un errore, un ace, un attacco a terra o un muro vincente chiudono lo scambio e assegnano il punto.
          </p>
        </div>
      </section>

      <details className={cn("rounded-2xl border border-dashed border-border-strong bg-surface/60 px-3 py-2.5", compact && "py-2 short:py-1.5")} data-scout-other-ways data-tour="scout-touch-fallback">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          Falli, sanzioni o solo il punto
          <span className="ml-1.5 font-normal text-muted-foreground">(senza i tocchi)</span>
        </summary>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Per un tocco di rete, un&apos;invasione, una sanzione, o se hai perso il filo dello scambio: chiudi lo scambio dicendo solo come è finito. I tocchi già segnati restano.
        </p>
        <div className="mt-3">
          <ScoutEntry data={data} locked={locked} dispatch={dispatch} courts={view.court} server={currentServer(view)} />
        </div>
      </details>
    </>
  );
}

