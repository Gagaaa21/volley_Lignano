"use client";

import type { DragEvent } from "react";
import { Armchair, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { seatLayout } from "@/lib/trips/rules";
import type { TripVehicle } from "@/lib/trips/types";
import { initials } from "@/components/ui/Avatar";
import { useBoard } from "./boardTypes";

/** Un volante, per il posto di chi guida. */
function SteeringWheel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M3.3 10.5c2.6.4 5 .9 6.5 1.5M20.7 10.5c-2.6.4-5 .9-6.5 1.5M12 14.2V21" />
    </svg>
  );
}

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

const SEAT = "relative flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-center transition";

/**
 * Il mezzo visto dall'alto con i suoi posti: davanti chi guida (si tocca per cambiarlo), poi un tile per ogni posto per le
 * atlete. Un posto occupato mostra l'atleta (si tocca per toglierla o spostarla, o si trascina su un altro mezzo); il primo posto
 * libero è un «+» per metterne una; gli altri liberi sono solo la sagoma. I posti si riempiono nell'ordine in cui si mettono le atlete.
 */
export function SeatMap({
  vehicle,
  selectedId,
  addOpen,
  onSeat,
  onAdd,
  onDriver,
}: {
  vehicle: TripVehicle;
  selectedId: string | null;
  addOpen: boolean;
  onSeat(athleteId: string): void;
  onAdd(): void;
  onDriver(): void;
}) {
  const board = useBoard();
  const layout = seatLayout(vehicle.kind, vehicle.seats);
  const columns = vehicle.kind === "pullman" ? 4 : 3;
  const canAdd = board.unplaced.length > 0;

  const seat = (index: number) => {
    const athleteId = vehicle.athleteIds[index];
    if (athleteId) {
      const name = board.nameOf(athleteId);
      const notCalledUp = !board.calledUp.has(athleteId);
      const selected = selectedId === athleteId;
      // Un div con ruolo di pulsante e non un <button>: Firefox non lascia trascinare i pulsanti.
      return (
        <div
          key={`seat-${index}`}
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event: DragEvent<HTMLDivElement>) => {
            event.dataTransfer.setData("text/plain", athleteId);
            event.dataTransfer.effectAllowed = "move";
            board.startDrag(athleteId);
          }}
          onDragEnd={board.endDrag}
          onClick={() => onSeat(athleteId)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSeat(athleteId);
          }}
          aria-label={`Posto ${index + 1}: ${name}${notCalledUp ? " (non più convocata)" : ""}`}
          aria-pressed={selected}
          title={name}
          data-seat={index}
          data-seat-state="taken"
          data-seat-athlete={athleteId}
          className={cn(
            SEAT,
            "cursor-grab border bg-card shadow-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-pop active:cursor-grabbing",
            selected ? "border-primary ring-2 ring-primary/40" : "border-border",
            board.dragging === athleteId && "opacity-40",
          )}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft font-display text-[12px] font-bold text-primary ring-1 ring-inset ring-primary/15">
            {initials(name)}
          </span>
          <span className="w-full truncate text-[11px] font-semibold leading-tight text-foreground">{firstName(name)}</span>
          {notCalledUp && (
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-warning-soft text-warning ring-2 ring-surface-muted">
              <TriangleAlert className="h-3 w-3" aria-hidden />
            </span>
          )}
        </div>
      );
    }
    if (index === vehicle.athleteIds.length) {
      return (
        <button
          key={`seat-${index}`}
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          aria-label={canAdd ? `Posto ${index + 1}: libero, tocca per metterci un'atleta` : `Posto ${index + 1}: libero, nessuna atleta senza passaggio`}
          aria-expanded={addOpen}
          data-seat={index}
          data-seat-state="add"
          className={cn(
            SEAT,
            "border-2 border-dashed",
            canAdd
              ? "border-primary/50 bg-primary-soft/60 text-primary hover:border-primary hover:bg-primary-soft"
              : "cursor-not-allowed border-border-strong bg-transparent text-muted-foreground/50",
            addOpen && canAdd && "border-primary ring-2 ring-primary/30",
          )}
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="text-[10px] font-semibold leading-none">{canAdd ? "Aggiungi" : "Libero"}</span>
        </button>
      );
    }
    return (
      <div
        key={`seat-${index}`}
        data-seat={index}
        data-seat-state="free"
        aria-label={`Posto ${index + 1}: libero`}
        role="img"
        className={cn(SEAT, "border border-dashed border-border-strong text-muted-foreground/45")}
      >
        <Armchair className="h-5 w-5" aria-hidden />
        <span className="text-[10px] font-semibold leading-none">{index + 1}</span>
      </div>
    );
  };

  const spacer = (key: string) => <div key={key} aria-hidden className="aspect-square w-full" />;

  // Davanti: chi guida a sinistra e i posti accanto a destra; in mezzo, se serve, lo spazio vuoto.
  const frontCells = [
    <button
      key="driver"
      type="button"
      onClick={onDriver}
      aria-label={`Chi guida: ${vehicle.driverName}. Tocca per cambiarlo`}
      data-seat-driver
      className={cn(SEAT, "border border-border-strong bg-muted text-foreground/80 hover:border-primary/60 hover:bg-primary-soft/60")}
    >
      <SteeringWheel className="h-6 w-6" />
      <span className="w-full truncate text-[11px] font-semibold leading-tight">{firstName(vehicle.driverName)}</span>
    </button>,
    ...Array.from({ length: Math.max(0, columns - 1 - layout.front.length) }, (_, i) => spacer(`front-gap-${i}`)),
    ...layout.front.map(seat),
  ];

  // Il pullman ha il corridoio dopo i primi due posti di ogni fila.
  const track = (size: number) =>
    layout.aisleAfter !== null && size > layout.aisleAfter
      ? `repeat(${layout.aisleAfter}, minmax(0, 1fr)) 0.75rem repeat(${columns - layout.aisleAfter}, minmax(0, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <div className="relative mx-auto w-full max-w-[19rem] select-none" data-seat-map={vehicle.id}>
      {/* Le ruote, per far sembrare un mezzo vero. */}
      {[
        "-left-1.5 top-[16%]",
        "-right-1.5 top-[16%]",
        "-left-1.5 bottom-[16%]",
        "-right-1.5 bottom-[16%]",
      ].map((position) => (
        <span key={position} aria-hidden className={cn("absolute h-11 w-2.5 rounded-full bg-foreground/20", position)} />
      ))}
      <div className="relative rounded-[2.25rem] border-2 border-border-strong bg-surface-muted px-4 pb-4 pt-3 shadow-[inset_0_2px_8px_rgba(15,30,50,0.07)]">
        <div aria-hidden className="mx-auto mb-3 h-2.5 w-3/5 rounded-full bg-border-strong/60" />
        <div className="space-y-2.5">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {frontCells}
          </div>
          {layout.rows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid gap-2.5" style={{ gridTemplateColumns: track(columns) }}>
              {row.flatMap((index, position) =>
                layout.aisleAfter !== null && position === layout.aisleAfter
                  ? [spacer(`aisle-${rowIndex}`), seat(index)]
                  : [seat(index)],
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
