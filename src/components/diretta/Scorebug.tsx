import { Timer, Trophy, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { accent, TeamMark } from "./TeamMark";

/**
 * La barra del punteggio della diretta video, in stile Serie A / SuperLega: categoria e set, le due squadre con battuta,
 * time-out usati, set vinti e punti, i parziali sotto. Tutte le misure sono in rem: la pagina fissa il corpo del testo
 * alla larghezza dello schermo (1 rem = 1/120 della larghezza, cioè 16 px su 1920), quindi la barra ha lo stesso aspetto
 * con qualunque dimensione della «Sorgente browser». Come il banner del sito: mai nomi né numeri di maglia.
 */

const NAVY = "#0a1e2c";

/** Due puntini per i time-out del set: pieni quelli già chiamati. */
function TimeoutPips({ used, side }: { used: number; side: Side }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span className="flex shrink-0 items-center gap-[0.35rem] px-[0.8rem]" data-grafica-timeouts={spent} data-grafica-timeouts-side={side}>
      <Timer aria-hidden className="h-[1rem] w-[1rem] text-amber-300/90" />
      {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[0.75rem] w-[0.75rem] rounded-full border-[0.12rem]",
            i < spent ? "border-amber-300 bg-amber-300 shadow-[0_0_0.6rem_rgba(252,211,77,0.8)]" : "border-white/40",
          )}
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
    <div
      className="flex h-[3.4rem] items-stretch"
      style={{ backgroundColor: NAVY, backgroundImage: `linear-gradient(90deg, ${color}66 0%, ${color}00 62%)` }}
      data-grafica-team={side}
    >
      <span className="w-[0.45rem] shrink-0" style={{ background: color }} />
      <span className={cn("grid w-[3.7rem] shrink-0 place-items-center", dimmed && "opacity-60")}>
        <TeamMark team={team} side={side} className="h-[2.5rem] w-[2.5rem]" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-[0.7rem]">
        <span className={cn("truncate font-display text-[1.45rem] font-extrabold uppercase tracking-wide", dimmed && "text-white/60")} data-grafica-name>
          {winner && <Trophy aria-label="Ha vinto" className="mr-[0.5rem] mb-[0.2rem] inline h-[1.2rem] w-[1.2rem] text-amber-300" />}
          {team.name}
        </span>
        <Volleyball
          aria-label={serving ? "Al servizio" : undefined}
          className={cn("h-[1.3rem] w-[1.3rem] shrink-0 text-amber-300", !serving && "invisible")}
          data-grafica-serving={serving ? side : undefined}
        />
      </span>
      {timeouts !== null && <TimeoutPips used={timeouts} side={side} />}
      {showSets && (
        <span className="grid w-[3rem] shrink-0 place-items-center bg-white/10 font-display text-[1.7rem] font-extrabold tabular-nums" data-grafica-sets={side}>
          {team.sets}
        </span>
      )}
      <span
        key={points}
        className={cn(
          "grid w-[4.6rem] shrink-0 animate-[livescore-score-pop_320ms_ease-out] place-items-center font-display text-[2.5rem] font-extrabold leading-none tabular-nums",
          dimmed ? "bg-[#c9d3dc]" : "bg-white",
        )}
        style={{ color: NAVY }}
        data-grafica-score={side}
      >
        {points}
      </span>
    </div>
  );
}

export function Scorebug({ live }: { live: PublicLiveScore }) {
  const finished = live.finished;
  // A partita finita il punteggio del set è azzerato: nel riquadro dei punti vanno i set vinti.
  const [homePoints, awayPoints] = finished ? [live.home.sets, live.away.sets] : [live.home.score, live.away.score];
  const winner: Side | null = finished && live.home.sets !== live.away.sets ? (live.home.sets > live.away.sets ? "home" : "away") : null;
  const timeouts = finished || !live.timeouts ? null : live.timeouts;
  const point = finished ? null : live.point;

  return (
    <div className="w-[40rem] overflow-hidden rounded-[0.7rem] text-white shadow-[0_0.6rem_1.6rem_rgba(0,0,0,0.45)]" data-grafica-bug>
      <div className="flex items-center justify-between gap-[1rem] bg-[#06141f] px-[1rem] py-[0.4rem] text-[0.95rem] font-extrabold uppercase tracking-[0.14em]">
        <p className="flex items-center gap-[0.6rem]">
          {live.category && (
            <span className="rounded-[0.3rem] bg-white/15 px-[0.55rem]" data-grafica-category>
              {live.category}F
            </span>
          )}
          <span data-grafica-phase>{finished ? "Finale" : `${live.sets.length + 1}° set`}</span>
        </p>
        {point && (
          <span
            className="animate-[grafica-point-pulse_1.1s_ease-in-out_infinite] text-amber-300"
            data-grafica-point={`${point.side}-${point.kind}`}
          >
            {point.kind === "match" ? "Match point" : "Set point"}
          </span>
        )}
      </div>
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
        <div className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-[0.2rem] bg-[#06141f] px-[1rem] py-[0.4rem] text-[1rem] font-bold tabular-nums" data-grafica-partials>
          {live.sets.map((set, i) => (
            <span key={i} className="flex items-center gap-[0.4rem]" data-grafica-partial={i + 1}>
              <span className="text-white/50">{i + 1}°</span>
              <span className={set.home > set.away ? "text-white" : "text-white/60"}>{set.home}</span>
              <span className="text-white/30">–</span>
              <span className={set.away > set.home ? "text-white" : "text-white/60"}>{set.away}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
