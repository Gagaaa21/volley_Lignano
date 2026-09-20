"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSession, setSessionCookie } from "@/lib/auth/session";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale."),
    newPassword: z.string().min(8, "La nuova password deve avere almeno 8 caratteri."),
    confirmPassword: z.string().min(1, "Conferma la nuova password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le due password non coincidono.",
    path: ["confirmPassword"],
  });

export interface ChangePasswordState {
  error?: string;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const staff = await repo.getStaffById(session.sub);
  if (!staff) redirect("/login");

  const valid = await verifyPassword(parsed.data.currentPassword, staff.passwordHash);
  if (!valid) return { error: "La password attuale non è corretta." };

  const newHash = await hashPassword(parsed.data.newPassword);
  await repo.setStaffPassword(staff.id, newHash, false);

  try {
    await setSessionCookie({
      sub: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      mustChangePassword: false,
    });
  } catch (err) {
    console.error("[cambia-password] impossibile aggiornare la sessione:", err);
    return {
      error: "Configurazione del server incompleta (SESSION_SECRET mancante). Contatta l'amministratore.",
    };
  }

  redirect(staff.hasSeenGuide ? "/admin?password_changed=1" : "/admin/guida?password_changed=1");
}
