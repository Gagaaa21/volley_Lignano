import "server-only";
import webpush from "web-push";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { PushSubscriptionRecord } from "@/lib/types";

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
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
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
 * Invia una notifica push a tutti i dispositivi iscritti quando il
 * calendario cambia. Non lancia mai eccezioni: se le chiavi VAPID non sono
 * configurate, o l'invio fallisce, l'operazione di calendario che l'ha
 * chiamata deve comunque andare a buon fine.
 */
export async function notifyCalendarChange(payload: CalendarNotification): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    if ((await getSession())?.testMode) return;

    const repo = await getRepo();
    const subscriptions = await repo.listPushSubscriptions();
    if (subscriptions.length === 0) return;

    await sendToSubscriptions(subscriptions, payload);
  } catch (err) {
    console.error("[push] notifyCalendarChange fallito:", err);
  }
}

/**
 * Come notifyCalendarChange, ma riservata ai soli dispositivi iscritti da
 * uno staff autenticato (admin/dev) — usata per eventi interni allo staff
 * come la creazione o l'assegnazione di una scheda, che non riguardano il
 * pubblico iscritto al calendario.
 */
export async function notifyStaffChange(payload: CalendarNotification): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    if ((await getSession())?.testMode) return;

    const repo = await getRepo();
    const subscriptions = (await repo.listPushSubscriptions()).filter((sub) => sub.staffId !== null);
    if (subscriptions.length === 0) return;

    await sendToSubscriptions(subscriptions, payload);
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
