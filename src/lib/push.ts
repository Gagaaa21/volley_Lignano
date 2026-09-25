import "server-only";
import webpush from "web-push";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { PushSubscriptionRecord, TrainingTeam } from "@/lib/types";

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export interface CalendarNotification {
  title: string;
  body: string;
  url?: string;
  /** Icona mostrata nella notifica: di default lo stemma del club, ma per
   * Minivolley usa il logo S3, così l'avviso si riconosce subito come
   * "suo" anche fuori dall'app. */
  icon?: string;
}

async function sendToSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  payload: CalendarNotification,
): Promise<void> {
  const repo = await getRepo();
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    icon: payload.icon,
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        // "urgency: high" dice al servizio push (FCM/APNs/Mozilla) di
        // consegnare subito anche a schermo spento o app in background,
        // invece di rimandare la consegna fino alla prossima riattivazione
        // del dispositivo (comportamento di default senza questo header).
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { urgency: "high" },
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await repo.deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => {});
        } else {
          console.error("[push] invio notifica fallito:", err);
        }
      }
    }),
  );
}

/**
 * Invia una notifica push ai dispositivi iscritti alla squadra "team"
 * quando il suo calendario cambia — chi segue Minivolley non riceve gli
 * avvisi U14/U15 e viceversa. Non lancia mai eccezioni: se le chiavi VAPID
 * non sono configurate, o l'invio fallisce, l'operazione di calendario che
 * l'ha chiamata deve comunque andare a buon fine.
 */
export async function notifyCalendarChange(
  payload: CalendarNotification,
  team: TrainingTeam,
): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    if ((await getSession())?.testMode) return;

    const repo = await getRepo();
    const subscriptions = (await repo.listPushSubscriptions()).filter((sub) => sub.team === team);
    if (subscriptions.length === 0) return;

    const icon = payload.icon ?? (team === "minivolley" ? "/icons-s3/icon-192.png" : undefined);
    await sendToSubscriptions(subscriptions, { ...payload, icon });
  } catch (err) {
    console.error("[push] notifyCalendarChange fallito:", err);
  }
}

/**
 * Come notifyCalendarChange, ma riservata ai soli dispositivi iscritti da
 * uno staff autenticato (admin/dev) — usata per eventi interni allo staff
 * come la creazione o l'assegnazione di una scheda, che non riguardano il
 * pubblico iscritto al calendario. Filtrata per squadra come
 * notifyCalendarChange: una scheda U14/U15 non deve notificare un
 * dispositivo iscritto mentre si lavorava sul Minivolley (e viceversa).
 */
export async function notifyStaffChange(payload: CalendarNotification, team: TrainingTeam): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    if ((await getSession())?.testMode) return;

    const repo = await getRepo();
    const subscriptions = (await repo.listPushSubscriptions()).filter(
      (sub) => sub.staffId !== null && sub.team === team,
    );
    if (subscriptions.length === 0) return;

    const icon = payload.icon ?? (team === "minivolley" ? "/icons-s3/icon-192.png" : undefined);
    await sendToSubscriptions(subscriptions, { ...payload, icon });
  } catch (err) {
    console.error("[push] notifyStaffChange fallito:", err);
  }
}

/**
 * Come notifyStaffChange, ma ristretta ai soli account con ruolo Admin
 * (esclude Developer e pubblico) — usata dallo strumento di invio manuale
 * nel Centro di controllo quando il Developer sceglie di avvisare solo lo
 * staff Admin invece di tutti.
 */
export async function notifyAdmins(payload: CalendarNotification): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    if ((await getSession())?.testMode) return;

    const repo = await getRepo();
    const [subscriptions, staff] = await Promise.all([repo.listPushSubscriptions(), repo.listStaff()]);
    const adminIds = new Set(staff.filter((s) => s.role === "admin").map((s) => s.id));
    const targeted = subscriptions.filter((sub) => sub.staffId && adminIds.has(sub.staffId));
    if (targeted.length === 0) return;

    await sendToSubscriptions(targeted, payload);
  } catch (err) {
    console.error("[push] notifyAdmins fallito:", err);
  }
}
