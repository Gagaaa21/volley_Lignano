import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Athlete, CourtPosition, LineupSlot } from "@/lib/types";

/** Ordine di disegno: fila avanti vicino alla rete (4-3-2), poi fila arretrata (5-6-1). */
export const GRID_ORDER: CourtPosition[] = [4, 3, 2, 5, 6, 1];

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function VolleyCourt({
  slots,
  athletesById,
  onSlotClick,
  onSlotPointerDown,
  interactive = true,
  selectedPosition = null,
  dragHoverPosition = null,
}: {
  slots: LineupSlot[];
  athletesById: Map<string, Athlete>;
  onSlotClick?: (position: CourtPosition) => void;
  onSlotPointerDown?: (event: React.PointerEvent<HTMLButtonElement>, position: CourtPosition) => void;
  interactive?: boolean;
  selectedPosition?: CourtPosition | null;
  dragHoverPosition?: CourtPosition | null;
}) {
  const byPosition = new Map(slots.map((s) => [s.position, s] as const));

  return (
    <div className="rounded-2xl border border-border-subtle bg-sea-800 p-3 sm:p-4">
      {/* Rete: barra piena con "pali" alle estremità. */}
      <div className="relative flex h-3 items-center rounded-full bg-sea-950/70">
        <div className="absolute inset-y-[-3px] left-1 w-1.5 rounded-full bg-sea-950" />
        <div className="absolute inset-y-[-3px] right-1 w-1.5 rounded-full bg-sea-950" />
        <span className="mx-auto rounded-full bg-sea-950 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sea-100">
          Rete
        </span>
      </div>

      {/* Campo: fondo pieno, linee bianche piene tra le colonne e tratteggiata tra le righe.
          Ritratto (più lungo che largo): la lunghezza rete-fondo campo è il lato lungo. */}
      <div className="mt-1.5 aspect-[4/5] overflow-hidden rounded-lg border-2 border-white/90 bg-sand-400 shadow-inner">
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-px bg-white/70">
          {GRID_ORDER.map((position, idx) => {
            const slot = byPosition.get(position);
            const athlete = slot?.athleteId ? athletesById.get(slot.athleteId) : undefined;
            const filled = Boolean(athlete);
            const selected = selectedPosition === position;
            const hovered = dragHoverPosition === position;
            const isFrontRow = idx < 3;
            return (
              <button
                key={position}
                type="button"
                disabled={!interactive}
                data-drop-target={`position-${position}`}
                onClick={() => onSlotClick?.(position)}
                onPointerDown={(event) => onSlotPointerDown?.(event, position)}
                className={cn(
                  "relative flex touch-none flex-col items-center justify-center gap-1 bg-sand-400 px-1 py-2 text-center transition-colors",
                  interactive && "cursor-pointer hover:bg-sand-300",
                  isFrontRow && "border-b-2 border-dashed border-white/80",
                  selected && "ring-2 ring-inset ring-sea-950",
                  hovered && "bg-sand-200 ring-2 ring-inset ring-sea-700",
                )}
              >
                <span className="absolute left-1.5 top-1.5 text-[9px] font-bold text-sea-950/40">
                  {position}
                </span>
                {slot?.isCaptain && (
                  <Crown
                    aria-label="Capitana"
                    className="absolute right-1.5 top-1.5 h-3 w-3 fill-sea-950 text-sea-950"
                  />
                )}
                {filled && athlete ? (
                  <>
                    <span className="line-clamp-2 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold leading-tight text-sea-950 shadow-sm sm:text-xs">
                      {shortName(athlete.fullName)}
                    </span>
                    {slot?.role && (
                      <span className="rounded-full bg-sea-950/85 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {slot.role}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-lg font-bold text-white/60">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-sea-100/60">
        Fondo campo
      </p>
    </div>
  );
}
