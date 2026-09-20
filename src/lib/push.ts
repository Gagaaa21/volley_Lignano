import "server-only";
import webpush from "web-push";
import { getRepo } from "@/lib/db";

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

/**
 * Invia una notifica push a tutti i dispositivi iscritti quando il
 * calendario cambia. Non lancia mai eccezioni: se le chiavi VAPID non sono
 * configurate, o l'invio fallisce, l'operazione di calendario che l'ha
 * chiamata deve comunque andare a buon fine.
 */
export async function notifyCalendarChange(payload: CalendarNotification): Promise<void> {
  try {
    if (!ensureConfigured()) return;

    const repo = await getRepo();
    const subscriptions = await repo.listPushSubscriptions();
    if (subscriptions.length === 0) return;

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
  } catch (err) {
    console.error("[push] notifyCalendarChange fallito:", err);
  }
}
