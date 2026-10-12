import { Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import { currentServer, setTarget, type ScoutView } from "@/lib/scout/derive";
import type { BallState } from "@/lib/scout/phases";
import type { ScoutSettings, ScoutSide } from "@/lib/scout/types";

function Serving({ show }: { show: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white",
        !show && "invisible",
      )}
      aria-hidden={!show}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
      Batte
    </span>
  );
}

function Team({ side, serving, hasBall }: { side: ScoutSide; serving: boolean; hasBall: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", side === "opp" && "items-end text-right")}>
      <span
        className={cn(
          "flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em]",
          side === "opp" && "flex-row-reverse",
          side === "us" ? "text-sea-300" : "text-sand-300",
        )}
      >
        {side === "us" ? "Noi" : "Loro"}
        {/* La palla è da questa parte della rete. */}
        <span
          aria-hidden
          data-scout-board-ball={hasBall ? side : undefined}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full bg-white text-sea-950 shadow-md ring-2 transition-[opacity,transform] duration-300",
            side === "us" ? "ring-sea-300/70" : "ring-sand-300/80",
            hasBall ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        >
          <Volleyball className="h-4 w-4" />
        </span>
      </span>
      <Serving show={serving} />
    </div>
  );
}

/**
 * Il tabellone dello scout: set in corso, punteggio, chi batte e set vinti.
 * Sempre scuro, come il tabellone del sito pubblico, qualunque sia il tema.
 */
export function ScoutBoard({
  view,
  settings,
  finished,
  ball = null,
}: {
  view: ScoutView;
  settings: ScoutSettings;
  /** Partita chiusa a mano prima di essere decisa. */
  finished: boolean;
  /** Da che parte del campo è la palla (vedi ballOf): si illumina quella metà del tabellone. */
  ball?: BallState | null;
}) {
  const over = view.decided || finished;
  const shown = view.current ?? view.sets[view.sets.length - 1];
  const server = over ? null : currentServer(view);
  const score = shown.score;
  const target = setTarget(settings, shown.n);

  return (
    <section
      aria-label="Punteggio"
      data-scout-board
      className="relative overflow-hidden rounded-2xl bg-sea-950 text-white shadow-[0_14px_32px_-20px_rgba(12,30,42,0.7)] ring-1 ring-sea-950/10"
    >
      {/* La metà del tabellone dalla parte della palla si illumina, nel colore della squadra. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-sea-300/30 to-transparent transition-opacity duration-300",
          ball?.side === "us" ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-sand-300/25 to-transparent transition-opacity duration-300",
          ball?.side === "opp" ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex items-center justify-between gap-3 px-4 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/65 sm:px-6">
        <span data-scout-set>
          {over ? "Partita finita" : `${shown.n}° set`}
          {!over && <span className="ml-2 font-semibold normal-case tracking-normal text-white/45">a {target}</span>}
        </span>
        <span>
          Set vinti{" "}
          <b className="tabular text-white" data-scout-sets-won>
            {view.setsWon.us}–{view.setsWon.opp}
          </b>
        </span>
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pb-4 pt-2.5 sm:gap-6 sm:px-6 sm:pb-5">
        <Team side="us" serving={server === "us"} hasBall={ball?.side === "us"} />
        <p
          className="tabular flex items-baseline gap-2.5 font-display text-[3.25rem] font-extrabold leading-none sm:gap-4 sm:text-7xl"
          aria-live="polite"
          data-scout-score
        >
          <span aria-label={`Noi ${score.us}`}>{score.us}</span>
          <span aria-hidden className="text-3xl font-bold text-white/30 sm:text-5xl">
            –
          </span>
          <span aria-label={`Loro ${score.opp}`}>{score.opp}</span>
        </p>
        <Team side="opp" serving={server === "opp"} hasBall={ball?.side === "opp"} />
      </div>
    </section>
  );
}
