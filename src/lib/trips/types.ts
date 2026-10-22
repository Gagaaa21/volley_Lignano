/**
 * Trasferte: per ogni partita fuori casa, i mezzi con i loro posti e chi viaggia su quale; più la rubrica dei genitori delle
 * atlete. Sezione «super riservata» (permesso «trasferte», vedi AdminPage in lib/types.ts): niente di tutto questo compare
 * sul sito pubblico, nelle notifiche o in un'esportazione che non sia il riepilogo scelto da chi ha il permesso.
 */

/** Il mezzo con cui si va in trasferta. */
export const VEHICLE_KINDS = ["auto", "pulmino", "pullman", "altro"] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const VEHICLE_KIND_LABELS: Record<VehicleKind, string> = {
  auto: "Auto",
  pulmino: "Pulmino",
  pullman: "Pullman",
  altro: "Altro mezzo",
};

export interface TripVehicle {
  id: string;
  kind: VehicleKind;
  /** Chi guida (spesso un genitore), nome e cognome. */
  driverName: string;
  /** Il numero dell'autista, come è stato scritto (si ripulisce solo per il link di chiamata). */
  driverPhone: string | null;
  /** Posti per le atlete: l'autista non conta. */
  seats: number;
  /** Partenza di questo mezzo se diversa dal ritrovo: ora «HH:mm» e/o luogo. */
  departureTime: string | null;
  departurePlace: string | null;
  notes: string | null;
  /** Le atlete sul mezzo, nell'ordine in cui sono state messe. Ognuna è su un mezzo solo. */
  athleteIds: string[];
}

/** Tutto quello che si sa di una trasferta, salvato insieme: un solo documento per partita. */
export interface MatchTripData {
  vehicles: TripVehicle[];
  /** Note riservate sulla trasferta (pranzo, costi, rientro…). */
  notes: string | null;
}

export interface MatchTrip extends MatchTripData {
  matchId: string;
  /** Sale a ogni salvataggio: chi salva dichiara su quale versione si basa, così due modifiche insieme non si cancellano. */
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

/** Esito di un salvataggio: ok, oppure la versione attuale quando nel frattempo qualcun altro ha salvato. */
export type SaveMatchTripResult = { ok: true; trip: MatchTrip } | { ok: false; current: MatchTrip | null };

export function emptyTripData(): MatchTripData {
  return { vehicles: [], notes: null };
}

/** Un genitore (o chi per lui) da chiamare per un'atleta. */
export interface AthleteContact {
  name: string;
  /** Come è stato scritto (si ripulisce solo per il link di chiamata). */
  phone: string;
  /** Es. «mamma», «papà», «nonna». */
  relation: string | null;
}

/** La rubrica di un'atleta: una riga per atleta. Vuota = nessuna riga. */
export interface AthleteContacts {
  athleteId: string;
  contacts: AthleteContact[];
  updatedBy: string | null;
  updatedAt: string;
}

/** Quanti mezzi, quanti posti e quanti numeri in rubrica al massimo: limiti larghi, per tenere a freno i refusi. */
export const MAX_VEHICLES = 12;
export const MAX_SEATS = 60;
export const MAX_CONTACTS_PER_ATHLETE = 4;
