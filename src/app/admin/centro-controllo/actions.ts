"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { notifyAdmins, notifyCalendarChange } from "@/lib/push";
import { ADMIN_PAGES, TEAMS, type AdminPage, type TrainingTeam } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1, "Inserisci un titolo."),
  body: z.string().min(1, "Inserisci il testo della notifica."),
  audience: z.enum(["all-u14u15", "all-minivolley", "admins"]),
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
    const team = parsed.data.audience === "all-minivolley" ? "minivolley" : "u14u15";
    sentTo = subscriptions.filter((sub) => sub.team === team).length;
  }

  if (sentTo === 0) {
    return {
      error:
        parsed.data.audience === "admins"
          ? "Nessun admin è iscritto alle notifiche al momento."
          : "Nessun dispositivo è iscritto alle notifiche di questa squadra al momento.",
    };
  }

  const payload = { title: parsed.data.title, body: parsed.data.body, url: "/" };
  if (parsed.data.audience === "admins") {
    await notifyAdmins(payload);
  } else if (parsed.data.audience === "all-minivolley") {
    await notifyCalendarChange({ ...payload, url: "/minivolley" }, "minivolley");
  } else {
    await notifyCalendarChange(payload, "u14u15");
  }
  return { success: true, sentTo };
}

/** Aggiorna quali pagine dell'area riservata e quali squadre (U14/U15,
 * Minivolley) un account Admin può gestire. Riservato al Developer: un
 * account "dev" non è mai limitabile da qui (vede sempre tutto), quindi la
 * richiesta viene ignorata se il bersaglio non è un Admin. */
export async function updateStaffPermissionsAction(formData: FormData): Promise<void> {
  await requireDev();

  const staffId = formData.get("staffId")?.toString();
  if (!staffId) return;

  const repo = await getRepo();
  const target = await repo.getStaffById(staffId);
  if (!target || target.role !== "admin") return;

  const submittedPages = new Set(formData.getAll("pages").map((v) => v.toString()));
  const allowedPages: AdminPage[] = ADMIN_PAGES.filter((page) => submittedPages.has(page));

  const submittedTeams = new Set(formData.getAll("teams").map((v) => v.toString()));
  const allowedTeams: TrainingTeam[] = TEAMS.filter((team) => submittedTeams.has(team));

  await repo.updateStaffPermissions(staffId, { allowedPages, allowedTeams });
  revalidatePath("/admin/centro-controllo");
}
