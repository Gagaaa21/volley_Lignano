import type { CSSProperties, ReactNode } from "react";
import { CUE_DURATION_MS, CUE_META, type CueKind } from "@/lib/diretta/cues";
import { Confetti } from "./Effects";
import { DROP, EDGE, GLASS, GOLD, IN_GREEN, INK, ORANGE, PINK, SKY, SUN, SUNSET, tag, VIOLET } from "./theme";

/**
 * La scritta della pulsantiera nella grafica della diretta (vedi src/lib/diretta/cues.ts), da cartone animato: al centro un
 * lampo, i raggi che girano e la fascia blu che entra di taglio; le lettere saltano dentro una per una, grosse e con lo spessore
 * 3D, e poi ballano finché la scritta è in onda. Ogni tasto ha la sua scena:
 * - Monster block: la bocca del mostro che morde due volte (come il grido) e gli occhi arrabbiati; la palla rimbalza via;
 * - Ace: la palla infuocata che attraversa lo schermo e una stella che gira dietro la scritta;
 * - Super attacco: la palla che schiaccia, l'esplosione da fumetto e i fulmini;
 * - Salvataggio: la palla che cade, viene salvata all'ultimo e vola via, con il fumetto «WOW!»;
 * - Che scambio!: la palla che va avanti e indietro e i «CLAP!» del pubblico;
 * - Forza Lignano: le bandiere che sventolano, i coriandoli e le lettere che fanno la ola.
 * Esce da sola (CUE_DURATION_MS). Solo la scritta e la squadra, mai una giocatrice. Solo CSS e SVG (trasformazioni e
 * trasparenza, le transform scritte a mano: il Chrome vecchio di Streamlabs / OBS non conosce le classi translate / rotate /
 * scale di Tailwind). Decorativa per gli effetti, la scritta si legge (role status).
 */

const ACCENT: Record<CueKind, string> = {
  monsterBlock: SKY,
  ace: SUN,
  attack: PINK,
  dig: IN_GREEN,
  rally: ORANGE,
  cheer: VIOLET,
};

/** Il colore dello spessore delle lettere (la parte «di lato» del 3D), più scuro dell'accento. */
const DEPTH: Record<CueKind, string> = {
  monsterBlock: "#0a5f93",
  ace: "#b97800",
  attack: "#a3164c",
  dig: "#12864a",
  rally: "#b4501a",
  cheer: "#4c2aa8",
};

/** Quando inizia l'uscita (ms dall'entrata): l'ultimo mezzo secondo. */
const OUT_AT = CUE_DURATION_MS - 500;
const SPARKS = 16;
/** Quando le lettere cominciano a entrare, dopo il lampo. */
const LETTERS_AT = 260;

/** Lo spessore 3D delle lettere: tanti strati del colore scuro uno dietro l'altro, poi il blu notte e l'ombra. */
function extrude(depth: string): string {
  const layers = Array.from({ length: 7 }, (_, i) => `${(0.07 * (i + 1)).toFixed(2)}rem ${(0.09 * (i + 1)).toFixed(2)}rem 0 ${depth}`);
  return [...layers, `0.56rem 0.74rem 0 ${INK}`, "0 1.2rem 2.4rem rgba(3,10,40,0.55)"].join(", ");
}

/** Una stella a punte, come clip-path. */
function starPath(points: number, inner: number): string {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner * 50 : 50;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`;
  });
  return `polygon(${corners.join(", ")})`;
}

/** L'esplosione da fumetto: punte irregolari (sempre le stesse). */
function burstPath(points: number): string {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? 31 + ((i * 7) % 5) : 46 + ((i * 5) % 4);
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`;
  });
  return `polygon(${corners.join(", ")})`;
}

const STAR = starPath(12, 0.62);
const TWINKLE = starPath(4, 0.38);
const BURST = burstPath(14);

/** Un punto della scena, spostato dal centro della scritta (in rem): quello che contiene ci si centra sopra. */
function At({ x = 0, y = 0, w, h, style, children }: { x?: number; y?: number; w: number; h: number; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span
      aria-hidden
      className="absolute block"
      style={{ left: `calc(50% + ${x - w / 2}rem)`, top: `calc(50% + ${y - h / 2}rem)`, width: `${w}rem`, height: `${h}rem`, ...style }}
    >
      {children}
    </span>
  );
}

/** La scritta a lettere che saltano dentro una per una e poi ballano (sfasate: insieme fanno la ola). */
function PopText({ text, size, color, depth, delay, step }: { text: string; size: string; color: string; depth: string; delay: number; step: number }) {
  return (
    <span className="grafica-type inline-block whitespace-nowrap leading-[0.9]" style={{ fontSize: size }}>
      {Array.from(text).map((letter, i) => {
        const at = delay + i * step;
        const style = {
          color,
          textShadow: extrude(depth),
          WebkitTextStroke: `0.16rem ${INK}`,
          "--tilt": `${i % 2 ? 3.5 : -3.5}deg`,
          animation: `cue-letter 560ms cubic-bezier(.2,.8,.2,1) ${at}ms both, cue-wiggle 620ms ease-in-out ${at + 560}ms infinite alternate`,
        } as CSSProperties;
        return (
          <span key={i} className="inline-block" style={style}>
            {letter === " " ? " " : letter}
          </span>
        );
      })}
    </span>
  );
}

/** Il pallone (bianco, giallo e azzurro), che gira su sé stesso. */
function Ball({ spin }: { spin: string }) {
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" style={{ animation: `cue-spin ${spin} linear infinite` }}>
      <circle cx="50" cy="50" r="46" fill="#ffffff" />
      <path d="M50 4 A46 46 0 0 1 96 50 C72 47 56 30 50 4Z" fill={SUN} />
      <path d="M4 50 C28 53 44 70 50 96 A46 46 0 0 1 4 50Z" fill={SKY} />
      <path d="M50 4 C56 30 72 47 96 50 M4 50 C28 53 44 70 50 96 M15 21 C42 33 62 60 80 86" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="46" fill="none" stroke={INK} strokeWidth="5" />
      <ellipse cx="34" cy="28" rx="12" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-30 34 28)" />
    </svg>
  );
}

/**
 * Una palla lanciata con la sua scia di fuoco: corre lungo una retta inclinata di `angle` gradi (0 = da sinistra a destra),
 * da `from` a `to` rem dal punto (x, y). Con `hit` alla fine si schianta (si gonfia e sparisce).
 */
function Comet({ x = 0, y = 0, angle, from, to, delay, dur, tail, hit = false }: { x?: number; y?: number; angle: number; from: number; to: number; delay: number; dur: number; tail: string; hit?: boolean }) {
  const size = 6.5;
  return (
    <At x={x} y={y} w={0} h={0} style={{ transform: `rotate(${angle}deg)` }}>
      <span
        className="absolute left-0 top-0 block"
        style={{ "--from": `${from}rem`, "--to": `${to}rem`, animation: `${hit ? "cue-comet-hit" : "cue-comet"} ${dur}ms cubic-bezier(.35,.1,.55,1) ${delay}ms both` } as CSSProperties}
      >
        <span
          className="absolute block rounded-full"
          style={{
            right: 0,
            top: `${-size * 0.34}rem`,
            width: "26rem",
            height: `${size * 0.68}rem`,
            background: `linear-gradient(270deg, ${SUN} 0%, ${tail} 22%, ${tail}88 55%, rgba(255,255,255,0) 100%)`,
            transformOrigin: "100% 50%",
            animation: "cue-flicker 110ms linear infinite alternate",
          }}
        />
        <span className="absolute block" style={{ left: `${-size / 2}rem`, top: `${-size / 2}rem`, width: `${size}rem`, height: `${size}rem` }}>
          <Ball spin="0.35s" />
        </span>
      </span>
    </At>
  );
}

/** Stelline che brillano qua e là. */
function Twinkles({ spots, color }: { spots: [x: number, y: number, at: number][]; color: string }) {
  return (
    <>
      {spots.map(([x, y, at], i) => (
        <At key={i} x={x} y={y} w={3.2} h={3.2} style={{ background: i % 2 ? "#ffffff" : color, clipPath: TWINKLE, animation: `cue-twinkle 900ms ease-in-out ${at}ms infinite both` }} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Monster block

const TEETH = 12;

/** Una mascella: gengiva viola e denti bianchi, due zanne più lunghe. Quella sotto è la stessa capovolta. */
function Jaw() {
  const left = 40;
  const width = (620 - left) / TEETH;
  const teeth = Array.from({ length: TEETH }, (_, i) => {
    const x0 = left + i * width;
    const tip = i === 2 || i === TEETH - 3 ? 82 : i % 2 ? 60 : 68;
    return `M${(x0 + 3).toFixed(1)} 22 L${(x0 + width / 2).toFixed(1)} ${tip} L${(x0 + width - 3).toFixed(1)} 22 Z`;
  }).join(" ");
  return (
    <svg viewBox="0 0 660 84" className="block h-full w-full">
      <rect x="10" y="2" width="640" height="26" rx="13" fill="#5e1d82" stroke={INK} strokeWidth="4" />
      <path d={teeth} fill="#ffffff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

/** Gli occhi del mostro: arrabbiati, guardano a destra e a sinistra e sbattono le palpebre. */
function Eyes({ y }: { y: number }) {
  return (
    <At y={y} w={24} h={9} style={{ animation: "cue-pop 420ms cubic-bezier(.2,.9,.3,1.3) 60ms both" }}>
      {([-1, 1] as const).map((side) => (
        <span key={side} className="absolute block" style={{ left: side < 0 ? "1.5rem" : "14.5rem", top: "2.2rem", width: "8rem", height: "6.4rem" }}>
          <span
            className="absolute left-0 top-0 block h-full w-full overflow-hidden rounded-full"
            style={{ background: "radial-gradient(circle at 40% 35%, #ffffff 0%, #ffe9a8 100%)", border: `0.4rem solid ${INK}`, boxShadow: `0 0 1.6rem ${SUN}aa`, animation: "cue-blink 1700ms ease-in-out 900ms infinite" }}
          >
            <span
              className="absolute block rounded-full"
              style={{ left: "2.3rem", top: "1.6rem", width: "2.6rem", height: "2.6rem", background: INK, boxShadow: "inset 0.5rem -0.4rem 0 #ffffff", animation: "cue-look 640ms ease-in-out infinite alternate" }}
            />
          </span>
          {/* Il sopracciglio, storto verso il naso: arrabbiato. */}
          <span
            className="absolute block rounded-full"
            style={{ left: "-0.4rem", top: "-1.9rem", width: "8.8rem", height: "1.3rem", background: INK, transform: `rotate(${side < 0 ? 16 : -16}deg)` }}
          />
        </span>
      ))}
    </At>
  );
}

function MonsterFront({ band }: { band: number }) {
  const half = band / 2;
  return (
    <>
      <At y={-half - 2.4} w={66} h={8.4} style={{ animation: "cue-chomp-top 2000ms cubic-bezier(.3,.7,.3,1) 100ms both" }}>
        <Jaw />
      </At>
      <At y={half + 2.4} w={66} h={8.4} style={{ animation: "cue-chomp-bottom 2000ms cubic-bezier(.3,.7,.3,1) 100ms both" }}>
        <span className="block h-full w-full" style={{ transform: "scaleY(-1)" }}>
          <Jaw />
        </span>
      </At>
      <Eyes y={-half - 11.6} />
      {/* La palla arriva da destra, sbatte contro il muro e torna indietro. */}
      <At y={-1} w={7} h={7} style={{ animation: "cue-ball-block 1050ms linear 200ms both" }}>
        <Ball spin="0.4s" />
      </At>
    </>
  );
}

// ---------------------------------------------------------------- Ace

function AceBack() {
  return (
    <At w={38} h={38} style={{ animation: "cue-pop 650ms cubic-bezier(.2,.9,.3,1.25) 150ms both" }}>
      <span
        className="block h-full w-full"
        style={{ background: `radial-gradient(circle, #fff6c2 0%, ${SUN} 40%, ${ORANGE} 100%)`, clipPath: STAR, animation: "cue-spin 14s linear infinite" }}
      />
    </At>
  );
}

function AceFront({ band }: { band: number }) {
  return (
    <>
      <Comet y={-band / 2 - 4.6} angle={0} from={-80} to={110} delay={40} dur={1300} tail={ORANGE} />
      <Twinkles color={SUN} spots={[[-34, -12, 700], [36, -10, 900], [-30, 11, 1100], [32, 12, 800], [0, 14, 1300]]} />
    </>
  );
}

// ---------------------------------------------------------------- Super attacco

/** Un fulmine giallo che lampeggia. */
function Bolt({ x, y, flip, delay }: { x: number; y: number; flip: boolean; delay: number }) {
  return (
    <At x={x} y={y} w={9} h={15} style={{ animation: `cue-bolt 900ms linear ${delay}ms 3 both` }}>
      <svg viewBox="0 0 60 100" className="block h-full w-full" style={flip ? { transform: "scaleX(-1)" } : undefined}>
        <polygon points="34,2 6,56 28,56 14,98 58,36 36,36 52,2" fill={SUN} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <polygon points="34,10 16,50 32,50 24,78" fill="#ffffff" opacity="0.6" />
      </svg>
    </At>
  );
}

function AttackBack() {
  return (
    <At w={60} h={34} style={{ animation: "cue-pop 420ms cubic-bezier(.2,.9,.3,1.4) 330ms both" }}>
      <span className="block h-full w-full" style={{ animation: "cue-throb 360ms ease-in-out 760ms infinite alternate" }}>
        <span className="absolute left-0 top-0 block h-full w-full" style={{ background: INK, clipPath: BURST }} />
        <span className="absolute block" style={{ left: "1.6rem", top: "1rem", right: "1.6rem", bottom: "1rem", background: SUNSET, clipPath: BURST }} />
      </span>
    </At>
  );
}

function AttackFront() {
  return (
    <>
      {/* La schiacciata: dall'alto a destra giù sulla scritta, e lì esplode. */}
      <Comet x={6} y={1} angle={135} from={-72} to={0} delay={0} dur={380} tail={PINK} hit />
      <Bolt x={-40} y={-3} flip={false} delay={380} />
      <Bolt x={40} y={-3} flip delay={470} />
    </>
  );
}

// ---------------------------------------------------------------- Salvataggio

function DigFront() {
  return (
    <>
      <At x={26} y={0} w={7} h={7} style={{ animation: "cue-dig-ball 1500ms linear 0ms both" }}>
        <Ball spin="0.45s" />
      </At>
      <At x={-31} y={-13.5} w={20} h={12} style={{ animation: "cue-pop 480ms cubic-bezier(.2,.9,.3,1.35) 600ms both" }}>
        <span className="block h-full w-full" style={{ animation: "cue-wobble 700ms ease-in-out 1080ms infinite alternate" }}>
          <svg viewBox="0 0 200 120" className="absolute left-0 top-0 block h-full w-full">
            <path
              d="M100 6 C160 6 194 28 194 54 C194 82 160 100 116 100 L156 118 L88 98 C38 94 6 78 6 54 C6 28 40 6 100 6Z"
              fill="#ffffff"
              stroke={INK}
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="grafica-type absolute left-0 top-0 flex h-[10rem] w-full items-center justify-center text-[5.2rem]"
            style={{ color: IN_GREEN, WebkitTextStroke: `0.14rem ${INK}`, textShadow: `0.25rem 0.3rem 0 ${INK}` } as CSSProperties}
          >
            WOW!
          </span>
        </span>
      </At>
      <Twinkles color={IN_GREEN} spots={[[22, -9, 650], [31, -6, 800], [27, 9, 950]]} />
    </>
  );
}

// ---------------------------------------------------------------- Che scambio!

const CLAPS: [x: number, y: number, tilt: number, at: number][] = [
  [-36, 11, -10, 450],
  [-12, 12.6, 6, 700],
  [12, 11, -6, 950],
  [36, 12.6, 9, 1200],
];

function RallyFront({ band }: { band: number }) {
  return (
    <>
      {/* La palla va e viene sopra la fascia, ad arco. */}
      <At y={-band / 2 - 3.8} w={0} h={0} style={{ animation: "cue-pingpong-x 640ms ease-in-out 200ms infinite alternate both" }}>
        <span className="absolute block" style={{ left: "-3rem", top: "-3rem", width: "6rem", height: "6rem", animation: "cue-pingpong-y 640ms linear 200ms infinite both" }}>
          <Ball spin="0.5s" />
        </span>
      </At>
      {CLAPS.map(([x, y, tilt, at], i) => (
        <At key={i} x={x} y={y} w={13} h={5} style={{ animation: `cue-pop 380ms cubic-bezier(.2,.9,.3,1.4) ${at}ms both` }}>
          <span
            className="grafica-type flex h-full w-full items-center justify-center text-[3rem]"
            style={{ background: GOLD, color: INK, clipPath: tag("1rem"), transform: `rotate(${tilt}deg)` }}
          >
            CLAP!
          </span>
        </At>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Forza Lignano

/** Una bandiera (azzurro, bianco e giallo) che sale da sotto e sventola. */
function Flag({ side, delay }: { side: -1 | 1; delay: number }) {
  return (
    <At x={side * 45} y={0} w={0} h={0} style={{ animation: `cue-rise 520ms cubic-bezier(.2,.9,.3,1.2) ${delay}ms both` }}>
      <span
        className="absolute block"
        style={{
          left: "-0.4rem",
          top: "-13rem",
          width: "0.8rem",
          height: "26rem",
          transformOrigin: "50% 100%",
          animation: `cue-flag-swing 900ms ease-in-out ${delay}ms infinite ${side < 0 ? "alternate" : "alternate-reverse"}`,
        }}
      >
        <span className="absolute left-0 top-0 block h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, #ffffff, #b9c6ea)", boxShadow: `0 0 0 0.15rem ${INK}` }} />
        <span
          className="absolute block"
          style={{
            top: "0.4rem",
            ...(side < 0 ? { left: "0.8rem" } : { right: "0.8rem" }),
            width: "12rem",
            height: "8.4rem",
            background: `linear-gradient(180deg, ${SKY} 0%, ${SKY} 33%, #ffffff 33%, #ffffff 66%, ${SUN} 66%, ${SUN} 100%)`,
            clipPath: side < 0 ? "polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%, 0 100%, 18% 50%)",
            transformOrigin: side < 0 ? "0 50%" : "100% 50%",
            animation: "cue-flag 520ms ease-in-out infinite alternate",
          }}
        />
      </span>
    </At>
  );
}

function CheerFront() {
  return (
    <>
      <Flag side={-1} delay={150} />
      <Flag side={1} delay={250} />
    </>
  );
}

// ----------------------------------------------------------------

export function CueBurst({ kind }: { kind: CueKind }) {
  const meta = CUE_META[kind];
  const accent = ACCENT[kind];
  const depth = DEPTH[kind];
  // Il Monster block ha la scritta su due righe come in SuperLega: «MONSTER» sopra, «BLOCK» enorme sotto.
  const twoLines = kind === "monsterBlock";
  const short = meta.title.length <= 5;
  const band = twoLines ? 19 : short ? 18 : 15.5;
  const titleSize = twoLines ? "11.5rem" : short ? "13rem" : meta.title.length > 12 ? "7.6rem" : "9.5rem";
  const step = Math.min(70, Math.round(560 / meta.title.length));
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ animation: `cue-out 500ms ease-in ${OUT_AT}ms both` }}
      role="status"
      aria-label={twoLines ? `${meta.kicker} ${meta.title}` : meta.title}
      data-grafica-cue={kind}
    >
      {/* Il lampo, appena colorato. */}
      <span aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}66 0%, transparent 60%)`, animation: "cue-flash 900ms ease-out both" }} />
      {/* I raggi che girano. */}
      <span aria-hidden className="absolute h-[84rem] w-[84rem]" style={{ animation: "cue-rays-in 650ms cubic-bezier(.2,.8,.2,1) both" }}>
        <span
          className="absolute left-0 top-0 block h-full w-full rounded-full"
          style={{
            background: `repeating-conic-gradient(from 0deg, ${accent}55 0deg 6deg, rgba(255,255,255,0) 6deg 15deg)`,
            WebkitMaskImage: "radial-gradient(circle, #000 14%, transparent 66%)",
            maskImage: "radial-gradient(circle, #000 14%, transparent 66%)",
            animation: "cue-spin 10s linear infinite",
          }}
        />
      </span>
      {/* L'onda d'urto. */}
      <span
        aria-hidden
        className="absolute h-[40rem] w-[40rem] rounded-full"
        style={{ border: `0.8rem solid ${accent}`, animation: "cue-ring 900ms cubic-bezier(.2,.7,.2,1) 180ms both" }}
      />
      {kind === "cheer" && <Confetti count={46} seed={7} />}

      <div className="relative" style={{ animation: twoLines ? "cue-shake 300ms linear 620ms, cue-shake 300ms linear 1540ms" : "cue-shake 380ms linear 420ms 2" }}>
        <div className="relative" style={{ transform: "rotate(-2deg)" }}>
          {kind === "ace" && <AceBack />}
          {kind === "attack" && <AttackBack />}

          {/* La fascia blu di taglio, dietro la scritta. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 w-[96rem] overflow-hidden"
            // transform scritto a mano: le classi translate di Tailwind il Chrome vecchio di Streamlabs / OBS non le conosce.
            style={{ filter: DROP, height: `${band}rem`, transform: "translate(-50%, -50%)" }}
          >
            <div className="h-full w-full" style={{ background: GLASS, boxShadow: EDGE, animation: "cue-band-in 420ms cubic-bezier(.2,.8,.2,1) both" }}>
              <span className="absolute inset-y-0 left-0 w-[1.2rem]" style={{ background: accent }} />
              <span className="absolute inset-y-0 right-0 w-[1.2rem]" style={{ background: accent }} />
              <span className="absolute inset-y-0 left-0 w-[14rem] animate-[grafica-sheen_1.8s_ease-in-out_400ms_both] bg-gradient-to-r from-white/0 via-white/30 to-white/0" />
            </div>
          </div>

          <div className="relative flex flex-col items-center px-[4rem] text-center">
            {meta.kicker && !twoLines && (
              <span
                className="grafica-type mb-[0.8rem] px-[1.6rem] py-[0.35rem] text-[2.3rem] tracking-[0.12em]"
                style={{ background: GOLD, color: INK, clipPath: tag("0.8rem"), transformOrigin: "50% 0", animation: "cue-swing 700ms ease-out 200ms both" }}
              >
                {meta.kicker}
              </span>
            )}
            {twoLines && meta.kicker && <PopText text={meta.kicker} size="5.6rem" color={SUN} depth="#b97800" delay={120} step={40} />}
            <PopText text={meta.title} size={titleSize} color="#ffffff" depth={depth} delay={twoLines ? 420 : LETTERS_AT} step={twoLines ? 80 : step} />
          </div>

          {kind === "monsterBlock" && <MonsterFront band={band} />}
          {kind === "ace" && <AceFront band={band} />}
          {kind === "attack" && <AttackFront />}
          {kind === "dig" && <DigFront />}
          {kind === "rally" && <RallyFront band={band} />}
          {kind === "cheer" && <CheerFront />}
        </div>

        {/* Le scintille, dal centro verso fuori, dopo l'impatto. */}
        <span aria-hidden className="absolute left-1/2 top-1/2">
          {Array.from({ length: SPARKS }, (_, i) => {
            const style = {
              "--angle": `${(360 / SPARKS) * i + (i % 2 ? 7 : -5)}deg`,
              "--reach": `${34 + ((i * 37) % 22)}rem`,
              width: i % 3 === 0 ? "2.6rem" : "1.6rem",
              height: "0.45rem",
              background: i % 2 ? accent : SUN,
              transformOrigin: "0 50%",
              animation: `cue-spark ${700 + ((i * 53) % 300)}ms cubic-bezier(.15,.7,.3,1) 470ms both`,
            } as CSSProperties;
            return <span key={i} className="absolute left-0 top-0 rounded-full" style={style} />;
          })}
        </span>
      </div>
    </div>
  );
}
