"use server";

import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { notifyAdmins, notifyCalendarChange } from "@/lib/push";

const schema = z.object({
  title: z.string().min(1, "Inserisci un titolo."),
  body: z.string().min(1, "Inserisci il testo della notifica."),
  audience: z.enum(["all", "admins"]),
});

export interface ManualNotificationState {
  error?: string;
  success?: boolean;
  sentTo?: number;
}

/** Invia una notifica push manuale, a scelta a tutti gli iscritti al
 * calendario pubblico oppure solo agli account Admin: pensata per avvisi
 * occasionali che non corrispondono a una modifica del calendario, es.
 * "convocazioni disponibili". Riservata al Developer, che sceglie ogni
 * volta chi deve riceverla. */
export async function sendManualNotificationAction(
  _prevState: ManualNotificationState,
  formData: FormData,
): Promise<ManualNotificationState> {
  await requireDev();

  const parsed = schema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    body: formData.get("body")?.toString().trim() ?? "",
    audience: formData.get("audience")?.toString() ?? "all",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const subscriptions = await repo.listPushSubscriptions();

  let sentTo: number;
  if (parsed.data.audience === "admins") {
    const staff = await repo.listStaff();
    const adminIds = new Set(staff.filter((s) => s.role === "admin").map((s) => s.id));
    sentTo = subscriptions.filter((sub) => sub.staffId && adminIds.has(sub.staffId)).length;
  } else {
    sentTo = subscriptions.length;
  }

  if (sentTo === 0) {
    return {
      error:
        parsed.data.audience === "admins"
          ? "Nessun admin è iscritto alle notifiche al momento."
          : "Nessun dispositivo è iscritto alle notifiche al momento.",
    };
  }

  const payload = { title: parsed.data.title, body: parsed.data.body, url: "/" };
  if (parsed.data.audience === "admins") {
    await notifyAdmins(payload);
  } else {
    await notifyCalendarChange(payload);
  }
  return { success: true, sentTo };
}
