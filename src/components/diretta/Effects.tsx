import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { PARTY, PINK, SKY, VIOLET } from "./theme";

/**
 * Gli effetti della grafica della diretta, pochi e misurati: i coriandoli delle nostre vittorie e le macchie di colore che si
 * muovono piano sul fondo degli schermi interi. Solo CSS (trasformazioni e trasparenza: leggeri anche per OBS), posizioni e
 * tempi «a caso» ma sempre uguali (un numero pseudo-casuale fisso per ogni pezzo), così la pagina disegna sempre la stessa
 * cosa. Tutti decorativi: aria-hidden.
 */

/** Un numero tra 0 e 1 che dipende solo da `seed`: sempre lo stesso a ogni disegno. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Coriandoli che cadono su tutto lo schermo, una volta sola: una festa che passa. */
export function Confetti({ count = 60, seed = 1, className }: { count?: number; seed?: number; className?: string }) {
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
          animation: `grafica-confetti ${2.8 + r(5) * 2.6}s cubic-bezier(.25,.6,.35,1) ${r(6) * 1.4}s 1 both`,
        } as CSSProperties;
        return <span key={i} className="absolute" style={style} />;
      })}
    </div>
  );
}

/** Il celeste chiarissimo delle macchie di luce: il giallo, sopra l'azzurro, diventerebbe verdognolo. */
const GLOW = "#8ff0ff";

/** Quattro macchie di colore (luce, rosa, cielo, viola) che si muovono piano sul fondo: il cielo che cambia, senza distrarre. */
export function Aurora() {
  const blob = (color: string) => `radial-gradient(closest-side, ${color}, transparent)`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -left-[12%] -top-[25%] h-[80%] w-[60%] opacity-45" style={{ background: blob(GLOW), animation: "grafica-drift-a 20s ease-in-out infinite alternate" }} />
      <span className="absolute -bottom-[30%] -right-[10%] h-[85%] w-[62%] opacity-35" style={{ background: blob(PINK), animation: "grafica-drift-b 24s ease-in-out infinite alternate" }} />
      <span className="absolute left-[25%] top-[30%] h-[70%] w-[50%] opacity-35" style={{ background: blob(SKY), animation: "grafica-drift-c 26s ease-in-out infinite alternate" }} />
      <span className="absolute -bottom-[20%] -left-[15%] h-[60%] w-[45%] opacity-25" style={{ background: blob(VIOLET), animation: "grafica-drift-b 30s ease-in-out infinite alternate-reverse" }} />
    </div>
  );
}
