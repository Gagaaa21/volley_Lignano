"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { halfCourtGrid } from "@/lib/liveScore";
import type { CourtPosition, LiveScorePlayers } from "@/lib/types";

/** Metà campo su fondo piatto e continuo (nessuna scacchiera). La
 * disposizione delle posizioni dipende dal formato (vedi halfCourtGrid in
 * src/lib/liveScore.ts): a 6 e a 5 due file, con la fila a rete larga 1/3 e il
 * fondo 2/3 come le misure reali (il confine, un filo bianco, è la linea dei 3
 * metri); a 3 un triangolo, a 4 un rombo, a 2 due giocatrici affiancate. Le
 * due squadre si guardano l'una con l'altra, quindi la stessa posizione cade
 * specchiata a seconda del lato. */
function HalfCourt({
  side,
  players,
  renderCell,
  large,
}: {
  side: "left" | "right";
  players: LiveScorePlayers;
  renderCell: (position: CourtPosition) => ReactNode;
  large: boolean;
}) {
  const { columns, rows, cells } = halfCourtGrid(players, side);
  return (
    <div
      data-court-side={side}
      className={cn("grid flex-1", large && "h-full")}
      style={{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {/* Nel DOM le posizioni vanno in ordine (1, 2, 3…) comunque siano disposte sul campo:
       * con Tab o Invio una formazione si scrive di seguito, dalla battitrice in poi. */}
      {[...cells].sort((a, b) => a.position - b.position).map((cell) => (
        <div
          key={cell.position}
          data-court-position={cell.position}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 px-2 text-center",
            large ? "py-2 sm:py-3" : "min-h-20 py-4 sm:min-h-24 sm:py-5",
            cell.attackLineSide === "right" && "border-r-2 border-white/80",
            cell.attackLineSide === "left" && "border-l-2 border-white/80",
          )}
          style={{ gridColumn: cell.column, gridRow: `${cell.row} / span ${cell.rowSpan}` }}
        >
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-full bg-white/25 font-bold text-white shadow-sm ring-1 ring-inset ring-white/30",
              large ? "left-2 top-2 h-6 w-6 text-[11px] sm:h-7 sm:w-7 sm:text-xs" : "left-1.5 top-1.5 h-4 w-4 text-[9px]",
            )}
          >
            {cell.position}
          </span>
          {renderCell(cell.position)}
        </div>
      ))}
    </div>
  );
}

/** Rete: nastro bianco sopra e sotto la maglia (trama a rombi incrociata),
 * più corposa dei fili di un vero campo per restare leggibile da bordo
 * campo — puramente decorativa e sovrapposta, non fa parte del layout a
 * griglia. Staccata di qualche pixel dal bordo bianco che delimita il
 * campo (non `inset-y-0`): a contatto diretto, il nastro bianco della rete
 * e il bordo del campo si fondevano in un'unica linea, come se la rete si
 * allungasse per tutta la larghezza del campo invece di restare una
 * striscia verticale isolata al centro. */
function Net({ large, className }: { large: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 overflow-hidden rounded-[1px] shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_3px_10px_rgba(9,26,38,0.35)]",
        large ? "inset-y-1.5 w-4 sm:inset-y-2 sm:w-5" : "inset-y-1 w-2.5 sm:w-3",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-sea-950"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px), repeating-linear-gradient(-45deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px)",
        }}
      />
      <div className={cn("absolute inset-x-0 top-0 bg-white", large ? "h-3 sm:h-3.5" : "h-2 sm:h-2.5")} />
      <div className={cn("absolute inset-x-0 bottom-0 bg-white", large ? "h-3 sm:h-3.5" : "h-2 sm:h-2.5")} />
    </div>
  );
}

/** Il nome di una squadra sopra la sua metà campo, solo quando le due metà stanno una sopra l'altra (telefono). */
function StackedLabel({ text, separated = false }: { text: string; separated?: boolean }) {
  return (
    <p
      className={cn(
        "hidden bg-sea-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white max-sm:block",
        separated && "border-t-2 border-white",
      )}
    >
      {text}
    </p>
  );
}

/** Campo intero e continuo in orizzontale, come un vero campo visto
 * dall'alto: fondo piatto a tinta unica (niente scacchiera), un sottile
 * bordo bianco a delimitarlo, la linea dei 3 metri per squadra e una sola
 * rete al centro, più corposa. Il nome delle due squadre sta sul riquadro
 * blu che circonda il campo, non sul campo stesso. Le due metà restano
 * indipendenti nei dati (renderCellA/renderCellB), ma i due grid stanno
 * incollati fianco a fianco (senza spazio tra loro) così da sembrare un
 * unico rettangolo. `large` (schermo intero) ingrandisce celle, etichette
 * e rete per restare leggibile da bordo campo. */
export function DualLiveScoreCourt({
  renderCellA,
  renderCellB,
  labelA,
  labelB,
  players = 6,
  large = false,
  fitHeight = false,
  stackOnPhone = false,
  className,
}: {
  /** Giocatrici per squadra (2–6): quante posizioni ha ogni metà campo. */
  players?: LiveScorePlayers;
  renderCellA: (position: CourtPosition) => ReactNode;
  renderCellB: (position: CourtPosition) => ReactNode;
  /** Nome delle due squadre, mostrato sugli angoli del riquadro che
   * circonda il campo (sinistra = A, destra = B). */
  labelA?: string;
  labelB?: string;
  large?: boolean;
  /** Se true, il campo rispetta anche un limite di ALTEZZA (oltre a quello
   * di larghezza già dato dal genitore), restringendosi leggermente sugli
   * schermi molto bassi (es. un PC 1366x768) invece di sforare in verticale
   * e forzare lo scroll — il tablet testato finora era abbastanza alto da
   * non far mai emergere il problema. Misurato via JS (ResizeObserver)
   * invece che solo CSS: `aspect-ratio` unito a `max-height` blocca
   * l'altezza ma non fa "seguire" la larghezza, quindi da solo
   * deformerebbe il campo invece di rimpicciolirlo in proporzione. Il
   * chiamante deve mettere questo componente dentro un contenitore
   * flessibile con altezza definita (`flex-1 min-h-0`), altrimenti non
   * c'è nessun limite reale da rispettare. */
  fitHeight?: boolean;
  /** Sul telefono le due metà campo stanno una sopra l'altra, ognuna a tutta larghezza e col nome della sua squadra: quando ci si
   * scrivono i nomi, in quattro colonne strette i campi si riducono a una lettera. Da tablet in su il campo è quello di sempre. */
  stackOnPhone?: boolean;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!fitHeight || !el) {
      setMaxWidth(undefined);
      return;
    }
    // clientHeight include il padding verticale del pannello e la riga dei
    // nomi squadra sopra il campo: vanno tolti entrambi per avere l'altezza
    // reale a disposizione del campo, altrimenti lo si restringerebbe anche
    // quando non ce n'è bisogno.
    const update = () => {
      const style = getComputedStyle(el);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const labelHeight = labelRef.current?.offsetHeight ?? 0;
      setMaxWidth(Math.max(0, (el.clientHeight - verticalPadding - labelHeight) * 2));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (labelRef.current) observer.observe(labelRef.current);
    return () => observer.disconnect();
  }, [fitHeight]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-sea-500 shadow-[0_16px_30px_-22px_rgba(12,30,42,0.4)]",
        "p-2.5 sm:p-3",
        className,
      )}
    >
      <div className="mx-auto" style={maxWidth !== undefined ? { maxWidth } : undefined}>
        {(labelA || labelB) && (
          <div ref={labelRef} className={cn("flex items-center justify-between gap-2 px-1", large ? "pb-2 sm:pb-2.5" : "pb-1.5", stackOnPhone && "max-sm:hidden")}>
            <span
              className={cn(
                "truncate font-bold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgba(6,16,26,0.35)]",
                large ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs",
              )}
            >
              {labelA}
            </span>
            <span
              className={cn(
                "truncate text-right font-bold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgba(6,16,26,0.35)]",
                large ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs",
              )}
            >
              {labelB}
            </span>
          </div>
        )}

        {/* Un campo vero è 18x9m: rapporto 2:1, mai deformato — riempie
         * tutta la larghezza disponibile finché l'altezza risultante ci
         * sta, altrimenti (fitHeight) si restringe quel tanto che basta a
         * stare nello spazio verticale reale. */}
        <div className={cn("relative flex w-full items-stretch", stackOnPhone ? "sm:aspect-[2/1]" : "aspect-[2/1]")}>
          <div className={cn("relative flex flex-1 overflow-hidden rounded-md border-2 border-white bg-sand-500 sm:border-[3px]", stackOnPhone && "max-sm:flex-col")}>
            {stackOnPhone && labelA && <StackedLabel text={labelA} />}
            <HalfCourt side="left" players={players} renderCell={renderCellA} large={large} />
            {stackOnPhone && labelB && <StackedLabel text={labelB} separated />}
            <HalfCourt side="right" players={players} renderCell={renderCellB} large={large} />
            <Net large={large} className={stackOnPhone ? "max-sm:hidden" : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
