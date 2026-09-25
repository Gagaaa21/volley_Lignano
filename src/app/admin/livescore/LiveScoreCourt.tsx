import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/** Stesso ordine di posizioni del campo usato in Partite → Formazioni
 * (VolleyCourt.tsx): fila avanti 4-3-2 vicino alla rete, fila dietro 5-6-1
 * sul fondo campo. Qui è un guscio puramente visivo: il contenuto di ogni
 * cella (nome digitabile in fase di impostazione, oppure nome/libero/servizio
 * in diretta) lo decide chi lo usa tramite renderCell. */
const GRID_ORDER: CourtPosition[] = [4, 3, 2, 5, 6, 1];

export function LiveScoreCourt({ renderCell }: { renderCell: (position: CourtPosition) => ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-sea-800 p-3 sm:p-4">
      <div className="relative flex h-3 items-center rounded-full bg-sea-950/70">
        <div className="absolute inset-y-[-3px] left-1 w-1.5 rounded-full bg-sea-950" />
        <div className="absolute inset-y-[-3px] right-1 w-1.5 rounded-full bg-sea-950" />
        <span className="mx-auto rounded-full bg-sea-950 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sea-100">
          Rete
        </span>
      </div>

      <div className="mt-1.5 aspect-[4/5] overflow-hidden rounded-lg border-2 border-white/90 bg-sand-400 shadow-inner">
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-px bg-white/70">
          {GRID_ORDER.map((position, idx) => (
            <div
              key={position}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 bg-sand-400 px-1.5 py-2 text-center",
                idx < 3 && "border-b-2 border-dashed border-white/80",
              )}
            >
              <span className="absolute left-1.5 top-1.5 text-[9px] font-bold text-sea-950/40">{position}</span>
              {renderCell(position)}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-sea-100/60">
        Fondo campo
      </p>
    </div>
  );
}
