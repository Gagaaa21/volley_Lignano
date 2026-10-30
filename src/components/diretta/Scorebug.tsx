"use client";

import { useState } from "react";
import { Flame, Trophy, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { cutRight, DROP, EDGE, GLASS, GLASS_DARK, GOLD, INK, ORANGE, PAPER, PINK, SUN, tag, VIOLET } from "./theme";
import { TeamMark, tone } from "./TeamMark";

/**
 * La barra del punteggio della diretta video, come nelle partite di SuperLega: in alto a sinistra, un riquadro blu profondo e
 * lucido con il taglio obliquo a destra e il filo giallo in cima; sopra, la linguetta con la categoria e il set. Per ogni
 * squadra la striscia del suo colore (giallo per Lignano), il logo, il nome corto («LIGNANO»), il pallone su chi batte, i
 * time-out usati (due tacche), i set vinti in giallo e i punti nel riquadro bianco, che scorrono in su a ogni punto; sotto, i
 * parziali e, quando serve, l'etichetta che scende: SET POINT / MATCH POINT o la serie in corso. A ogni punto un lampo di luce
 * passa sulla riga di chi segna. Misure in rem: la pagina fissa 1 rem a 1/120 della larghezza (16 px su 1920), così la barra
 * ha lo stesso aspetto con qualunque dimensione della sorgente.
 */

/** Quante volte `value` è salito da quando la barra c'è (non al primo disegno): serve a far partire il lampo a ogni punto. */
function useRises(value: number): number {
  const [seen, setSeen] = useState({ value, rises: 0 });
  if (seen.value !== value) {
    const next = { value, rises: value > seen.value ? seen.rises + 1 : seen.rises };
    setSeen(next);
    return next.rises;
  }
  return seen.rises;
}

/** Le due tacche dei time-out del set: piene (gialle) quelle già chiamate. */
function TimeoutPips({ used, side }: { used: number; side: Side }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span className="relative flex shrink-0 flex-col justify-center gap-[0.24rem] px-[0.6rem]" data-grafica-timeouts={spent} data-grafica-timeouts-side={side}>
      {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
        <span
          key={i}
          className={cn("h-[0.38rem] w-[1.1rem] rounded-full", i >= spent && "bg-white/20")}
          style={i < spent ? { background: SUN, boxShadow: "0 0 0.5rem rgba(255,210,63,0.8)" } : undefined}
        />
      ))}
    </span>
  );
}

function TeamRow({
  team,
  side,
  points,
  rises,
  serving,
  timeouts,
  showSets,
  winner,
  dimmed,
}: {
  team: PublicLiveScoreTeam;
  side: Side;
  points: number;
  rises: number;
  serving: boolean;
  timeouts: number | null;
  showSets: boolean;
  winner: boolean;
  dimmed: boolean;
}) {
  return (
    <div className="relative flex h-[3.3rem] items-stretch overflow-hidden" data-grafica-team={side}>
      {/* Il colore della squadra: una striscia piena (giallo per Lignano, il suo blu qui sparirebbe). */}
      <span className="relative w-[0.5rem] shrink-0" style={{ background: tone(side, team.color) }} />
      {/* Il lampo sulla riga di chi ha appena fatto punto. */}
      {rises > 0 && (
        <span
          key={rises}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,210,63,0.75), rgba(255,255,255,0.85), transparent)", animation: "grafica-row-flash 750ms ease-out both" }}
          data-grafica-flash={side}
        />
      )}
      <span className={cn("relative grid w-[3.6rem] shrink-0 place-items-center", dimmed && "opacity-55")}>
        <TeamMark team={team} side={side} className="h-[2.5rem] w-[2.5rem] rounded-[0.5rem] shadow-[0_0.15rem_0.5rem_rgba(0,0,0,0.35)]" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-[0.6rem] pr-[0.4rem]">
        <span className={cn("grafica-type truncate text-[1.85rem] tracking-[0.03em]", dimmed ? "text-white/55" : "text-white")} data-grafica-name>
          {winner && <Trophy aria-label="Ha vinto" className="mb-[0.15rem] mr-[0.4rem] inline h-[1.3rem] w-[1.3rem]" style={{ color: SUN }} />}
          {teamShortName(team.name)}
        </span>
        <Volleyball
          aria-label={serving ? "Al servizio" : undefined}
          className={cn("h-[1.4rem] w-[1.4rem] shrink-0", !serving && "invisible")}
          style={{ color: SUN, filter: "drop-shadow(0 0 0.35rem rgba(255,210,63,0.8))" }}
          data-grafica-serving={serving ? side : undefined}
        />
      </span>
      {timeouts !== null && <TimeoutPips used={timeouts} side={side} />}
      {showSets && (
        <span
          className="grafica-type relative grid w-[2.9rem] shrink-0 place-items-center text-[1.9rem] tabular-nums"
          style={{ color: SUN, background: "rgba(3,10,40,0.35)" }}
          data-grafica-sets={side}
        >
          {team.sets}
        </span>
      )}
      {/* I punti: il numero nuovo entra da sotto. Il margine a destra lascia posto al taglio obliquo. */}
      <span className={cn("relative grid w-[4.8rem] shrink-0 place-items-center overflow-hidden pr-[1rem]", dimmed && "opacity-80")} style={{ background: PAPER }}>
        <span
          key={points}
          className="grafica-type block text-[2.55rem] tabular-nums"
          style={{ color: INK, animation: "grafica-roll 420ms cubic-bezier(.2,.8,.2,1)" }}
          data-grafica-score={side}
        >
          {points}
        </span>
      </span>
    </div>
  );
}

/** L'etichetta che scende da sotto la barra: set point / match point (prima di tutto) oppure la serie di punti in corso. */
function Flag({ live }: { live: PublicLiveScore }) {
  if (live.finished) return null;
  const point = live.point;
  if (point) {
    const team = point.side === "home" ? live.home : live.away;
    const match = point.kind === "match";
    return (
      <div
        key={`${point.side}-${point.kind}`}
        className="ml-[0.5rem] flex h-[2.3rem] w-fit items-stretch"
        style={{ filter: DROP, animation: "grafica-drop 420ms cubic-bezier(.2,.8,.2,1)" }}
        data-grafica-flag="point"
      >
        <span
          className="grafica-type flex items-center px-[1.2rem] text-[1.35rem] tracking-[0.06em]"
          style={{ background: match ? `linear-gradient(90deg, ${PINK}, ${VIOLET})` : GOLD, color: match ? "#ffffff" : INK, clipPath: tag("0.6rem") }}
        >
          <span className="animate-[grafica-point-pulse_1.1s_ease-in-out_infinite]" data-grafica-point={`${point.side}-${point.kind}`}>
            {match ? "Match point" : "Set point"}
          </span>
        </span>
        <span className="grafica-type -ml-[0.3rem] flex items-center px-[1.1rem] text-[1.15rem] text-white" style={{ background: GLASS, clipPath: tag("0.6rem") }}>
          {teamShortName(team.name)}
        </span>
      </div>
    );
  }
  const run = live.run;
  if (run) {
    const team = run.side === "home" ? live.home : live.away;
    return (
      <div
        key={`${run.side}-run`}
        className="ml-[0.5rem] flex h-[2.3rem] w-fit animate-[grafica-drop_420ms_cubic-bezier(.2,.8,.2,1)] items-stretch"
        style={{ filter: DROP }}
        data-grafica-flag="run"
      >
        <span className="grafica-type flex items-center px-[1.1rem] text-[1.15rem] text-white" style={{ background: GLASS, clipPath: tag("0.6rem") }}>
          {teamShortName(team.name)}
        </span>
        <span
          className="grafica-type -ml-[0.3rem] flex items-center gap-[0.4rem] px-[1.2rem] text-[1.35rem] text-white"
          style={{ background: `linear-gradient(90deg, ${ORANGE}, ${PINK})`, clipPath: tag("0.6rem") }}
        >
          <Flame className="h-[1.3rem] w-[1.3rem]" style={{ color: SUN }} aria-hidden />
          <span data-grafica-run={`${run.side}-${run.points}`}>Parziale {run.side === "home" ? `${run.points}–0` : `0–${run.points}`}</span>
        </span>
      </div>
    );
  }
  return null;
}

export function Scorebug({ live, flags = true }: { live: PublicLiveScore; flags?: boolean }) {
  const finished = live.finished;
  // A partita finita il punteggio del set è azzerato: nel riquadro dei punti vanno i set vinti.
  const [homePoints, awayPoints] = finished ? [live.home.sets, live.away.sets] : [live.home.score, live.away.score];
  const winner: Side | null = finished && live.home.sets !== live.away.sets ? (live.home.sets > live.away.sets ? "home" : "away") : null;
  const timeouts = finished || !live.timeouts ? null : live.timeouts;
  // I punti fatti da quando la barra c'è: a ogni punto in più il lampo passa sulla riga di chi l'ha fatto.
  const homeRises = useRises(finished ? 0 : live.home.score);
  const awayRises = useRises(finished ? 0 : live.away.score);

  return (
    <div className="relative w-[38rem] text-white" data-grafica-bug>
      {/* La linguetta sopra: categoria e set in corso. */}
      <div className="flex h-[2rem] w-fit items-stretch" style={{ filter: DROP }}>
        {live.category && (
          <span className="grafica-type flex items-center px-[0.8rem] text-[1.1rem]" style={{ background: GOLD, color: INK }} data-grafica-category>
            {live.category}F
          </span>
        )}
        <span
          className="grafica-type flex items-center pl-[0.8rem] pr-[1.5rem] text-[1.1rem] tracking-[0.1em] text-white"
          style={{ background: GLASS_DARK, clipPath: cutRight("0.7rem") }}
          data-grafica-phase
        >
          {finished ? "Finale" : `${live.sets.length + 1}° set`}
        </span>
      </div>
      <div style={{ filter: DROP }}>
        <div className="relative overflow-hidden" style={{ background: GLASS, boxShadow: EDGE, clipPath: cutRight("1.2rem") }}>
          {/* Il filo giallo in cima, come nelle grafiche TV. */}
          <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-[0.18rem]" style={{ background: GOLD }} />
          <TeamRow
            team={live.home}
            side="home"
            points={homePoints}
            rises={homeRises}
            serving={!finished && live.serving === "home"}
            timeouts={timeouts ? timeouts.home : null}
            showSets={!finished}
            winner={winner === "home"}
            dimmed={winner === "away"}
          />
          <div className="relative h-[0.1rem] bg-white/15" />
          <TeamRow
            team={live.away}
            side="away"
            points={awayPoints}
            rises={awayRises}
            serving={!finished && live.serving === "away"}
            timeouts={timeouts ? timeouts.away : null}
            showSets={!finished}
            winner={winner === "away"}
            dimmed={winner === "home"}
          />
        </div>
        {live.sets.length > 0 && (
          <div
            className="flex w-fit flex-wrap items-center gap-x-[1rem] gap-y-[0.2rem] py-[0.35rem] pl-[1rem] pr-[1.8rem] text-[1.05rem] font-bold tabular-nums"
            style={{ background: GLASS_DARK, clipPath: cutRight("0.6rem") }}
            data-grafica-partials
          >
            {live.sets.map((set, i) => (
              <span key={i} className="flex items-center gap-[0.35rem]" data-grafica-partial={i + 1}>
                <span style={{ color: SUN }}>{i + 1}°</span>
                <span className={set.home > set.away ? "text-white" : "text-white/60"}>{set.home}</span>
                <span className="text-white/40">–</span>
                <span className={set.away > set.home ? "text-white" : "text-white/60"}>{set.away}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {flags && (
        <div className="mt-[0.35rem]">
          <Flag live={live} />
        </div>
      )}
    </div>
  );
}
