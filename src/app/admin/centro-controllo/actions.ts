"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { notifyAdmins, notifyCalendarChange } from "@/lib/push";
import { refreshFederation } from "@/lib/federation/refresh";
import { isAllowedFederationUrl } from "@/lib/federation/url";
import { NOTIFY_PROMPT_COOLDOWN_MS, NOTIFY_PROMPT_SETTING } from "@/lib/notifyPrompt";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { ADMIN_PAGES, TEAMS, type AdminPage, type TrainingTeam } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1, "Inserisci un titolo."),
  body: z.string().min(1, "Inserisci il testo della notifica."),
  audience: z.enum(["all-u14u15", "all-minivolley", "admins"]),
});

export interface ManualNotificationState {
  error?: string;
  success?: boolean;
  /** Dispositivi a cui il servizio push ha consegnato la notifica. */
  sentTo?: number;
  /** Dispositivi che non esistevano più (iscrizione annullata dal browser): tolti dall'elenco. */
  removed?: number;
  /** Dispositivi con un errore temporaneo: la notifica non è arrivata. */
  failed?: number;
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

  let attempted: number;
  if (parsed.data.audience === "admins") {
    const staff = await repo.listStaff();
    const adminIds = new Set(staff.filter((s) => s.role === "admin").map((s) => s.id));
    attempted = subscriptions.filter((sub) => sub.staffId && adminIds.has(sub.staffId)).length;
  } else {
    const team = parsed.data.audience === "all-minivolley" ? "minivolley" : "u14u15";
    attempted = subscriptions.filter((sub) => sub.team === team).length;
  }

  if (attempted === 0) {
    return {
      error:
        parsed.data.audience === "admins"
          ? "Nessun admin è iscritto alle notifiche al momento."
          : "Nessun dispositivo è iscritto alle notifiche di questa squadra al momento.",
    };
  }

  const payload = { title: parsed.data.title, body: parsed.data.body, url: "/" };
  const result =
    parsed.data.audience === "admins"
      ? await notifyAdmins(payload)
      : parsed.data.audience === "all-minivolley"
        ? await notifyCalendarChange({ ...payload, url: "/minivolley" }, "minivolley")
        : await notifyCalendarChange(payload, "u14u15");

  // Niente consegne e niente errori: l'invio non è partito (chiavi VAPID mancanti o modalità prova).
  if (result.delivered + result.removed + result.failed === 0) {
    return {
      error: "L'invio non è partito: controlla le chiavi per le notifiche (VAPID) e che la modalità prova sia spenta.",
    };
  }
  return { success: true, sentTo: result.delivered, removed: result.removed, failed: result.failed };
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

export interface FederationSourceFormState {
  error?: string;
  message?: string;
}

/** Imposta dove leggere il girone di una categoria (indirizzo della pagina
 * sul portale federale e nome della nostra squadra) e lo rilegge subito, così
 * il Developer vede se l'indirizzo è giusto. Indirizzo vuoto = girone non
 * ancora pubblicato: la categoria resta nascosta. Riservato al Developer. */
export async function saveFederationSourceAction(
  _prevState: FederationSourceFormState,
  formData: FormData,
): Promise<FederationSourceFormState> {
  await requireDev();

  const categoryRaw = formData.get("category")?.toString();
  if (categoryRaw !== "U14" && categoryRaw !== "U15") return { error: "Categoria non valida." };
  const category = categoryRaw;

  const url = formData.get("url")?.toString().trim() ?? "";
  if (url && !isAllowedFederationUrl(url)) {
    return {
      error:
        "Indirizzo non valido: incolla la pagina del girone dal portale della federazione (comincia con https:// e finisce in federvolley.it o portalefipav.net).",
    };
  }
  const teamAliases = (formData.get("aliases")?.toString() ?? "")
    .split(/[\n,;]+/)
    .map((alias) => alias.trim())
    .filter(Boolean);
  if (url && teamAliases.length === 0) {
    return { error: "Scrivi come compare la squadra nel girone (es. CDA VOLLEY LIGNANO)." };
  }
  const enabled = formData.get("enabled") === "on";

  try {
    const repo = await getRepo();
    const previous = (await repo.listFederationSources()).find((source) => source.category === category);
    await repo.saveFederationSource(category, { url: url || null, teamAliases, enabled });

    // Un girone diverso non deve mostrare, nemmeno per poco, i dati di quello
    // precedente: se l'indirizzo cambia si riparte da zero.
    if ((previous?.url ?? "") !== url) {
      await repo.saveFederationSnapshot({
        category,
        girone: null,
        fetchedAt: null,
        lastError: null,
        lastErrorAt: null,
      });
    }

    let message = url ? "Salvato." : "Salvato: girone non ancora pubblicato, la categoria resta nascosta.";
    if (url && enabled) {
      const [outcome] = await refreshFederation(repo, { minIntervalMs: 0, categories: [category] });
      if (outcome?.status === "failed") {
        revalidateFederationPages();
        return { error: `Salvato, ma la lettura non è riuscita: ${outcome.message}` };
      }
      const snapshot = (await repo.listFederationSnapshots()).find((snap) => snap.category === category);
      if (snapshot?.girone) {
        message = `Salvato. Girone letto: ${snapshot.girone.standings.length} squadre, ${snapshot.girone.matches.length} gare.`;
      }
    }
    revalidateFederationPages();
    return { message };
  } catch (error) {
    console.error("[saveFederationSourceAction]", error);
    return { error: "Non è stato possibile salvare. Riprova." };
  }
}

function revalidateFederationPages() {
  revalidatePath("/admin/centro-controllo");
  revalidatePath("/admin/partite");
  revalidatePath("/admin/manutenzione");
  revalidatePath("/admin");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

export interface NotificationPromptState {
  error?: string;
  success?: boolean;
}

/**
 * «Chiedi a tutti di attivare le notifiche»: da questo momento chi apre il
 * sito (pubblico o area riservata) senza aver ancora attivato le notifiche
 * rivede il messaggio «Attiva le notifiche», anche se l'aveva chiuso da
 * poco. Non invia nulla a chi non è già iscritto (senza iscrizione non c'è
 * modo di raggiungerlo): il messaggio compare alla sua prossima visita. Chi
 * ha già attivato le notifiche, o le ha bloccate dal browser, non vede niente.
 * Riservata al Developer; tra una richiesta e l'altra passa almeno un'ora.
 */
export async function requestNotificationPromptAction(): Promise<NotificationPromptState> {
  await requireDev();
  try {
    const repo = await getRepo();
    const last = await repo.getAppSetting(NOTIFY_PROMPT_SETTING);
    if (last) {
      const waitMs = NOTIFY_PROMPT_COOLDOWN_MS - (Date.now() - Date.parse(last));
      if (waitMs > 0) {
        return {
          error: `Hai già inviato la richiesta da poco: attendi ancora ${Math.ceil(waitMs / 60_000)} minuti, altrimenti chi l'ha appena chiusa se la ritrova subito.`,
        };
      }
    }
    await repo.setAppSetting(NOTIFY_PROMPT_SETTING, new Date().toISOString());
    revalidatePath("/admin/centro-controllo");
    return { success: true };
  } catch (error) {
    console.error("[requestNotificationPromptAction]", error);
    return {
      error:
        "Non è stato possibile salvare la richiesta. Se non l'hai ancora fatto, esegui su Supabase l'SQL della tabella app_settings (in fondo a supabase/schema.sql).",
    };
  }
}
