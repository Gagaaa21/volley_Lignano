import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { secondsLeft, TIMEOUT_CARD_MS, type StripCard } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { cutRight, DROP, EDGE, GLASS, GLASS_DARK, GOLD, IN_GREEN, INK, OUT_RED, PAPER, SUN, tag } from "./theme";
import { TeamMark, tone } from "./TeamMark";

/**
 * I sottopancia della diretta video, in basso a sinistra come in Serie A: l'etichetta gialla a parallelogramma (TIME-OUT,
 * CAMBIO) scende sopra un riquadro blu profondo con il taglio obliquo, che si apre con una tendina e si richiude allo stesso
 * modo. Il time-out ha l'anello del conto alla rovescia (parte quando la grafica se ne accorge, qualche secondo dopo lo Scout:
 * è indicativo) e i punti del set divisi per fondamentale; il cambio dice chi entra (freccia verde in su) e chi esce (freccia
 * rossa in giù), con il numero di maglia (e il nome, se lo staff lo ha acceso nello Scout).
 */

/** Gli ultimi istanti la grafica si richiude, invece di sparire di colpo. */
export const STRIP_OUT_MS = 450;

function Frame({ card, now, kind, icon, label, children }: { card: StripCard; now: number; kind: StripCard["kind"]; icon: ReactNode; label: string; children: ReactNode }) {
  const leaving = card.until - now < STRIP_OUT_MS;
  return (
    <div
      className={cn("relative w-[48rem] text-white", leaving && "animate-[grafica-wipe-out_450ms_ease-in_forwards]")}
      data-grafica-card={kind}
    >
      {/* L'etichetta scende dopo che il riquadro si è aperto. */}
      <div className="relative z-10 ml-[1.2rem] w-fit" style={{ filter: DROP, animation: leaving ? undefined : "grafica-drop 380ms cubic-bezier(.2,.8,.2,1) 260ms both" }}>
        <span className="grafica-type flex h-[2.4rem] items-center gap-[0.5rem] px-[1.4rem] text-[1.45rem] tracking-[0.06em]" style={{ background: GOLD, color: INK, clipPath: tag("0.65rem") }}>
          {icon}
          {label}
        </span>
      </div>
      <div className="-mt-[0.6rem]" style={{ filter: DROP, animation: leaving ? undefined : "grafica-wipe-in 560ms cubic-bezier(.2,.8,.2,1) both" }}>
        <div className="relative overflow-hidden" style={{ background: GLASS, boxShadow: EDGE, clipPath: cutRight("1.4rem") }}>
          {/* Un riflesso solo, mentre la tendina si apre. */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[8rem] animate-[grafica-sheen_1.6s_ease-in-out_both] bg-gradient-to-r from-white/0 via-white/25 to-white/0" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** La testata: logo e nome della squadra, e a destra quello che serve (anello del time-out, punteggio del cambio). */
function Head({ live, side, right }: { live: PublicLiveScore; side: "home" | "away"; right?: ReactNode }) {
  const team = side === "home" ? live.home : live.away;
  return (
    <div className="relative flex h-[4rem] items-stretch pt-[0.4rem]">
      <span className="w-[0.5rem] shrink-0" style={{ background: tone(side, team.color) }} />
      <span className="flex min-w-0 flex-1 items-center gap-[0.8rem] px-[1rem]">
        <TeamMark team={team} side={side} className="h-[2.6rem] w-[2.6rem] rounded-[0.5rem] shadow-[0_0.15rem_0.5rem_rgba(0,0,0,0.35)]" />
        <span className="grafica-type truncate text-[2rem] tracking-[0.03em]">{teamShortName(team.name)}</span>
      </span>
      {right}
    </div>
  );
}

/** L'anello del conto alla rovescia: si svuota in 30 secondi, con i secondi che mancano in mezzo. */
function CountdownRing({ card, now }: { card: StripCard; now: number }) {
  return (
    <span className="relative mr-[2rem] grid h-[3rem] w-[3rem] shrink-0 place-items-center self-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx="18" cy="18" r="16" fill="rgba(3,10,40,0.45)" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
        <circle
          key={card.startedAt}
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={SUN}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray="100.53"
          style={{ animation: `grafica-dash ${TIMEOUT_CARD_MS}ms linear forwards`, filter: "drop-shadow(0 0 0.25rem rgba(255,210,63,0.9))" }}
        />
      </svg>
      <span className="grafica-type relative text-[1.25rem] tabular-nums" data-grafica-countdown>
        0:{String(secondsLeft(card, now)).padStart(2, "0")}
      </span>
    </span>
  );
}

const STAT_COLUMNS: { key: keyof PublicSetRecapTeam; label: string }[] = [
  { key: "attack", label: "Attacco" },
  { key: "block", label: "Muro" },
  { key: "ace", label: "Ace" },
  { key: "gifts", label: "Err. avv." },
];

const STAT_GRID = "grid-cols-[1fr_repeat(4,5.6rem)_4.6rem]";

/** I punti del set divisi per fondamentale, una riga per squadra: come la tabella dei time-out in TV. */
function PointsTable({ live, stats, set }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; set: number }) {
  const rows = [
    { side: "home" as const, team: live.home, values: stats.home, score: live.home.score },
    { side: "away" as const, team: live.away, values: stats.away, score: live.away.score },
  ];
  return (
    <div className="pb-[0.7rem] pl-[1.5rem] pr-[2.4rem] pt-[0.55rem]" style={{ background: GLASS_DARK }} data-grafica-timeout-stats>
      <div className={cn("grid items-center gap-x-[0.4rem] whitespace-nowrap pb-[0.3rem] text-[0.85rem] font-extrabold uppercase tracking-[0.1em] text-white/60", STAT_GRID)}>
        <span style={{ color: SUN }}>Punti nel {set}° set</span>
        {STAT_COLUMNS.map((column) => (
          <span key={column.key} className="text-center">
            {column.label}
          </span>
        ))}
        <span className="text-center">Tot.</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.side}
          className={cn("grid h-[2.3rem] items-center gap-x-[0.4rem]", STAT_GRID, i > 0 && "border-t border-white/10")}
          data-grafica-timeout-row={row.side}
        >
          <span className="flex min-w-0 items-center gap-[0.6rem]">
            <span className="h-[1.3rem] w-[0.3rem] shrink-0" style={{ background: tone(row.side, row.team.color) }} />
            <span className="grafica-type truncate text-[1.35rem]">{teamShortName(row.team.name)}</span>
          </span>
          {STAT_COLUMNS.map((column) => (
            <span key={column.key} className="grafica-type text-center text-[1.5rem] tabular-nums" data-grafica-timeout-value={`${row.side}-${column.key}`}>
              {row.values[column.key]}
            </span>
          ))}
          <span className="grafica-type mx-auto grid h-[1.9rem] min-w-[3rem] place-items-center text-[1.5rem] tabular-nums" style={{ background: GOLD, color: INK, clipPath: tag("0.3rem") }}>
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

/** «12 ROSSI» con la freccia: verde in su chi entra, rossa in giù chi esce. Senza nome: «Entra» / «Esce». */
function PlayerLine({ player, direction }: { player: PublicPlayer; direction: "in" | "out" }) {
  const entering = direction === "in";
  const color = entering ? IN_GREEN : OUT_RED;
  const Arrow = entering ? ArrowUp : ArrowDown;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-[0.7rem]" data-grafica-sub-player={direction}>
      <span className="grid h-[2.4rem] w-[2.4rem] shrink-0 place-items-center" style={{ background: color, clipPath: tag("0.35rem") }}>
        <Arrow className="h-[1.45rem] w-[1.45rem] text-white" strokeWidth={3.2} aria-label={entering ? "Entra" : "Esce"} />
      </span>
      <span
        className="grafica-type grid h-[2.4rem] min-w-[3rem] shrink-0 place-items-center px-[0.5rem] text-[1.75rem] tabular-nums"
        style={{ background: PAPER, color: INK, clipPath: tag("0.35rem") }}
        data-grafica-sub-number
      >
        {player.number ?? "–"}
      </span>
      <span className="grafica-type min-w-0 truncate text-[1.6rem] tracking-[0.03em]" data-grafica-sub-name>
        {player.name ?? (entering ? "Entra" : "Esce")}
      </span>
    </span>
  );
}

export function LowerThird({ card, live, now }: { card: StripCard; live: PublicLiveScore; now: number }) {
  if (card.kind === "timeout") {
    return (
      <Frame card={card} now={now} kind="timeout" icon={<Timer className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />} label="Time-out">
        <Head live={live} side={card.side} right={<CountdownRing card={card} now={now} />} />
        {/* I 30 secondi che passano: una riga gialla che si accorcia. */}
        <div className="h-[0.22rem] w-full bg-white/10">
          <div key={card.startedAt} className="h-full origin-left" style={{ background: GOLD, animation: `grafica-countdown ${TIMEOUT_CARD_MS}ms linear forwards` }} />
        </div>
        {card.stats && <PointsTable live={live} stats={card.stats} set={live.sets.length + 1} />}
      </Frame>
    );
  }

  const last = card.subs[card.subs.length - 1];
  return (
    <Frame
      card={card}
      now={now}
      kind="sub"
      icon={<ArrowUpDown className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />}
      label={card.subs.length > 1 ? "Cambi" : "Cambio"}
    >
      <Head
        live={live}
        side="home"
        right={
          <span className="grafica-type mr-[2rem] flex items-center text-[1.6rem] tabular-nums text-white/80" data-grafica-sub-score>
            {last.score.home}–{last.score.away}
          </span>
        }
      />
      <div className="divide-y divide-white/10" style={{ background: GLASS_DARK }}>
        {card.subs.map((sub) => (
          <div key={sub.id} className="flex items-center gap-[1rem] py-[0.6rem] pl-[1.5rem] pr-[2.4rem]" data-grafica-sub={sub.id}>
            <PlayerLine player={sub.in} direction="in" />
            <PlayerLine player={sub.out} direction="out" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
