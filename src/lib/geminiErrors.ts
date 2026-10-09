/**
 * Errori di Gemini che servono a decidere cosa fare dopo un tentativo fallito.
 * L'IA gratuita ha un limite di richieste per ogni modello, al minuto e al
 * giorno (oggi 20 al giorno): quando è finito risponde 429 e dice tra quanto
 * riprovare. Funzioni pure, senza dipendenze, così si provano con test semplici.
 */

/** Il limite di richieste del modello è finito (errore 429 / "quota exceeded")? */
export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { status, message } = err as { status?: unknown; message?: unknown };
  if (status === 429) return true;
  return typeof message === "string" && /RESOURCE_EXHAUSTED|quota exceeded/i.test(message);
}

/** Pausa minima e massima prima di riprovare un modello a cui è finito il limite. */
const MIN_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Quanto aspettare prima di riprovare lo stesso modello, letto dalla risposta
 * ("retryDelay": "22220s" oppure "Please retry in 6h10m20s"). Se non c'è, un minuto.
 */
export function retryDelayMs(err: unknown): number {
  const raw = err && typeof err === "object" ? (err as { message?: unknown }).message : undefined;
  const message = typeof raw === "string" ? raw : "";
  let ms = 60_000;
  const field = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (field) {
    ms = Number(field[1]) * 1000;
  } else {
    const text = message.match(/retry in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?/i);
    if (text && (text[1] || text[2] || text[3])) {
      ms = (Number(text[1] ?? 0) * 3600 + Number(text[2] ?? 0) * 60 + Number(text[3] ?? 0)) * 1000;
    }
  }
  return Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, ms));
}
