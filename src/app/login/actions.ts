"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

const schema = z.object({
  username: z.string().min(1, "Inserisci il nome utente."),
  password: z.string().min(1, "Inserisci la password."),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const staff = await repo.getStaffByUsername(parsed.data.username.trim());
  if (!staff) return { error: "Nome utente o password errati." };

  const valid = await verifyPassword(parsed.data.password, staff.passwordHash);
  if (!valid) return { error: "Nome utente o password errati." };

  try {
    await setSessionCookie({
      sub: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      mustChangePassword: staff.mustChangePassword,
    });
  } catch (err) {
    console.error("[login] impossibile creare la sessione:", err);
    return {
      error: "Configurazione del server incompleta (SESSION_SECRET mancante). Contatta l'amministratore.",
    };
  }

  redirect(staff.mustChangePassword ? "/admin/cambia-password" : "/admin");
}
