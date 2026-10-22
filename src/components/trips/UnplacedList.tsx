"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { GripVertical, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { seatsLeft } from "@/lib/trips/rules";
import { VEHICLE_KIND_LABELS, type TripVehicle } from "@/lib/trips/types";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { ContactLinks } from "./ContactLinks";
import { useBoard } from "./boardTypes";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Le convocate ancora senza passaggio. Ognuna si può trascinare su un mezzo (o si sceglie il mezzo qui e si tocca «Metti»);
 * trascinando un'atleta da un mezzo su questo riquadro la si toglie dal suo.
 */
export function UnplacedList({ vehicles, calledUpCount }: { vehicles: TripVehicle[]; calledUpCount: number }) {
  const board = useBoard();
  const [over, setOver] = useState(false);
  const withSeats = vehicles.filter((vehicle) => seatsLeft(vehicle) > 0);
  // Si può lasciare qui solo chi sta su un mezzo.
  const onVehicle = board.dragging !== null && vehicles.some((vehicle) => vehicle.athleteIds.includes(board.dragging!));

  function submit(event: FormEvent<HTMLFormElement>, athleteId: string) {
    event.preventDefault();
    const vehicleId = new FormData(event.currentTarget).get("vehicleId")?.toString();
    if (vehicleId) board.move(athleteId, vehicleId);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const athleteId = event.dataTransfer.getData("text/plain") || board.dragging;
    board.endDrag();
    if (athleteId) board.move(athleteId, null);
  }

  if (calledUpCount === 0) return <p className="text-sm text-muted-foreground">Nessuna convocata.</p>;
  if (board.unplaced.length === 0 && !onVehicle) {
    return (
      <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success" data-trip-all-placed>
        Tutte le convocate hanno un passaggio.
      </p>
    );
  }

  return (
    <div
      // Il permesso di lasciare qui va dato sia entrando che passando sopra: il browser guarda l'ultimo dei due che ha ricevuto.
      onDragOver={(event) => {
        if (!onVehicle) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(event) => {
        if (!onVehicle) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={drop}
      className={cn(
        "divide-y divide-border overflow-hidden rounded-2xl border bg-card shadow-card transition",
        over ? "border-primary bg-primary-soft/30 ring-2 ring-primary/30" : onVehicle ? "border-primary/40 ring-2 ring-primary/15" : "border-border",
      )}
      data-unplaced-zone
    >
      {onVehicle && (
        <p className="bg-primary-soft/60 px-4 py-2.5 text-center text-xs font-bold text-primary">Rilascia qui per toglierla dal mezzo</p>
      )}
      {board.unplaced.map((athleteId) => (
        <form
          key={athleteId}
          onSubmit={(event) => submit(event, athleteId)}
          className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", board.dragging === athleteId && "opacity-40")}
          data-unplaced={athleteId}
        >
          {/* Solo la parte con il nome si trascina: il menù accanto resta un menù. */}
          <div
            draggable
            onDragStart={(event: DragEvent<HTMLDivElement>) => {
              event.dataTransfer.setData("text/plain", athleteId);
              event.dataTransfer.effectAllowed = "move";
              board.startDrag(athleteId);
            }}
            onDragEnd={board.endDrag}
            className="flex min-w-0 cursor-grab items-start gap-2 active:cursor-grabbing"
            data-unplaced-handle={athleteId}
          >
            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{board.nameOf(athleteId)}</p>
              <ContactLinks contacts={board.people[athleteId]?.contacts ?? []} />
            </div>
          </div>
          {withSeats.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2">
              <div className="min-w-0 sm:w-64">
                <Label htmlFor={`assign-${athleteId}`} className="sr-only">
                  Mezzo per {board.nameOf(athleteId)}
                </Label>
                <Select id={`assign-${athleteId}`} name="vehicleId" defaultValue="" required>
                  <option value="" disabled>
                    Scegli il mezzo
                  </option>
                  {withSeats.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {VEHICLE_KIND_LABELS[vehicle.kind]} di {vehicle.driverName} · {plural(seatsLeft(vehicle), "posto libero", "posti liberi")}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" size="sm" data-assign={athleteId}>
                <UserPlus className="h-3.5 w-3.5" />
                Metti
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {vehicles.length === 0 ? "Aggiungi prima un mezzo." : "Nessun mezzo ha posti liberi: aggiungine uno."}
            </p>
          )}
        </form>
      ))}
    </div>
  );
}
