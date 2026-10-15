import { Timer, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import { currentServer, setTarget, type ScoutScore, type ScoutView } from "@/lib/scout/derive";
import type { BallState } from "@/lib/scout/phases";
import type { ScoutSettings, ScoutSide } from "@/lib/scout/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";

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
 * Il pulsante del time-out di una squadra: i puntini dicono quanti ne ha già usati nel set (due per set, regola
 * 15.4); si tocca quando l'allenatore lo chiede e compare anche sul sito pubblico. Finiti i due, si spegne.
 */
function TimeoutButton({ side, used, compact, onClick }: { side: ScoutSide; used: number; compact: boolean; onClick: () => void }) {
  const spent = used >= TIMEOUTS_PER_SET;
  const who = side === "us" ? "nostro" : "loro";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spent}
      data-scout-timeout={side}
      data-scout-timeouts-used={used}
      aria-label={spent ? `Time-out ${who}: tutti e ${TIMEOUTS_PER_SET} usati` : `Segna un time-out ${who}: ${used} usati su ${TIMEOUTS_PER_SET}`}
      title={spent ? `Time-out ${who} finiti in questo set` : `Segna un time-out ${who} (${used}/${TIMEOUTS_PER_SET} usati)`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-amber-300/45 bg-amber-300/10 px-3 text-[12px] font-bold uppercase tracking-wide text-amber-100 transition-[background-color,transform,opacity] hover:bg-amber-300/20 active:translate-y-px disabled:pointer-events-none disabled:border-white/15 disabled:bg-white/5 disabled:text-white/45",
        compact ? "min-h-9 py-1" : "min-h-10 py-1.5",
        side === "opp" && "flex-row-reverse",
      )}
    >
      <Timer className="h-4 w-4 shrink-0" aria-hidden />
      <span>Time-out</span>
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-full border", i < used ? "border-amber-300 bg-amber-300" : "border-amber-200/60")} />
        ))}
      </span>
    </button>
  );
}

/**
 * Il tabellone dello scout: set in corso, punteggio, chi batte, set vinti e, se si passa `onTimeout`, i time-out
 * usati da ogni squadra nel set (con il pulsante per segnarli).
 * Sempre scuro, come il tabellone del sito pubblico, qualunque sia il tema.
 */
export function ScoutBoard({
  view,
  settings,
  finished,
  ball = null,
  compact = false,
  timeouts,
  onTimeout,
}: {
  view: ScoutView;
  settings: ScoutSettings;
  /** Partita chiusa a mano prima di essere decisa. */
  finished: boolean;
  /** Da che parte del campo è la palla (vedi ballOf): si illumina quella metà del tabellone. */
  ball?: BallState | null;
  /** Più basso (a schermo intero ogni riga in altezza serve ai pulsanti). */
  compact?: boolean;
  /** Time-out usati da ogni squadra nel set in corso. */
  timeouts?: ScoutScore;
  /** Se c'è, sotto il punteggio compaiono i pulsanti dei time-out. */
  onTimeout?: (side: ScoutSide) => void;
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
      <div
        className={cn(
          "relative flex items-center justify-between gap-3 px-4 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/65 sm:px-6",
          compact && "pt-2.5",
        )}
      >
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

      <div
        className={cn(
          "relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pb-4 pt-2.5 sm:gap-6 sm:px-6 sm:pb-5",
          compact && "pb-2.5 pt-1 sm:pb-3",
        )}
      >
        <Team side="us" serving={server === "us"} hasBall={ball?.side === "us"} />
        <p
          className={cn(
            "tabular flex items-baseline gap-2.5 font-display text-[3.25rem] font-extrabold leading-none sm:gap-4 sm:text-7xl",
            compact && "text-[2.75rem] sm:text-6xl",
          )}
          aria-live="polite"
          data-scout-score
        >
          <span aria-label={`Noi ${score.us}`}>{score.us}</span>
          <span aria-hidden className={cn("text-3xl font-bold text-white/30 sm:text-5xl", compact && "text-2xl sm:text-4xl")}>
            –
          </span>
          <span aria-label={`Loro ${score.opp}`}>{score.opp}</span>
        </p>
        <Team side="opp" serving={server === "opp"} hasBall={ball?.side === "opp"} />
      </div>

      {onTimeout && !over && (
        <div
          className={cn("relative flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 sm:px-6", compact && "py-1.5")}
          data-scout-timeouts
        >
          <TimeoutButton side="us" used={timeouts?.us ?? 0} compact={compact} onClick={() => onTimeout("us")} />
          <TimeoutButton side="opp" used={timeouts?.opp ?? 0} compact={compact} onClick={() => onTimeout("opp")} />
        </div>
      )}
    </section>
  );
}
