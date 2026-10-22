"use client";

import { useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import {
  addSuggestedVehicleAction,
  moveAthleteAction,
  removeVehicleAction,
  setVehicleSeatsAction,
  type TripActionResult,
} from "@/app/admin/trasferte/actions";
import { moveAthlete, removeVehicle, setVehicleSeats, summarizeTrip, type VehicleSuggestion } from "@/lib/trips/rules";
import { VEHICLE_KIND_LABELS, type MatchTripData, type TripVehicle } from "@/lib/trips/types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { BoardContext, type BoardApi, type BoardPerson } from "./boardTypes";
import { UnplacedList } from "./UnplacedList";
import { VehicleCard } from "./VehicleCard";
import { VehicleForm } from "./VehicleForm";

/** Quello che cambia sulla lavagna subito, prima che il server risponda. */
type BoardChange =
  | { type: "move"; athleteId: string; vehicleId: string | null }
  | { type: "seats"; vehicleId: string; seats: number }
  | { type: "remove"; vehicleId: string };

/** Le stesse regole del server, applicate qui: se non tornano non cambia niente (e il server lo dirà). */
function applyChange(vehicles: TripVehicle[], change: BoardChange): TripVehicle[] {
  const data: MatchTripData = { vehicles, notes: null };
  const result =
    change.type === "move"
      ? moveAthlete(data, change.athleteId, change.vehicleId)
      : change.type === "seats"
        ? setVehicleSeats(data, change.vehicleId, change.seats)
        : ({ ok: true, data: removeVehicle(data, change.vehicleId) } as const);
  return result.ok ? result.data.vehicles : vehicles;
}

const suggestionLabel = (suggestion: VehicleSuggestion) =>
  [
    `${VEHICLE_KIND_LABELS[suggestion.kind]} · ${suggestion.driverName}`,
    suggestion.ownerName ? `di ${suggestion.ownerName}` : null,
    `${suggestion.seats} ${suggestion.seats === 1 ? "posto" : "posti"}`,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * La lavagna di una trasferta: i numeri in alto, i mezzi con i loro posti (si cambiano da lì), le convocate senza passaggio, e
 * accanto il modulo per un mezzo nuovo con i mezzi già usati altre volte. Quello che si sposta (un'atleta, un posto in più o in
 * meno, un mezzo tolto) cambia subito sullo schermo e intanto va al server; se il server lo rifiuta torna com'era e lo dice.
 */
export function TripBoard({
  matchId,
  vehicles,
  people,
  calledUpIds,
  suggestions,
  driverNames,
  ownerNames,
  notes,
}: {
  matchId: string;
  vehicles: TripVehicle[];
  people: Record<string, BoardPerson>;
  calledUpIds: string[];
  suggestions: VehicleSuggestion[];
  driverNames: string[];
  ownerNames: string[];
  /** Le note riservate (si salvano con un modulo del server). */
  notes: ReactNode;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(vehicles, applyChange);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const data = useMemo<MatchTripData>(() => ({ vehicles: optimistic, notes: null }), [optimistic]);
  const summary = useMemo(() => summarizeTrip(data, calledUpIds), [data, calledUpIds]);
  const calledUp = useMemo(() => new Set(calledUpIds), [calledUpIds]);

  /** Fa vedere subito il cambiamento e lo manda al server; se non va a buon fine il server lo dice e la lavagna torna com'era. */
  function run(change: BoardChange | null, call: () => Promise<TripActionResult>) {
    setError(null);
    startTransition(async () => {
      if (change) applyOptimistic(change);
      try {
        const result = await call();
        if (!result.ok) setError(result.error);
      } catch {
        setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      }
    });
  }

  const api: BoardApi = {
    matchId,
    people,
    calledUp,
    unplaced: summary.unplaced,
    driverNames,
    ownerNames,
    dragging,
    nameOf: (athleteId) => people[athleteId]?.name ?? "Atleta non più in elenco",
    move(athleteId, vehicleId) {
      // Un mezzo pieno (o che non c'è più) lo si sa già qui: niente da spedire.
      const check = moveAthlete(data, athleteId, vehicleId);
      if (!check.ok) return setError(check.error);
      run({ type: "move", athleteId, vehicleId }, () => moveAthleteAction(matchId, athleteId, vehicleId));
    },
    setSeats(vehicleId, seats) {
      const check = setVehicleSeats(data, vehicleId, seats);
      if (!check.ok) return setError(check.error);
      run({ type: "seats", vehicleId, seats }, () => setVehicleSeatsAction(matchId, vehicleId, seats));
    },
    remove(vehicleId) {
      run({ type: "remove", vehicleId }, () => removeVehicleAction(matchId, vehicleId));
    },
    startDrag: setDragging,
    endDrag: () => setDragging(null),
  };

  return (
    <BoardContext.Provider value={api}>
      <div data-trip-board data-saving={saving ? "true" : "false"} aria-busy={saving}>
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div data-trip-stat="called">
            <StatTile label="Convocate" value={summary.calledUp} tone="primary" />
          </div>
          <div data-trip-stat="placed">
            <StatTile label="Con un passaggio" value={summary.placed} tone="success" />
          </div>
          <div data-trip-stat="unplaced">
            <StatTile label="Senza passaggio" value={summary.unplaced.length} tone={summary.unplaced.length > 0 ? "warning" : "success"} />
          </div>
          <div data-trip-stat="free">
            <StatTile label="Posti liberi" value={summary.seatsFree} tone="gold" />
          </div>
        </div>

        {error && (
          <p role="alert" data-trip-board-error className="mb-5 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <div className="min-w-0 space-y-8">
            <section data-tour="section-trasferta-vehicles">
              <SectionHeading
                title="Mezzi"
                description={optimistic.length === 0 ? "Aggiungi chi guida e quanti posti ha il mezzo." : "Tocca un posto per metterci o togliere un'atleta, oppure trascinala."}
              />
              {optimistic.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground" data-trip-no-vehicles>
                  Nessun mezzo ancora. Aggiungine uno qui accanto, o scegline uno già usato: poi potrai dire chi ci sale.
                </div>
              ) : (
                <div className="space-y-4">
                  {optimistic.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} vehicles={optimistic} />
                  ))}
                </div>
              )}
            </section>

            <section data-tour="section-trasferta-unplaced">
              <SectionHeading title="Senza passaggio" description="Le convocate che non sono ancora su nessun mezzo." />
              <UnplacedList vehicles={optimistic} calledUpCount={calledUpIds.length} />
            </section>
          </div>

          <aside className="min-w-0 space-y-8">
            <section data-tour="section-trasferta-add">
              <SectionHeading title="Aggiungi un mezzo" />
              {suggestions.length > 0 && (
                <div className="mb-4" data-suggestions>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Già usati altre volte</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={`${suggestion.kind}-${suggestion.ownerName}-${suggestion.driverName}`}
                        type="button"
                        size="xs"
                        variant="soft"
                        disabled={saving}
                        onClick={() => run(null, () => addSuggestedVehicleAction(matchId, suggestion))}
                        data-suggestion={suggestion.driverName}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {suggestionLabel(suggestion)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <Card>
                <CardBody className="pt-5">
                  <VehicleForm
                    matchId={matchId}
                    driverNames={driverNames}
                    ownerNames={ownerNames}
                    idPrefix="v-new"
                    narrow
                  />
                </CardBody>
              </Card>
            </section>
            {notes}
          </aside>
        </div>
      </div>
    </BoardContext.Provider>
  );
}
