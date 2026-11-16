import type { CSSProperties } from "react";
import { CUE_DURATION_MS, CUE_META, type CueKind } from "@/lib/diretta/cues";
import { DROP, EDGE, GLASS, GOLD, IN_GREEN, INK, PINK, SKY, SUN, tag, VIOLET } from "./theme";

/**
 * La scritta della pulsantiera nella grafica della diretta (vedi src/lib/diretta/cues.ts): al centro dello schermo un lampo e
 * un'onda d'urto, una fascia blu che entra di taglio, la scritta enorme che «sbatte» e trema, le scintille che schizzano via; poi
 * esce da sola (CUE_DURATION_MS). Ogni tasto ha il suo colore. Solo la scritta e la squadra, mai una giocatrice. Solo CSS
 * (trasformazioni e trasparenza): leggera anche in OBS. Decorativa per gli effetti, la scritta si legge (role status).
 */

const ACCENT: Record<CueKind, string> = {
  monsterBlock: SKY,
  ace: SUN,
  attack: PINK,
  dig: IN_GREEN,
  rally: IN_GREEN,
  cheer: VIOLET,
};

/** Quando inizia l'uscita (ms dall'entrata): l'ultimo mezzo secondo. */
const OUT_AT = CUE_DURATION_MS - 500;
const SPARKS = 16;

export function CueBurst({ kind }: { kind: CueKind }) {
  const meta = CUE_META[kind];
  const accent = ACCENT[kind];
  // Il Monster block ha la scritta su due righe come in SuperLega: «MONSTER» sopra, «BLOCK» enorme sotto.
  const twoLines = kind === "monsterBlock";
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
      {/* L'onda d'urto. */}
      <span
        aria-hidden
        className="absolute h-[40rem] w-[40rem] rounded-full"
        style={{ border: `0.8rem solid ${accent}`, animation: "cue-ring 900ms cubic-bezier(.2,.7,.2,1) 180ms both" }}
      />
      <div className="relative" style={{ animation: "cue-shake 380ms linear 420ms 2 both" }}>
        {/* La fascia blu di taglio, dietro la scritta. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 w-[96rem] overflow-hidden"
          // transform scritto a mano: le classi translate di Tailwind il Chrome vecchio di Streamlabs / OBS non le conosce.
          style={{ filter: DROP, height: twoLines ? "19rem" : "15.5rem", transform: "translate(-50%, -50%)" }}
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
              className="grafica-type mb-[0.6rem] px-[1.6rem] py-[0.35rem] text-[2.1rem] tracking-[0.12em]"
              style={{ background: GOLD, color: INK, clipPath: tag("0.8rem"), animation: "grafica-drop 380ms cubic-bezier(.2,.8,.2,1) 380ms both" }}
            >
              {meta.kicker}
            </span>
          )}
          {twoLines && (
            <span
              className="grafica-type text-[5.2rem] tracking-[0.18em]"
              style={{ color: SUN, textShadow: "0 0.3rem 0 rgba(3,10,40,0.6)", animation: "cue-slam 460ms cubic-bezier(.2,.8,.2,1) 120ms both" }}
            >
              {meta.kicker}
            </span>
          )}
          <span
            className="grafica-type whitespace-nowrap leading-[0.9]"
            style={
              {
                fontSize: twoLines ? "11rem" : meta.title.length > 12 ? "7.6rem" : "9.5rem",
                color: "#ffffff",
                textShadow: `0 0.45rem 0 ${INK}, 0 0 2.6rem ${accent}aa`,
                WebkitTextStroke: `0.18rem ${INK}`,
                animation: "cue-slam 520ms cubic-bezier(.2,.8,.2,1) 220ms both",
              } as CSSProperties
            }
          >
            {meta.title}
          </span>
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
