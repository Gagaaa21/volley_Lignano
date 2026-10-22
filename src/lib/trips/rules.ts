import { nameKey } from "./phone";
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

/** I campi scritti a mano di un mezzo, così come sono. */
export function fieldsOf(vehicle: TripVehicle): VehicleFields {
  return {
    kind: vehicle.kind,
    ownerName: vehicle.ownerName,
    driverName: vehicle.driverName,
    driverPhone: vehicle.driverPhone,
    seats: vehicle.seats,
    departureTime: vehicle.departureTime,
    departurePlace: vehicle.departurePlace,
    notes: vehicle.notes,
  };
}

/** Cambia solo i posti di un mezzo (il contatore + e −): da 1 al massimo, e mai meno di chi c'è già sopra. */
export function setVehicleSeats(data: MatchTripData, id: string, seats: number): TripChange {
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return fail(`I posti vanno da 1 a ${MAX_SEATS}.`);
  const current = data.vehicles.find((vehicle) => vehicle.id === id);
  if (!current) return fail("Questo mezzo non c'è più.");
  return updateVehicle(data, id, { ...fieldsOf(current), seats });
}

/** Sposta un'atleta su un mezzo (anche da un altro) o, senza mezzo, la toglie dal suo: resta senza passaggio. */
export function moveAthlete(data: MatchTripData, athleteId: string, vehicleId: string | null): TripChange {
  return vehicleId === null ? { ok: true, data: unassignAthlete(data, athleteId) } : assignAthlete(data, athleteId, vehicleId);
}

/** Di chi è il mezzo, se si dice e non è di chi guida (la stessa persona scritta in due modi conta una volta). */
export function ownerLabel(vehicle: Pick<TripVehicle, "ownerName" | "driverName">): string | null {
  if (!vehicle.ownerName) return null;
  return nameKey(vehicle.ownerName) === nameKey(vehicle.driverName) ? null : vehicle.ownerName;
}

/**
 * Come si dispongono i posti di un mezzo visto dall'alto: davanti, accanto a chi guida, e poi le file dietro. Gli indici sono
 * quelli dei posti per le atlete (da 0, chi guida non conta) e compaiono tutti una volta sola, nell'ordine in cui si riempiono.
 */
export interface SeatLayout {
  /** I posti davanti, accanto a chi guida. */
  front: number[];
  /** Le file dietro, da quella più vicina a chi guida. */
  rows: number[][];
  /** Dopo quanti posti di una fila sta il corridoio (solo il pullman). */
  aisleAfter: number | null;
}

export function seatLayout(kind: VehicleKind, seats: number): SeatLayout {
  const total = Math.max(0, Math.floor(seats));
  const frontCount = Math.min(total, kind === "pulmino" ? 2 : 1);
  const rowSize = kind === "pullman" ? 4 : 3;
  const front = Array.from({ length: frontCount }, (_, index) => index);
  const rows: number[][] = [];
  for (let start = frontCount; start < total; start += rowSize) {
    rows.push(Array.from({ length: Math.min(rowSize, total - start) }, (_, index) => start + index));
  }
  return { front, rows, aisleAfter: kind === "pullman" ? 2 : null };
}

/** Un mezzo che si è già usato in altre trasferte: si può rimettere con un tocco. */
export type VehicleSuggestion = Pick<TripVehicle, "kind" | "ownerName" | "driverName" | "driverPhone" | "seats">;

const sameVehicleKey = (vehicle: Pick<TripVehicle, "kind" | "ownerName" | "driverName">) =>
  [vehicle.kind, nameKey(vehicle.ownerName ?? ""), nameKey(vehicle.driverName)].join("|");

/**
 * I mezzi usati nelle altre trasferte, per rimetterli senza riscriverli: quelli più usati per primi (a parità, i più recenti),
 * uno per tipo, proprietario e autista, con i posti e il numero dell'ultima volta. `trips` va dalla trasferta più recente alla
 * più vecchia, senza quella in corso; i mezzi già presenti in questa trasferta non si riproppongono.
 */
export function suggestVehicles(trips: readonly MatchTripData[], current: MatchTripData, limit = 6): VehicleSuggestion[] {
  const already = new Set(current.vehicles.map(sameVehicleKey));
  const found = new Map<string, { suggestion: VehicleSuggestion; uses: number }>();
  for (const trip of trips) {
    for (const vehicle of trip.vehicles) {
      const key = sameVehicleKey(vehicle);
      if (already.has(key)) continue;
      const known = found.get(key);
      if (known) known.uses += 1;
      else
        found.set(key, {
          uses: 1,
          suggestion: {
            kind: vehicle.kind,
            ownerName: vehicle.ownerName,
            driverName: vehicle.driverName,
            driverPhone: vehicle.driverPhone,
            seats: vehicle.seats,
          },
        });
    }
  }
  // Array.prototype.sort è stabile: a parità di usi restano nell'ordine in cui sono comparsi (i più recenti per primi).
  return [...found.values()]
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit)
    .map((entry) => entry.suggestion);
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
    ownerName: text(value.ownerName, 80),
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
