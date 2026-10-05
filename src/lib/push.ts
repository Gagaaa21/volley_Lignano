import "server-only";
import webpush from "web-push";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { AdminPage, PushSubscriptionRecord, TrainingTeam } from "@/lib/types";

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

/** Quanto a lungo il servizio push (FCM, Mozilla, Apple) tiene in coda una
 * notifica per un dispositivo spento o senza rete, prima di scartarla: una
 * settimana, perché una partita spostata resta utile a chi riaccende il
 * telefono dopo un giorno o due. (Senza indicazione il limite è di 4
 * settimane, troppo anche per un avviso ormai vecchio.) */
const PUSH_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Esito di un invio: quanti dispositivi hanno ricevuto la notifica dal
 * servizio push, quanti non esistevano più (rimossi dall'elenco) e quanti
 * hanno dato un errore temporaneo. */
export interface PushResult {
  delivered: number;
  removed: number;
  failed: number;
}

const NOTHING_SENT: PushResult = { delivered: 0, removed: 0, failed: 0 };

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
): Promise<PushResult> {
  const repo = await getRepo();
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    icon: payload.icon,
  });

  const result: PushResult = { delivered: 0, removed: 0, failed: 0 };
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        // "urgency: high" dice al servizio push (FCM/APNs/Mozilla) di
        // consegnare subito anche a schermo spento, in risparmio energetico
        // o con il telefono fermo (modalità Doze di Android): senza questo
        // header la consegna può slittare alla prossima "finestra di
        // manutenzione" del dispositivo, anche di ore. "TTL" fissa per
        // quanto tempo riprovare se il dispositivo è spento o senza rete.
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { urgency: "high", TTL: PUSH_TTL_SECONDS },
        );
        result.delivered++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Il browser ha annullato l'iscrizione: inutile riprovare.
          await repo.deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => {});
          result.removed++;
        } else {
          console.error("[push] invio notifica fallito:", err);
          result.failed++;
        }
      }
    }),
  );
  return result;
}

/**
 * Invia una notifica push ai dispositivi iscritti alla squadra "team"
 * quando il suo calendario cambia — chi segue Minivolley non riceve gli
 * avvisi U14/U15 e viceversa. Non lancia mai eccezioni: se le chiavi VAPID
 * non sono configurate, o l'invio fallisce, l'operazione di calendario che
 * l'ha chiamata deve comunque andare a buon fine.
 */
export async function notifyCalendarChange(payload: CalendarNotification, team: TrainingTeam): Promise<PushResult> {
  try {
    if (!ensureConfigured()) return NOTHING_SENT;
    if ((await getSession())?.testMode) return NOTHING_SENT;

    const repo = await getRepo();
    const subscriptions = (await repo.listPushSubscriptions()).filter((sub) => sub.team === team);
    if (subscriptions.length === 0) return NOTHING_SENT;

    const icon = payload.icon ?? (team === "minivolley" ? "/icons-s3/icon-192.png" : undefined);
    return await sendToSubscriptions(subscriptions, { ...payload, icon });
  } catch (err) {
    console.error("[push] notifyCalendarChange fallito:", err);
    return NOTHING_SENT;
  }
}

/**
 * Come notifyCalendarChange, ma riservata ai soli dispositivi iscritti da
 * uno staff autenticato (admin/dev) — usata per eventi interni allo staff
 * come la creazione o l'assegnazione di una scheda, che non riguardano il
 * pubblico iscritto al calendario. Filtrata per squadra come
 * notifyCalendarChange: una scheda U14/U15 non deve notificare un
 * dispositivo iscritto mentre si lavorava sul Minivolley (e viceversa).
 *
 * Filtrata anche per pagina: un Admin a cui il Developer ha tolto l'accesso
 * a una sezione (es. Presenze, vedi Centro di controllo) non deve riceverne
 * le notifiche nemmeno se il suo dispositivo resta iscritto alla squadra —
 * stesso principio di requireStaffPage(), solo lato invio invece che lato
 * accesso alla pagina. Un Developer vede/riceve sempre tutto.
 */
export async function notifyStaffChange(
  payload: CalendarNotification,
  team: TrainingTeam,
  page: AdminPage,
): Promise<PushResult> {
  try {
    if (!ensureConfigured()) return NOTHING_SENT;
    if ((await getSession())?.testMode) return NOTHING_SENT;

    const repo = await getRepo();
    const [subscriptions, staff] = await Promise.all([repo.listPushSubscriptions(), repo.listStaff()]);
    const staffById = new Map(staff.map((s) => [s.id, s] as const));
    const targeted = subscriptions.filter((sub) => {
      if (sub.staffId === null || sub.team !== team) return false;
      const member = staffById.get(sub.staffId);
      if (!member) return false;
      return member.role === "dev" || member.allowedPages.includes(page);
    });
    if (targeted.length === 0) return NOTHING_SENT;

    const icon = payload.icon ?? (team === "minivolley" ? "/icons-s3/icon-192.png" : undefined);
    return await sendToSubscriptions(targeted, { ...payload, icon });
  } catch (err) {
    console.error("[push] notifyStaffChange fallito:", err);
    return NOTHING_SENT;
  }
}

/**
 * Come notifyStaffChange, ma ristretta ai soli account con ruolo Admin
 * (esclude Developer e pubblico) — usata dallo strumento di invio manuale
 * nel Centro di controllo quando il Developer sceglie di avvisare solo lo
 * staff Admin invece di tutti. Un avviso manuale non riguarda una singola
 * sezione, quindi non filtra per allowedPages (a differenza di
 * notifyStaffChange): il Developer sta scegliendo esplicitamente
 * l'audience "tutti gli Admin", non una sezione specifica.
 */
export async function notifyAdmins(payload: CalendarNotification): Promise<PushResult> {
  try {
    if (!ensureConfigured()) return NOTHING_SENT;
    if ((await getSession())?.testMode) return NOTHING_SENT;

    const repo = await getRepo();
    const [subscriptions, staff] = await Promise.all([repo.listPushSubscriptions(), repo.listStaff()]);
    const adminIds = new Set(staff.filter((s) => s.role === "admin").map((s) => s.id));
    const targeted = subscriptions.filter((sub) => sub.staffId && adminIds.has(sub.staffId));
    if (targeted.length === 0) return NOTHING_SENT;

    return await sendToSubscriptions(targeted, payload);
  } catch (err) {
    console.error("[push] notifyAdmins fallito:", err);
    return NOTHING_SENT;
  }
}
