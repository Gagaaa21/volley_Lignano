import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { secondsLeft, TIMEOUT_CARD_MS, type StripCard } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { IN_GREEN, INK, OUT_RED, PANEL_BG, SHADOW, STRIPES, SUN, SUNSET } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * I sottopancia della diretta video, in basso a sinistra come in Serie A ma allegri: si aprono con una tendina e si
 * richiudono allo stesso modo. Il time-out ha l'anello del conto alla rovescia (parte quando la grafica se ne accorge, qualche
 * secondo dopo lo Scout: è indicativo) e i punti del set divisi per fondamentale; il cambio dice chi entra (freccia verde in
 * su) e chi esce (freccia rossa in giù), con il numero di maglia (e il nome, se lo staff lo ha acceso nello Scout).
 */

/** Gli ultimi istanti la grafica si richiude, invece di sparire di colpo. */
export const STRIP_OUT_MS = 450;

function Frame({ card, now, kind, children }: { card: StripCard; now: number; kind: StripCard["kind"]; children: ReactNode }) {
  const leaving = card.until - now < STRIP_OUT_MS;
  return (
    <div
      className={cn(
        "relative w-[46rem] overflow-hidden rounded-[0.8rem] text-white ring-[0.12rem] ring-white/40",
        leaving ? "animate-[grafica-wipe-out_450ms_ease-in_forwards]" : "animate-[grafica-wipe-in_560ms_cubic-bezier(.2,.8,.2,1)]",
      )}
      style={{ background: PANEL_BG, boxShadow: SHADOW }}
      data-grafica-card={kind}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: STRIPES }} />
      {/* Un riflesso solo, mentre la tendina si apre. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[8rem] animate-[grafica-sheen_1.6s_ease-in-out_both] bg-gradient-to-r from-white/0 via-white/30 to-white/0" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** La testata: l'etichetta al tramonto (TIME OUT, CAMBIO) e la squadra. */
function Head({ icon, label, live, side, right }: { icon: ReactNode; label: string; live: PublicLiveScore; side: "home" | "away"; right?: ReactNode }) {
  const team = side === "home" ? live.home : live.away;
  return (
    <div className="flex h-[3.4rem] items-stretch">
      <span className="grafica-type flex items-center gap-[0.5rem] px-[1rem] text-[1.6rem]" style={{ background: SUNSET, color: INK }}>
        {icon}
        {label}
      </span>
      <span className="w-[0.5rem] shrink-0" style={{ background: accent(team.color) }} />
      <span className="flex min-w-0 flex-1 items-center gap-[0.7rem] px-[0.9rem]">
        <TeamMark team={team} side={side} className="h-[2.4rem] w-[2.4rem] shadow-[0_0.2rem_0.6rem_rgba(0,0,0,0.25)]" />
        <span className="grafica-type truncate text-[1.8rem] [text-shadow:0_0.12rem_0.3rem_rgba(11,27,77,0.45)]">{teamShortName(team.name)}</span>
      </span>
      {right}
    </div>
  );
}

/** L'anello del conto alla rovescia: si svuota in 30 secondi, con i secondi che mancano in mezzo. */
function CountdownRing({ card, now }: { card: StripCard; now: number }) {
  return (
    <span className="relative mr-[0.7rem] grid h-[2.9rem] w-[2.9rem] shrink-0 place-items-center self-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx="18" cy="18" r="16" fill="rgba(11,27,77,0.35)" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
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

/** I punti del set divisi per fondamentale, una riga per squadra: come la tabella dei time-out in TV. */
function PointsTable({ live, stats, set }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; set: number }) {
  const rows = [
    { side: "home" as const, team: live.home, values: stats.home, score: live.home.score },
    { side: "away" as const, team: live.away, values: stats.away, score: live.away.score },
  ];
  return (
    <div className="border-t border-white/20 px-[1rem] pb-[0.7rem] pt-[0.5rem]" style={{ background: "rgba(11,27,77,0.35)" }} data-grafica-timeout-stats>
      <div className="grid grid-cols-[1fr_repeat(4,5.6rem)_4.4rem] items-center gap-x-[0.4rem] whitespace-nowrap pb-[0.25rem] text-[0.85rem] font-extrabold uppercase tracking-[0.08em]" style={{ color: SUN }}>
        <span>Punti nel {set}° set</span>
        {STAT_COLUMNS.map((column) => (
          <span key={column.key} className="text-center">
            {column.label}
          </span>
        ))}
        <span className="text-center">Tot.</span>
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
          <span className="grafica-type mx-auto grid h-[1.8rem] min-w-[2.8rem] place-items-center rounded-[0.4rem] text-[1.5rem] tabular-nums" style={{ background: SUN, color: INK }}>
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
    <span className="flex min-w-0 flex-1 items-center gap-[0.6rem]" data-grafica-sub-player={direction}>
      <span className="grid h-[2.3rem] w-[2.3rem] shrink-0 place-items-center rounded-full shadow-[0_0_0.8rem_rgba(255,255,255,0.35)]" style={{ background: color }}>
        <Arrow
          className="h-[1.45rem] w-[1.45rem] text-white"
          strokeWidth={3.2}
          aria-label={entering ? "Entra" : "Esce"}
        />
      </span>
      <span className="grafica-type grid h-[2.3rem] min-w-[2.7rem] shrink-0 place-items-center rounded-[0.5rem] bg-white px-[0.4rem] text-[1.65rem] tabular-nums" style={{ color: INK }} data-grafica-sub-number>
        {player.number ?? "–"}
      </span>
      <span className="grafica-type min-w-0 truncate text-[1.55rem]" data-grafica-sub-name>
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
          icon={<Timer className="h-[1.5rem] w-[1.5rem]" strokeWidth={3} aria-hidden />}
          label="Time-out"
          live={live}
          side={card.side}
          right={<CountdownRing card={card} now={now} />}
        />
        <div className="h-[0.32rem] w-full bg-white/15">
          <div key={card.startedAt} className="h-full origin-left" style={{ background: SUNSET, animation: `grafica-countdown ${TIMEOUT_CARD_MS}ms linear forwards` }} />
        </div>
        {card.stats && <PointsTable live={live} stats={card.stats} set={live.sets.length + 1} />}
      </Frame>
    );
  }

  const last = card.subs[card.subs.length - 1];
  return (
    <Frame card={card} now={now} kind="sub">
      <Head
        icon={<ArrowUpDown className="h-[1.5rem] w-[1.5rem]" strokeWidth={3} aria-hidden />}
        label={card.subs.length > 1 ? "Cambi" : "Cambio"}
        live={live}
        side="home"
        right={
          <span className="grafica-type flex items-center px-[1rem] text-[1.55rem] tabular-nums text-white/85" data-grafica-sub-score>
            {last.score.home}–{last.score.away}
          </span>
        }
      />
      <div className="divide-y divide-white/15 border-t border-white/20" style={{ background: "rgba(11,27,77,0.35)" }}>
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
