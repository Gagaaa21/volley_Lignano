"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/**
 * Le due squadre giocano su lati opposti della rete e si guardano l'una
 * con l'altra: la stessa posizione (es. 2, avanti a destra) cade quindi
 * specchiata rispetto all'asse verticale a seconda di quale squadra la
 * occupa — non un semplice ribaltamento colonna per colonna, ma due
 * ordini davvero distinti. Verificato posizione per posizione su
 * entrambi gli schemi di rotazione reali allegati (uno per squadra):
 * fila vicino alla rete e fila sul fondo campo, dall'alto in basso.
 */
const LEFT_NET_COL: CourtPosition[] = [4, 3, 2];
const LEFT_BASELINE_COL: CourtPosition[] = [5, 6, 1];
const RIGHT_NET_COL: CourtPosition[] = [2, 3, 4];
const RIGHT_BASELINE_COL: CourtPosition[] = [1, 6, 5];

/** Le sei posizioni di una metà campo, in ordine di lettura riga per riga
 * di una griglia 2 colonne × 3 righe: colonna vicina al centro (rete) e
 * colonna verso il bordo esterno (fondo campo). */
function halfCourtOrder(side: "left" | "right"): CourtPosition[] {
  const netCol = side === "left" ? LEFT_NET_COL : RIGHT_NET_COL;
  const baselineCol = side === "left" ? LEFT_BASELINE_COL : RIGHT_BASELINE_COL;
  const order: CourtPosition[] = [];
  for (let row = 0; row < 3; row++) {
    if (side === "left") order.push(baselineCol[row], netCol[row]);
    else order.push(netCol[row], baselineCol[row]);
  }
  return order;
}

/** Metà campo su fondo piatto e continuo (nessuna scacchiera): la colonna
 * "campo lungo" (2fr) è sempre sul bordo esterno, quella vicina alla rete
 * (1fr) sempre adiacente al centro — il confine fra le due, marcato da un
 * sottile filo bianco, è la linea dei 3 metri. */
function HalfCourt({
  side,
  renderCell,
  large,
}: {
  side: "left" | "right";
  renderCell: (position: CourtPosition) => ReactNode;
  large: boolean;
}) {
  const order = halfCourtOrder(side);
  return (
    <div
      className={cn(
        "grid flex-1 grid-rows-3",
        // Ogni metà campo è un quadrato di 9x9m: la fila vicino alla rete
        // occupa i primi 3m (linea d'attacco), il fondo campo i restanti
        // 6m — colonne in proporzione 1:2, non a metà, per restare fedeli
        // alle misure reali di un campo di pallavolo.
        side === "left" ? "grid-cols-[2fr_1fr]" : "grid-cols-[1fr_2fr]",
        large && "h-full",
      )}
    >
      {order.map((position, idx) => (
        <div
          key={position}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 px-2 text-center",
            large ? "py-2 sm:py-3" : "min-h-20 py-4 sm:min-h-24 sm:py-5",
            // Confine fra colonna campo-lungo e colonna rete: la linea dei 3m.
            idx % 2 === 0 && "border-r-2 border-white/80",
          )}
        >
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-full bg-white/25 font-bold text-white shadow-sm ring-1 ring-inset ring-white/30",
              large ? "left-2 top-2 h-6 w-6 text-[11px] sm:h-7 sm:w-7 sm:text-xs" : "left-1.5 top-1.5 h-4 w-4 text-[9px]",
            )}
          >
            {position}
          </span>
          {renderCell(position)}
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
function Net({ large }: { large: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 overflow-hidden rounded-[1px] shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_3px_10px_rgba(9,26,38,0.35)]",
        large ? "inset-y-1.5 w-4 sm:inset-y-2 sm:w-5" : "inset-y-1 w-2.5 sm:w-3",
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
  large = false,
  fitHeight = false,
  className,
}: {
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
          <div ref={labelRef} className={cn("flex items-center justify-between gap-2 px-1", large ? "pb-2 sm:pb-2.5" : "pb-1.5")}>
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
        <div className="relative flex aspect-[2/1] w-full items-stretch">
          <div className="relative flex flex-1 overflow-hidden rounded-md border-2 border-white bg-sand-500 sm:border-[3px]">
            <HalfCourt side="left" renderCell={renderCellA} large={large} />
            <HalfCourt side="right" renderCell={renderCellB} large={large} />
            <Net large={large} />
          </div>
        </div>
      </div>
    </div>
  );
}
