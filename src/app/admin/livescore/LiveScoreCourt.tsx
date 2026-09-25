import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/** Fila vicino alla rete: 2-3-4 dall'alto in basso. Fila sul fondo campo:
 * 1-6-5 dall'alto in basso — verificato sullo schema di rotazione reale
 * (posizione 1 e 2 sulla stessa fiancata di destra, 4 e 5 su quella di
 * sinistra, 3 e 6 al centro): un unico campo continuo in orizzontale con
 * la rete sottile al centro e il fondo campo di ciascuna squadra sul
 * bordo esterno (sinistro o destro), come un vero campo visto dall'alto
 * durante un allenamento a due squadre. */
const NET_ROW: CourtPosition[] = [2, 3, 4];
const BASELINE_ROW: CourtPosition[] = [1, 6, 5];

/** Le sei posizioni di una metà campo, in ordine di lettura riga per riga
 * di una griglia 2 colonne × 3 righe: colonna vicina al centro (rete) e
 * colonna verso il bordo esterno (fondo campo), specchiate a seconda del
 * lato. */
function halfCourtOrder(side: "left" | "right"): CourtPosition[] {
  const outerColumn = side === "left" ? BASELINE_ROW : NET_ROW;
  const innerColumn = side === "left" ? NET_ROW : BASELINE_ROW;
  const order: CourtPosition[] = [];
  for (let row = 0; row < 3; row++) {
    order.push(outerColumn[row], innerColumn[row]);
  }
  return order;
}

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
    <div className={cn("grid flex-1 grid-cols-2 grid-rows-3 gap-px bg-white/70", large && "h-full")}>
      {order.map((position, idx) => (
        <div
          key={position}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-sand-300 to-sand-400 px-2 text-center transition-[min-height] duration-200",
            large ? "py-2 sm:py-3" : "min-h-20 py-4 sm:min-h-24 sm:py-5",
            idx % 2 === 0 && "border-r-2 border-dashed border-white/70",
          )}
        >
          <span
            className={cn(
              "absolute left-2 top-2 font-bold text-sea-950/40",
              large ? "text-xs sm:text-sm" : "text-[10px]",
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

/** Etichetta "Fondo campo" in verticale, alla fine del campo (bordo
 * esterno sinistro o destro) invece che come didascalia orizzontale sotto
 * — come un'etichetta di quota su una pianta. */
function EndLabel({ text, large }: { text: string; large: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center", large ? "h-full w-8 sm:w-10" : "w-6 sm:w-7")}>
      <span
        className={cn(
          "origin-center -rotate-90 whitespace-nowrap font-bold uppercase tracking-[0.18em] text-sea-100/55",
          large ? "text-xs sm:text-sm" : "text-[10px] sm:text-[11px]",
        )}
      >
        {text}
      </span>
    </div>
  );
}

/** Campo intero e continuo in orizzontale, come un vero campo visto
 * dall'alto: una sola rete sottile al centro (non un divisorio largo), il
 * fondo campo di ciascuna squadra sul bordo esterno, etichettato in
 * verticale alla fine del campo. Le due metà restano indipendenti nei dati
 * (renderCellA/renderCellB), ma i due grid stanno incollati fianco a
 * fianco (senza spazio tra loro) così da sembrare un unico rettangolo —
 * la rete è solo una linea sottile disegnata sopra, non un terzo elemento
 * che occupa spazio nel layout. `large` (schermo intero) ingrandisce
 * celle, etichette e rete per restare leggibile da bordo campo. */
export function DualLiveScoreCourt({
  renderCellA,
  renderCellB,
  large = false,
}: {
  renderCellA: (position: CourtPosition) => ReactNode;
  renderCellB: (position: CourtPosition) => ReactNode;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-gradient-to-b from-sea-800 to-sea-950 shadow-xl shadow-sea-950/25",
        large ? "flex min-h-0 flex-1 flex-col p-4 sm:p-6" : "p-3 sm:p-4",
      )}
    >
      <div className={cn("flex items-stretch", large && "min-h-0 flex-1")}>
        <EndLabel text="Fondo campo" large={large} />

        <div
          className={cn(
            "relative flex flex-1 overflow-hidden rounded-lg border-2 border-white/90 shadow-inner",
            large && "min-h-0",
          )}
        >
          <HalfCourt side="left" renderCell={renderCellA} large={large} />
          <HalfCourt side="right" renderCell={renderCellB} large={large} />

          {/* Rete: una linea sottile al centro con due "pali", puramente
           * decorativa e sovrapposta — non fa parte del layout a griglia. */}
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 -translate-x-1/2 bg-sea-950/85",
              large ? "inset-y-3 w-1 sm:inset-y-4" : "inset-y-2 w-0.5 sm:inset-y-3",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sea-950 shadow-sm",
              large ? "h-5 w-5" : "h-3.5 w-3.5",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full bg-sea-950 shadow-sm",
              large ? "h-5 w-5" : "h-3.5 w-3.5",
            )}
          />
        </div>

        <EndLabel text="Fondo campo" large={large} />
      </div>
    </div>
  );
}
