import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Athlete, CourtPosition, SetLineup } from "@/lib/types";

/** Ordine di disegno: fila avanti vicino alla rete (4-3-2), poi fila arretrata (5-6-1). */
export const GRID_ORDER: CourtPosition[] = [4, 3, 2, 5, 6, 1];

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function VolleyCourt({
  slots,
  athletesById,
  onSlotClick,
  interactive = true,
  selectedPosition = null,
}: {
  slots: SetLineup;
  athletesById: Map<string, Athlete>;
  onSlotClick?: (position: CourtPosition) => void;
  interactive?: boolean;
  selectedPosition?: CourtPosition | null;
}) {
  const byPosition = new Map(slots.map((s) => [s.position, s] as const));

  return (
    <div className="rounded-2xl border border-border-subtle bg-sea-50 p-3 sm:p-4">
      <div className="flex items-center justify-center">
        <span className="rounded-full bg-sea-700/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sea-700">
          Rete
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t-2 border-dashed border-sea-700/25 pt-2.5">
        {GRID_ORDER.map((position) => {
          const slot = byPosition.get(position);
          const athlete = slot?.athleteId ? athletesById.get(slot.athleteId) : undefined;
          const filled = Boolean(athlete);
          const selected = selectedPosition === position;
          return (
            <button
              key={position}
              type="button"
              disabled={!interactive}
              onClick={() => onSlotClick?.(position)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-center transition-colors",
                filled
                  ? "border-sea-700 bg-white shadow-sm shadow-sea-950/10"
                  : "border-dashed border-sea-700/25 bg-white/60",
                interactive && "cursor-pointer hover:border-sea-700/60",
                selected && "ring-2 ring-sand-400 ring-offset-1",
              )}
            >
              <span className="absolute left-1.5 top-1.5 text-[9px] font-bold text-foreground/30">
                {position}
              </span>
              {slot?.isCaptain && (
                <Crown
                  aria-label="Capitana"
                  className="absolute right-1.5 top-1.5 h-3 w-3 fill-sand-400 text-sand-500"
                />
              )}
              {filled && athlete ? (
                <>
                  <span className="line-clamp-2 px-0.5 text-[11px] font-bold leading-tight text-foreground sm:text-xs">
                    {shortName(athlete.fullName)}
                  </span>
                  {slot?.role && (
                    <span className="rounded-full bg-[var(--color-training-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-training-strong)]">
                      {slot.role}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-bold text-foreground/20">+</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-foreground/35">
        Fondo campo
      </p>
    </div>
  );
}
