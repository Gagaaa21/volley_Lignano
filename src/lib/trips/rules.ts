import {
  MAX_SEATS,
  MAX_VEHICLES,
  VEHICLE_KINDS,
  emptyTripData,
  type MatchTripData,
  type TripVehicle,
  type VehicleKind,
} from "./types";

/**
 * Le regole delle trasferte, in funzioni pure (niente database né pagina): quanti posti restano, chi sta su quale mezzo,
 * cosa succede spostando o togliendo qualcuno. Ogni funzione restituisce un documento nuovo e non tocca quello ricevuto.
 */

export type TripChange = { ok: true; data: MatchTripData } | { ok: false; error: string };

const fail = (error: string): TripChange => ({ ok: false, error });

export function seatsLeft(vehicle: TripVehicle): number {
  return Math.max(0, vehicle.seats - vehicle.athleteIds.length);
}

/** Il mezzo su cui viaggia un'atleta, se ne ha uno. */
export function vehicleOf(data: MatchTripData, athleteId: string): TripVehicle | undefined {
  return data.vehicles.find((vehicle) => vehicle.athleteIds.includes(athleteId));
}

/** Mette un'atleta su un mezzo: se era su un altro la sposta. Non si supera il numero di posti. */
export function assignAthlete(data: MatchTripData, athleteId: string, vehicleId: string): TripChange {
  const target = data.vehicles.find((vehicle) => vehicle.id === vehicleId);
  if (!target) return fail("Questo mezzo non c'è più.");
  if (target.athleteIds.includes(athleteId)) return { ok: true, data };
  if (seatsLeft(target) === 0) return fail("Il mezzo è pieno: non ci sono più posti.");
  return {
    ok: true,
    data: {
      ...data,
      vehicles: data.vehicles.map((vehicle) => ({
        ...vehicle,
        athleteIds:
          vehicle.id === vehicleId
            ? [...vehicle.athleteIds, athleteId]
            : vehicle.athleteIds.filter((id) => id !== athleteId),
      })),
    },
  };
}

/** Toglie un'atleta dal suo mezzo: resta senza passaggio. */
export function unassignAthlete(data: MatchTripData, athleteId: string): MatchTripData {
  return {
    ...data,
    vehicles: data.vehicles.map((vehicle) => ({
      ...vehicle,
      athleteIds: vehicle.athleteIds.filter((id) => id !== athleteId),
    })),
  };
}

/** I campi di un mezzo che si scrivono a mano (non l'identificativo né chi ci sta sopra). */
export type VehicleFields = Omit<TripVehicle, "id" | "athleteIds">;

export function addVehicle(data: MatchTripData, fields: VehicleFields, id: string): TripChange {
  if (data.vehicles.length >= MAX_VEHICLES) return fail(`Ci sono già ${MAX_VEHICLES} mezzi: sono tanti, forse c'è un doppione.`);
  return { ok: true, data: { ...data, vehicles: [...data.vehicles, { ...fields, id, athleteIds: [] }] } };
}

/** Cambia i dati di un mezzo. I posti non possono scendere sotto le atlete già sopra: prima si tolgono loro. */
export function updateVehicle(data: MatchTripData, id: string, fields: VehicleFields): TripChange {
  const current = data.vehicles.find((vehicle) => vehicle.id === id);
  if (!current) return fail("Questo mezzo non c'è più.");
  if (fields.seats < current.athleteIds.length) {
    const n = current.athleteIds.length;
    return fail(
      n === 1
        ? "Su questo mezzo c'è già 1 atleta: toglila prima di ridurre i posti."
        : `Su questo mezzo ci sono già ${n} atlete: togline qualcuna prima di ridurre i posti.`,
    );
  }
  return {
    ok: true,
    data: { ...data, vehicles: data.vehicles.map((vehicle) => (vehicle.id === id ? { ...vehicle, ...fields } : vehicle)) },
  };
}

/** Toglie un mezzo: chi c'era sopra resta senza passaggio. */
export function removeVehicle(data: MatchTripData, id: string): MatchTripData {
  return { ...data, vehicles: data.vehicles.filter((vehicle) => vehicle.id !== id) };
}

export interface TripSummary {
  vehicles: number;
  seats: number;
  seatsFree: number;
  /** Le convocate della partita. */
  calledUp: number;
  /** Le convocate che hanno un posto. */
  placed: number;
  /** Le convocate ancora senza passaggio, nell'ordine della convocazione. */
  unplaced: string[];
  /** Su un mezzo ma non più tra le convocate (la convocazione è cambiata dopo). */
  notCalledUp: string[];
}

export function summarizeTrip(data: MatchTripData, calledUpIds: readonly string[]): TripSummary {
  const calledUp = new Set(calledUpIds);
  const onBoard = data.vehicles.flatMap((vehicle) => vehicle.athleteIds);
  const onBoardSet = new Set(onBoard);
  return {
    vehicles: data.vehicles.length,
    seats: data.vehicles.reduce((sum, vehicle) => sum + vehicle.seats, 0),
    seatsFree: data.vehicles.reduce((sum, vehicle) => sum + seatsLeft(vehicle), 0),
    calledUp: calledUp.size,
    placed: [...calledUp].filter((id) => onBoardSet.has(id)).length,
    unplaced: [...calledUp].filter((id) => !onBoardSet.has(id)),
    notCalledUp: onBoard.filter((id) => !calledUp.has(id)),
  };
}

/** A che punto è l'organizzazione, in una parola per l'elenco. */
export type TripStatus = "no-called-up" | "no-vehicles" | "missing" | "done";

export function tripStatus(summary: TripSummary): TripStatus {
  if (summary.calledUp === 0) return "no-called-up";
  if (summary.vehicles === 0) return "no-vehicles";
  return summary.unplaced.length > 0 ? "missing" : "done";
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
};

function normalizeVehicle(raw: unknown): TripVehicle | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id, 60);
  const driverName = text(value.driverName, 80);
  const seats = Number(value.seats);
  if (!id || !driverName || !Number.isInteger(seats) || seats < 0 || seats > MAX_SEATS) return null;
  const kind = VEHICLE_KINDS.includes(value.kind as VehicleKind) ? (value.kind as VehicleKind) : "altro";
  const athleteIds = Array.isArray(value.athleteIds)
    ? [...new Set(value.athleteIds.filter((athleteId): athleteId is string => typeof athleteId === "string"))]
    : [];
  return {
    id,
    kind,
    driverName,
    driverPhone: text(value.driverPhone, 40),
    seats,
    departureTime: text(value.departureTime, 5),
    departurePlace: text(value.departurePlace, 120),
    notes: text(value.notes, 400),
    athleteIds,
  };
}

/**
 * Rilegge un documento salvato: scarta le parti rovinate o fuori misura invece di rompere la pagina, e tiene ogni atleta su
 * un mezzo solo (la prima volta che compare) e dentro i posti del mezzo.
 */
export function normalizeTripData(raw: unknown): MatchTripData {
  if (!raw || typeof raw !== "object") return emptyTripData();
  const value = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const vehicles = (Array.isArray(value.vehicles) ? value.vehicles : [])
    .map(normalizeVehicle)
    .filter((vehicle): vehicle is TripVehicle => vehicle !== null)
    .slice(0, MAX_VEHICLES)
    .map((vehicle) => {
      const athleteIds = vehicle.athleteIds.filter((id) => !seen.has(id)).slice(0, vehicle.seats);
      for (const id of athleteIds) seen.add(id);
      return { ...vehicle, athleteIds };
    });
  return { vehicles, notes: text(value.notes, 2000) };
}
