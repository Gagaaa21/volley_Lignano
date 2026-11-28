import { Ribbon } from "lucide-react";
import { NIGHT } from "./theme";

/** Quanto dura la dissolvenza in uscita: chi la mostra la toglie dopo questo tempo. */
export const SILENCE_OUT_MS = 1_200;

/**
 * Il minuto di silenzio nella grafica della diretta (vedi LIVE_SILENCE_KEY in src/lib/diretta/cues.ts): una scritta sobria in
 * basso al centro, blu notte quasi nero e bianco, il nastro del lutto, la dedica se lo staff l'ha scritta. Niente colori vivi,
 * niente movimento: entra e esce piano, in dissolvenza. Intanto la grafica non mostra nient'altro, così la telecamera fa vedere
 * le squadre in campo.
 */
export function SilenceCard({ text, leaving = false }: { text: string | null; leaving?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.5rem] flex justify-center px-[4rem]" style={{ zIndex: 70 }} role="status" data-grafica-silence>
      <div
        className="flex items-center gap-[2.4rem] px-[4rem] py-[2.2rem]"
        style={{
          background: `linear-gradient(180deg, rgba(10,16,34,0.94) 0%, ${NIGHT}f2 100%)`,
          boxShadow: "inset 0 0.12rem 0 rgba(255,255,255,0.55), 0 1rem 3rem rgba(0,0,0,0.45)",
          animation: leaving ? `silence-out ${SILENCE_OUT_MS}ms ease-in both` : "silence-in 1400ms ease-out both",
        }}
      >
        <Ribbon aria-hidden strokeWidth={1.6} style={{ width: "4.4rem", height: "4.4rem", color: "#ffffff", flex: "none" }} />
        <div className="flex flex-col gap-[0.5rem]">
          <span className="grafica-type text-[4.6rem] tracking-[0.08em] text-white" style={{ fontWeight: 700 }}>
            Un minuto di silenzio
          </span>
          {text && (
            <span className="text-[2.4rem] leading-tight text-white/85" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }} data-grafica-silence-text>
              {text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
