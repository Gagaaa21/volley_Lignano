import type { ReactNode } from "react";
import Image from "next/image";
import { format, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { MapPin, Trophy, Volleyball } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { cn } from "@/lib/cn";
import { FULL_EXIT_MS, type FullCard, type Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLineup, PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { CLUB_BLUE, GOLD, NAVY, NAVY_DEEP, NAVY_LIGHT } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * Le grafiche a schermo intero della diretta video, come nelle pause delle partite di Serie A: presentazione della partita,
 * formazione di partenza, fine set con i parziali e i numeri del set, risultato finale con i numeri della partita. Entrano ed
 * escono con la transizione (bande diagonali nei colori del club che attraversano lo schermo); intanto la barra del punteggio
 * si nasconde. Il fondo è quasi pieno: sotto, il video si intravede appena.
 */

/** Quanto dura la transizione in entrata; in uscita FULL_EXIT_MS. */
export const STINGER_MS = 900;

/** Le bande della transizione: oro, blu del club, bianco, una dopo l'altra. */
function Stinger({ phase }: { phase: "in" | "out" }) {
  const bands = [
    { color: GOLD, delay: 0 },
    { color: CLUB_BLUE, delay: 90 },
    { color: "#ffffff", delay: 180 },
  ];
  return (
    <div key={phase} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-grafica-stinger={phase} aria-hidden>
      {bands.map((band) => (
        <span
          key={band.color}
          className="absolute inset-y-[-10%] left-0 w-[70%]"
          style={{ background: band.color, animation: `grafica-stinger 760ms cubic-bezier(.55,.05,.35,1) ${band.delay}ms both` }}
        />
      ))}
      <span
        className="absolute left-1/2 top-1/2 grid h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 place-items-center"
        style={{ animation: "grafica-full-out 300ms ease-in 520ms both" }}
      >
        <Image src={crest} alt="" unoptimized className="h-full w-full object-contain drop-shadow-[0_0.6rem_1.6rem_rgba(0,0,0,0.45)]" />
      </span>
    </div>
  );
}

function Frame({ card, now, children }: { card: FullCard; now: number; children: ReactNode }) {
  const entering = now - card.startedAt < STINGER_MS;
  const leaving = card.until - now < FULL_EXIT_MS;
  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-grafica-full={card.kind} data-grafica-card={card.kind}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ animation: leaving ? "grafica-full-out 380ms ease-in 300ms both" : "grafica-full-in 520ms ease-out 330ms both" }}
      >
        {/* Il fondo: blu notte con una luce in alto, due fasci diagonali e lo stemma in filigrana. */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(110% 80% at 50% -10%, ${NAVY_LIGHT} 0%, ${NAVY} 55%, ${NAVY_DEEP} 100%)`, opacity: 0.96 }}
        />
        <div className="absolute -left-[10%] top-0 h-full w-[35%] -skew-x-[18deg] bg-gradient-to-r from-white/0 via-white/[0.05] to-white/0" />
        <div className="absolute right-[5%] top-0 h-full w-[18%] -skew-x-[18deg] bg-gradient-to-r from-white/0 via-white/[0.04] to-white/0" />
        <div className="absolute -bottom-[8rem] -right-[6rem] h-[44rem] w-[44rem] opacity-[0.06]">
          <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[0.5rem]" style={{ background: `linear-gradient(90deg, ${GOLD}, ${CLUB_BLUE})` }} />
        <div className="relative flex h-full flex-col items-center justify-center px-[6rem] text-white">{children}</div>
      </div>
      {(entering || leaving) && <Stinger phase={leaving ? "out" : "in"} />}
    </div>
  );
}

/** «Under 15 femminile», con «Amichevole» quando lo è. */
function competition(live: PublicLiveScore): string {
  const parts = [live.category ? `Under ${live.category.slice(1)} femminile` : "Pallavolo femminile"];
  if (live.info?.friendly) parts.push("Amichevole");
  return parts.join(" · ");
}

function Heading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-[2rem] flex w-[96rem] max-w-full items-end justify-between gap-[2rem] border-b-[0.2rem] border-white/15 pb-[0.9rem]" style={{ animation: "grafica-rise 500ms ease-out 450ms both" }}>
      <div>
        <p className="grafica-type text-[1.5rem] tracking-[0.14em]" style={{ color: GOLD }} data-grafica-full-eyebrow>
          {eyebrow}
        </p>
        <h2 className="grafica-type mt-[0.4rem] text-[4.6rem]" data-grafica-full-title>
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

/** Una squadra in grande: logo e nome (intero nella presentazione, corto nei riepiloghi, dove c'è poco spazio). */
function TeamBlock({ live, side, dimmed = false, size = "lg" }: { live: PublicLiveScore; side: Side; dimmed?: boolean; size?: "lg" | "md" }) {
  const team = side === "home" ? live.home : live.away;
  const large = size === "lg";
  return (
    <div className={cn("flex min-w-0 flex-col items-center text-center", large ? "gap-[1.4rem]" : "gap-[1rem]", dimmed && "opacity-55")} data-grafica-full-team={side}>
      <TeamMark team={team} side={side} className={large ? "h-[13rem] w-[13rem] rounded-[1.6rem] p-[1rem] text-[4rem]" : "h-[6.6rem] w-[6.6rem] rounded-[1rem] p-[0.6rem] text-[2.2rem]"} />
      <span className={cn("grafica-type max-w-full", large ? "text-[3.4rem]" : "truncate text-[2.6rem]")}>{large ? team.name : teamShortName(team.name)}</span>
      <span className="h-[0.4rem] w-[6rem] rounded-full" style={{ background: accent(team.color) }} />
    </div>
  );
}

function matchDate(iso: string): string | null {
  const date = parseISO(iso);
  if (!isValid(date)) return null;
  const text = format(date, "EEEE d MMMM · 'ore' HH:mm", { locale: it });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Intro({ live }: { live: PublicLiveScore }) {
  const when = live.info ? matchDate(live.info.date) : null;
  return (
    <>
      <Heading eyebrow={competition(live)} title="Oggi in campo" />
      <div className="grid w-[96rem] max-w-full grid-cols-[1fr_auto_1fr] items-center gap-[3rem]" style={{ animation: "grafica-rise 600ms ease-out 550ms both" }}>
        <TeamBlock live={live} side="home" />
        <span className="grafica-type grid h-[8rem] w-[8rem] place-items-center rounded-full text-[3.2rem]" style={{ background: GOLD, color: NAVY }}>
          VS
        </span>
        <TeamBlock live={live} side="away" />
      </div>
      {(when || live.info?.venue) && (
        <div className="mt-[3rem] flex flex-col items-center gap-[0.7rem]" style={{ animation: "grafica-rise 600ms ease-out 700ms both" }}>
          {when && (
            <p className="grafica-type text-[2.2rem] tracking-[0.06em]" data-grafica-intro-date>
              {when}
            </p>
          )}
          {live.info?.venue && (
            <p className="flex items-center gap-[0.6rem] text-[1.6rem] font-semibold text-white/75" data-grafica-intro-venue>
              <MapPin className="h-[1.6rem] w-[1.6rem]" style={{ color: GOLD }} aria-hidden />
              {live.info.venue}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** Una maglia con il numero (e il nome sotto, se c'è): il disegno della formazione. */
function Jersey({ player, libero = false, serving = false, position }: { player: PublicPlayer | null; libero?: boolean; serving?: boolean; position?: number }) {
  const fill = libero ? GOLD : CLUB_BLUE;
  return (
    <div className="flex w-[13rem] flex-col items-center gap-[0.6rem]" data-grafica-lineup-spot={libero ? "libero" : position}>
      <div className="relative h-[8.4rem] w-[8.4rem]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_0.4rem_0.8rem_rgba(0,0,0,0.4)]" aria-hidden>
          <path d="M31 6 L43 2 Q50 11 57 2 L69 6 L94 21 L84 41 L73 35 L73 97 L27 97 L27 35 L16 41 L6 21 Z" fill={fill} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        </svg>
        <span
          className="grafica-type absolute inset-0 grid place-items-center pt-[1.2rem] text-[3.4rem] tabular-nums"
          style={{ color: libero ? NAVY : "#ffffff" }}
          data-grafica-lineup-number
        >
          {player?.number ?? "–"}
        </span>
        {serving && (
          <Volleyball className="absolute -right-[0.4rem] -top-[0.2rem] h-[2rem] w-[2rem] rounded-full bg-white p-[0.15rem]" style={{ color: NAVY }} aria-label="Batte" />
        )}
      </div>
      {player?.name && (
        <span className="grafica-type max-w-full truncate text-[1.5rem]" data-grafica-lineup-name>
          {player.name}
        </span>
      )}
    </div>
  );
}

/** Le posizioni come si vedono dalla nostra metà campo: davanti 4-3-2, dietro 5-6-1. */
const ROWS = [
  [4, 3, 2],
  [5, 6, 1],
] as const;

function Lineup({ live, lineup }: { live: PublicLiveScore; lineup: PublicLineup }) {
  return (
    <>
      <Heading
        eyebrow={competition(live)}
        title={`Formazione · ${lineup.set}° set`}
        right={
          <span className="flex items-center gap-[1rem]">
            <TeamMark team={live.home} side="home" className="h-[4.4rem] w-[4.4rem]" />
            <span className="grafica-type text-[2.6rem]">{live.home.name}</span>
          </span>
        }
      />
      <div className="flex items-center gap-[4rem]" style={{ animation: "grafica-rise 600ms ease-out 550ms both" }} data-grafica-lineup={lineup.set}>
        {/* Il campo: la rete in alto, la prima linea davanti. */}
        <div className="relative w-[50rem] overflow-hidden rounded-[1.2rem] border-[0.25rem] border-white/70 px-[2rem] pb-[2rem] pt-[3.4rem]" style={{ background: `linear-gradient(180deg, ${CLUB_BLUE}55, ${NAVY}cc)` }}>
          <span className="absolute inset-x-0 top-0 grid h-[1.6rem] place-items-center bg-white/85 text-[0.95rem] font-extrabold uppercase tracking-[0.3em]" style={{ color: NAVY }}>
            Rete
          </span>
          <span className="absolute inset-x-0 top-[48%] h-[0.2rem] bg-white/40" aria-hidden />
          {ROWS.map((row, i) => (
            <div key={i} className={cn("relative flex justify-between", i === 0 ? "mb-[2.6rem]" : "")}>
              {row.map((position) => (
                <Jersey key={position} player={lineup.positions[position - 1] ?? null} serving={position === 1} position={position} />
              ))}
            </div>
          ))}
        </div>
        {lineup.libero && (
          <div className="flex flex-col items-center gap-[1rem]">
            <span className="grafica-type rounded-[0.5rem] px-[1rem] py-[0.4rem] text-[1.4rem] tracking-[0.14em]" style={{ background: GOLD, color: NAVY }}>
              Libero
            </span>
            <Jersey player={lineup.libero} libero />
          </div>
        )}
      </div>
    </>
  );
}

/** I parziali di tutti i set in una tabella, come in TV: una riga per squadra, i set vinti nell'ultima colonna. */
function SetsTable({ live, highlight }: { live: PublicLiveScore; highlight?: number }) {
  const columns = live.sets.length;
  const rows: { side: Side; team: PublicLiveScore["home"] }[] = [
    { side: "home", team: live.home },
    { side: "away", team: live.away },
  ];
  return (
    <div className="w-[72rem] max-w-full overflow-hidden rounded-[0.9rem] border border-white/12" style={{ background: "rgba(4,13,31,0.6)" }} data-grafica-sets-table>
      <div className="grid items-center border-b border-white/12 px-[1.4rem] py-[0.5rem] text-[1rem] font-extrabold uppercase tracking-[0.14em] text-white/55" style={{ gridTemplateColumns: `1fr repeat(${columns}, 5.2rem) 6.4rem` }}>
        <span>Set</span>
        {live.sets.map((_, i) => (
          <span key={i} className={cn("text-center", highlight === i + 1 && "text-white")}>
            {i + 1}°
          </span>
        ))}
        <span className="text-center" style={{ color: GOLD }}>
          Vinti
        </span>
      </div>
      {rows.map(({ side, team }) => (
        <div key={side} className="grid h-[3.6rem] items-center px-[1.4rem]" style={{ gridTemplateColumns: `1fr repeat(${columns}, 5.2rem) 6.4rem` }} data-grafica-sets-row={side}>
          <span className="flex min-w-0 items-center gap-[0.9rem]">
            <TeamMark team={team} side={side} className="h-[2.6rem] w-[2.6rem]" />
            <span className="grafica-type truncate text-[2rem]">{teamShortName(team.name)}</span>
          </span>
          {live.sets.map((set, i) => {
            const mine = side === "home" ? set.home : set.away;
            const theirs = side === "home" ? set.away : set.home;
            return (
              <span
                key={i}
                className={cn("grafica-type text-center text-[2rem] tabular-nums", mine > theirs ? "text-white" : "text-white/45", highlight === i + 1 && "rounded-[0.4rem] bg-white/10")}
              >
                {mine}
              </span>
            );
          })}
          <span className="grafica-type mx-auto grid h-[3.2rem] w-[4rem] place-items-center rounded-[0.5rem] text-[2.4rem] tabular-nums" style={{ background: GOLD, color: NAVY }} data-grafica-sets-won={side}>
            {team.sets}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATS: { key: keyof PublicSetRecapTeam; label: string }[] = [
  { key: "attack", label: "Attacco" },
  { key: "block", label: "Muri" },
  { key: "ace", label: "Ace" },
  { key: "gifts", label: "Errori avversari" },
  { key: "run", label: "Serie più lunga" },
  { key: "timeouts", label: "Time-out" },
];

/** I numeri di squadra, una barra per parte: chi ha di più è in pieno colore. */
function StatBars({ live, stats, title }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; title: string }) {
  const homeColor = accent(live.home.color);
  const awayColor = accent(live.away.color);
  return (
    <div className="mt-[1.4rem] w-[72rem] max-w-full" data-grafica-recap-stats>
      <p className="pb-[0.5rem] text-center text-[1rem] font-extrabold uppercase tracking-[0.18em] text-white/55">{title}</p>
      {STATS.map(({ key, label }) => {
        const home = stats.home[key];
        const away = stats.away[key];
        const max = Math.max(home, away, 1);
        return (
          <div key={key} className="grid h-[2.4rem] grid-cols-[4rem_1fr_14rem_1fr_4rem] items-center gap-[1rem]" data-grafica-recap-row={key}>
            <span className={cn("grafica-type text-right text-[1.9rem] tabular-nums", away > home && "text-white/50")} data-grafica-recap-value={`${key}-home`}>
              {home}
            </span>
            <span className="flex justify-end">
              <span className="h-[0.8rem] origin-right animate-[grafica-grow_700ms_ease-out_700ms_both] rounded-l-full" style={{ width: `${(home / max) * 100}%`, background: homeColor, opacity: away > home ? 0.45 : 1 }} />
            </span>
            <span className="text-center text-[1.05rem] font-extrabold uppercase tracking-[0.12em] text-white/80">{label}</span>
            <span className="flex justify-start">
              <span className="h-[0.8rem] origin-left animate-[grafica-grow_700ms_ease-out_700ms_both] rounded-r-full" style={{ width: `${(away / max) * 100}%`, background: awayColor, opacity: home > away ? 0.45 : 1 }} />
            </span>
            <span className={cn("grafica-type text-[1.9rem] tabular-nums", home > away && "text-white/50")} data-grafica-recap-value={`${key}-away`}>
              {away}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Le due squadre con il punteggio grande in mezzo (il parziale del set o i set vinti). */
function Scoreline({ live, home, away, marker }: { live: PublicLiveScore; home: number; away: number; marker: Record<string, string> }) {
  return (
    <div className="mb-[1.6rem] grid w-[80rem] max-w-full grid-cols-[1fr_auto_1fr] items-center gap-[2.4rem]" style={{ animation: "grafica-rise 600ms ease-out 550ms both" }}>
      <TeamBlock live={live} side="home" size="md" dimmed={away > home} />
      <span className="grafica-type flex items-center gap-[1.2rem] text-[7.4rem] tabular-nums" data-grafica-recap-score {...marker}>
        <span className={cn(away > home && "text-white/50")}>{home}</span>
        <span className="text-white/35">–</span>
        <span className={cn(home > away && "text-white/50")}>{away}</span>
      </span>
      <TeamBlock live={live} side="away" size="md" dimmed={home > away} />
    </div>
  );
}

export function FullScreen({ card, live, now }: { card: FullCard; live: PublicLiveScore; now: number }) {
  if (card.kind === "intro") {
    return (
      <Frame card={card} now={now}>
        <Intro live={live} />
      </Frame>
    );
  }
  if (card.kind === "lineup") {
    return (
      <Frame card={card} now={now}>
        <Lineup live={live} lineup={card.lineup} />
      </Frame>
    );
  }
  if (card.kind === "set") {
    return (
      <Frame card={card} now={now}>
        <Heading
          eyebrow={competition(live)}
          title={`Fine ${card.n}° set`}
          right={
            card.recap?.minutes != null ? (
              <span className="grafica-type text-[2rem] text-white/70" data-grafica-recap-minutes>
                Durata {card.recap.minutes}′
              </span>
            ) : undefined
          }
        />
        {/* Gli stessi segni di prima, così chi cerca il punteggio del set lo trova. */}
        <Scoreline live={live} home={card.home} away={card.away} marker={{ "data-grafica-set-score": `${card.home}–${card.away}` }} />
        <SetsTable live={live} highlight={card.n} />
        {card.recap && <StatBars live={live} stats={{ home: card.recap.home, away: card.recap.away }} title={`Numeri del ${card.n}° set`} />}
      </Frame>
    );
  }

  const winner: Side | null = live.home.sets === live.away.sets ? null : live.home.sets > live.away.sets ? "home" : "away";
  const winnerTeam = winner === "home" ? live.home : winner === "away" ? live.away : null;
  const stats = card.stats ?? (card.recap ? { home: card.recap.home, away: card.recap.away } : null);
  return (
    <Frame card={card} now={now}>
      <Heading
        eyebrow={competition(live)}
        title="Risultato finale"
        right={
          winnerTeam ? (
            <span className="grafica-type flex items-center gap-[0.8rem] rounded-[0.6rem] px-[1.2rem] py-[0.6rem] text-[2.2rem]" style={{ background: GOLD, color: NAVY }} data-grafica-final-winner>
              <Trophy className="h-[2rem] w-[2rem]" aria-hidden />
              Vince {teamShortName(winnerTeam.name)}
            </span>
          ) : undefined
        }
      />
      <Scoreline live={live} home={live.home.sets} away={live.away.sets} marker={{ "data-grafica-final-score": `${live.home.sets}–${live.away.sets}` }} />
      {live.sets.length > 0 && <SetsTable live={live} />}
      {stats && <StatBars live={live} stats={stats} title={card.stats ? "Numeri della partita" : "Numeri dell'ultimo set"} />}
    </Frame>
  );
}
