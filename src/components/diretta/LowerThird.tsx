import type { ReactNode } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, ChartNoAxesColumn, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { STRIP_OUT_MS, timeoutSecondsLeft, TIMEOUT_CARD_MS, type StripCard } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { cutRight, DROP, EDGE, GLASS, GLASS_DARK, GOLD, IN_GREEN, INK, OUT_RED, PAPER, SUN, tag } from "./theme";
import { TeamMark, tone } from "./TeamMark";

/**
 * I sottopancia della diretta video, in basso a sinistra come in Serie A: l'etichetta gialla a parallelogramma (TIME-OUT,
 * CAMBIO, IL SET FIN QUI, CAMBIO DI CAMPO) scende sopra un riquadro blu profondo con il taglio obliquo, che si apre con una
 * tendina e si richiude allo stesso modo.
 * - Time-out: chi l'ha chiesto, quale dei due (i pallini), i secondi che mancano in grande con la barra che si svuota, e i
 *   punti del set a barre speculari. Esce da solo al primo punto dopo (si è ripreso a giocare), o dopo 30 secondi.
 * - Il set fin qui: a 8 e a 16 di chi è avanti (i vecchi time-out tecnici), il punteggio e gli stessi numeri.
 * - Cambio di campo: nel set decisivo, quando chi è avanti arriva a 8.
 * - Cambio: chi entra (freccia verde in su) e chi esce (freccia rossa in giù), con il numero di maglia (e il nome, se lo staff
 *   lo ha acceso nello Scout).
 */

export { STRIP_OUT_MS };

function Frame({ card, now, icon, label, children }: { card: StripCard; now: number; icon: ReactNode; label: string; children: ReactNode }) {
  const leaving = card.until - now < STRIP_OUT_MS;
  return (
    <div
      className={cn("relative w-[50rem] text-white", leaving && "animate-[grafica-wipe-out_450ms_ease-in_forwards]")}
      data-grafica-card={card.kind}
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

/** La testata: logo e nome della squadra, e a destra quello che serve (i secondi del time-out, il punteggio del cambio). */
function Head({ live, side, right }: { live: PublicLiveScore; side: "home" | "away"; right?: ReactNode }) {
  const team = side === "home" ? live.home : live.away;
  return (
    <div className="relative flex h-[4.4rem] items-stretch pt-[0.4rem]">
      <span className="w-[0.5rem] shrink-0" style={{ background: tone(side, team.color) }} />
      <span className="flex min-w-0 flex-1 items-center gap-[0.8rem] px-[1rem]">
        <TeamMark team={team} side={side} className="h-[2.8rem] w-[2.8rem] rounded-[0.5rem] shadow-[0_0.15rem_0.5rem_rgba(0,0,0,0.35)]" />
        <span className="grafica-type truncate text-[2.1rem] tracking-[0.03em]">{teamShortName(team.name)}</span>
      </span>
      {right}
    </div>
  );
}

/** Quale time-out è (1° o 2° dei due del set): i pallini pieni sono quelli usati. */
function TimeoutPips({ used }: { used: number }) {
  return (
    <span className="flex flex-col items-end gap-[0.35rem] leading-none" data-grafica-timeout-count={used}>
      <span className="text-[0.95rem] font-extrabold uppercase tracking-[0.14em] text-white/70">{used}° time-out</span>
      <span className="flex gap-[0.3rem]">
        {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
          <span
            key={i}
            className="h-[0.5rem] w-[1.6rem]"
            style={i < used ? { background: SUN, boxShadow: "0 0 0.5rem rgba(255,210,63,0.8)", clipPath: tag("0.2rem") } : { background: "rgba(255,255,255,0.22)", clipPath: tag("0.2rem") }}
          />
        ))}
      </span>
    </span>
  );
}

/** I secondi che mancano, in grande su una piastrina bianca: 0:30 → 0:00. */
function Countdown({ card, now }: { card: Extract<StripCard, { kind: "timeout" }>; now: number }) {
  return (
    <span
      className="grafica-type mr-[2rem] grid h-[3.1rem] min-w-[6rem] place-items-center self-center px-[0.9rem] text-[2.2rem] tabular-nums"
      style={{ background: PAPER, color: INK, clipPath: tag("0.55rem") }}
      data-grafica-countdown
    >
      0:{String(timeoutSecondsLeft(card, now)).padStart(2, "0")}
    </span>
  );
}

const STAT_ROWS: { key: keyof PublicSetRecapTeam; label: string }[] = [
  { key: "attack", label: "Attacco" },
  { key: "block", label: "Muro" },
  { key: "ace", label: "Ace" },
  { key: "gifts", label: "Errori avv." },
];

/**
 * I punti del set divisi per fondamentale, a barre che crescono dal centro come nel resoconto di fine set: chi ne ha di più
 * è nel suo colore, chi meno in bianco tenue. Sopra, le due squadre (e il punteggio, se serve).
 */
function PointsBars({ live, stats, title, names = true }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; title: string; names?: boolean }) {
  const homeColor = tone("home", live.home.color);
  const awayColor = tone("away", live.away.color);
  const fill = (color: string, less: boolean) => (less ? { background: "rgba(255,255,255,0.28)" } : { background: color, boxShadow: `0 0 0.6rem ${color}` });
  const grid = "grid grid-cols-[3rem_1fr_11rem_1fr_3rem] items-center gap-x-[0.8rem]";
  return (
    <div className="pb-[0.7rem] pl-[1.5rem] pr-[2.6rem] pt-[0.55rem]" style={{ background: GLASS_DARK }} data-grafica-timeout-stats>
      <div className={cn(grid, "pb-[0.35rem]")}>
        <span className="col-span-2 flex min-w-0 items-center gap-[0.5rem]">
          {names && <span className="h-[1.2rem] w-[0.3rem] shrink-0" style={{ background: homeColor }} />}
          {names && <span className="grafica-type truncate text-[1.2rem]">{teamShortName(live.home.name)}</span>}
        </span>
        <span className="text-center text-[0.85rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: SUN }}>
          {title}
        </span>
        <span className="col-span-2 flex min-w-0 items-center justify-end gap-[0.5rem]">
          {names && <span className="grafica-type truncate text-[1.2rem]">{teamShortName(live.away.name)}</span>}
          {names && <span className="h-[1.2rem] w-[0.3rem] shrink-0" style={{ background: awayColor }} />}
        </span>
      </div>
      {STAT_ROWS.map(({ key, label }, i) => {
        const home = stats.home[key];
        const away = stats.away[key];
        const max = Math.max(home, away, 1);
        const delay = `${600 + i * 80}ms`;
        return (
          <div key={key} className={cn(grid, "h-[2.15rem] border-t border-white/[0.07]")} data-grafica-timeout-row={key}>
            <span className={cn("grafica-type text-right text-[1.55rem] tabular-nums", away > home && "text-white/55")} data-grafica-timeout-value={`home-${key}`}>
              {home}
            </span>
            <span className="flex justify-end">
              <span className="h-[0.55rem] origin-right" style={{ width: `${(home / max) * 100}%`, ...fill(homeColor, away > home), clipPath: tag("0.28rem"), animation: `grafica-grow 600ms ease-out ${delay} both` }} />
            </span>
            <span className="text-center text-[0.95rem] font-extrabold uppercase tracking-[0.1em] text-white/85">{label}</span>
            <span className="flex justify-start">
              <span className="h-[0.55rem] origin-left" style={{ width: `${(away / max) * 100}%`, ...fill(awayColor, home > away), clipPath: tag("0.28rem"), animation: `grafica-grow 600ms ease-out ${delay} both` }} />
            </span>
            <span className={cn("grafica-type text-[1.55rem] tabular-nums", home > away && "text-white/55")} data-grafica-timeout-value={`away-${key}`}>
              {away}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Le due squadre con il punteggio del set in mezzo, su due piastrine bianche: la testata di «Il set fin qui». */
function Scoreline({ live }: { live: PublicLiveScore }) {
  const chip = "grafica-type grid h-[2.9rem] min-w-[3.6rem] place-items-center px-[0.6rem] text-[2rem] tabular-nums";
  return (
    <div className="relative flex h-[4.4rem] items-center gap-[0.9rem] pl-[1.5rem] pr-[2.6rem] pt-[0.4rem]" data-grafica-stats-score>
      <span className="flex min-w-0 flex-1 items-center gap-[0.8rem]">
        <TeamMark team={live.home} side="home" className="h-[2.6rem] w-[2.6rem] rounded-[0.5rem] shadow-[0_0.15rem_0.5rem_rgba(0,0,0,0.35)]" />
        <span className="grafica-type truncate text-[1.8rem] tracking-[0.03em]">{teamShortName(live.home.name)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-[0.4rem]">
        <span className={chip} style={{ background: PAPER, color: INK, clipPath: tag("0.45rem") }}>
          {live.home.score}
        </span>
        <span className={chip} style={{ background: PAPER, color: INK, clipPath: tag("0.45rem") }}>
          {live.away.score}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-[0.8rem]">
        <span className="grafica-type truncate text-[1.8rem] tracking-[0.03em]">{teamShortName(live.away.name)}</span>
        <TeamMark team={live.away} side="away" className="h-[2.6rem] w-[2.6rem] rounded-[0.5rem] shadow-[0_0.15rem_0.5rem_rgba(0,0,0,0.35)]" />
      </span>
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
    const set = live.sets.length + 1;
    return (
      <Frame card={card} now={now} icon={<Timer className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />} label="Time-out">
        <Head
          live={live}
          side={card.side}
          right={
            <span className="flex items-center gap-[1.4rem]">
              <TimeoutPips used={card.count} />
              <Countdown card={card} now={now} />
            </span>
          }
        />
        {/* I 30 secondi che passano: la barra gialla si svuota. */}
        <div className="h-[0.32rem] w-full bg-white/10">
          <div key={card.startedAt} className="h-full origin-left" style={{ background: GOLD, boxShadow: "0 0 0.6rem rgba(255,210,63,0.7)", animation: `grafica-countdown ${TIMEOUT_CARD_MS}ms linear forwards` }} />
        </div>
        {card.stats && <PointsBars live={live} stats={card.stats} title={`Punti nel ${set}° set`} />}
      </Frame>
    );
  }

  if (card.kind === "stats") {
    return (
      <Frame card={card} now={now} icon={<ChartNoAxesColumn className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />} label="Il set fin qui">
        <Scoreline live={live} />
        <PointsBars live={live} stats={card.stats} title={`Punti nel ${card.set}° set`} names={false} />
      </Frame>
    );
  }

  if (card.kind === "court") {
    return (
      <Frame card={card} now={now} icon={<ArrowLeftRight className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />} label="Cambio di campo">
        <div className="flex items-center gap-[1.4rem] py-[1rem] pl-[1.5rem] pr-[2.6rem]" data-grafica-court>
          <span className="grafica-type text-[2rem] tracking-[0.03em]">Tie-break</span>
          <span className="min-w-0 flex-1 truncate text-[1.35rem] font-semibold text-white/85">Le squadre cambiano campo</span>
          <span className="grafica-type grid h-[2.8rem] place-items-center px-[1rem] text-[1.9rem] tabular-nums" style={{ background: PAPER, color: INK, clipPath: tag("0.5rem") }} data-grafica-court-score>
            {card.score.home}–{card.score.away}
          </span>
        </div>
      </Frame>
    );
  }

  const last = card.subs[card.subs.length - 1];
  return (
    <Frame card={card} now={now} icon={<ArrowUpDown className="h-[1.4rem] w-[1.4rem]" strokeWidth={3} aria-hidden />} label={card.subs.length > 1 ? "Cambi" : "Cambio"}>
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
