import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/** Fila vicino alla rete: 4-3-2. Fila sul fondo campo: 5-6-1 — stesso
 * ordine di Partite → Formazioni (VolleyCourt.tsx), qui però in
 * orizzontale: le due metà campo stanno fianco a fianco con la rete al
 * centro, come un allenamento con due squadre sullo stesso campo. */
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
            "relative flex flex-col items-center justify-center gap-1 bg-sand-400 px-1.5 py-2.5 text-center",
            idx % 2 === 0 && "border-r-2 border-dashed border-white/80",
          )}
        >
          <span className="absolute left-1.5 top-1.5 text-[9px] font-bold text-sea-950/40">{position}</span>
          {renderCell(position)}
        </div>
      ))}
    </div>
  );
}

/** Campo intero in orizzontale, rete al centro: una metà per squadra, così
 * chi allena può seguire le due rotazioni fianco a fianco durante uno
 * scrimmage interno. Guscio puramente visivo: il contenuto di ogni cella
 * (nome digitabile in fase di impostazione, oppure nome/libero/servizio in
 * diretta) lo decide chi lo usa tramite renderCellA/renderCellB. */
export function DualLiveScoreCourt({
  renderCellA,
  renderCellB,
}: {
  renderCellA: (position: CourtPosition) => ReactNode;
  renderCellB: (position: CourtPosition) => ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-sea-800 p-3 sm:p-4">
      <div className="flex overflow-hidden rounded-lg border-2 border-white/90 shadow-inner">
        <HalfCourt side="left" renderCell={renderCellA} />

        <div className="relative flex w-3 shrink-0 items-center justify-center bg-sea-950/80 sm:w-4">
          <span className="rotate-90 whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.16em] text-sea-100/90">
            Rete
          </span>
        </div>

        <HalfCourt side="right" renderCell={renderCellB} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 text-center text-[10px] font-medium uppercase tracking-wide text-sea-100/60">
        <span>Fondo campo</span>
        <span>Fondo campo</span>
      </div>
    </div>
  );
}
