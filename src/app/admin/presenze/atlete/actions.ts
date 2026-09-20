"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import type { AthleteInput } from "@/lib/types";

const schema = z.object({
  fullName: z.string().min(1, "Inserisci nome e cognome."),
  category: z.union([z.enum(["U14", "U15"]), z.null()]),
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
  const session = await requireStaff();
  const rawCategory = formData.get("category")?.toString().trim();
  const parsed = schema.safeParse({
    fullName: formData.get("fullName")?.toString().trim() ?? "",
    category: rawCategory ? rawCategory : null,
    notes: formData.get("notes")?.toString().trim() || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const input: AthleteInput = {
    fullName: parsed.data.fullName,
    category: parsed.data.category,
    notes: parsed.data.notes ?? null,
    isActive: parsed.data.isActive,
  };

  const repo = await getRepo();
  if (id) {
    await repo.updateAthlete(id, input);
  } else {
    await repo.createAthlete(input, session.sub);
  }

  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/atlete");
  redirect("/admin/presenze/atlete");
}

const bulkSchema = z.object({
  names: z.string().min(1, "Inserisci almeno un nominativo."),
  category: z.union([z.enum(["U14", "U15"]), z.null()]),
});

export interface BulkAthleteFormState {
  error?: string;
  created?: number;
}

export async function bulkCreateAthletesAction(
  _prevState: BulkAthleteFormState,
  formData: FormData,
): Promise<BulkAthleteFormState> {
  const session = await requireStaff();

  const rawCategory = formData.get("category")?.toString().trim();
  const parsed = bulkSchema.safeParse({
    names: formData.get("names")?.toString() ?? "",
    category: rawCategory ? rawCategory : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const names = [
    ...new Set(
      parsed.data.names
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) {
    return { error: "Inserisci almeno un nominativo valido." };
  }

  const inputs: AthleteInput[] = names.map((fullName) => ({
    fullName,
    category: parsed.data.category,
    notes: null,
    isActive: true,
  }));

  const repo = await getRepo();
  await repo.createAthletesBulk(inputs, session.sub);

  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/atlete");
  return { created: names.length };
}

export async function deleteAthleteAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
  await repo.deleteAthlete(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/atlete");
}
