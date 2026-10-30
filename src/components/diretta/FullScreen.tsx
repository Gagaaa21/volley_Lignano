import type { ReactNode } from "react";
import Image from "next/image";
import { format, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { MapPin, PartyPopper, Trophy, Volleyball } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { cn } from "@/lib/cn";
import { FULL_EXIT_MS, type FullCard, type Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLineup, PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { Aurora, Confetti } from "./Effects";
import { AZURE, INK, ORANGE, ROYAL, SKY, SUN, SUNSET } from "./theme";
import { accent, TeamMark } from "./TeamMark";

/**
 * Le grafiche a schermo intero della diretta video, come nelle pause delle partite di Serie A ma allegre: presentazione della
 * partita, formazione di partenza, fine set con i parziali e i numeri del set, risultato finale con i numeri della partita.
 * Il fondo è il cielo di Lignano (azzurro luminoso con qualche macchia di colore che si muove piano, lo stemma in filigrana);
 * entrano ed escono con la transizione (bande gialle, arancio e celesti che attraversano lo schermo, con lo stemma in mezzo);
 * quando un set o la partita li vince Lignano scende una pioggia di coriandoli, una volta sola. Intanto la barra del punteggio
 * si nasconde. Gli effetti restano pochi e misurati: la partita e i numeri devono farsi leggere.
 */

/** Quanto dura la transizione in entrata; in uscita FULL_EXIT_MS. */
export const STINGER_MS = 900;

/** Le bande della transizione, una dopo l'altra, con lo stemma in mezzo. */
function Stinger({ phase }: { phase: "in" | "out" }) {
  const bands = [SUN, ORANGE, SKY];
  return (
    <div key={phase} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-grafica-stinger={phase} aria-hidden>
      {bands.map((color, i) => (
        <span
          key={color}
          className="absolute inset-y-[-10%] left-0 w-[62%]"
          style={{ background: color, animation: `grafica-stinger 780ms cubic-bezier(.55,.05,.35,1) ${i * 70}ms both` }}
        />
      ))}
      {/* Centrato con margini negativi e non con translate: il browser di Streamlabs / OBS può essere vecchio e non conoscerlo. */}
      <span className="absolute left-1/2 top-1/2 -ml-[9rem] -mt-[9rem] h-[18rem] w-[18rem]" style={{ animation: "grafica-full-out 260ms ease-in 560ms both" }}>
        <span className="block h-full w-full" style={{ animation: "grafica-bounce-in 520ms cubic-bezier(.2,.8,.2,1) both" }}>
          <Image src={crest} alt="" unoptimized className="h-full w-full object-contain drop-shadow-[0_0.8rem_2rem_rgba(0,0,0,0.35)]" />
        </span>
      </span>
    </div>
  );
}

function Frame({ card, now, children, party = false }: { card: FullCard; now: number; children: ReactNode; party?: boolean }) {
  const entering = now - card.startedAt < STINGER_MS;
  const leaving = card.until - now < FULL_EXIT_MS;
  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-grafica-full={card.kind} data-grafica-card={card.kind}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ animation: leaving ? "grafica-full-out 380ms ease-in 300ms both" : "grafica-full-in 520ms ease-out 330ms both" }}
      >
        {/* Il cielo di Lignano: azzurro luminoso, qualche macchia di colore che si muove piano e lo stemma in filigrana. */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${ROYAL} 0%, ${AZURE} 45%, ${SKY} 100%)` }} />
        <Aurora />
        <div className="absolute -bottom-[6rem] -right-[5rem] h-[40rem] w-[40rem] opacity-[0.1]">
          <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[0.6rem]" style={{ background: SUNSET }} />
        <div className="absolute inset-x-0 top-0 h-[0.6rem]" style={{ background: SUNSET }} />
        {party && <Confetti seed={(card.startedAt % 97) + 1} />}
        <div className="relative flex h-full flex-col items-center justify-center px-[6rem] text-white">{children}</div>
      </div>
      {(entering || leaving) && <Stinger phase={leaving ? "out" : "in"} />}
    </div>
  );
}

/**
 * Il colore di una squadra sullo schermo intero: per Lignano il giallo dello stemma (il suo blu, sull'azzurro del fondo, non
 * si vedrebbe), per l'avversaria il suo colore.
 */
function tone(live: PublicLiveScore, side: Side): string {
  return side === "home" ? SUN : accent(live.away.color);
}

/** «Under 15 femminile», con «Amichevole» quando lo è. */
function competition(live: PublicLiveScore): string {
  const parts = [live.category ? `Under ${live.category.slice(1)} femminile` : "Pallavolo femminile"];
  if (live.info?.friendly) parts.push("Amichevole");
  return parts.join(" · ");
}

/** Il titolo; `gold` lo colora del giallo dello stemma (la nostra vittoria). */
function Heading({ eyebrow, title, right, gold = false }: { eyebrow: string; title: string; right?: ReactNode; gold?: boolean }) {
  return (
    <div
      className="mb-[2rem] flex w-[96rem] max-w-full items-end justify-between gap-[2rem] border-b-[0.25rem] border-white/35 pb-[0.9rem]"
      style={{ animation: "grafica-rise 500ms ease-out 450ms both" }}
    >
      <div>
        <p className="grafica-type text-[1.6rem] tracking-[0.14em] [text-shadow:0_0.1rem_0.3rem_rgba(11,27,77,0.5)]" style={{ color: SUN }} data-grafica-full-eyebrow>
          {eyebrow}
        </p>
        <h2 className="grafica-type mt-[0.4rem] text-[4.8rem] [text-shadow:0_0.25rem_0.8rem_rgba(11,27,77,0.45)]" style={gold ? { color: SUN } : undefined} data-grafica-full-title>
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

/** L'etichetta colorata in alto a destra (chi ha vinto il set o la partita). */
function Badge({ children, party = false, marker }: { children: ReactNode; party?: boolean; marker: string }) {
  return (
    <span
      className="grafica-type flex items-center gap-[0.8rem] rounded-full px-[1.4rem] py-[0.6rem] text-[2.2rem] shadow-[0_0.5rem_1.4rem_rgba(11,27,77,0.35)]"
      style={{ background: party ? SUNSET : SUN, color: INK, animation: "grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) 700ms both" }}
      {...{ [marker]: "" }}
    >
      {children}
    </span>
  );
}

/** Una squadra in grande: logo e nome (intero nella presentazione, corto nei riepiloghi, dove c'è poco spazio). */
function TeamBlock({ live, side, dimmed = false, size = "lg", delay = 600 }: { live: PublicLiveScore; side: Side; dimmed?: boolean; size?: "lg" | "md"; delay?: number }) {
  const team = side === "home" ? live.home : live.away;
  const large = size === "lg";
  return (
    <div className={cn("flex min-w-0 flex-col items-center text-center", large ? "gap-[1.4rem]" : "gap-[1rem]", dimmed && "opacity-60")} data-grafica-full-team={side}>
      <span style={{ animation: `grafica-bounce-in 650ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}>
        <TeamMark
          team={team}
          side={side}
          className={cn(
            "shadow-[0_1rem_2.4rem_rgba(11,27,77,0.45)] ring-[0.35rem] ring-white/70",
            large ? "h-[13rem] w-[13rem] rounded-[1.8rem] p-[1rem] text-[4rem]" : "h-[6.6rem] w-[6.6rem] rounded-[1.1rem] p-[0.6rem] text-[2.2rem]",
          )}
        />
      </span>
      <span className={cn("grafica-type max-w-full [text-shadow:0_0.2rem_0.6rem_rgba(11,27,77,0.5)]", large ? "text-[3.4rem]" : "truncate text-[2.6rem]")}>
        {large ? team.name : teamShortName(team.name)}
      </span>
      <span className="h-[0.45rem] w-[6rem] rounded-full shadow-[0_0_0.8rem_rgba(255,255,255,0.6)]" style={{ background: tone(live, side) }} />
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
      <Heading eyebrow={competition(live)} title="Oggi in campo!" />
      <div className="grid w-[96rem] max-w-full grid-cols-[1fr_auto_1fr] items-center gap-[3rem]">
        <TeamBlock live={live} side="home" delay={550} />
        <span
          className="grafica-type grid h-[8.5rem] w-[8.5rem] place-items-center rounded-full text-[3.4rem] ring-[0.4rem] ring-white/80"
          style={{ background: SUNSET, color: INK, animation: "grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) 800ms both" }}
        >
          VS
        </span>
        <TeamBlock live={live} side="away" delay={700} />
      </div>
      {(when || live.info?.venue) && (
        <div
          className="mt-[3rem] flex flex-col items-center gap-[0.8rem] rounded-[1.4rem] bg-white/15 px-[2.4rem] py-[1.1rem] ring-[0.12rem] ring-white/35"
          style={{ animation: "grafica-rise 600ms ease-out 900ms both" }}
        >
          {when && (
            <p className="grafica-type text-[2.3rem] tracking-[0.06em]" data-grafica-intro-date>
              {when}
            </p>
          )}
          {live.info?.venue && (
            <p className="flex items-center gap-[0.6rem] text-[1.7rem] font-semibold" data-grafica-intro-venue>
              <MapPin className="h-[1.7rem] w-[1.7rem]" style={{ color: SUN }} aria-hidden />
              {live.info.venue}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** Una maglia con il numero (e il nome sotto, se c'è): il disegno della formazione. */
function Jersey({
  player,
  libero = false,
  serving = false,
  position,
  delay = 0,
}: {
  player: PublicPlayer | null;
  libero?: boolean;
  serving?: boolean;
  position?: number;
  delay?: number;
}) {
  const fill = libero ? SUN : ROYAL;
  return (
    <div
      className="flex w-[13rem] flex-col items-center gap-[0.6rem]"
      style={{ animation: `grafica-bounce-in 560ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}
      data-grafica-lineup-spot={libero ? "libero" : position}
    >
      <div className="relative h-[8.4rem] w-[8.4rem]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_0.5rem_0.9rem_rgba(11,27,77,0.45)]" aria-hidden>
          <path d="M31 6 L43 2 Q50 11 57 2 L69 6 L94 21 L84 41 L73 35 L73 97 L27 97 L27 35 L16 41 L6 21 Z" fill={fill} stroke="#ffffff" strokeWidth="2.5" />
          <path d="M27 88 L73 88" stroke={libero ? ORANGE : SUN} strokeWidth="5" />
        </svg>
        <span className="grafica-type absolute inset-0 grid place-items-center pb-[0.4rem] text-[3.4rem] tabular-nums" style={{ color: libero ? INK : "#ffffff" }} data-grafica-lineup-number>
          {player?.number ?? "–"}
        </span>
        {serving && (
          <Volleyball
            className="absolute -right-[0.5rem] -top-[0.3rem] h-[2.2rem] w-[2.2rem] rounded-full bg-white p-[0.15rem] shadow-[0_0_0.8rem_rgba(255,210,63,0.9)]"
            style={{ color: INK }}
            aria-label="Batte"
          />
        )}
      </div>
      {player?.name && (
        <span className="grafica-type max-w-full truncate rounded-full bg-white px-[0.8rem] py-[0.15rem] text-[1.4rem]" style={{ color: INK }} data-grafica-lineup-name>
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
            <TeamMark team={live.home} side="home" className="h-[4.4rem] w-[4.4rem] ring-[0.25rem] ring-white/70" />
            <span className="grafica-type text-[2.6rem] [text-shadow:0_0.2rem_0.6rem_rgba(11,27,77,0.5)]">{live.home.name}</span>
          </span>
        }
      />
      <div className="flex items-center gap-[4rem]" data-grafica-lineup={lineup.set}>
        {/* Il campo come in palestra: arancio con le righe bianche, la zona libera blu, la rete in alto. */}
        <div className="relative w-[50rem] rounded-[1.2rem] p-[1.2rem] shadow-[0_1.2rem_3rem_rgba(11,27,77,0.45)]" style={{ background: ROYAL, animation: "grafica-rise 600ms ease-out 450ms both" }}>
          <div className="relative overflow-hidden rounded-[0.4rem] border-[0.3rem] border-white px-[1.6rem] pb-[1.8rem] pt-[3rem]" style={{ background: "linear-gradient(180deg, #ffa24c, #ff7a29)" }}>
            <span className="grafica-type absolute inset-x-0 top-0 grid h-[1.7rem] place-items-center bg-white text-[1rem] tracking-[0.35em]" style={{ color: INK }}>
              Rete
            </span>
            <span className="absolute inset-x-0 top-[44%] h-[0.25rem] bg-white" aria-hidden />
            {ROWS.map((row, i) => (
              <div key={i} className={cn("relative flex justify-between", i === 0 ? "mb-[2.4rem]" : "")}>
                {row.map((position, j) => (
                  <Jersey key={position} player={lineup.positions[position - 1] ?? null} serving={position === 1} position={position} delay={650 + (i * 3 + j) * 90} />
                ))}
              </div>
            ))}
          </div>
        </div>
        {lineup.libero && (
          <div className="flex flex-col items-center gap-[1rem]">
            <span className="grafica-type rounded-full px-[1.2rem] py-[0.4rem] text-[1.5rem] tracking-[0.14em] shadow-[0_0.4rem_1rem_rgba(11,27,77,0.35)]" style={{ background: SUNSET, color: INK }}>
              Libero
            </span>
            <Jersey player={lineup.libero} libero delay={1250} />
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
    <div
      className="w-[72rem] max-w-full overflow-hidden rounded-[1rem] bg-white/15 shadow-[0_0.8rem_2rem_rgba(11,27,77,0.3)] ring-[0.12rem] ring-white/40"
      style={{ animation: "grafica-rise 600ms ease-out 750ms both" }}
      data-grafica-sets-table
    >
      <div
        className="grid items-center border-b border-white/25 px-[1.4rem] py-[0.5rem] text-[1rem] font-extrabold uppercase tracking-[0.14em]"
        style={{ gridTemplateColumns: `1fr repeat(${columns}, 5.2rem) 6.4rem`, color: SUN }}
      >
        <span>Set</span>
        {live.sets.map((_, i) => (
          <span key={i} className="text-center">
            {i + 1}°
          </span>
        ))}
        <span className="text-center">Vinti</span>
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
                className={cn("grafica-type text-center text-[2rem] tabular-nums", mine > theirs ? "text-white" : "text-white/55", highlight === i + 1 && "rounded-[0.5rem] bg-white/20")}
              >
                {mine}
              </span>
            );
          })}
          <span
            className="grafica-type mx-auto grid h-[3.2rem] w-[4rem] place-items-center rounded-[0.6rem] text-[2.4rem] tabular-nums shadow-[0_0_1rem_rgba(255,210,63,0.6)]"
            style={{ background: SUN, color: INK }}
            data-grafica-sets-won={side}
          >
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

/** I numeri di squadra, una barra luminosa per parte che cresce: chi ha di più è in pieno colore. */
function StatBars({ live, stats, title }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; title: string }) {
  const homeColor = tone(live, "home");
  const awayColor = tone(live, "away");
  return (
    <div
      className="mt-[1.4rem] w-[72rem] max-w-full rounded-[1rem] bg-white/10 px-[1.4rem] pb-[0.8rem] pt-[0.6rem] ring-[0.12rem] ring-white/30"
      style={{ animation: "grafica-rise 600ms ease-out 900ms both" }}
      data-grafica-recap-stats
    >
      <p className="pb-[0.4rem] text-center text-[1rem] font-extrabold uppercase tracking-[0.18em]" style={{ color: SUN }}>
        {title}
      </p>
      {STATS.map(({ key, label }, i) => {
        const home = stats.home[key];
        const away = stats.away[key];
        const max = Math.max(home, away, 1);
        const delay = `${1000 + i * 90}ms`;
        return (
          <div key={key} className="grid h-[2.4rem] grid-cols-[4rem_1fr_14rem_1fr_4rem] items-center gap-[1rem]" data-grafica-recap-row={key}>
            <span className={cn("grafica-type text-right text-[1.9rem] tabular-nums", away > home && "text-white/60")} data-grafica-recap-value={`${key}-home`}>
              {home}
            </span>
            <span className="flex justify-end">
              <span
                className="h-[0.85rem] origin-right rounded-l-full"
                style={{
                  width: `${(home / max) * 100}%`,
                  background: homeColor,
                  opacity: away > home ? 0.5 : 1,
                  boxShadow: `0 0 0.8rem ${homeColor}`,
                  animation: `grafica-grow 700ms ease-out ${delay} both`,
                }}
              />
            </span>
            <span className="text-center text-[1.05rem] font-extrabold uppercase tracking-[0.12em]">{label}</span>
            <span className="flex justify-start">
              <span
                className="h-[0.85rem] origin-left rounded-r-full"
                style={{
                  width: `${(away / max) * 100}%`,
                  background: awayColor,
                  opacity: home > away ? 0.5 : 1,
                  boxShadow: `0 0 0.8rem ${awayColor}`,
                  animation: `grafica-grow 700ms ease-out ${delay} both`,
                }}
              />
            </span>
            <span className={cn("grafica-type text-[1.9rem] tabular-nums", home > away && "text-white/60")} data-grafica-recap-value={`${key}-away`}>
              {away}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Le due squadre con il punteggio grande e luminoso in mezzo (il parziale del set o i set vinti). */
function Scoreline({ live, home, away, marker }: { live: PublicLiveScore; home: number; away: number; marker: Record<string, string> }) {
  const glow = "[text-shadow:0_0_1.6rem_rgba(255,210,63,0.75),0_0.3rem_0.8rem_rgba(11,27,77,0.5)]";
  return (
    <div className="mb-[1.6rem] grid w-[80rem] max-w-full grid-cols-[1fr_auto_1fr] items-center gap-[2.4rem]">
      <TeamBlock live={live} side="home" size="md" dimmed={away > home} delay={550} />
      <span
        className="grafica-type flex items-center gap-[1.2rem] text-[7.6rem] tabular-nums"
        style={{ animation: "grafica-bounce-in 650ms cubic-bezier(.2,.8,.2,1) 650ms both" }}
        data-grafica-recap-score
        {...marker}
      >
        <span className={cn(away > home ? "text-white/60" : glow)}>{home}</span>
        <span style={{ color: SUN }}>–</span>
        <span className={cn(home > away ? "text-white/60" : glow)}>{away}</span>
      </span>
      <TeamBlock live={live} side="away" size="md" dimmed={home > away} delay={700} />
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
    // Il set lo ha vinto Lignano: festa (coriandoli e l'etichetta al tramonto).
    const ours = card.home > card.away;
    const setWinner = ours ? live.home : live.away;
    const minutes = card.recap?.minutes ?? null;
    return (
      <Frame card={card} now={now} party={ours}>
        <Heading
          eyebrow={competition(live)}
          title={`Fine ${card.n}° set`}
          right={
            <span className="flex flex-col items-end gap-[0.6rem]">
              <Badge party={ours} marker="data-grafica-set-winner">
                {ours && <PartyPopper className="h-[2rem] w-[2rem]" aria-hidden />}
                Set {teamShortName(setWinner.name)}
              </Badge>
              {minutes !== null && (
                <span className="grafica-type text-[1.6rem] text-white/90" data-grafica-recap-minutes>
                  Durata {minutes}′
                </span>
              )}
            </span>
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
  const ours = winner === "home";
  return (
    <Frame card={card} now={now} party={ours}>
      <Heading
        eyebrow={competition(live)}
        title={ours ? "Vittoria!" : "Risultato finale"}
        gold={ours}
        right={
          winnerTeam ? (
            <Badge party={ours} marker="data-grafica-final-winner">
              <Trophy className="h-[2rem] w-[2rem]" aria-hidden />
              Vince {teamShortName(winnerTeam.name)}
            </Badge>
          ) : undefined
        }
      />
      <Scoreline live={live} home={live.home.sets} away={live.away.sets} marker={{ "data-grafica-final-score": `${live.home.sets}–${live.away.sets}` }} />
      {live.sets.length > 0 && <SetsTable live={live} />}
      {stats && <StatBars live={live} stats={stats} title={card.stats ? "Numeri della partita" : "Numeri dell'ultimo set"} />}
    </Frame>
  );
}
