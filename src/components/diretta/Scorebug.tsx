"use client";

import { useState } from "react";
import { Flame, Sparkles as SparkIcon, Trophy, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { INK, ORANGE, PANEL_BG, PINK, SHADOW, STRIPES, SUN, SUNSET, VIOLET } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * La barra del punteggio della diretta video, come nelle partite di SuperLega ma con i colori di Lignano d'estate: in alto a
 * sinistra, sopra la linguetta con la categoria e il set; per ogni squadra il colore, il logo, il nome corto («LIGNANO»), il
 * pallone su chi batte, i time-out usati (due tacche), i set vinti in giallo e i punti in bianco; sotto, i parziali e, quando
 * serve, la striscia che scende: SET POINT / MATCH POINT o la serie in corso con la fiamma. A ogni punto un lampo di luce
 * passa sulla riga di chi segna (e basta: la barra resta sempre leggibile). Misure in rem: la pagina
 * fissa 1 rem a 1/120 della larghezza (16 px su 1920), così la barra ha lo stesso aspetto con qualunque dimensione della sorgente.
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

/** Le due tacche dei time-out del set: piene (e luminose) quelle già chiamate. */
function TimeoutPips({ used, side }: { used: number; side: Side }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span className="relative flex shrink-0 flex-col justify-center gap-[0.22rem] px-[0.55rem]" data-grafica-timeouts={spent} data-grafica-timeouts-side={side}>
      {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
        <span
          key={i}
          className={cn("h-[0.42rem] w-[1.15rem] rounded-full", i < spent ? "shadow-[0_0_0.6rem_rgba(255,210,63,0.9)]" : "bg-white/25")}
          style={i < spent ? { background: SUN } : undefined}
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
  const color = accent(team.color);
  return (
    <div className="relative flex h-[3.1rem] items-stretch overflow-hidden" data-grafica-team={side}>
      {/* Il colore della squadra, e una luce che lo sfuma verso il nome. */}
      <span className="relative w-[0.55rem] shrink-0" style={{ background: color }} />
      <span className="pointer-events-none absolute inset-y-0 left-[0.55rem] w-[14rem]" style={{ background: `linear-gradient(90deg, ${color}aa, ${color}00)` }} />
      {/* Il lampo sulla riga di chi ha appena fatto punto. */}
      {rises > 0 && (
        <span
          key={rises}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(90deg, transparent, ${SUN}cc, #ffffffcc, transparent)`, animation: "grafica-row-flash 750ms ease-out both" }}
          data-grafica-flash={side}
        />
      )}
      <span className={cn("relative grid w-[3.4rem] shrink-0 place-items-center", dimmed && "opacity-55")}>
        <TeamMark team={team} side={side} className="h-[2.35rem] w-[2.35rem] shadow-[0_0.2rem_0.6rem_rgba(0,0,0,0.25)]" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-[0.6rem] pr-[0.4rem]">
        <span className={cn("grafica-type truncate text-[1.75rem] [text-shadow:0_0.12rem_0.3rem_rgba(11,27,77,0.45)]", dimmed ? "text-white/55" : "text-white")} data-grafica-name>
          {winner && <Trophy aria-label="Ha vinto" className="mb-[0.15rem] mr-[0.4rem] inline h-[1.25rem] w-[1.25rem]" style={{ color: SUN }} />}
          {teamShortName(team.name)}
        </span>
        <Volleyball
          aria-label={serving ? "Al servizio" : undefined}
          className={cn("h-[1.35rem] w-[1.35rem] shrink-0 drop-shadow-[0_0_0.4rem_rgba(255,210,63,0.9)]", !serving && "invisible")}
          style={{ color: SUN }}
          data-grafica-serving={serving ? side : undefined}
        />
      </span>
      {timeouts !== null && <TimeoutPips used={timeouts} side={side} />}
      {showSets && (
        <span className="grafica-type relative grid w-[2.7rem] shrink-0 place-items-center text-[1.75rem] tabular-nums" style={{ background: SUN, color: INK }} data-grafica-sets={side}>
          {team.sets}
        </span>
      )}
      <span
        key={points}
        className={cn("grafica-type relative grid w-[4rem] shrink-0 animate-[livescore-score-pop_380ms_ease-out] place-items-center text-[2.35rem] tabular-nums", dimmed ? "bg-[#d5dcf0]" : "bg-white")}
        style={{ color: INK }}
        data-grafica-score={side}
      >
        {points}
      </span>
    </div>
  );
}

/** La striscia che scende da sotto la barra: set point / match point (prima di tutto) oppure la serie di punti in corso. */
function Flag({ live }: { live: PublicLiveScore }) {
  if (live.finished) return null;
  const point = live.point;
  if (point) {
    const team = point.side === "home" ? live.home : live.away;
    const match = point.kind === "match";
    return (
      <div
        key={`${point.side}-${point.kind}`}
        className="flex h-[2.3rem] w-fit items-stretch overflow-hidden rounded-b-[0.6rem]"
        style={{ boxShadow: SHADOW, animation: "grafica-drop 420ms cubic-bezier(.2,.8,.2,1)" }}
        data-grafica-flag="point"
      >
        <span
          className="grafica-type flex items-center gap-[0.45rem] px-[0.9rem] text-[1.3rem]"
          style={{ background: match ? `linear-gradient(90deg, ${PINK}, ${VIOLET})` : `linear-gradient(90deg, ${SUN}, ${ORANGE})`, color: match ? "#ffffff" : INK }}
        >
          <SparkIcon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
          <span className="animate-[grafica-point-pulse_1.1s_ease-in-out_infinite]" data-grafica-point={`${point.side}-${point.kind}`}>
            {match ? "Match point" : "Set point"}
          </span>
        </span>
        <span className="grafica-type flex items-center px-[0.9rem] text-[1.15rem] text-white" style={{ background: accent(team.color) }}>
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
        className="flex h-[2.3rem] w-fit animate-[grafica-drop_420ms_cubic-bezier(.2,.8,.2,1)] items-stretch overflow-hidden rounded-b-[0.6rem]"
        style={{ boxShadow: SHADOW }}
        data-grafica-flag="run"
      >
        <span className="grafica-type flex items-center px-[0.9rem] text-[1.15rem] text-white" style={{ background: accent(team.color) }}>
          {teamShortName(team.name)}
        </span>
        <span className="grafica-type flex items-center gap-[0.4rem] px-[0.9rem] text-[1.3rem] text-white" style={{ background: `linear-gradient(90deg, ${ORANGE}, ${PINK})` }}>
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
    <div className="relative w-[36rem] text-white" data-grafica-bug>
      {/* La linguetta sopra: categoria e set in corso. */}
      <div className="flex h-[2rem] w-fit items-stretch overflow-hidden rounded-t-[0.6rem]" style={{ boxShadow: SHADOW }}>
        {live.category && (
          <span className="grafica-type flex items-center px-[0.75rem] text-[1.1rem]" style={{ background: SUN, color: INK }} data-grafica-category>
            {live.category}F
          </span>
        )}
        <span
          className="grafica-type flex items-center px-[0.85rem] text-[1.1rem] tracking-[0.08em] text-white [text-shadow:0_0.1rem_0.25rem_rgba(11,27,77,0.4)]"
          style={{ background: `linear-gradient(90deg, ${ORANGE}, ${PINK})` }}
          data-grafica-phase
        >
          {finished ? "Finale" : `${live.sets.length + 1}° set`}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-b-[0.7rem] rounded-tr-[0.7rem] ring-[0.12rem] ring-white/40" style={{ background: PANEL_BG, boxShadow: SHADOW }}>
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: STRIPES }} />
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
        <div className="relative h-[0.12rem]" style={{ background: SUNSET }} />
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
        {live.sets.length > 0 && (
          <div
            className="relative flex flex-wrap items-center gap-x-[0.9rem] gap-y-[0.2rem] px-[0.9rem] py-[0.3rem] text-[1rem] font-bold tabular-nums"
            style={{ background: "rgba(11,27,77,0.4)" }}
            data-grafica-partials
          >
            {live.sets.map((set, i) => (
              <span key={i} className="flex items-center gap-[0.35rem]" data-grafica-partial={i + 1}>
                <span style={{ color: SUN }}>{i + 1}°</span>
                <span className={set.home > set.away ? "text-white" : "text-white/65"}>{set.home}</span>
                <span className="text-white/40">–</span>
                <span className={set.away > set.home ? "text-white" : "text-white/65"}>{set.away}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {flags && <Flag live={live} />}
    </div>
  );
}
