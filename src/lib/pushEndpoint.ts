/**
 * Quali indirizzi di notifica (endpoint) il sito accetta. Un'iscrizione la manda il browser di chiunque apra il sito, senza
 * accesso: ma poi è il nostro server a contattare quell'indirizzo a ogni avviso. Senza un controllo, un visitatore potrebbe
 * iscrivere un indirizzo qualsiasi (anche di un sito altrui, o interno alla rete) e far spedire al server richieste a sua scelta,
 * ripetute a ogni notifica. Si accettano quindi solo i servizi che i browser usano davvero per le notifiche: Google (Chrome,
 * Edge, Samsung, Brave…), Apple (Safari/iPhone), Mozilla (Firefox) e Microsoft. Solo https, senza credenziali né porte strane.
 * Regole pure, provate in unit/push-endpoint.spec.ts. Funzioni pure, senza dipendenze: valgono anche per il client.
 */

const MAX_ENDPOINT_LENGTH = 2048;
// p256dh (chiave pubblica, 87 caratteri) e auth (22 caratteri) in base64url: molto sotto questi limiti.
const MAX_P256DH_LENGTH = 256;
const MAX_AUTH_LENGTH = 128;

/** Host esatti dei servizi push. */
const PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);

/** Famiglie di host dei servizi push (ogni sottodominio di questi domini). */
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Le due chiavi dell'iscrizione: stringhe non vuote e di lunghezza ragionevole (non si salvano testi enormi nell'archivio). */
export function areValidPushKeys(p256dh: string, auth: string): boolean {
  return p256dh.length > 0 && p256dh.length <= MAX_P256DH_LENGTH && auth.length > 0 && auth.length <= MAX_AUTH_LENGTH;
}
