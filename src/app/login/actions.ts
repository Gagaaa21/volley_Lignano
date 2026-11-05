"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { verifyTypedPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import {
  loginFailuresKey,
  loginLockedFor,
  loginLockedMessage,
  NO_LOGIN_FAILURES,
  parseLoginFailures,
  recordLoginFailure,
} from "@/lib/auth/loginThrottle";

const schema = z.object({
  username: z.string().min(1, "Inserisci il nome utente."),
  password: z.string().min(1, "Inserisci la password."),
});

export interface LoginState {
  error?: string;
  /** Nome utente o password sbagliati (sotto si spiega cosa controllare). */
  wrongCredentials?: boolean;
}

const WRONG: LoginState = { error: "Nome utente o password errati.", wrongCredentials: true };

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
  if (!staff) return WRONG;

  // Freno ai tentativi: un account con troppe password sbagliate di fila non ne accetta altre per un po' (vedi loginThrottle.ts).
  // Se le impostazioni non si leggono o non si scrivono l'accesso funziona come prima: il freno non deve mai chiudere fuori.
  const failuresKey = loginFailuresKey(staff.id);
  const failures = parseLoginFailures(await repo.getAppSetting(failuresKey).catch(() => null));
  const now = Date.now();
  const wait = loginLockedFor(failures, now);
  if (wait > 0) return { error: loginLockedMessage(wait) };

  const valid = await verifyTypedPassword(parsed.data.password, staff.passwordHash);
  if (!valid) {
    const next = recordLoginFailure(failures, now);
    await repo.setAppSetting(failuresKey, JSON.stringify(next)).catch((err) => console.error("[login] tentativi:", err));
    return next.lockedUntil > now ? { error: loginLockedMessage(next.lockedUntil - now) } : WRONG;
  }
  if (failures.count > 0) {
    await repo.setAppSetting(failuresKey, JSON.stringify(NO_LOGIN_FAILURES)).catch((err) => console.error("[login] tentativi:", err));
  }

  try {
    await setSessionCookie({
      sub: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      mustChangePassword: staff.mustChangePassword,
      hasSeenGuide: staff.hasSeenGuide,
    });
  } catch (err) {
    console.error("[login] impossibile creare la sessione:", err);
    return {
      error: "Configurazione del server incompleta (SESSION_SECRET mancante). Contatta l'amministratore.",
    };
  }

  if (staff.mustChangePassword) redirect("/admin/cambia-password");
  // Se non ha ancora visto la guida, il tour guidato si avvia da solo sulla
  // dashboard (vedi src/components/tour/Tour.tsx) — non serve più un
  // redirect dedicato a /admin/guida.
  redirect("/admin");
}
