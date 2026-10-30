import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { secondsLeft, TIMEOUT_CARD_MS, type StripCard } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { GOLD, IN_GREEN, NAVY, NAVY_DEEP, OUT_RED, PANEL_BG, SHADOW } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * I sottopancia della diretta video, in basso a sinistra come in Serie A: si aprono con una tendina e si richiudono allo
 * stesso modo. Il time-out ha il conto alla rovescia (parte quando la grafica se ne accorge, qualche secondo dopo lo Scout:
 * è indicativo) e i punti del set divisi per fondamentale; il cambio dice chi entra e chi esce, con il numero di maglia (e il
 * nome, se lo staff lo ha acceso nello Scout).
 */

/** Gli ultimi istanti la grafica si richiude, invece di sparire di colpo. */
export const STRIP_OUT_MS = 450;

function Frame({ card, now, kind, children }: { card: StripCard; now: number; kind: StripCard["kind"]; children: ReactNode }) {
  const leaving = card.until - now < STRIP_OUT_MS;
  return (
    <div
      className={cn(
        "w-[46rem] overflow-hidden rounded-[0.6rem] text-white",
        leaving ? "animate-[grafica-wipe-out_450ms_ease-in_forwards]" : "animate-[grafica-wipe-in_520ms_cubic-bezier(.2,.8,.2,1)]",
      )}
      style={{ background: PANEL_BG, boxShadow: SHADOW }}
      data-grafica-card={kind}
    >
      {children}
    </div>
  );
}

/** La testata: l'etichetta oro (TIME OUT, CAMBIO) e la squadra. */
function Head({ icon, label, live, side, right }: { icon: ReactNode; label: string; live: PublicLiveScore; side: "home" | "away"; right?: ReactNode }) {
  const team = side === "home" ? live.home : live.away;
  return (
    <div className="flex h-[3.2rem] items-stretch">
      <span className="grafica-type flex items-center gap-[0.5rem] px-[1rem] text-[1.5rem]" style={{ background: GOLD, color: NAVY }}>
        {icon}
        {label}
      </span>
      <span className="w-[0.45rem] shrink-0" style={{ background: accent(team.color) }} />
      <span className="flex min-w-0 flex-1 items-center gap-[0.7rem] px-[0.9rem]">
        <TeamMark team={team} side={side} className="h-[2.3rem] w-[2.3rem]" />
        <span className="grafica-type truncate text-[1.7rem]">{teamShortName(team.name)}</span>
      </span>
      {right}
    </div>
  );
}

const STAT_COLUMNS: { key: keyof PublicSetRecapTeam; label: string }[] = [
  { key: "attack", label: "Attacco" },
  { key: "block", label: "Muro" },
  { key: "ace", label: "Ace" },
  { key: "gifts", label: "Err. avv." },
];

/** I punti del set divisi per fondamentale, una riga per squadra: come la tabella dei time-out in TV. */
function PointsTable({ live, stats, set }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; set: number }) {
  const rows = [
    { side: "home" as const, team: live.home, values: stats.home, score: live.home.score },
    { side: "away" as const, team: live.away, values: stats.away, score: live.away.score },
  ];
  return (
    <div className="border-t border-white/10 px-[1rem] pb-[0.7rem] pt-[0.5rem]" style={{ background: NAVY_DEEP }} data-grafica-timeout-stats>
      <div className="grid grid-cols-[1fr_repeat(4,5.6rem)_4.4rem] items-center gap-x-[0.4rem] pb-[0.25rem] text-[0.85rem] font-extrabold uppercase tracking-[0.08em] whitespace-nowrap text-white/55">
        <span>Punti nel {set}° set</span>
        {STAT_COLUMNS.map((column) => (
          <span key={column.key} className="text-center">
            {column.label}
          </span>
        ))}
        <span className="text-center" style={{ color: GOLD }}>
          Tot.
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.side} className="grid h-[2.1rem] grid-cols-[1fr_repeat(4,5.6rem)_4.4rem] items-center gap-x-[0.4rem]" data-grafica-timeout-row={row.side}>
          <span className="flex min-w-0 items-center gap-[0.5rem]">
            <span className="h-[1.2rem] w-[0.35rem] shrink-0 rounded-full" style={{ background: accent(row.team.color) }} />
            <span className="grafica-type truncate text-[1.3rem]">{teamShortName(row.team.name)}</span>
          </span>
          {STAT_COLUMNS.map((column) => (
            <span key={column.key} className="grafica-type text-center text-[1.45rem] tabular-nums" data-grafica-timeout-value={`${row.side}-${column.key}`}>
              {row.values[column.key]}
            </span>
          ))}
          <span className="grafica-type text-center text-[1.6rem] tabular-nums" style={{ color: GOLD }}>
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

/** «12 ROSSI» con la freccia: verde chi entra, rossa chi esce. Senza nome: «N. 12 · Entra». */
function PlayerLine({ player, direction }: { player: PublicPlayer; direction: "in" | "out" }) {
  const entering = direction === "in";
  const color = entering ? IN_GREEN : OUT_RED;
  const Arrow = entering ? ArrowUp : ArrowDown;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-[0.6rem]" data-grafica-sub-player={direction}>
      <span className="grid h-[2.2rem] w-[2.2rem] shrink-0 place-items-center rounded-[0.4rem]" style={{ background: color }}>
        <Arrow className="h-[1.4rem] w-[1.4rem] text-white" strokeWidth={3} aria-label={entering ? "Entra" : "Esce"} />
      </span>
      <span className="grafica-type grid h-[2.2rem] min-w-[2.6rem] shrink-0 place-items-center rounded-[0.4rem] bg-white px-[0.4rem] text-[1.6rem] tabular-nums" style={{ color: NAVY }} data-grafica-sub-number>
        {player.number ?? "–"}
      </span>
      <span className="grafica-type min-w-0 truncate text-[1.5rem]" data-grafica-sub-name>
        {player.name ?? (entering ? "Entra" : "Esce")}
      </span>
    </span>
  );
}

export function LowerThird({ card, live, now }: { card: StripCard; live: PublicLiveScore; now: number }) {
  if (card.kind === "timeout") {
    return (
      <Frame card={card} now={now} kind="timeout">
        <Head
          icon={<Timer className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />}
          label="Time-out"
          live={live}
          side={card.side}
          right={
            <span className="grafica-type flex items-center px-[1rem] text-[2rem] tabular-nums" data-grafica-countdown>
              0:{String(secondsLeft(card, now)).padStart(2, "0")}
            </span>
          }
        />
        <div className="h-[0.3rem] w-full bg-white/10">
          <div key={card.startedAt} className="h-full origin-left" style={{ background: GOLD, animation: `grafica-countdown ${TIMEOUT_CARD_MS}ms linear forwards` }} />
        </div>
        {card.stats && <PointsTable live={live} stats={card.stats} set={live.sets.length + 1} />}
      </Frame>
    );
  }

  return (
    <Frame card={card} now={now} kind="sub">
      <Head
        icon={<ArrowUpDown className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />}
        label={card.subs.length > 1 ? "Cambi" : "Cambio"}
        live={live}
        side="home"
        right={
          <span className="grafica-type flex items-center px-[1rem] text-[1.5rem] tabular-nums text-white/70" data-grafica-sub-score>
            {card.subs[card.subs.length - 1].score.home}–{card.subs[card.subs.length - 1].score.away}
          </span>
        }
      />
      <div className="divide-y divide-white/10 border-t border-white/10" style={{ background: NAVY_DEEP }}>
        {card.subs.map((sub) => (
          <div key={sub.id} className="flex items-center gap-[1rem] px-[1rem] py-[0.55rem]" data-grafica-sub={sub.id}>
            <PlayerLine player={sub.in} direction="in" />
            <PlayerLine player={sub.out} direction="out" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
