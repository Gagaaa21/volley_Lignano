"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { BODY_MEASURE_FIELDS, SQUAT_JUMP_TRIALS, squatJumpFieldName } from "@/lib/physicalTestFields";
import type { PhysicalTestInput } from "@/lib/types";

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
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const entries: { testName: string; value: string }[] = [];

  for (let trial = 1; trial <= SQUAT_JUMP_TRIALS; trial++) {
    const tempo = formData.get(`squatJump_${trial}_tempo`)?.toString().trim();
    if (tempo) entries.push({ testName: squatJumpFieldName(trial, "tempo"), value: tempo });
    const altezza = formData.get(`squatJump_${trial}_altezza`)?.toString().trim();
    if (altezza) entries.push({ testName: squatJumpFieldName(trial, "altezza"), value: altezza });
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

  if (entries.length === 0) {
    return { error: "Inserisci almeno un dato prima di salvare." };
  }

  // Un errore qui non deve far perdere quanto digitato: si torna al form
  // con un messaggio invece di lasciar risalire l'eccezione.
  try {
    const repo = await getActiveRepo();
    const athlete = await repo.getAthlete(parsed.data.athleteId);
    if (!athlete) return { error: "Atleta non trovata." };

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
    return { error: "Non è stato possibile salvare i dati. Riprova." };
  }

  redirect(`/admin/test-fisici/atleta/${parsed.data.athleteId}`);
}

export async function deletePhysicalTestAction(formData: FormData): Promise<void> {
  await requireStaffPage("testfisici");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deletePhysicalTest(id);
  revalidatePath("/admin/test-fisici");
}
