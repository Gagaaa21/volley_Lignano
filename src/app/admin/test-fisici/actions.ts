"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import {
  BODY_MEASURE_FIELDS,
  SQUAT_JUMP_TRIALS,
  isSquatJumpField,
  squatJumpFieldName,
  squatJumpInputName,
} from "@/lib/physicalTestFields";
import type { PhysicalTest, PhysicalTestInput } from "@/lib/types";

const schema = z.object({
  athleteId: z.string().min(1, "Seleziona un'atleta."),
  testName: z.string().min(1, "Inserisci il nome del test."),
  value: z.string().min(1, "Inserisci il risultato."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
  notes: z.string().optional(),
});

export interface PhysicalTestFormState {
  error?: string;
}

export async function savePhysicalTestAction(
  _prevState: PhysicalTestFormState,
  formData: FormData,
): Promise<PhysicalTestFormState> {
  const session = await requireStaffPage("testfisici");
  const parsed = schema.safeParse({
    athleteId: formData.get("athleteId")?.toString() ?? "",
    testName: formData.get("testName")?.toString().trim() ?? "",
    value: formData.get("value")?.toString().trim() ?? "",
    date: formData.get("date")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // quanto digitato: si torna al form con un messaggio invece di lasciar
  // risalire l'eccezione.
  try {
    const repo = await getActiveRepo();
    // La squadra non si sceglie nel form: deriva sempre dall'atleta
    // selezionata, così resta coerente anche se lo switcher squadra
    // nell'header cambia dopo l'apertura del form.
    const athlete = await repo.getAthlete(parsed.data.athleteId);
    if (!athlete) return { error: "Atleta non trovata." };

    const input: PhysicalTestInput = {
      athleteId: athlete.id,
      team: athlete.team,
      testName: parsed.data.testName,
      value: parsed.data.value,
      date: parsed.data.date,
      notes: parsed.data.notes ?? null,
    };

    if (id) {
      await repo.updatePhysicalTest(id, input);
    } else {
      await repo.createPhysicalTest(input, session.sub);
    }

    revalidatePath("/admin/test-fisici");
    revalidatePath(`/admin/test-fisici/atleta/${athlete.id}`);
  } catch (err) {
    console.error("[savePhysicalTestAction]", err);
    return { error: "Non è stato possibile salvare il test. Riprova." };
  }

  redirect(`/admin/test-fisici/atleta/${parsed.data.athleteId}`);
}

const batchSchema = z.object({
  athleteId: z.string().min(1, "Atleta non valida."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
  notes: z.string().optional(),
});

export interface PhysicalTestBatchFormState {
  error?: string;
  /** Campi inviati, rimandati al modulo dopo un errore: React 19 azzera i
   * campi non controllati a fine azione, quindi senza questo si perderebbe
   * tutto quanto digitato. */
  values?: Record<string, string>;
}

function failBatch(error: string, formData: FormData): PhysicalTestBatchFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "altroName" && key !== "altroValue") values[key] = value;
  }
  return { error, values };
}

interface BatchEntry {
  testName: string;
  value: string;
}

/** I dati compilati nel modulo di sessione (salti, misure corporee, righe
 * libere): uno per ogni campo non vuoto. */
function collectBatchEntries(formData: FormData): BatchEntry[] {
  const entries: BatchEntry[] = [];

  for (let trial = 1; trial <= SQUAT_JUMP_TRIALS; trial++) {
    for (const metric of ["tempo", "altezza", "forza"] as const) {
      const value = formData.get(squatJumpInputName(trial, metric))?.toString().trim();
      if (value) entries.push({ testName: squatJumpFieldName(trial, metric), value });
    }
  }

  for (const field of BODY_MEASURE_FIELDS) {
    const value = formData.get(field.key)?.toString().trim();
    if (value) entries.push({ testName: field.testName, value });
  }

  const altroNames = formData.getAll("altroName").map((v) => v.toString().trim());
  const altroValues = formData.getAll("altroValue").map((v) => v.toString().trim());
  altroNames.forEach((name, i) => {
    const value = altroValues[i];
    if (name && value) entries.push({ testName: name, value });
  });

  return entries;
}

/**
 * Registra in un colpo solo tutti i dati raccolti in una sessione (squat
 * jump + misure corporee + righe libere "Altro"): ogni campo compilato
 * diventa una riga PhysicalTest a sé, tutte con la stessa data — nessuna
 * modifica allo schema, solo più righe create insieme invece che una alla
 * volta. Campi vuoti vengono semplicemente saltati: lo staff può registrare
 * anche solo 1-2 salti o una sola misura, non serve compilare tutto.
 */
export async function saveTestBatchAction(
  _prevState: PhysicalTestBatchFormState,
  formData: FormData,
): Promise<PhysicalTestBatchFormState> {
  const session = await requireStaffPage("testfisici");
  const parsed = batchSchema.safeParse({
    athleteId: formData.get("athleteId")?.toString() ?? "",
    date: formData.get("date")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return failBatch(parsed.error.issues[0]?.message ?? "Dati non validi.", formData);
  }

  const entries = collectBatchEntries(formData);

  if (entries.length === 0) {
    return failBatch("Inserisci almeno un dato prima di salvare.", formData);
  }

  // Un errore qui non deve far perdere quanto digitato: si torna al form
  // con un messaggio invece di lasciar risalire l'eccezione.
  try {
    const repo = await getActiveRepo();
    const athlete = await repo.getAthlete(parsed.data.athleteId);
    if (!athlete) return failBatch("Atleta non trovata.", formData);

    await Promise.all(
      entries.map((entry) =>
        repo.createPhysicalTest(
          {
            athleteId: athlete.id,
            team: athlete.team,
            testName: entry.testName,
            value: entry.value,
            date: parsed.data.date,
            notes: parsed.data.notes ?? null,
          },
          session.sub,
        ),
      ),
    );

    revalidatePath("/admin/test-fisici");
    revalidatePath(`/admin/test-fisici/atleta/${athlete.id}`);
  } catch (err) {
    console.error("[saveTestBatchAction]", err);
    return failBatch("Non è stato possibile salvare i dati. Riprova.", formData);
  }

  redirect(`/admin/test-fisici/atleta/${parsed.data.athleteId}`);
}

const updateSessionSchema = batchSchema.extend({
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sessione non valida."),
});

/**
 * Modifica una sessione già registrata (tutte le righe di un'atleta in una
 * data) con lo stesso modulo dell'inserimento: ogni campo compilato aggiorna
 * la riga che già lo conteneva o ne crea una nuova, ogni campo svuotato
 * toglie la sua riga. La data può cambiare, ma non verso un giorno che ha
 * già una sessione (si mescolerebbero salti e misure di due sedute).
 *
 * Le note vanno su tutte le righe solo se sono state toccate: le righe
 * create una alla volta dal vecchio modulo possono averne di diverse, e
 * salvare senza modificarle non deve appiattirle su una sola.
 */
export async function updateTestSessionAction(
  _prevState: PhysicalTestBatchFormState,
  formData: FormData,
): Promise<PhysicalTestBatchFormState> {
  const session = await requireStaffPage("testfisici");
  const parsed = updateSessionSchema.safeParse({
    athleteId: formData.get("athleteId")?.toString() ?? "",
    originalDate: formData.get("originalDate")?.toString() ?? "",
    date: formData.get("date")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return failBatch(parsed.error.issues[0]?.message ?? "Dati non validi.", formData);
  }
  const { athleteId, originalDate, date } = parsed.data;
  const notes = parsed.data.notes ?? null;
  const notesTouched = (notes ?? "") !== (formData.get("originalNotes")?.toString().trim() ?? "");

  const entries = collectBatchEntries(formData);
  if (entries.length === 0) {
    return failBatch("Inserisci almeno un dato prima di salvare.", formData);
  }

  try {
    const repo = await getActiveRepo();
    const athlete = await repo.getAthlete(athleteId);
    if (!athlete) return failBatch("Atleta non trovata.", formData);

    const all = (await repo.listPhysicalTests({ team: athlete.team })).filter((t) => t.athleteId === athlete.id);
    const existing = all.filter((t) => t.date === originalDate);
    if (existing.length === 0) {
      return failBatch("Questa sessione non esiste più: torna alla scheda dell'atleta.", formData);
    }
    if (date !== originalDate && all.some((t) => t.date === date)) {
      return failBatch(
        `Il ${formatDateShort(date)} c'è già una sessione registrata: scegli un'altra data o modifica quella.`,
        formData,
      );
    }

    // Righe già presenti, per nome, in ordine di inserimento: due righe
    // libere con lo stesso nome si abbinano nello stesso ordine.
    const pool = new Map<string, PhysicalTest[]>();
    for (const row of [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const rows = pool.get(row.testName);
      if (rows) rows.push(row);
      else pool.set(row.testName, [row]);
    }

    const writes: Promise<unknown>[] = [];
    for (const entry of entries) {
      const match = pool.get(entry.testName)?.shift();
      const input: PhysicalTestInput = {
        athleteId: athlete.id,
        team: athlete.team,
        testName: entry.testName,
        value: entry.value,
        date,
        notes: match && !notesTouched ? match.notes : notes,
      };
      writes.push(match ? repo.updatePhysicalTest(match.id, input) : repo.createPhysicalTest(input, session.sub));
    }
    for (const leftover of pool.values()) {
      for (const row of leftover) writes.push(repo.deletePhysicalTest(row.id));
    }
    await Promise.all(writes);

    revalidatePath("/admin/test-fisici");
    revalidatePath(`/admin/test-fisici/atleta/${athlete.id}`);
  } catch (err) {
    console.error("[updateTestSessionAction]", err);
    return failBatch("Non è stato possibile salvare le modifiche. Riprova.", formData);
  }

  redirect(`/admin/test-fisici/atleta/${athleteId}`);
}

export async function deletePhysicalTestAction(formData: FormData): Promise<void> {
  await requireStaffPage("testfisici");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deletePhysicalTest(id);
  revalidatePath("/admin/test-fisici");
}

/** Una sessione Squat Jump è fino a 9 righe PhysicalTest (3 salti × tempo/
 * altezza/forza) create insieme dallo stesso batch: elimina tutte quelle di
 * un'atleta per una data, così uno sbaglio si corregge rifacendo la
 * sessione invece di editare 9 righe separate una per una. */
export async function deleteSquatJumpSessionAction(formData: FormData): Promise<void> {
  await requireStaffPage("testfisici");
  const athleteId = formData.get("athleteId")?.toString();
  const date = formData.get("date")?.toString();
  if (!athleteId || !date) return;

  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(athleteId);
  if (!athlete) return;

  const tests = await repo.listPhysicalTests({ team: athlete.team });
  const toDelete = tests.filter((t) => t.athleteId === athleteId && t.date === date && isSquatJumpField(t.testName));
  await Promise.all(toDelete.map((t) => repo.deletePhysicalTest(t.id)));

  revalidatePath("/admin/test-fisici");
  revalidatePath(`/admin/test-fisici/atleta/${athleteId}`);
}
