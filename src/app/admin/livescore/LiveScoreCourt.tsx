import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/** Fila vicino alla rete: 4-3-2. Fila sul fondo campo: 5-6-1 — stesso
 * ordine di Partite → Formazioni (VolleyCourt.tsx), qui però in
 * orizzontale: un unico campo continuo con la rete sottile al centro e il
 * fondo campo di ciascuna squadra sul bordo esterno (sinistro o destro),
 * come un vero campo visto dall'alto durante un allenamento a due squadre. */
const NET_ROW: CourtPosition[] = [4, 3, 2];
const BASELINE_ROW: CourtPosition[] = [5, 6, 1];

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
}: {
  side: "left" | "right";
  renderCell: (position: CourtPosition) => ReactNode;
}) {
  const order = halfCourtOrder(side);
  return (
    <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-px bg-white/70">
      {order.map((position, idx) => (
        <div
          key={position}
          className={cn(
            "relative flex min-h-20 flex-col items-center justify-center gap-1.5 bg-sand-400 px-2 py-4 text-center sm:min-h-24 sm:py-5",
            idx % 2 === 0 && "border-r-2 border-dashed border-white/70",
          )}
        >
          <span className="absolute left-2 top-2 text-[10px] font-bold text-sea-950/40">{position}</span>
          {renderCell(position)}
        </div>
      ))}
    </div>
  );
}

/** Etichetta "Fondo campo" in verticale, alla fine del campo (bordo
 * esterno sinistro o destro) invece che come didascalia orizzontale sotto
 * — come un'etichetta di quota su una pianta. */
function EndLabel({ text }: { text: string }) {
  return (
    <div className="flex w-6 shrink-0 items-center justify-center sm:w-7">
      <span className="origin-center -rotate-90 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-sea-100/55 sm:text-[11px]">
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
 * che occupa spazio nel layout. */
export function DualLiveScoreCourt({
  renderCellA,
  renderCellB,
}: {
  renderCellA: (position: CourtPosition) => ReactNode;
  renderCellB: (position: CourtPosition) => ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-sea-800 p-3 sm:p-4">
      <div className="flex items-stretch">
        <EndLabel text="Fondo campo" />

        <div className="relative flex flex-1 overflow-hidden rounded-lg border-2 border-white/90 shadow-inner">
          <HalfCourt side="left" renderCell={renderCellA} />
          <HalfCourt side="right" renderCell={renderCellB} />

          {/* Rete: una linea sottile al centro con due "pali", puramente
           * decorativa e sovrapposta — non fa parte del layout a griglia. */}
          <div className="pointer-events-none absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 bg-sea-950/85 sm:inset-y-3" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sea-950 shadow-sm" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-sea-950 shadow-sm" />
        </div>

        <EndLabel text="Fondo campo" />
      </div>
    </div>
  );
}
