"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { parseContactRows, type ContactRowInput } from "@/lib/trips/contacts";
import { isTripTableMissing } from "@/lib/trips/missing";
import { MAX_CONTACTS_PER_ATHLETE } from "@/lib/trips/types";

export interface ContactsFormState {
  error?: string;
  /** Le righe come erano state scritte, riportate indietro con un errore: React svuota da solo i campi dopo ogni invio e senza questo si perderebbe tutto. */
  values?: ContactRowInput[];
  /** Cambia a ogni salvataggio riuscito: il modulo lo usa per dire «Salvato». */
  savedAt?: number;
}

/** I numeri di chi chiamare per un'atleta, tutti insieme: righe `name1`/`phone1`/`relation1`… del modulo. */
export async function saveContactsAction(_prev: ContactsFormState, formData: FormData): Promise<ContactsFormState> {
  const session = await requireStaffPage("trasferte");
  const athleteId = formData.get("athleteId")?.toString().trim() ?? "";

  const repo = await getActiveRepo();
  const athlete = athleteId ? await repo.getAthlete(athleteId) : null;
  // Le trasferte sono solo di U14/U15: non si scrivono numeri per atlete di altre squadre.
  if (!athlete || athlete.team !== "u14u15") return { error: "Atleta non trovata." };

  const rows: ContactRowInput[] = Array.from({ length: MAX_CONTACTS_PER_ATHLETE }, (_, index) => ({
    name: formData.get(`name${index + 1}`)?.toString() ?? "",
    phone: formData.get(`phone${index + 1}`)?.toString() ?? "",
    relation: formData.get(`relation${index + 1}`)?.toString() ?? "",
  }));
  const parsed = parseContactRows(rows);
  if (!parsed.ok) return { error: parsed.error, values: rows };

  try {
    await repo.saveAthleteContacts(athlete.id, parsed.contacts, session.sub);
  } catch (error) {
    if (isTripTableMissing(error)) {
      return {
        error: "Mancano le tabelle delle trasferte nel database: va eseguito l'aggiornamento (vedi supabase/schema.sql).",
        values: rows,
      };
    }
    throw error;
  }
  revalidatePath("/admin/trasferte/rubrica");
  revalidatePath("/admin/trasferte", "layout");
  return { savedAt: Date.now() };
}
