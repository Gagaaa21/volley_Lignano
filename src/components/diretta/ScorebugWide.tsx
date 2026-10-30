import { Timer, Trophy, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { INK, ROYAL, SKY } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * La barra larga della diretta video, in basso al centro, come nelle partite di SuperLega: a sinistra Lignano (stemma e nome),
 * a destra l'avversaria (nome e logo), in mezzo i punti del set in un riquadro scuro; «SETS» e i set vinti accanto ai punti,
 * i time-out usati sotto, il pallone su chi batte; sotto il riquadro la linguetta con il set in corso (e «Set point» /
 * «Match point» che pulsa). Si sceglie con `?stile=larga` (o `entrambe`); di partenza c'è la barra in alto a sinistra.
 * Stesse regole della barra in alto: misure in rem (1 rem = 1/120 della larghezza), nomi corti. A partita finita nel
 * riquadro vanno i set vinti.
 */

/** Il riquadro dei punti e la linguetta: il blu scuro dei titoli, così i numeri bianchi spiccano sull'azzurro. */
const NAVY = INK;
const BLUE = ROYAL;

function Timeouts({ used, side }: { used: number; side: Side }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span className="flex items-center gap-[0.3rem]" data-grafica-wide-timeouts={spent} data-grafica-wide-timeouts-side={side}>
      <Timer aria-hidden className="h-[0.8rem] w-[0.8rem] text-[#ffd23f]" />
      {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[0.6rem] w-[0.6rem] rounded-full border-[0.1rem]",
            i < spent ? "border-[#ffd23f] bg-[#ffd23f] shadow-[0_0_0.6rem_rgba(255,210,63,0.9)]" : "border-white/40",
          )}
        />
      ))}
    </span>
  );
}

/** «SETS» con i set vinti (e, sotto, i time-out usati nel set): il riquadro accanto ai punti. */
function SetsBox({ sets, timeouts, side }: { sets: number; timeouts: number | null; side: Side }) {
  return (
    <span className="flex w-[5rem] shrink-0 flex-col items-center justify-center gap-[0.1rem] bg-black/25" data-grafica-wide-sets-box={side}>
      <span className="text-[0.75rem] font-extrabold uppercase leading-none tracking-[0.18em] text-white/70">Sets</span>
      <span className="grafica-type text-[2.5rem] tabular-nums" data-grafica-wide-sets={side}>
        {sets}
      </span>
      {timeouts !== null ? <Timeouts used={timeouts} side={side} /> : <span className="h-[0.8rem]" />}
    </span>
  );
}

function TeamSide({
  team,
  side,
  serving,
  winner,
  dimmed,
}: {
  team: PublicLiveScoreTeam;
  side: Side;
  serving: boolean;
  winner: boolean;
  dimmed: boolean;
}) {
  const ball = (
    <Volleyball
      aria-label={serving ? "Al servizio" : undefined}
      className={cn("h-[1.6rem] w-[1.6rem] shrink-0 text-[#ffd23f]", !serving && "invisible")}
      data-grafica-wide-serving={serving ? side : undefined}
    />
  );
  const logo = <TeamMark team={team} side={side} className={cn("h-[3.6rem] w-[3.6rem]", dimmed && "opacity-60")} />;
  const name = (
    <span
      className={cn("grafica-type min-w-0 flex-1 truncate text-[2.1rem]", dimmed && "text-white/60", side === "away" && "text-right")}
      data-grafica-wide-name={side}
    >
      {winner && <Trophy aria-label="Ha vinto" className="mr-[0.5rem] mb-[0.2rem] inline h-[1.5rem] w-[1.5rem] text-[#ffd23f]" />}
      {teamShortName(team.name)}
    </span>
  );
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-[0.8rem] px-[1rem]", side === "away" && "justify-end")} data-grafica-wide-team={side}>
      {side === "home" ? (
        <>
          {logo}
          {name}
          {ball}
        </>
      ) : (
        <>
          {ball}
          {name}
          {logo}
        </>
      )}
    </span>
  );
}

export function ScorebugWide({ live }: { live: PublicLiveScore }) {
  const finished = live.finished;
  // A partita finita il punteggio del set è azzerato: nel riquadro dei punti vanno i set vinti.
  const [homePoints, awayPoints] = finished ? [live.home.sets, live.away.sets] : [live.home.score, live.away.score];
  const winner: Side | null = finished && live.home.sets !== live.away.sets ? (live.home.sets > live.away.sets ? "home" : "away") : null;
  const timeouts = finished || !live.timeouts ? null : live.timeouts;
  const point = finished ? null : live.point;
  const homeColor = accent(live.home.color);
  const awayColor = accent(live.away.color);

  return (
    <div className="relative w-[84rem] max-w-[96%] pb-[1.7rem]" data-grafica-wide>
      <div
        className="flex h-[6.4rem] items-stretch overflow-hidden rounded-[1.2rem] text-white shadow-[0_0.6rem_1.6rem_rgba(8,20,70,0.45)] ring-[0.12rem] ring-white/40"
        style={{
          backgroundColor: BLUE,
          backgroundImage: `radial-gradient(40% 160% at 0% 50%, ${homeColor}99 0%, ${homeColor}00 100%), radial-gradient(40% 160% at 100% 50%, ${awayColor}99 0%, ${awayColor}00 100%), linear-gradient(120deg, ${ROYAL}, ${SKY})`,
        }}
      >
        <TeamSide team={live.home} side="home" serving={!finished && live.serving === "home"} winner={winner === "home"} dimmed={winner === "away"} />
        <SetsBox sets={live.home.sets} timeouts={timeouts ? timeouts.home : null} side="home" />
        <span className="flex shrink-0 items-center justify-center gap-[1rem] px-[1.4rem]" style={{ backgroundColor: NAVY }}>
          <span
            key={`h${homePoints}`}
            className="grafica-type min-w-[3.4rem] animate-[livescore-score-pop_320ms_ease-out] text-center text-[4.2rem] tabular-nums"
            data-grafica-wide-score="home"
          >
            {homePoints}
          </span>
          <span className="grid h-[2rem] w-[2rem] place-items-center rounded-full bg-white/15" aria-hidden>
            <Volleyball className="h-[1.2rem] w-[1.2rem] text-[#ffd23f]" />
          </span>
          <span
            key={`a${awayPoints}`}
            className="grafica-type min-w-[3.4rem] animate-[livescore-score-pop_320ms_ease-out] text-center text-[4.2rem] tabular-nums"
            data-grafica-wide-score="away"
          >
            {awayPoints}
          </span>
        </span>
        <SetsBox sets={live.away.sets} timeouts={timeouts ? timeouts.away : null} side="away" />
        <TeamSide team={live.away} side="away" serving={!finished && live.serving === "away"} winner={winner === "away"} dimmed={winner === "home"} />
      </div>
      {/* La linguetta sotto il riquadro dei punti: categoria, set in corso e, quando c'è, il set point o il match point. */}
      <div
        className="absolute bottom-0 left-1/2 flex items-center gap-[0.8rem] rounded-b-[0.7rem] px-[1.2rem] py-[0.2rem] text-[0.95rem] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_0.4rem_1rem_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: NAVY, transform: "translateX(-50%)" }}
        data-grafica-wide-tab
      >
        {live.category && <span className="rounded-[0.3rem] bg-white/15 px-[0.5rem]">{live.category}F</span>}
        <span data-grafica-wide-phase>{finished ? "Finale" : `${live.sets.length + 1}° set`}</span>
        {point && (
          <span className="animate-[grafica-point-pulse_1.1s_ease-in-out_infinite] text-[#ffd23f]" data-grafica-wide-point={`${point.side}-${point.kind}`}>
            {point.kind === "match" ? "Match point" : "Set point"}
          </span>
        )}
      </div>
    </div>
  );
}
