import type { ComponentType, CSSProperties } from "react";
import Image from "next/image";
import { BrickWall, Flame, Megaphone, Repeat, Shield, Zap } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { CUE_DURATION_MS, CUE_META, type CueKind } from "@/lib/diretta/cues";
import { DROP, EDGE, GLASS, GOLD, IN_GREEN, INK, NIGHT, ORANGE, PINK, SKY, SUN, tag, VIOLET } from "./theme";

/**
 * La scritta della pulsantiera nella grafica della diretta (vedi src/lib/diretta/cues.ts), come uno stinger di regia in TV e
 * con i materiali del resto della grafica: la fascia blu profondo che si apre di taglio da sinistra, a sinistra il riquadro del
 * colore del tasto con la sua icona, sopra la scritta l'etichetta gialla, la scritta grande che sale da sotto, un lampo di luce,
 * sotto la linguetta con lo stemma; poi si chiude verso destra. Il Monster block su una riga sola («MONSTER» giallo, «BLOCK»
 * bianco) e con due colpi sui due «MONSTER BLOCK» del grido. Esce da sola (CUE_DURATION_MS). Solo la scritta e la squadra, mai
 * una giocatrice. Sopra a tutto, anche alle grafiche a schermo intero. Transform scritte a mano: il Chrome vecchio di
 * Streamlabs / OBS non conosce le classi translate / rotate / scale di Tailwind. La scritta si legge (role status).
 */

const ACCENT: Record<CueKind, string> = {
  monsterBlock: SKY,
  ace: SUN,
  attack: PINK,
  dig: IN_GREEN,
  rally: ORANGE,
  cheer: VIOLET,
};

const ICON: Record<CueKind, ComponentType<{ style?: CSSProperties; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  monsterBlock: BrickWall,
  ace: Zap,
  attack: Flame,
  dig: Shield,
  rally: Repeat,
  cheer: Megaphone,
};

/** L'etichetta gialla sopra la scritta: per il Monster block (che ha «MONSTER» nella scritta) dice che cos'è. */
const KICKER: Partial<Record<CueKind, string>> = { monsterBlock: "Punto a muro" };

/** Quando comincia la chiusura (ms dall'entrata). */
const OUT_AT = CUE_DURATION_MS - 450;
/** I due colpi del Monster block, sui due «MONSTER BLOCK» del grido. */
const IMPACTS = [620, 1540];

export function CueBurst({ kind }: { kind: CueKind }) {
  const meta = CUE_META[kind];
  const accent = ACCENT[kind];
  const Icon = ICON[kind];
  const monster = kind === "monsterBlock";
  const kicker = KICKER[kind] ?? meta.kicker;
  const label = monster ? `${meta.kicker} ${meta.title}` : meta.title;
  const titleSize = label.length > 12 ? "8.6rem" : "9.6rem";
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      // Sopra a tutto: barra, sottopancia e grafiche a schermo intero.
      style={{ zIndex: 60 }}
      role="status"
      aria-label={label}
      data-grafica-cue={kind}
    >
      {/* Un velo leggero al centro, perché la scritta stacchi sull'immagine della palestra. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(2,8,30,0.34) 0%, rgba(2,8,30,0) 100%)", animation: `cue-dim ${CUE_DURATION_MS}ms linear both` }}
      />
      <div className="relative" style={{ animation: monster ? IMPACTS.map((at) => `cue-impact 380ms ease-out ${at}ms`).join(", ") : undefined }}>
        {/* L'ombra fuori, la tendina dentro: con l'ombra sullo stesso elemento della tendina si vedrebbe il bordo del riquadro. */}
        <div style={{ filter: DROP }}>
        {/* La fascia: si apre da sinistra, si chiude verso destra. */}
        <div
          style={{
            animation: `cue-plate-in 520ms cubic-bezier(.7,0,.2,1) both, cue-plate-out 450ms cubic-bezier(.6,0,.4,1) ${OUT_AT}ms forwards`,
          }}
        >
          <div className="relative flex h-[15.5rem] items-stretch overflow-hidden" style={{ background: GLASS, boxShadow: EDGE, clipPath: tag("2.6rem") }}>
            {/* Il filo giallo in alto, come la barra del punteggio. */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-[0.4rem]" style={{ background: GOLD }} />
            {/* Il riquadro del colore del tasto, con la sua icona. */}
            <span
              aria-hidden
              className="relative flex w-[17rem] shrink-0 items-center justify-center"
              style={{ background: `linear-gradient(160deg, ${accent} 0%, ${accent}cc 100%)`, clipPath: "polygon(0 0, 100% 0, calc(100% - 2.6rem) 100%, 0 100%)" }}
            >
              <Icon aria-hidden strokeWidth={2.2} style={{ width: "6.6rem", height: "6.6rem", color: INK, marginLeft: "1.4rem" }} />
            </span>
            <div className="flex flex-col justify-center gap-[0.6rem] pl-[2.6rem] pr-[6rem]">
              {kicker && (
                <span
                  className="grafica-type self-start px-[1.4rem] py-[0.3rem] text-[2.3rem] tracking-[0.14em]"
                  style={{ background: GOLD, color: INK, clipPath: tag("0.7rem"), animation: "cue-tag-in 380ms cubic-bezier(.2,.8,.2,1) 300ms both" }}
                >
                  {kicker}
                </span>
              )}
              {/* La scritta sale da sotto, dentro la sua riga. */}
              <span className="block overflow-hidden" style={{ paddingBlock: "0.2rem" }}>
                <span
                  className="grafica-type block whitespace-nowrap leading-[0.92]"
                  style={{ fontSize: titleSize, color: "#ffffff", textShadow: "0 0.4rem 1.6rem rgba(2,8,30,0.45)", animation: "cue-text-rise 480ms cubic-bezier(.2,.8,.2,1) 220ms both" }}
                >
                  {monster ? (
                    <>
                      <span style={{ color: SUN }}>{meta.kicker}</span> {meta.title}
                    </>
                  ) : (
                    meta.title
                  )}
                </span>
              </span>
            </div>
            {/* Il lampo di luce, una volta sola. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[16rem]"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 100%)", animation: "cue-sweep 1100ms ease-in-out 520ms both" }}
            />
          </div>
          {/* La linguetta con lo stemma, sotto la fascia. */}
          <div
            className="ml-[3.2rem] flex w-max items-center gap-[1rem] px-[1.6rem] py-[0.7rem]"
            style={{ background: NIGHT, clipPath: "polygon(0 0, 100% 0, calc(100% - 1rem) 100%, 1rem 100%)", animation: "cue-tag-in 380ms cubic-bezier(.2,.8,.2,1) 420ms both" }}
          >
            <Image src={crest} alt="" unoptimized className="h-[2.4rem] w-[2.4rem] object-contain" />
            <span className="grafica-type text-[1.7rem] tracking-[0.18em] text-white">Volley Lignano</span>
            <span aria-hidden className="h-[0.5rem] w-[3rem]" style={{ background: accent }} />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
