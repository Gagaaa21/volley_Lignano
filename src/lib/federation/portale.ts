import "server-only";
import { parseGirone, validateGirone } from "@/lib/federation/parse";
import { isAllowedFederationUrl, isAllowedLogoUrl } from "@/lib/federation/url";
import type { Girone } from "@/lib/federation/types";

/** Il portale federale (udine.federvolley.it, friulivg.portalefipav.net, …)
 * ogni tanto resetta la connessione: si ritenta con attesa crescente. */
const ATTEMPTS = 3;
const FIRST_RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT = "VolleyLignanoSite/1.0 (sito della società; lettura occasionale di classifiche e risultati)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(FIRST_RETRY_DELAY_MS * 2 ** (attempt - 1));
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "it-IT,it;q=0.9", Accept: "text/html" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // Anche dopo un reindirizzamento si resta sui siti della federazione.
      if (!isAllowedFederationUrl(response.url || url)) {
        throw new Error("La pagina è stata reindirizzata fuori dal sito della federazione.");
      }
      if (!response.ok) throw new Error(`Il portale ha risposto con errore ${response.status}.`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "errore sconosciuto";
  throw new Error(`Portale non raggiungibile dopo ${ATTEMPTS} tentativi (${reason}).`);
}

const LOGO_ATTEMPTS = 2;
const LOGO_TIMEOUT_MS = 8_000;
const LOGO_MAX_BYTES = 500_000;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export interface LogoImage {
  body: ArrayBuffer;
  contentType: string;
}

/** Scarica il logo di una squadra. Null se non è raggiungibile, non è
 * un'immagine ammessa o è troppo grande: il sito mostra le iniziali. */
export async function fetchLogo(url: string): Promise<LogoImage | null> {
  if (!isAllowedLogoUrl(url)) return null;
  for (let attempt = 0; attempt < LOGO_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(FIRST_RETRY_DELAY_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
      });
      if (!isAllowedLogoUrl(response.url || url)) return null;
      if (response.status === 404) return null;
      if (!response.ok) continue;
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!LOGO_TYPES.includes(contentType)) return null;
      const body = await response.arrayBuffer();
      if (body.byteLength === 0 || body.byteLength > LOGO_MAX_BYTES) return null;
      return { body, contentType };
    } catch {
      // si riprova una volta, poi si rinuncia
    }
  }
  return null;
}

/** Legge e controlla la pagina di un girone. Se i dati non sono plausibili
 * lancia un errore: il chiamante tiene l'ultimo contenuto valido. */
export async function readGirone(url: string): Promise<Girone> {
  if (!isAllowedFederationUrl(url)) {
    throw new Error(
      "L'indirizzo del girone non è una pagina della federazione (https, federvolley.it o portalefipav.net).",
    );
  }
  const result = parseGirone(await fetchHtml(url), url);
  const problem = validateGirone(result);
  if (problem) throw new Error(problem);
  return result.girone;
}
