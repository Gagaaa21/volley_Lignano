import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { ORANGE, PARTY, PINK, SKY, SUN, VIOLET } from "./theme";

/**
 * Gli effetti speciali della grafica della diretta: coriandoli, aurora colorata, raggi di luce, scintille, l'esplosione sul
 * punto. Solo CSS (trasformazioni e trasparenza: leggeri anche per OBS), posizioni e tempi «a caso» ma sempre uguali (un
 * numero pseudo-casuale fisso per ogni pezzo), così la pagina disegna sempre la stessa cosa. Tutti decorativi: aria-hidden.
 */

/** Un numero tra 0 e 1 che dipende solo da `seed`: sempre lo stesso a ogni disegno. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Coriandoli che cadono su tutto lo schermo: una volta sola (una festa che passa) o in ciclo. */
export function Confetti({ count = 70, loop = false, seed = 1, className }: { count?: number; loop?: boolean; seed?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} data-grafica-confetti>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => noise(seed * 1000 + i * 17 + k);
        const round = r(9) > 0.72;
        const style = {
          left: `${r(1) * 100}%`,
          top: "-8%",
          width: `${0.5 + r(2) * 0.6}rem`,
          height: round ? `${0.5 + r(2) * 0.6}rem` : `${0.9 + r(3) * 0.9}rem`,
          background: PARTY[Math.floor(r(4) * PARTY.length)],
          borderRadius: round ? "999px" : "0.15rem",
          "--drift": `${(r(7) - 0.5) * 18}rem`,
          "--spin": `${(r(8) > 0.5 ? 1 : -1) * (540 + r(6) * 540)}deg`,
          animation: `grafica-confetti ${2.8 + r(5) * 2.6}s cubic-bezier(.25,.6,.35,1) ${r(6) * (loop ? 4 : 1.4)}s ${loop ? "infinite" : "1 both"}`,
        } as CSSProperties;
        return <span key={i} className="absolute" style={style} />;
      })}
    </div>
  );
}

/** Il celeste chiarissimo delle macchie di luce: il giallo, sopra l'azzurro, diventerebbe verdognolo. */
const GLOW = "#8ff0ff";

/** Quattro macchie di colore (luce, rosa, cielo, viola) che si muovono piano sul fondo: il cielo che cambia. */
export function Aurora() {
  const blob = (color: string) => `radial-gradient(closest-side, ${color}, transparent)`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -left-[12%] -top-[25%] h-[80%] w-[60%] opacity-55" style={{ background: blob(GLOW), animation: "grafica-drift-a 13s ease-in-out infinite alternate" }} />
      <span className="absolute -bottom-[30%] -right-[10%] h-[85%] w-[62%] opacity-50" style={{ background: blob(PINK), animation: "grafica-drift-b 15s ease-in-out infinite alternate" }} />
      <span className="absolute left-[25%] top-[30%] h-[70%] w-[50%] opacity-45" style={{ background: blob(SKY), animation: "grafica-drift-c 17s ease-in-out infinite alternate" }} />
      <span className="absolute -bottom-[20%] -left-[15%] h-[60%] w-[45%] opacity-35" style={{ background: blob(VIOLET), animation: "grafica-drift-b 19s ease-in-out infinite alternate-reverse" }} />
    </div>
  );
}

/** Raggi di luce che girano piano dal centro, come un faro da stadio. */
export function Rays({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <span
        className="absolute left-1/2 top-1/2 h-[260%] w-[260%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.10) 0deg 5deg, rgba(255,255,255,0) 5deg 15deg)",
          maskImage: "radial-gradient(closest-side, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(closest-side, black 0%, transparent 70%)",
          animation: "grafica-spin 70s linear infinite",
        }}
      />
    </div>
  );
}

/** Una stellina a quattro punte. */
function Star({ size, color }: { size: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
    </svg>
  );
}

/** Scintille che si accendono e si spengono qua e là. */
export function Sparkles({ count = 18, seed = 3, className }: { count?: number; seed?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => noise(seed * 500 + i * 13 + k);
        return (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${r(1) * 100}%`,
              top: `${r(2) * 100}%`,
              animation: `grafica-twinkle ${1.6 + r(3) * 1.8}s ease-in-out ${r(4) * 2.5}s infinite`,
            }}
          >
            <Star size={`${0.8 + r(5) * 1.4}rem`} color={[SUN, "#ffffff", PINK, SKY][Math.floor(r(6) * 4)]} />
          </span>
        );
      })}
    </div>
  );
}

/** L'esplosione di un punto: un anello che si allarga e una raggiera di pezzetti colorati. Si rimonta a ogni punto (key). */
export function PointBurst({ color }: { color: string }) {
  const bits = 12;
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" data-grafica-burst>
      <span
        className="absolute left-1/2 top-1/2 h-[3.4rem] w-[3.4rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.3rem]"
        style={{ borderColor: SUN, animation: "grafica-ring 700ms ease-out both" }}
      />
      {Array.from({ length: bits }, (_, i) => {
        const angle = (i / bits) * Math.PI * 2;
        const distance = 3.2 + (i % 3) * 0.8;
        const style = {
          background: [SUN, color, ORANGE, "#ffffff"][i % 4],
          "--dx": `${Math.cos(angle) * distance}rem`,
          "--dy": `${Math.sin(angle) * distance}rem`,
          animation: `grafica-burst 750ms cubic-bezier(.2,.8,.3,1) ${i % 2 ? 40 : 0}ms both`,
        } as CSSProperties;
        return <span key={i} className="absolute left-0 top-0 h-[0.55rem] w-[0.55rem] -translate-x-1/2 -translate-y-1/2 rounded-full" style={style} />;
      })}
    </span>
  );
}
