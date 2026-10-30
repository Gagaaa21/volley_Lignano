import { Trophy, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { GOLD, NAVY, NAVY_DEEP, PANEL_BG, SHADOW } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * La barra del punteggio della diretta video, come nelle partite di SuperLega: in alto a sinistra, sopra la linguetta con la
 * categoria e il set; per ogni squadra il colore, il logo, il nome corto («LIGNANO»), il pallone su chi batte, i time-out usati
 * (due tacche), i set vinti e i punti del set in un riquadro chiaro; sotto, i parziali già giocati e, quando serve, la striscia
 * che scende: SET POINT / MATCH POINT o la serie di punti in corso («Parziale 4-0»). Misure in rem: la pagina fissa 1 rem a
 * 1/120 della larghezza (16 px su 1920), così la barra ha lo stesso aspetto con qualunque dimensione della sorgente.
 */

/** Le due tacche dei time-out del set: piene quelle già chiamate. */
function TimeoutPips({ used, side }: { used: number; side: Side }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span className="flex shrink-0 flex-col justify-center gap-[0.22rem] px-[0.55rem]" data-grafica-timeouts={spent} data-grafica-timeouts-side={side}>
      {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
        <span
          key={i}
          className={cn("h-[0.42rem] w-[1.15rem] rounded-[0.12rem]", i < spent ? "shadow-[0_0_0.5rem_rgba(245,183,0,0.7)]" : "bg-white/18")}
          style={i < spent ? { background: GOLD } : undefined}
        />
      ))}
    </span>
  );
}

function TeamRow({
  team,
  side,
  points,
  serving,
  timeouts,
  showSets,
  winner,
  dimmed,
}: {
  team: PublicLiveScoreTeam;
  side: Side;
  points: number;
  serving: boolean;
  timeouts: number | null;
  showSets: boolean;
  winner: boolean;
  dimmed: boolean;
}) {
  const color = accent(team.color);
  return (
    <div className="relative flex h-[3.1rem] items-stretch" data-grafica-team={side}>
      {/* Il colore della squadra, e una luce che lo sfuma verso il nome. */}
      <span className="w-[0.5rem] shrink-0" style={{ background: color }} />
      <span className="pointer-events-none absolute inset-y-0 left-[0.5rem] w-[14rem]" style={{ background: `linear-gradient(90deg, ${color}55, ${color}00)` }} />
      <span className={cn("relative grid w-[3.4rem] shrink-0 place-items-center", dimmed && "opacity-55")}>
        <TeamMark team={team} side={side} className="h-[2.35rem] w-[2.35rem]" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-[0.6rem] pr-[0.4rem]">
        <span className={cn("grafica-type truncate text-[1.75rem]", dimmed ? "text-white/55" : "text-white")} data-grafica-name>
          {winner && <Trophy aria-label="Ha vinto" className="mb-[0.15rem] mr-[0.4rem] inline h-[1.25rem] w-[1.25rem]" style={{ color: GOLD }} />}
          {teamShortName(team.name)}
        </span>
        <Volleyball
          aria-label={serving ? "Al servizio" : undefined}
          className={cn("h-[1.25rem] w-[1.25rem] shrink-0", !serving && "invisible")}
          style={{ color: GOLD }}
          data-grafica-serving={serving ? side : undefined}
        />
      </span>
      {timeouts !== null && <TimeoutPips used={timeouts} side={side} />}
      {showSets && (
        <span className="grafica-type grid w-[2.7rem] shrink-0 place-items-center bg-black/30 text-[1.75rem] tabular-nums text-white" data-grafica-sets={side}>
          {team.sets}
        </span>
      )}
      <span
        key={points}
        className={cn("grafica-type grid w-[4rem] shrink-0 animate-[livescore-score-pop_320ms_ease-out] place-items-center text-[2.35rem] tabular-nums", dimmed ? "bg-[#c9d3dc]" : "bg-white")}
        style={{ color: NAVY }}
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
    return (
      <div
        key={`${point.side}-${point.kind}`}
        className="flex h-[2.2rem] w-fit animate-[grafica-drop_380ms_cubic-bezier(.2,.8,.2,1)] items-stretch overflow-hidden rounded-b-[0.45rem]"
        style={{ boxShadow: SHADOW }}
        data-grafica-flag="point"
      >
        <span className="grafica-type flex items-center px-[0.9rem] text-[1.25rem]" style={{ background: GOLD, color: NAVY }}>
          <span className="animate-[grafica-point-pulse_1.1s_ease-in-out_infinite]" data-grafica-point={`${point.side}-${point.kind}`}>
            {point.kind === "match" ? "Match point" : "Set point"}
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
        className="flex h-[2.2rem] w-fit animate-[grafica-drop_380ms_cubic-bezier(.2,.8,.2,1)] items-stretch overflow-hidden rounded-b-[0.45rem]"
        style={{ boxShadow: SHADOW }}
        data-grafica-flag="run"
      >
        <span className="grafica-type flex items-center px-[0.9rem] text-[1.15rem] text-white" style={{ background: accent(team.color) }}>
          {teamShortName(team.name)}
        </span>
        <span className="grafica-type flex items-center px-[0.9rem] text-[1.25rem] text-white" style={{ background: NAVY }} data-grafica-run={`${run.side}-${run.points}`}>
          Parziale {run.side === "home" ? `${run.points}–0` : `0–${run.points}`}
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

  return (
    <div className="w-[36rem] text-white" data-grafica-bug>
      {/* La linguetta sopra: categoria e set in corso. */}
      <div className="flex h-[1.9rem] w-fit items-stretch overflow-hidden rounded-t-[0.45rem]">
        {live.category && (
          <span className="grafica-type flex items-center px-[0.75rem] text-[1.05rem]" style={{ background: GOLD, color: NAVY }} data-grafica-category>
            {live.category}F
          </span>
        )}
        <span className="grafica-type flex items-center px-[0.85rem] text-[1.05rem] tracking-[0.08em] text-white" style={{ background: NAVY_DEEP }} data-grafica-phase>
          {finished ? "Finale" : `${live.sets.length + 1}° set`}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-b-[0.55rem] rounded-tr-[0.55rem]" style={{ background: PANEL_BG, boxShadow: SHADOW }}>
        <TeamRow
          team={live.home}
          side="home"
          points={homePoints}
          serving={!finished && live.serving === "home"}
          timeouts={timeouts ? timeouts.home : null}
          showSets={!finished}
          winner={winner === "home"}
          dimmed={winner === "away"}
        />
        <div className="h-px bg-white/12" />
        <TeamRow
          team={live.away}
          side="away"
          points={awayPoints}
          serving={!finished && live.serving === "away"}
          timeouts={timeouts ? timeouts.away : null}
          showSets={!finished}
          winner={winner === "away"}
          dimmed={winner === "home"}
        />
        {live.sets.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-[0.2rem] border-t border-white/10 px-[0.9rem] py-[0.3rem] text-[1rem] font-bold tabular-nums"
            style={{ background: NAVY_DEEP }}
            data-grafica-partials
          >
            {live.sets.map((set, i) => (
              <span key={i} className="flex items-center gap-[0.35rem]" data-grafica-partial={i + 1}>
                <span className="text-white/45">{i + 1}°</span>
                <span className={set.home > set.away ? "text-white" : "text-white/60"}>{set.home}</span>
                <span className="text-white/30">–</span>
                <span className={set.away > set.home ? "text-white" : "text-white/60"}>{set.away}</span>
              </span>
            ))}
          </div>
        )}
        {/* Un riflesso che passa ogni tanto sulla barra, come nelle grafiche TV. */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[6rem] animate-[grafica-sheen_9s_ease-in-out_infinite] bg-gradient-to-r from-white/0 via-white/12 to-white/0" aria-hidden />
      </div>
      {flags && <Flag live={live} />}
    </div>
  );
}
