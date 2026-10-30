"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { INK, SUN } from "./theme";

/** Le misure giuste della «Sorgente browser»: quelle del video (Full HD). */
export const SOURCE_WIDTH = 1920;
export const SOURCE_HEIGHT = 1080;

export type SourceCheck = "ok" | "small" | "ratio";

/**
 * Com'è la sorgente: giusta (1920×1080, o più grande in 16:9), piccola (16:9 ma sotto 1920: OBS la ingrandisce e la grafica
 * si sgrana) o con le proporzioni sbagliate (di solito 800×600, la misura di partenza di OBS e Streamlabs: allargata sul
 * video la grafica si deforma o finisce fuori posto).
 */
export function checkSource(width: number, height: number): SourceCheck {
  if (width <= 0 || height <= 0) return "ratio";
  if (Math.abs(width / height - 16 / 9) > 0.02) return "ratio";
  return width >= SOURCE_WIDTH ? "ok" : "small";
}

/** Dove gira la pagina: dentro Streamlabs / OBS (che aggiungono `window.obsstudio`) o in un browser, e con quale Chrome. */
function browserName(): string {
  const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1];
  const host = "obsstudio" in window ? "Streamlabs / OBS" : "browser";
  return chrome ? `${host}, Chrome ${chrome}` : host;
}

/**
 * La schermata di verifica (`?verifica=1`), da guardare nell'anteprima di Streamlabs / OBS prima della partita: gli angoli
 * verdi devono toccare gli angoli del video, il riquadro tratteggiato è l'area sicura dove stanno le grafiche, e al centro la
 * misura vera della sorgente con quello che c'è da correggere. Sotto, la partita finta mostra le grafiche al loro posto.
 * Niente translate per centrare: il browser dentro Streamlabs / OBS può essere un Chrome vecchio che non lo conosce.
 */
export function VerifyFrame() {
  const [size, setSize] = useState<{ width: number; height: number; dpr: number; browser: string } | null>(null);
  useEffect(() => {
    const read = () => setSize({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1, browser: browserName() });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  if (!size) return null;
  const status = checkSource(size.width, size.height);
  const good = status === "ok";
  const color = good ? "#22c55e" : "#ef4444";

  return (
    <div className="pointer-events-none fixed inset-0 z-50" data-grafica-verify={status}>
      <div className="absolute inset-0 border-[0.35rem]" style={{ borderColor: color }} />
      {/* Gli angoli: devono combaciare con quelli del video. */}
      {(["left-0 top-0 border-l-[0.9rem] border-t-[0.9rem]", "right-0 top-0 border-r-[0.9rem] border-t-[0.9rem]", "bottom-0 left-0 border-b-[0.9rem] border-l-[0.9rem]", "bottom-0 right-0 border-b-[0.9rem] border-r-[0.9rem]"] as const).map(
        (corner) => (
          <span key={corner} className={cn("absolute h-[7rem] w-[7rem]", corner)} style={{ borderColor: color }} />
        ),
      )}
      {/* L'area sicura (5% per lato) e il centro. */}
      <div className="absolute inset-[5%] border-[0.15rem] border-dashed border-white/60" />
      <span className="absolute left-1/2 top-0 h-full w-px bg-white/35" />
      <span className="absolute left-0 top-1/2 h-px w-full bg-white/35" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[64rem] rounded-[1rem] px-[2.4rem] py-[2rem] text-white shadow-2xl" style={{ background: `${INK}ee` }} data-grafica-verify-panel>
          <p className="grafica-type text-[1.4rem] tracking-[0.14em]" style={{ color: SUN }}>
            Verifica della grafica
          </p>
          <p className="grafica-type mt-[0.6rem] text-[4.6rem] tabular-nums" style={{ color }} data-grafica-verify-size>
            {size.width} × {size.height}
          </p>
          <p className="mt-[0.8rem] text-[1.6rem] font-semibold leading-snug">
            {good
              ? "Misura giusta: la grafica è nitida. Ora guarda gli angoli verdi: devono toccare gli angoli del video. Se escono o restano dentro, tasto destro sulla sorgente → Trasforma → Adatta allo schermo. Poi togli «?verifica=1» dall'indirizzo."
              : status === "small"
                ? `La sorgente è più piccola di ${SOURCE_WIDTH}×${SOURCE_HEIGHT}: se il video di Streamlabs è più grande, la grafica viene ingrandita e si sgrana. Nelle proprietà della sorgente scrivi Larghezza ${SOURCE_WIDTH} e Altezza ${SOURCE_HEIGHT}, poi tasto destro sulla sorgente → Trasforma → Adatta allo schermo.`
                : `Proporzioni sbagliate: la grafica si deforma o finisce fuori posto. Nelle proprietà della sorgente scrivi Larghezza ${SOURCE_WIDTH} e Altezza ${SOURCE_HEIGHT}, poi tasto destro sulla sorgente → Trasforma → Adatta allo schermo.`}
          </p>
          <p className="mt-[0.6rem] text-[1.2rem] text-white/60" data-grafica-verify-browser>
            Pagina aperta in: {size.browser}
            {size.dpr !== 1 && ` · scala dello schermo ${size.dpr}× (in Streamlabs / OBS di solito è 1×)`}
          </p>
        </div>
      </div>
    </div>
  );
}
