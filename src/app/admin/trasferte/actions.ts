"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { requireStaffPage } from "@/lib/auth/guard";
import type { SessionPayload } from "@/lib/auth/session";
import { parseClockTime } from "@/lib/clockTime";
import { phoneForName } from "@/lib/trips/contacts";
import { isTripTableMissing } from "@/lib/trips/missing";
import { cleanPhone, isValidPhone } from "@/lib/trips/phone";
import {
  addVehicle,
  moveAthlete,
  removeVehicle,
  setVehicleSeats,
  updateVehicle,
  type TripChange,
  type VehicleFields,
} from "@/lib/trips/rules";
import { MAX_SEATS, VEHICLE_KINDS, emptyTripData, type MatchTripData } from "@/lib/trips/types";

/**
 * Le azioni della sezione Trasferte. Ognuna ricontrolla da sola il permesso «Trasferte» (il controllo del layout protegge solo
 * le pagine, non le azioni, che si possono chiamare anche da fuori) e legge la partita da sé: non si fida di quanto arriva dal client.
 */

type Outcome = { ok: true } | { ok: false; error: string };

/** Esito di un'azione chiamata da un pulsante: la pagina mostra l'errore, se c'è, e rimette com'era quello che si era già spostato. */
export type TripActionResult = Outcome;

const TABLES_MISSING = "Mancano le tabelle delle trasferte nel database: va eseguito l'aggiornamento (vedi supabase/schema.sql).";

/**
 * Applica una modifica alla trasferta di una partita. Legge il documento, lo cambia e lo salva dichiarando la versione su cui
 * si basa; se nel frattempo un altro dispositivo ha salvato, rilegge e rifà la stessa modifica sul documento nuovo (sono
 * modifiche piccole e indipendenti: mettere un'atleta su un mezzo non dipende da cos'altro è cambiato).
 */
async function mutateTrip(
  matchId: string,
  session: SessionPayload,
  change: (data: MatchTripData, calledUpIds: readonly string[]) => TripChange,
): Promise<Outcome> {
  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match || match.team !== "u14u15") return { ok: false, error: "Partita non trovata." };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const trip = await repo.getMatchTrip(matchId);
      const result = change(trip ? { vehicles: trip.vehicles, notes: trip.notes } : emptyTripData(), match.calledUpAthleteIds);
      if (!result.ok) return result;
      const saved = await repo.saveMatchTrip(matchId, result.data, session.sub, trip?.version ?? null);
      if (saved.ok) {
        revalidatePath(`/admin/trasferte/${matchId}`);
        revalidatePath("/admin/trasferte");
        return { ok: true };
      }
    }
  } catch (error) {
    if (isTripTableMissing(error)) return { ok: false, error: TABLES_MISSING };
    throw error;
  }
  return { ok: false, error: "Un'altra persona ha cambiato la trasferta nello stesso momento: riprova." };
}

const idOf = (formData: FormData, name: string) => formData.get(name)?.toString().trim() ?? "";
const plainId = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 100) : "");

// --- Un mezzo: i campi, controllati allo stesso modo da modulo e da «mezzi già usati» -----------------------------------

/** I valori scritti nel modulo, riportati indietro con l'errore: senza, React svuota i campi e si perderebbe quanto scritto. */
export interface VehicleFormValues {
  kind: string;
  ownerName: string;
  driverName: string;
  driverPhone: string;
  seats: string;
  departureTime: string;
  departurePlace: string;
  notes: string;
}

export interface VehicleFormState {
  error?: string;
  values?: VehicleFormValues;
  /** Cambia a ogni salvataggio riuscito. */
  savedAt?: number;
}

const vehicleSchema = z.object({
  kind: z.enum(VEHICLE_KINDS, { message: "Scegli il tipo di mezzo." }),
  ownerName: z.string().max(80, "Il nome di chi è il mezzo è troppo lungo."),
  driverName: z.string().min(1, "Scrivi il nome di chi guida.").max(60, "Il nome di chi guida è troppo lungo."),
  seats: z.coerce
    .number({ message: "Scrivi i posti per le atlete." })
    .int("I posti sono un numero intero.")
    .min(1, "Servono almeno 1 posto per le atlete.")
    .max(MAX_SEATS, `Al massimo ${MAX_SEATS} posti.`),
  departurePlace: z.string().max(120, "Il luogo di partenza è troppo lungo."),
  notes: z.string().max(400, "Le note sono troppo lunghe (massimo 400 caratteri)."),
});

function readVehicleValues(formData: FormData): VehicleFormValues {
  const text = (name: string) => formData.get(name)?.toString() ?? "";
  return {
    kind: text("kind"),
    ownerName: text("ownerName"),
    driverName: text("driverName"),
    driverPhone: text("driverPhone"),
    seats: text("seats"),
    departureTime: text("departureTime"),
    departurePlace: text("departurePlace"),
    notes: text("notes"),
  };
}

/**
 * Controlla i campi di un mezzo e li rende puliti. Senza numero scritto, se chi guida è in rubrica (un solo nome, un solo
 * numero) si usa quello.
 */
async function parseVehicleFields(
  repo: Repo,
  values: VehicleFormValues,
): Promise<{ ok: true; fields: VehicleFields } | { ok: false; error: string }> {
  const parsed = vehicleSchema.safeParse({
    kind: values.kind,
    ownerName: values.ownerName.trim().replace(/\s+/g, " "),
    driverName: values.driverName.trim().replace(/\s+/g, " "),
    seats: values.seats.trim(),
    departurePlace: values.departurePlace.trim(),
    notes: values.notes.trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controlla i campi del mezzo." };

  const time = parseClockTime(values.departureTime);
  if (!time.ok) return { ok: false, error: "L'ora di partenza non è valida: scrivila così, 17:30." };

  let phone = cleanPhone(values.driverPhone);
  if (phone && !isValidPhone(phone)) {
    return { ok: false, error: "Il numero dell'autista non sembra un numero di telefono (solo cifre, spazi e un + iniziale)." };
  }
  if (!phone) {
    try {
      phone = phoneForName(await repo.listAthleteContacts(), parsed.data.driverName) ?? "";
    } catch (error) {
      if (!isTripTableMissing(error)) throw error;
    }
  }

  return {
    ok: true,
    fields: {
      kind: parsed.data.kind,
      ownerName: parsed.data.ownerName || null,
      driverName: parsed.data.driverName,
      driverPhone: phone || null,
      seats: parsed.data.seats,
      departureTime: time.value,
      departurePlace: parsed.data.departurePlace || null,
      notes: parsed.data.notes || null,
    },
  };
}

/** Il modulo «Aggiungi un mezzo» e «Modifica il mezzo» (con `vehicleId`). */
export async function saveVehicleAction(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const session = await requireStaffPage("trasferte");
  const matchId = idOf(formData, "matchId");
  const vehicleId = idOf(formData, "vehicleId");
  const values = readVehicleValues(formData);
  const fail = (error: string): VehicleFormState => ({ error, values });

  const parsed = await parseVehicleFields(await getActiveRepo(), values);
  if (!parsed.ok) return fail(parsed.error);

  const outcome = await mutateTrip(matchId, session, (data) =>
    vehicleId ? updateVehicle(data, vehicleId, parsed.fields) : addVehicle(data, parsed.fields, crypto.randomUUID()),
  );
  if (!outcome.ok) return fail(outcome.error);
  // Un mezzo nuovo: i campi tornano vuoti (lo fa React da solo); uno modificato: restano quelli salvati.
  return { savedAt: Date.now() };
}

/** Un mezzo usato in un'altra trasferta, rimesso in questa con un tocco (senza atlete): i campi arrivano dal client e si ricontrollano. */
export async function addSuggestedVehicleAction(
  matchId: string,
  suggestion: { kind: string; ownerName: string | null; driverName: string; driverPhone: string | null; seats: number },
): Promise<TripActionResult> {
  const session = await requireStaffPage("trasferte");
  const parsed = await parseVehicleFields(await getActiveRepo(), {
    kind: String(suggestion.kind),
    ownerName: suggestion.ownerName ?? "",
    driverName: String(suggestion.driverName ?? ""),
    driverPhone: suggestion.driverPhone ?? "",
    seats: String(suggestion.seats),
    departureTime: "",
    departurePlace: "",
    notes: "",
  });
  if (!parsed.ok) return parsed;
  return mutateTrip(plainId(matchId), session, (data) => addVehicle(data, parsed.fields, crypto.randomUUID()));
}

// --- Dalla scheda del mezzo: sposta, posti, elimina ---------------------------------------------------------------------

/** Mette un'atleta su un mezzo (anche spostandola da un altro) o, con `vehicleId` nullo, la toglie dal suo. */
export async function moveAthleteAction(matchId: string, athleteId: string, vehicleId: string | null): Promise<TripActionResult> {
  const session = await requireStaffPage("trasferte");
  const athlete = plainId(athleteId);
  const vehicle = vehicleId === null ? null : plainId(vehicleId);
  if (!athlete || vehicle === "") return { ok: false, error: "Scegli il mezzo per questa atleta." };
  return mutateTrip(plainId(matchId), session, (data, calledUpIds) => {
    // Toglierla dal mezzo si può sempre (anche se non è più tra le convocate); metterla su un mezzo solo se è convocata.
    if (vehicle !== null && !calledUpIds.includes(athlete)) {
      return { ok: false, error: "Questa atleta non è tra le convocate della partita." };
    }
    return moveAthlete(data, athlete, vehicle);
  });
}

/** Il contatore dei posti di un mezzo (+ e −). */
export async function setVehicleSeatsAction(matchId: string, vehicleId: string, seats: number): Promise<TripActionResult> {
  const session = await requireStaffPage("trasferte");
  return mutateTrip(plainId(matchId), session, (data) => setVehicleSeats(data, plainId(vehicleId), Number(seats)));
}

/** Elimina un mezzo: chi c'era sopra resta senza passaggio. */
export async function removeVehicleAction(matchId: string, vehicleId: string): Promise<TripActionResult> {
  const session = await requireStaffPage("trasferte");
  return mutateTrip(plainId(matchId), session, (data) => ({ ok: true, data: removeVehicle(data, plainId(vehicleId)) }));
}

// --- Note riservate ----------------------------------------------------------------------------------------------------

/** Riporta alla pagina della trasferta dicendo cosa non è andato (il modulo delle note non ha un posto per un errore). */
function backWithError(matchId: string, error: string): never {
  redirect(`/admin/trasferte/${matchId}?errore=${encodeURIComponent(error)}`);
}

export async function saveTripNotesAction(formData: FormData) {
  const session = await requireStaffPage("trasferte");
  const matchId = idOf(formData, "matchId");
  const notes = (formData.get("notes")?.toString() ?? "").trim();
  if (notes.length > 2000) backWithError(matchId, "Le note sono troppo lunghe (massimo 2000 caratteri).");
  const outcome = await mutateTrip(matchId, session, (data) => ({ ok: true, data: { ...data, notes: notes || null } }));
  if (!outcome.ok) backWithError(matchId, outcome.error);
}
