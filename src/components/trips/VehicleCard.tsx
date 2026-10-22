"use client";

import { useState, type DragEvent } from "react";
import { ArrowRightLeft, Bus, Car, MapPin, Minus, Pencil, Phone, Plus, Trash2, Truck, UserMinus, Van, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { phoneHref } from "@/lib/trips/phone";
import { ownerLabel, seatsLeft } from "@/lib/trips/rules";
import { MAX_SEATS, VEHICLE_KIND_LABELS, type TripVehicle, type VehicleKind } from "@/lib/trips/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ContactLinks } from "./ContactLinks";
import { SeatMap } from "./SeatMap";
import { VehicleForm } from "./VehicleForm";
import { useBoard } from "./boardTypes";

const KIND_ICONS: Record<VehicleKind, typeof Car> = { auto: Car, pulmino: Van, pullman: Bus, altro: Truck };

/** Il riquadro sotto il mezzo: uno alla volta. */
type Panel = { type: "add" } | { type: "seat"; athleteId: string } | { type: "edit" } | null;

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

/**
 * La scheda di un mezzo: chi guida e di chi è, i posti con il contatore (+ e −), il mezzo visto dall'alto con le atlete sui
 * suoi posti, e chi viaggia con i numeri da chiamare. Tutto si cambia da qui: tocca un posto libero per metterci un'atleta,
 * un posto occupato per toglierla o spostarla, il volante (o la matita) per cambiare chi guida, di chi è, il numero, la
 * partenza. Le atlete si possono anche trascinare da un mezzo all'altro.
 */
export function VehicleCard({ vehicle, vehicles }: { vehicle: TripVehicle; vehicles: TripVehicle[] }) {
  const board = useBoard();
  const [panel, setPanel] = useState<Panel>(null);
  const [over, setOver] = useState(false);

  const Icon = KIND_ICONS[vehicle.kind];
  const left = seatsLeft(vehicle);
  const taken = vehicle.athleteIds.length;
  const owner = ownerLabel(vehicle);
  const href = vehicle.driverPhone ? phoneHref(vehicle.driverPhone) : null;
  const departure = [vehicle.departureTime ? `ore ${vehicle.departureTime}` : null, vehicle.departurePlace].filter(Boolean).join(" · ");
  // Chi si sta trascinando può cadere qui se non è già qui e c'è posto.
  const canDrop = board.dragging !== null && !vehicle.athleteIds.includes(board.dragging) && left > 0;
  const others = vehicles.filter((other) => other.id !== vehicle.id && seatsLeft(other) > 0);
  const seatPanelAthlete = panel?.type === "seat" && vehicle.athleteIds.includes(panel.athleteId) ? panel.athleteId : null;

  function toggle(next: NonNullable<Panel>) {
    setPanel((current) =>
      current && current.type === next.type && (current.type !== "seat" || (next.type === "seat" && current.athleteId === next.athleteId)) ? null : next,
    );
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const athleteId = event.dataTransfer.getData("text/plain") || board.dragging;
    board.endDrag();
    if (athleteId && !vehicle.athleteIds.includes(athleteId)) board.move(athleteId, vehicle.id);
  }

  return (
    <Card
      data-vehicle={vehicle.id}
      data-vehicle-droppable={canDrop ? "true" : undefined}
      // Il permesso di lasciare qui va dato sia entrando che passando sopra: il browser guarda l'ultimo dei due che ha ricevuto.
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={drop}
      className={cn(
        "relative overflow-hidden",
        canDrop && "border-primary/40 ring-2 ring-primary/15",
        over && "border-primary bg-primary-soft/30 ring-primary/40",
      )}
    >
      {over && (
        <p className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-pop">
          Rilascia per metterla qui
        </p>
      )}

      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <span className="icon-chip shrink-0">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold leading-snug text-foreground" data-vehicle-title>
            {VEHICLE_KIND_LABELS[vehicle.kind]} · {vehicle.driverName}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
            {owner && (
              <span className="font-medium text-foreground/70" data-vehicle-owner>
                di {owner}
              </span>
            )}
            {vehicle.driverPhone &&
              (href ? (
                <a href={href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" data-vehicle-phone>
                  <Phone className="h-3 w-3" aria-hidden />
                  {vehicle.driverPhone}
                </a>
              ) : (
                <span data-vehicle-phone>{vehicle.driverPhone}</span>
              ))}
            {departure && (
              <span className="inline-flex items-center gap-1" data-vehicle-departure>
                <MapPin className="h-3 w-3" aria-hidden />
                Partenza {departure}
              </span>
            )}
          </p>
          {vehicle.notes && <p className="mt-1 text-[13px] text-muted-foreground">{vehicle.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant={panel?.type === "edit" ? "soft" : "quiet"}
            aria-label="Modifica il mezzo"
            aria-expanded={panel?.type === "edit"}
            onClick={() => toggle({ type: "edit" })}
            data-vehicle-edit-button
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="danger-ghost"
            aria-label={`Elimina il mezzo di ${vehicle.driverName}`}
            onClick={() => {
              const message =
                taken > 0
                  ? `Eliminare il mezzo di ${vehicle.driverName}? Le ${taken} atlete sopra resteranno senza passaggio.`
                  : `Eliminare il mezzo di ${vehicle.driverName}?`;
              if (window.confirm(message)) board.remove(vehicle.id);
            }}
            data-vehicle-delete={vehicle.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-4 sm:px-5" data-vehicle-seats-bar>
        <span className="text-[13px] font-semibold text-muted-foreground">Posti per le atlete</span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Un posto in meno"
            disabled={vehicle.seats <= Math.max(1, taken)}
            onClick={() => board.setSeats(vehicle.id, vehicle.seats - 1)}
            data-seats-minus
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Badge tone={left === 0 ? "neutral" : "success"} className="min-w-[5.5rem] justify-center" data-vehicle-seats>
            {taken}/{vehicle.seats} posti
          </Badge>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Un posto in più"
            disabled={vehicle.seats >= MAX_SEATS}
            onClick={() => board.setSeats(vehicle.id, vehicle.seats + 1)}
            data-seats-plus
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 px-4 py-5 sm:px-5 md:grid-cols-[19rem_minmax(0,1fr)] md:items-start">
        <SeatMap
          vehicle={vehicle}
          selectedId={seatPanelAthlete}
          addOpen={panel?.type === "add"}
          onSeat={(athleteId) => toggle({ type: "seat", athleteId })}
          onAdd={() => toggle({ type: "add" })}
          onDriver={() => toggle({ type: "edit" })}
        />

        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chi viaggia</p>
          {taken === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong px-3.5 py-4 text-sm text-muted-foreground">
              Nessuna atleta su questo mezzo: tocca un posto libero, oppure trascinala qui.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {vehicle.athleteIds.map((athleteId) => (
                <li key={athleteId} className="flex items-start justify-between gap-3 px-3.5 py-2.5" data-passenger={athleteId}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {board.nameOf(athleteId)}
                      {!board.calledUp.has(athleteId) && <Badge tone="warning">Non più convocata</Badge>}
                    </p>
                    <ContactLinks contacts={board.people[athleteId]?.contacts ?? []} />
                  </div>
                  <Button type="button" size="xs" variant="outline" onClick={() => board.move(athleteId, null)} data-unassign={athleteId}>
                    <UserMinus className="h-3.5 w-3.5" />
                    Togli
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {panel?.type === "add" && (
        <div className="animate-[pop-in_220ms_ease-out] border-t border-border bg-surface-muted px-4 py-4 sm:px-5" data-panel="add">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Chi sale su questo mezzo?</p>
            <Button type="button" size="icon-sm" variant="quiet" aria-label="Chiudi" onClick={() => setPanel(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {board.unplaced.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tutte le convocate hanno già un passaggio.</p>
          ) : left === 0 ? (
            <p className="text-sm text-muted-foreground">Il mezzo è pieno: aggiungi un posto con il «+» o scegli un altro mezzo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {board.unplaced.map((athleteId) => (
                <Button
                  key={athleteId}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    board.move(athleteId, vehicle.id);
                    // Fatta la scelta si resta qui per le altre, finché ci sono posti e atlete.
                    if (left <= 1 || board.unplaced.length <= 1) setPanel(null);
                  }}
                  data-pick-athlete={athleteId}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {board.nameOf(athleteId)}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {seatPanelAthlete && (
        <div className="animate-[pop-in_220ms_ease-out] border-t border-border bg-surface-muted px-4 py-4 sm:px-5" data-panel="seat">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{board.nameOf(seatPanelAthlete)}</p>
              <ContactLinks contacts={board.people[seatPanelAthlete]?.contacts ?? []} />
            </div>
            <Button type="button" size="icon-sm" variant="quiet" aria-label="Chiudi" onClick={() => setPanel(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                board.move(seatPanelAthlete, null);
                setPanel(null);
              }}
              data-seat-remove
            >
              <UserMinus className="h-4 w-4" />
              Togli dal mezzo
            </Button>
            {others.map((other) => (
              <Button
                key={other.id}
                type="button"
                size="sm"
                variant="soft"
                onClick={() => {
                  board.move(seatPanelAthlete, other.id);
                  setPanel(null);
                }}
                data-seat-move-to={other.id}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Sposta su {VEHICLE_KIND_LABELS[other.kind].toLowerCase()} di {firstName(other.driverName)}
              </Button>
            ))}
            {others.length === 0 && vehicles.length > 1 && <span className="text-[13px] text-muted-foreground">Gli altri mezzi sono pieni.</span>}
          </div>
        </div>
      )}

      {panel?.type === "edit" && (
        <div className="animate-[pop-in_220ms_ease-out] border-t border-border bg-surface-muted px-4 py-4 sm:px-5" data-panel="edit">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Modifica il mezzo</p>
            <Button type="button" size="icon-sm" variant="quiet" aria-label="Chiudi" onClick={() => setPanel(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <VehicleForm
            matchId={board.matchId}
            vehicle={vehicle}
            driverNames={board.driverNames}
            ownerNames={board.ownerNames}
            idPrefix={`v-${vehicle.id}`}
            onSaved={() => setPanel(null)}
          />
        </div>
      )}
    </Card>
  );
}
