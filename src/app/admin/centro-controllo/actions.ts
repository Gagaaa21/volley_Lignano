"use server";

import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";

const schema = z.object({
  title: z.string().min(1, "Inserisci un titolo."),
  body: z.string().min(1, "Inserisci il testo della notifica."),
});

export interface ManualNotificationState {
  error?: string;
  success?: boolean;
  sentTo?: number;
}

/** Invia una notifica push manuale a tutti gli iscritti al calendario
 * pubblico (non solo allo staff): pensata per avvisi occasionali che non
 * corrispondono a una modifica del calendario, es. "convocazioni
 * disponibili". Riservata al Developer proprio perché raggiunge tutti. */
export async function sendManualNotificationAction(
  _prevState: ManualNotificationState,
  formData: FormData,
): Promise<ManualNotificationState> {
  await requireDev();

  const parsed = schema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    body: formData.get("body")?.toString().trim() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const sentTo = (await repo.listPushSubscriptions()).length;
  if (sentTo === 0) {
    return { error: "Nessun dispositivo è iscritto alle notifiche al momento." };
  }

  await notifyCalendarChange({ title: parsed.data.title, body: parsed.data.body, url: "/" });
  return { success: true, sentTo };
}
