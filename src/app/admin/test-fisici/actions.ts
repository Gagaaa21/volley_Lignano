"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
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

  redirect("/admin/test-fisici");
}

export async function deletePhysicalTestAction(formData: FormData): Promise<void> {
  await requireStaffPage("testfisici");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deletePhysicalTest(id);
  revalidatePath("/admin/test-fisici");
}
