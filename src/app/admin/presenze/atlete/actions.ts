"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { parseMinivolleyBulkLine } from "@/lib/text";
import { nameKey, parseAthleteBulkLine, parseJerseyNumber } from "@/lib/jersey";
import type { Athlete, AthleteInput } from "@/lib/types";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";

/** Nomi e gruppi delle atlete compaiono anche sul sito pubblico (presenze e
 * convocazioni): dopo ogni modifica si aggiornano anche quelle pagine. */
function revalidateAthletes() {
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/atlete");
  revalidatePath("/");
  revalidatePath("/minivolley");
  revalidatePath("/minivolley/presenze");
  updateTag(PUBLIC_CALENDAR_TAG);
}

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
  const jerseyNumber = parseJerseyNumber(formData.get("jerseyNumber")?.toString());
  if (jerseyNumber === undefined) {
    return { error: "Il numero di maglia deve essere un numero da 0 a 99." };
  }
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
  let numberLost = false;

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
      // Il numero di maglia serve a Scout e Live score, che non ci sono nel Minivolley.
      jerseyNumber: team === "u14u15" ? jerseyNumber : null,
      notes: parsed.data.notes ?? null,
      isActive: parsed.data.isActive,
    };

    const saved = id ? await repo.updateAthlete(id, input) : await repo.createAthlete(input, session.sub);
    // Il numero non è stato scritto: sul database manca ancora la colonna.
    numberLost = input.jerseyNumber !== null && saved.jerseyNumber !== input.jerseyNumber;

    revalidateAthletes();
  } catch (err) {
    console.error("[saveAthleteAction]", err);
    return { error: "Non è stato possibile salvare l'atleta. Riprova." };
  }

  redirect(numberLost ? "/admin/presenze/atlete?avviso=numero" : "/admin/presenze/atlete");
}

const bulkSchema = z.object({
  names: z.string().min(1, "Inserisci almeno un nominativo."),
  category: z.union([z.enum(["U14", "U15"]), z.null()]),
});

export interface BulkAthleteFormState {
  error?: string;
  created?: number;
  skipped?: number;
  /** Atlete già in anagrafica a cui l'elenco ha aggiornato il numero di maglia. */
  numbersUpdated?: number;
  /** Atlete salvate, ma senza il numero di maglia (manca la colonna sul database). */
  numbersLost?: boolean;
}

/** Le stesse informazioni di un'atleta già salvata, da cui ripartire per cambiarne una sola. */
function asInput(athlete: Athlete): AthleteInput {
  return {
    fullName: athlete.fullName,
    team: athlete.team,
    category: athlete.category,
    group: athlete.group,
    jerseyNumber: athlete.jerseyNumber,
    isActive: athlete.isActive,
    notes: athlete.notes,
  };
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
      jerseyNumber: null,
      notes: null,
      isActive: true,
    }));
  } else {
    // Ogni riga è un nome, con facoltativamente il numero di maglia prima o
    // dopo (vedi parseAthleteBulkLine). La stessa persona scritta due volte
    // conta una volta sola, e se solo una delle due righe ha il numero si
    // tiene quello.
    const byName = new Map<string, AthleteInput>();
    for (const line of lines) {
      const { fullName, jerseyNumber } = parseAthleteBulkLine(line);
      if (!/\p{L}/u.test(fullName)) continue;
      const key = nameKey(fullName);
      const already = byName.get(key);
      if (already) {
        if (already.jerseyNumber === null) already.jerseyNumber = jerseyNumber;
        continue;
      }
      byName.set(key, { fullName, team, category: parsed.data.category, group: null, jerseyNumber, notes: null, isActive: true });
    }
    inputs = [...byName.values()];
    if (inputs.length === 0) {
      return { error: "Inserisci almeno un nominativo valido." };
    }
  }

  try {
    const repo = await getActiveRepo();
    // Chi è già in anagrafica (stesso nome, senza distinguere maiuscole/
    // minuscole) non si crea di nuovo: incollare due volte lo stesso elenco, o
    // un nominativo già aggiunto singolarmente, non deve creare doppioni. Se
    // però la riga porta un numero di maglia diverso da quello registrato, il
    // numero si aggiorna: incollare l'elenco con i numeri è il modo più
    // rapido per assegnarli a tutte.
    const existing = new Map((await repo.listAthletes({ team })).map((a) => [nameKey(a.fullName), a]));
    const toCreate: AthleteInput[] = [];
    const toRenumber: { athlete: Athlete; jerseyNumber: number }[] = [];
    for (const input of inputs) {
      const found = existing.get(nameKey(input.fullName));
      if (!found) toCreate.push(input);
      else if (input.jerseyNumber !== null && found.jerseyNumber !== input.jerseyNumber) {
        toRenumber.push({ athlete: found, jerseyNumber: input.jerseyNumber });
      }
    }
    const skipped = inputs.length - toCreate.length;

    const created = toCreate.length > 0 ? await repo.createAthletesBulk(toCreate, session.sub) : [];
    const renumbered = await Promise.all(
      toRenumber.map(({ athlete, jerseyNumber }) => repo.updateAthlete(athlete.id, { ...asInput(athlete), jerseyNumber })),
    );
    const numbersLost =
      created.some((a, i) => toCreate[i]?.jerseyNumber !== null && a.jerseyNumber !== toCreate[i]?.jerseyNumber) ||
      renumbered.some((a, i) => a.jerseyNumber !== toRenumber[i].jerseyNumber);

    revalidateAthletes();
    return { created: toCreate.length, skipped, numbersUpdated: toRenumber.length, numbersLost };
  } catch (err) {
    console.error("[bulkCreateAthletesAction]", err);
    return { error: "Non è stato possibile salvare l'elenco. Riprova." };
  }
}

export type SetJerseyResult = { ok: true; jerseyNumber: number | null } | { ok: false; error: string };

/** Cambia il solo numero di maglia di un'atleta, dall'elenco (campo accanto al nome). */
export async function setAthleteJerseyAction(id: string, value: string): Promise<SetJerseyResult> {
  const session = await requireStaffPage("presenze");
  const jerseyNumber = parseJerseyNumber(value);
  if (jerseyNumber === undefined) return { ok: false, error: "Scrivi un numero da 0 a 99." };
  try {
    const repo = await getActiveRepo();
    const team = await resolveActiveTeam(session);
    const athlete = await repo.getAthlete(id);
    if (!athlete || athlete.team !== team || athlete.team !== "u14u15") return { ok: false, error: "Atleta non trovata." };
    if (athlete.jerseyNumber === jerseyNumber) return { ok: true, jerseyNumber };
    const saved = await repo.updateAthlete(id, { ...asInput(athlete), jerseyNumber });
    if (saved.jerseyNumber !== jerseyNumber) {
      return { ok: false, error: "Il numero non è stato registrato: nel database manca ancora la colonna del numero di maglia." };
    }
    revalidatePath("/admin/presenze/atlete");
    return { ok: true, jerseyNumber };
  } catch (err) {
    console.error("[setAthleteJerseyAction]", err);
    return { ok: false, error: "Non è stato possibile salvare il numero. Riprova." };
  }
}

export async function deleteAthleteAction(formData: FormData): Promise<void> {
  await requireStaffPage("presenze");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deleteAthlete(id);
  revalidateAthletes();
  redirect("/admin/presenze/atlete");
}
