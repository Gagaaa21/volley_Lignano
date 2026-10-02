"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { parseMinivolleyBulkLine } from "@/lib/text";
import type { AthleteInput } from "@/lib/types";

const schema = z.object({
  fullName: z.string().min(1, "Inserisci nome e cognome."),
  category: z.union([z.enum(["U14", "U15"]), z.null()]),
  group: z.union([z.enum(["lignano", "san_michele"]), z.null()]),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

export interface AthleteFormState {
  error?: string;
}

export async function saveAthleteAction(
  _prevState: AthleteFormState,
  formData: FormData,
): Promise<AthleteFormState> {
  const session = await requireStaffPage("presenze");
  const rawCategory = formData.get("category")?.toString().trim();
  const rawGroup = formData.get("group")?.toString().trim();
  const parsed = schema.safeParse({
    fullName: formData.get("fullName")?.toString().trim() ?? "",
    category: rawCategory ? rawCategory : null,
    group: rawGroup ? rawGroup : null,
    notes: formData.get("notes")?.toString().trim() || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // quanto digitato: si torna al form con un messaggio invece di lasciar
  // risalire l'eccezione (che smonterebbe il form senza un error.tsx
  // dedicato).
  try {
    const repo = await getActiveRepo();
    // La squadra di un'atleta esistente non cambia mai in modifica.
    const existing = id ? await repo.getAthlete(id) : null;
    const team = existing?.team ?? (await resolveActiveTeam(session));
    // Il form mostra solo il campo giusto per la squadra (Categoria per
    // u14u15, Gruppo per Minivolley), ma si persiste solo quello coerente
    // anche qui come difesa in profondità.
    const input: AthleteInput = {
      fullName: parsed.data.fullName,
      team,
      category: team === "u14u15" ? parsed.data.category : null,
      group: team === "minivolley" ? parsed.data.group : null,
      notes: parsed.data.notes ?? null,
      isActive: parsed.data.isActive,
    };

    if (id) {
      await repo.updateAthlete(id, input);
    } else {
      await repo.createAthlete(input, session.sub);
    }

    revalidatePath("/admin/presenze");
    revalidatePath("/admin/presenze/atlete");
  } catch (err) {
    console.error("[saveAthleteAction]", err);
    return { error: "Non è stato possibile salvare l'atleta. Riprova." };
  }

  redirect("/admin/presenze/atlete");
}

const bulkSchema = z.object({
  names: z.string().min(1, "Inserisci almeno un nominativo."),
  category: z.union([z.enum(["U14", "U15"]), z.null()]),
});

export interface BulkAthleteFormState {
  error?: string;
  created?: number;
  skipped?: number;
}

export async function bulkCreateAthletesAction(
  _prevState: BulkAthleteFormState,
  formData: FormData,
): Promise<BulkAthleteFormState> {
  const session = await requireStaffPage("presenze");
  const team = await resolveActiveTeam(session);

  const rawCategory = formData.get("category")?.toString().trim();
  const parsed = bulkSchema.safeParse({
    names: formData.get("names")?.toString() ?? "",
    category: rawCategory ? rawCategory : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const lines = parsed.data.names
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let inputs: AthleteInput[];
  if (team === "minivolley") {
    // Ogni riga è "Gruppo<TAB>Nome<TAB>Cognome": il gruppo arriva dalla riga
    // stessa, niente selettore unico come per u14u15 (vedi
    // parseMinivolleyBulkLine). Dedup sul nome normalizzato, non sulla riga
    // grezza, per non creare falsi-unici per via di spazi residui nel testo
    // incollato.
    const seen = new Set<string>();
    const rows = lines
      .map(parseMinivolleyBulkLine)
      .filter((row) => row.fullName && !seen.has(row.fullName) && seen.add(row.fullName));
    if (rows.length === 0) {
      return { error: "Inserisci almeno un nominativo valido." };
    }
    inputs = rows.map(({ fullName, group }) => ({
      fullName,
      team,
      category: null,
      group,
      notes: null,
      isActive: true,
    }));
  } else {
    const names = [...new Set(lines)];
    if (names.length === 0) {
      return { error: "Inserisci almeno un nominativo valido." };
    }
    inputs = names.map((fullName) => ({
      fullName,
      team,
      category: parsed.data.category,
      group: null,
      notes: null,
      isActive: true,
    }));
  }

  try {
    const repo = await getActiveRepo();
    // Salta chi è già in anagrafica (stesso nome, senza distinguere
    // maiuscole/minuscole): incollare due volte lo stesso elenco, o un
    // nominativo già aggiunto singolarmente, non deve creare doppioni.
    const existingNames = new Set((await repo.listAthletes({ team })).map((a) => a.fullName.trim().toLowerCase()));
    const beforeCount = inputs.length;
    inputs = inputs.filter((i) => !existingNames.has(i.fullName.trim().toLowerCase()));
    const skipped = beforeCount - inputs.length;

    if (inputs.length > 0) await repo.createAthletesBulk(inputs, session.sub);

    revalidatePath("/admin/presenze");
    revalidatePath("/admin/presenze/atlete");
    return { created: inputs.length, skipped };
  } catch (err) {
    console.error("[bulkCreateAthletesAction]", err);
    return { error: "Non è stato possibile salvare l'elenco. Riprova." };
  }
}

export async function deleteAthleteAction(formData: FormData): Promise<void> {
  await requireStaffPage("presenze");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deleteAthlete(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/atlete");
  redirect("/admin/presenze/atlete");
}
