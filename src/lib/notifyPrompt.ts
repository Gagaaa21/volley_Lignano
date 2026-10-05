import "server-only";
import { getRepo } from "@/lib/db";

/**
 * «Richiesta di attivazione delle notifiche»: il Developer la invia dal
 * Centro di controllo e chi apre il sito senza aver ancora attivato le
 * notifiche rivede il messaggio «Attiva le notifiche», anche se l'aveva
 * chiuso da poco (di norma ricompare solo dopo 7 giorni). Qui si tiene
 * l'istante dell'ultima richiesta; il browser lo confronta con l'ultima
 * richiesta già vista (vedi PwaClient).
 */
export const NOTIFY_PROMPT_SETTING = "notify_prompt_at";
/** Tra una richiesta e la successiva passa almeno questo tempo: premere due
 * volte di fila farebbe ritrovare il messaggio a chi l'ha appena chiuso. */
export const NOTIFY_PROMPT_COOLDOWN_MS = 60 * 60 * 1000;

/** Istante (ISO) dell'ultima richiesta, o null se non ce ne sono (o se la
 * tabella app_settings non esiste ancora: il sito deve funzionare lo stesso).
 * Nessuna cache qui: è una sola riga, e la risposta pubblica è già tenuta un
 * minuto dalla rete (vedi /api/push/prompt). Una cache persistente farebbe
 * rivedere una richiesta vecchia dopo un riavvio. */
export async function getNotifyPromptAt(): Promise<string | null> {
  try {
    return await (await getRepo()).getAppSetting(NOTIFY_PROMPT_SETTING);
  } catch (error) {
    console.error("[notifyPrompt] impostazione non leggibile:", error);
    return null;
  }
}
