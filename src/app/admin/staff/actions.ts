"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireDev, requireStaffPage } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_PAGES, TEAMS } from "@/lib/types";

const schema = z.object({
  username: z
    .string()
    .min(3, "Il nome utente deve avere almeno 3 caratteri.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Usa solo lettere, numeri, punti, trattini e underscore."),
  fullName: z.string().min(1, "Inserisci nome e cognome."),
  temporaryPassword: z.string().min(8, "La password temporanea deve avere almeno 8 caratteri."),
});

export interface StaffFormState {
  error?: string;
  created?: { username: string; password: string };
}

export async function createStaffAction(
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const session = await requireStaffPage("staff");

  const parsed = schema.safeParse({
    username: formData.get("username")?.toString().trim() ?? "",
    fullName: formData.get("fullName")?.toString().trim() ?? "",
    temporaryPassword: formData.get("temporaryPassword")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  try {
    const repo = await getRepo();
    const existing = await repo.getStaffByUsername(parsed.data.username);
    if (existing) {
      return { error: "Questo nome utente è già in uso." };
    }

    const passwordHash = await hashPassword(parsed.data.temporaryPassword);
    await repo.createStaff({
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      passwordHash,
      role: "admin",
      mustChangePassword: true,
      allowedPages: ADMIN_PAGES,
      allowedTeams: TEAMS,
      createdBy: session.sub,
    });

    revalidatePath("/admin/staff");
    return { created: { username: parsed.data.username, password: parsed.data.temporaryPassword } };
  } catch (err) {
    console.error("[createStaffAction]", err);
    return { error: "Non è stato possibile creare l'account. Riprova." };
  }
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const session = await requireDev();
  const id = formData.get("id")?.toString();
  if (!id || id === session.sub) return;

  const repo = await getRepo();
  const target = await repo.getStaffById(id);
  if (!target || target.role === "dev") return;

  await repo.deleteStaff(id);
  revalidatePath("/admin/staff");
}

const updateSchema = z.object({
  username: z
    .string()
    .min(3, "Il nome utente deve avere almeno 3 caratteri.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Usa solo lettere, numeri, punti, trattini e underscore."),
  fullName: z.string().min(1, "Inserisci nome e cognome."),
  newPassword: z.union([z.string().min(8, "La nuova password deve avere almeno 8 caratteri."), z.literal("")]),
});

export interface UpdateStaffFormState {
  error?: string;
  saved?: boolean;
  resetPassword?: { username: string; password: string };
}

export async function updateStaffAction(
  _prevState: UpdateStaffFormState,
  formData: FormData,
): Promise<UpdateStaffFormState> {
  await requireDev();

  const id = formData.get("id")?.toString();
  if (!id) return { error: "Account non trovato." };

  const parsed = updateSchema.safeParse({
    username: formData.get("username")?.toString().trim() ?? "",
    fullName: formData.get("fullName")?.toString().trim() ?? "",
    newPassword: formData.get("newPassword")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  try {
    const repo = await getRepo();
    const target = await repo.getStaffById(id);
    if (!target || target.role === "dev") return { error: "Account non trovato." };

    const existing = await repo.getStaffByUsername(parsed.data.username);
    if (existing && existing.id !== id) {
      return { error: "Questo nome utente è già in uso." };
    }

    await repo.updateStaffProfile(id, { username: parsed.data.username, fullName: parsed.data.fullName });

    let resetPassword: UpdateStaffFormState["resetPassword"];
    if (parsed.data.newPassword) {
      const passwordHash = await hashPassword(parsed.data.newPassword);
      await repo.setStaffPassword(id, passwordHash, true);
      resetPassword = { username: parsed.data.username, password: parsed.data.newPassword };
    }

    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${id}`);
    return { saved: true, resetPassword };
  } catch (err) {
    console.error("[updateStaffAction]", err);
    return { error: "Non è stato possibile salvare le modifiche. Riprova." };
  }
}
