import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { format, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, MapPin, PartyPopper, Trophy, Volleyball } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { cn } from "@/lib/cn";
import { FULL_EXIT_MS, type FullCard, type Side } from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLineup, PublicLiveScore, PublicPlayer, PublicSetRecapTeam } from "@/lib/types";
import { Confetti } from "./Effects";
import { AZURE, cutRight, DEEP, DROP, EDGE, GLASS, GLASS_DARK, GOLD, INK, ORANGE, OUT_RED, SUN, SUNSET, tag } from "./theme";
import { TeamMark, tone } from "./TeamMark";

/**
 * Le grafiche a schermo intero della diretta video, come nelle pause delle partite di Serie A: presentazione della partita,
 * formazione di partenza, fine set con i parziali e i numeri del set, risultato finale con i numeri della partita.
 * Il fondo è uno studio TV blu notte: lastre di luce oblique che scorrono piano, righe sottili, un lampo di luce ogni tanto,
 * lo stemma in filigrana e, in basso, la fascia con il club e «Diretta». Titolo con la barra gialla a sinistra, riquadri blu
 * profondi e lucidi con i tagli obliqui, numeri grandi. Entrano ed escono con la transizione (bande blu, gialla e azzurra che
 * attraversano lo schermo, con lo stemma in mezzo); quando un set o la partita li vince Lignano scende una pioggia di
 * coriandoli, una volta sola, e dietro c'è la scritta gigante. Intanto la barra del punteggio si nasconde.
 * Niente translate / rotate / scale di Tailwind: il browser di Streamlabs / OBS può essere un Chrome vecchio (vedi
 * unit/diretta-overlay.spec.ts); per spostare e girare si usa transform scritto a mano.
 */

/** Quanto dura la transizione in entrata; in uscita FULL_EXIT_MS. */
export const STINGER_MS = 900;

/** Le bande della transizione, una dopo l'altra, con lo stemma in mezzo. */
function Stinger({ phase }: { phase: "in" | "out" }) {
  const bands = [DEEP, SUN, AZURE];
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
          <Image src={crest} alt="" unoptimized className="h-full w-full object-contain drop-shadow-[0_0.8rem_2rem_rgba(0,0,0,0.45)]" />
        </span>
      </span>
    </div>
  );
}

/** Lo studio: blu notte, lastre di luce oblique, righe sottili, un lampo ogni tanto, la vignetta e lo stemma in filigrana. */
function Studio({ word }: { word?: string }) {
  const slab = (style: CSSProperties) => <span className="absolute top-[-40%] h-[180%]" style={{ transform: "rotate(24deg)", ...style }} />;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 95% at 22% 12%, #2149bd 0%, #12318e 38%, #0a1d5c 70%, #050d2a 100%)" }} />
      <div className="absolute inset-0" style={{ animation: "grafica-slab 22s ease-in-out infinite alternate" }}>
        {slab({ left: "-6%", width: "34%", background: "linear-gradient(90deg, rgba(47,128,237,0) 0%, rgba(47,128,237,0.32) 100%)" })}
        {slab({ left: "30%", width: "1.2%", background: "rgba(255,210,63,0.22)" })}
        {slab({ left: "33%", width: "0.4%", background: "rgba(255,210,63,0.28)" })}
        {slab({ left: "70%", width: "22%", background: "linear-gradient(90deg, rgba(34,184,240,0.16) 0%, rgba(34,184,240,0) 100%)" })}
      </div>
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(114deg, rgba(255,255,255,0.035) 0 0.08rem, rgba(255,255,255,0) 0.08rem 1.15rem)" }} />
      {/* Il lampo: una riga di luce che attraversa lo schermo ogni tanto. */}
      <span
        className="absolute top-[-30%] h-[160%] w-[7rem]"
        style={{
          left: "-15%",
          background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 100%)",
          animation: "grafica-streak 8s ease-in-out 1.4s infinite",
        }}
      />
      {word && (
        <span
          className="grafica-type absolute left-1/2 top-[55%] whitespace-nowrap text-[25rem] leading-none"
          style={{ color: "transparent", WebkitTextStroke: "0.16rem rgba(255,255,255,0.08)", transform: "translate(-50%, -50%)" }}
          data-grafica-backdrop-word
        >
          {word}
        </span>
      )}
      <div className="absolute -bottom-[7rem] -right-[5rem] h-[40rem] w-[40rem] opacity-[0.07]">
        <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
      </div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(2,6,24,0) 55%, rgba(2,6,24,0.6) 100%)" }} />
    </div>
  );
}

/** La fascia in basso, come in TV: stemma e club a sinistra, «Diretta» con il punto rosso a destra. */
function Footer({ live }: { live: PublicLiveScore }) {
  return (
    <div className="absolute inset-x-0 bottom-[2.6rem] flex h-[3.6rem] items-stretch justify-between" style={{ animation: "grafica-rise 500ms ease-out 650ms both" }}>
      <div className="flex items-center gap-[1rem] pl-[6rem] pr-[3rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: cutRight("1.6rem") }}>
        <Image src={crest} alt="" unoptimized className="h-[2.6rem] w-[2.6rem] object-contain" />
        <span className="grafica-type text-[1.35rem] tracking-[0.12em] text-white">Volley Lignano Sabbiadoro</span>
        <span className="h-[1.4rem] w-[0.12rem] bg-white/25" />
        <span className="grafica-type text-[1.35rem] tracking-[0.12em]" style={{ color: SUN }}>
          {live.category ? `${live.category} femminile` : "Pallavolo femminile"}
        </span>
      </div>
      <div className="flex items-center gap-[0.7rem] pl-[2.6rem] pr-[6rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: tag("1.6rem") }}>
        <span className="h-[0.85rem] w-[0.85rem] rounded-full animate-[grafica-point-pulse_1.4s_ease-in-out_infinite]" style={{ background: OUT_RED, boxShadow: "0 0 0.6rem rgba(255,77,94,0.9)" }} />
        <span className="grafica-type text-[1.35rem] tracking-[0.16em] text-white">Diretta</span>
      </div>
    </div>
  );
}

function Frame({ card, now, live, children, party = false, word }: { card: FullCard; now: number; live: PublicLiveScore; children: ReactNode; party?: boolean; word?: string }) {
  const entering = now - card.startedAt < STINGER_MS;
  const leaving = card.until - now < FULL_EXIT_MS;
  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-grafica-full={card.kind} data-grafica-card={card.kind}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ animation: leaving ? "grafica-full-out 380ms ease-in 300ms both" : "grafica-full-in 520ms ease-out 330ms both" }}
      >
        <Studio word={word} />
        {/* La riga gialla in cima, come le sigle TV. */}
        <div className="absolute inset-x-0 top-0 h-[0.45rem]" style={{ background: GOLD }} />
        {party && <Confetti seed={(card.startedAt % 97) + 1} />}
        <div className="relative flex h-full flex-col items-center justify-center px-[6rem] pb-[5rem] text-white">{children}</div>
        <Footer live={live} />
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

/** Il titolo con la barra gialla a sinistra; `gold` lo colora del giallo dello stemma (la nostra vittoria). Si apre a tendina. */
function Heading({ eyebrow, title, right, gold = false }: { eyebrow: string; title: string; right?: ReactNode; gold?: boolean }) {
  return (
    <div className="mb-[2.2rem] flex w-[100rem] max-w-full items-end justify-between gap-[2rem]">
      <div className="flex items-stretch gap-[1.3rem]" style={{ animation: "grafica-wipe-in 650ms cubic-bezier(.2,.8,.2,1) 450ms both" }}>
        <span className="w-[0.6rem] shrink-0" style={{ background: GOLD, boxShadow: "0 0 1rem rgba(255,210,63,0.5)" }} />
        <div className="py-[0.2rem]">
          <p className="grafica-type text-[1.5rem] tracking-[0.18em]" style={{ color: SUN }} data-grafica-full-eyebrow>
            {eyebrow}
          </p>
          <h2
            className="grafica-type mt-[0.5rem] text-[5.6rem] tracking-[0.01em] [text-shadow:0_0.3rem_1.2rem_rgba(2,6,24,0.55)]"
            style={gold ? { color: SUN } : undefined}
            data-grafica-full-title
          >
            {title}
          </h2>
        </div>
      </div>
      {right}
    </div>
  );
}

/** L'etichetta a parallelogramma in alto a destra (chi ha vinto il set o la partita). */
function Badge({ children, party = false, marker }: { children: ReactNode; party?: boolean; marker: string }) {
  return (
    <span className="mb-[0.6rem] block" style={{ filter: DROP, animation: "grafica-drop 450ms cubic-bezier(.2,.8,.2,1) 800ms both" }}>
      <span
        className="grafica-type flex items-center gap-[0.8rem] px-[2rem] py-[0.75rem] text-[2.2rem] tracking-[0.04em]"
        style={{ background: party ? SUNSET : GOLD, color: INK, clipPath: tag("1rem") }}
        {...{ [marker]: "" }}
      >
        {children}
      </span>
    </span>
  );
}

/** Una squadra nei riepiloghi: logo, nome corto e la striscia del suo colore. Chi ha perso si spegne nel nome e nella striscia. */
function TeamBlock({ live, side, dimmed = false, delay = 600 }: { live: PublicLiveScore; side: Side; dimmed?: boolean; delay?: number }) {
  const team = side === "home" ? live.home : live.away;
  return (
    <div className="flex min-w-0 flex-col items-center gap-[1rem] text-center" data-grafica-full-team={side}>
      <span style={{ animation: `grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}>
        <TeamMark team={team} side={side} className="h-[7.2rem] w-[7.2rem] rounded-[1.1rem] p-[0.6rem] text-[2.4rem] shadow-[0_0.9rem_2.2rem_rgba(2,6,24,0.55)]" />
      </span>
      <span className={cn("grafica-type max-w-full truncate text-[2.7rem] tracking-[0.03em]", dimmed && "text-white/55")}>{teamShortName(team.name)}</span>
      <span className="h-[0.4rem] w-[6rem]" style={{ background: dimmed ? "rgba(255,255,255,0.3)" : tone(side, team.color), clipPath: tag("0.3rem") }} />
    </div>
  );
}

function matchDate(iso: string): string | null {
  const date = parseISO(iso);
  if (!isValid(date)) return null;
  const text = format(date, "EEEE d MMMM · 'ore' HH:mm", { locale: it });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Nella presentazione ogni squadra ha il suo pannello obliquo, con il colore in cima, il logo grande e il nome intero. */
function TeamPanel({ live, side, delay }: { live: PublicLiveScore; side: Side; delay: number }) {
  const team = side === "home" ? live.home : live.away;
  const shape = side === "home" ? "polygon(0 0, 100% 0, calc(100% - 3rem) 100%, 0 100%)" : "polygon(3rem 0, 100% 0, 100% 100%, 0 100%)";
  return (
    <div
      className="relative flex h-[31rem] w-[36rem] flex-col items-center justify-center gap-[1.8rem] px-[3.5rem] text-center"
      style={{ filter: DROP, animation: `grafica-wipe-in 650ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}
      data-grafica-full-team={side}
    >
      <span className="absolute inset-0" style={{ background: GLASS, boxShadow: EDGE, clipPath: shape }} />
      <span className="absolute inset-x-0 top-0 h-[0.55rem]" style={{ background: tone(side, team.color), clipPath: shape }} />
      <span className="relative" style={{ animation: `grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) ${delay + 250}ms both` }}>
        <TeamMark team={team} side={side} className="h-[13rem] w-[13rem] rounded-[1.6rem] p-[1rem] text-[4rem] shadow-[0_1rem_2.6rem_rgba(2,6,24,0.6)]" />
      </span>
      <span className="grafica-type relative max-w-full text-[3.1rem] leading-[1.05] tracking-[0.02em]">{team.name}</span>
    </div>
  );
}

function Intro({ live }: { live: PublicLiveScore }) {
  const when = live.info ? matchDate(live.info.date) : null;
  return (
    <>
      <Heading eyebrow={competition(live)} title="Oggi in campo!" />
      <div className="flex w-[100rem] max-w-full items-center justify-center gap-[1.5rem]">
        <TeamPanel live={live} side="home" delay={500} />
        {/* Il VS in un rombo giallo, come nelle sigle. */}
        <span className="relative z-10 -mx-[3rem] shrink-0" style={{ filter: "drop-shadow(0 0 1.6rem rgba(255,210,63,0.55))", animation: "grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) 850ms both" }}>
          <span className="grafica-type grid h-[9rem] w-[9rem] place-items-center text-[3.4rem]" style={{ background: GOLD, color: INK, clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}>
            VS
          </span>
        </span>
        <TeamPanel live={live} side="away" delay={650} />
      </div>
      {(when || live.info?.venue) && (
        <div className="mt-[2.2rem]" style={{ filter: DROP, animation: "grafica-rise 600ms ease-out 1000ms both" }}>
          <div className="flex items-center gap-[2.4rem] px-[3.2rem] py-[1rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: tag("1.2rem") }}>
            {when && (
              <p className="grafica-type flex items-center gap-[0.7rem] text-[2.1rem] tracking-[0.05em]">
                <CalendarDays className="h-[1.9rem] w-[1.9rem]" style={{ color: SUN }} aria-hidden />
                <span data-grafica-intro-date>{when}</span>
              </p>
            )}
            {live.info?.venue && (
              <p className="flex items-center gap-[0.6rem] text-[1.7rem] font-semibold">
                <MapPin className="h-[1.8rem] w-[1.8rem]" style={{ color: SUN }} aria-hidden />
                <span data-grafica-intro-venue>{live.info.venue}</span>
              </p>
            )}
          </div>
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
  return (
    <div
      className="flex w-[13rem] flex-col items-center gap-[0.5rem]"
      style={{ animation: `grafica-bounce-in 560ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}
      data-grafica-lineup-spot={libero ? "libero" : position}
    >
      <div className="relative h-[8.4rem] w-[8.4rem]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_0.5rem_0.9rem_rgba(2,6,24,0.5)]" aria-hidden>
          <path d="M31 6 L43 2 Q50 11 57 2 L69 6 L94 21 L84 41 L73 35 L73 97 L27 97 L27 35 L16 41 L6 21 Z" fill={libero ? SUN : "#1d43b0"} stroke="#ffffff" strokeWidth="2.5" />
          <path d="M27 88 L73 88" stroke={libero ? ORANGE : SUN} strokeWidth="5" />
          {/* La luce sulla spalla sinistra. */}
          <path d="M31 6 L43 2 Q50 11 57 2 L50 30 L27 35 L16 41 L6 21 Z" fill="#ffffff" opacity="0.12" />
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
        <span className="grafica-type max-w-full truncate px-[1rem] py-[0.25rem] text-[1.35rem] tracking-[0.04em] text-white" style={{ background: GLASS_DARK, clipPath: tag("0.4rem") }} data-grafica-lineup-name>
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
          <span className="mb-[0.4rem] flex items-center gap-[1rem]" style={{ animation: "grafica-rise 500ms ease-out 700ms both" }}>
            <TeamMark team={live.home} side="home" className="h-[4.4rem] w-[4.4rem] rounded-[0.8rem] shadow-[0_0.5rem_1.2rem_rgba(2,6,24,0.5)]" />
            <span className="grafica-type text-[2.6rem] tracking-[0.03em]">{live.home.name}</span>
          </span>
        }
      />
      <div className="flex items-center gap-[4rem]" data-grafica-lineup={lineup.set}>
        {/* Il campo come in palestra, un po' inclinato: arancio con le righe bianche, la rete in alto. */}
        <div style={{ filter: DROP, transform: "perspective(80rem) rotateX(12deg)", transformOrigin: "50% 100%", animation: "grafica-rise 600ms ease-out 450ms both" }}>
          <div className="relative w-[52rem] p-[1rem]" style={{ background: GLASS, boxShadow: EDGE }}>
            <div
              className="relative overflow-hidden border-[0.3rem] border-white px-[1.6rem] pb-[1.8rem] pt-[3.2rem]"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 0.12rem, rgba(255,255,255,0) 0.12rem 3.4rem), linear-gradient(180deg, #ff9d47 0%, #f2741f 100%)",
              }}
            >
              {/* La rete: le maglie e la fascia bianca in cima. */}
              <span
                className="grafica-type absolute inset-x-0 top-0 grid h-[1.9rem] place-items-center text-[1rem] tracking-[0.35em] text-white"
                style={{
                  background:
                    "linear-gradient(180deg, #ffffff 0 0.3rem, rgba(0,0,0,0) 0.3rem), repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 0.08rem, rgba(0,0,0,0) 0.08rem 0.55rem), #0b1b4d",
                }}
              >
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
        </div>
        {lineup.libero && (
          <div className="flex flex-col items-center gap-[1.2rem] px-[2.4rem] pb-[1.6rem] pt-[1.2rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, animation: "grafica-rise 600ms ease-out 900ms both" }}>
            <span className="grafica-type px-[1.4rem] py-[0.45rem] text-[1.5rem] tracking-[0.16em]" style={{ background: GOLD, color: INK, clipPath: tag("0.5rem") }}>
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
  const grid = { gridTemplateColumns: `1fr repeat(${columns}, 5.4rem) 7rem` };
  const rows: { side: Side; team: PublicLiveScore["home"] }[] = [
    { side: "home", team: live.home },
    { side: "away", team: live.away },
  ];
  return (
    <div className="w-[74rem] max-w-full" style={{ filter: DROP, animation: "grafica-rise 600ms ease-out 750ms both" }} data-grafica-sets-table>
      <div style={{ background: GLASS, boxShadow: EDGE, clipPath: cutRight("1.4rem") }}>
        <div className="grid items-center px-[1.6rem] py-[0.55rem] text-[1rem] font-extrabold uppercase tracking-[0.16em] text-white/60" style={{ ...grid, background: GLASS_DARK }}>
          <span style={{ color: SUN }}>Set</span>
          {live.sets.map((_, i) => (
            <span key={i} className="text-center">
              {i + 1}°
            </span>
          ))}
          <span className="text-center">Vinti</span>
        </div>
        {rows.map(({ side, team }, row) => (
          <div key={side} className={cn("grid h-[3.8rem] items-center px-[1.6rem]", row > 0 && "border-t border-white/10")} style={grid} data-grafica-sets-row={side}>
            <span className="flex min-w-0 items-center gap-[0.9rem]">
              <span className="h-[2rem] w-[0.35rem] shrink-0" style={{ background: tone(side, team.color) }} />
              <TeamMark team={team} side={side} className="h-[2.6rem] w-[2.6rem] rounded-[0.45rem]" />
              <span className="grafica-type truncate text-[2.1rem] tracking-[0.03em]">{teamShortName(team.name)}</span>
            </span>
            {live.sets.map((set, i) => {
              const mine = side === "home" ? set.home : set.away;
              const theirs = side === "home" ? set.away : set.home;
              return (
                <span
                  key={i}
                  className={cn("grafica-type mx-[0.3rem] py-[0.3rem] text-center text-[2.1rem] tabular-nums", mine > theirs ? "text-white" : "text-white/45", highlight === i + 1 && "bg-white/12")}
                >
                  {mine}
                </span>
              );
            })}
            <span
              className="grafica-type mx-auto grid h-[3rem] w-[4.6rem] place-items-center text-[2.4rem] tabular-nums"
              style={{ background: GOLD, color: INK, clipPath: tag("0.5rem") }}
              data-grafica-sets-won={side}
            >
              {team.sets}
            </span>
          </div>
        ))}
      </div>
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

/** I numeri di squadra, una barra per parte che cresce dal centro: chi ha di più è in pieno colore, chi ha meno in bianco tenue. */
function StatBars({ live, stats, title }: { live: PublicLiveScore; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; title: string }) {
  const homeColor = tone("home", live.home.color);
  const awayColor = tone("away", live.away.color);
  const fill = (color: string, less: boolean) => (less ? { background: "rgba(255,255,255,0.28)" } : { background: color, boxShadow: `0 0 0.8rem ${color}` });
  return (
    <div className="mt-[1.2rem] w-[74rem] max-w-full" style={{ filter: DROP, animation: "grafica-rise 600ms ease-out 900ms both" }} data-grafica-recap-stats>
      <div className="px-[1.6rem] pb-[0.8rem] pt-[0.6rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: cutRight("1.4rem") }}>
        <p className="pb-[0.4rem] text-center text-[1rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: SUN }}>
          {title}
        </p>
        {STATS.map(({ key, label }, i) => {
          const home = stats.home[key];
          const away = stats.away[key];
          const max = Math.max(home, away, 1);
          const delay = `${1000 + i * 90}ms`;
          return (
            <div key={key} className={cn("grid h-[2.5rem] grid-cols-[4rem_1fr_15rem_1fr_4rem] items-center gap-[1rem]", i > 0 && "border-t border-white/[0.07]")} data-grafica-recap-row={key}>
              <span className={cn("grafica-type text-right text-[1.9rem] tabular-nums", away > home && "text-white/55")} data-grafica-recap-value={`${key}-home`}>
                {home}
              </span>
              <span className="flex justify-end">
                <span
                  className="h-[0.7rem] origin-right"
                  style={{ width: `${(home / max) * 100}%`, ...fill(homeColor, away > home), clipPath: tag("0.35rem"), animation: `grafica-grow 700ms ease-out ${delay} both` }}
                />
              </span>
              <span className="text-center text-[1.05rem] font-extrabold uppercase tracking-[0.12em] text-white/85">{label}</span>
              <span className="flex justify-start">
                <span
                  className="h-[0.7rem] origin-left"
                  style={{ width: `${(away / max) * 100}%`, ...fill(awayColor, home > away), clipPath: tag("0.35rem"), animation: `grafica-grow 700ms ease-out ${delay} both` }}
                />
              </span>
              <span className={cn("grafica-type text-[1.9rem] tabular-nums", home > away && "text-white/55")} data-grafica-recap-value={`${key}-away`}>
                {away}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Le due squadre con il punteggio grande in mezzo (il parziale del set o i set vinti), su una lastra scura. */
function Scoreline({ live, home, away, marker }: { live: PublicLiveScore; home: number; away: number; marker: Record<string, string> }) {
  return (
    <div className="mb-[1.6rem] grid w-[80rem] max-w-full grid-cols-[1fr_auto_1fr] items-center gap-[2.4rem]">
      <TeamBlock live={live} side="home" dimmed={away > home} delay={550} />
      <span className="block" style={{ filter: DROP, animation: "grafica-bounce-in 600ms cubic-bezier(.2,.8,.2,1) 650ms both" }}>
        <span className="flex items-center px-[3.4rem] py-[0.8rem]" style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: tag("1.6rem") }}>
          <span className="grafica-type flex items-center gap-[1.2rem] text-[8.4rem] leading-none tabular-nums" data-grafica-recap-score {...marker}>
            <span className={away > home ? "text-white/45" : "text-white [text-shadow:0_0_1.8rem_rgba(255,255,255,0.35)]"}>{home}</span>
            <span style={{ color: SUN }}>–</span>
            <span className={home > away ? "text-white/45" : "text-white [text-shadow:0_0_1.8rem_rgba(255,255,255,0.35)]"}>{away}</span>
          </span>
        </span>
      </span>
      <TeamBlock live={live} side="away" dimmed={home > away} delay={700} />
    </div>
  );
}

export function FullScreen({ card, live, now }: { card: FullCard; live: PublicLiveScore; now: number }) {
  if (card.kind === "intro") {
    return (
      <Frame card={card} now={now} live={live}>
        <Intro live={live} />
      </Frame>
    );
  }
  if (card.kind === "lineup") {
    return (
      <Frame card={card} now={now} live={live}>
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
      <Frame card={card} now={now} live={live} party={ours} word={`${card.n}° set`}>
        <Heading
          eyebrow={competition(live)}
          title={`Fine ${card.n}° set`}
          right={
            <span className="flex flex-col items-end gap-[0.4rem]">
              <Badge party={ours} marker="data-grafica-set-winner">
                {ours && <PartyPopper className="h-[2rem] w-[2rem]" aria-hidden />}
                Set {teamShortName(setWinner.name)}
              </Badge>
              {minutes !== null && (
                <span className="grafica-type mr-[1rem] text-[1.6rem] tracking-[0.08em] text-white/80" data-grafica-recap-minutes>
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
    <Frame card={card} now={now} live={live} party={ours} word={ours ? "Vittoria" : "Finale"}>
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
