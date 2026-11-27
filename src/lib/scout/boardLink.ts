import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Il link del tabellone della palestra (/tabellone/<chiave>): non è pubblico, ma non chiede l'accesso. La chiave è lunga e
 * impossibile da indovinare, come quella dei link dei genitori, e non scade mai: il tablet lo tiene nei preferiti e funziona a
 * ogni partita, senza rientrare. Senza la chiave il punteggio non esce (con la diretta spenta il sito pubblico non lo ha).
 *
 * La chiave non sta in un archivio: si ricava dal segreto delle sessioni del sito (SESSION_SECRET, sempre presente in
 * produzione) con un HMAC dedicato, quindi è sempre la stessa e nessuno può ricavarla senza il segreto. Solo per il server
 * (usa node:crypto): lo staff la vede nella scheda «Tabellone per la palestra» dello Scout.
 */

const KEY_LENGTH = 32;
const KEY_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET non impostata: obbligatoria in produzione.");
  // Come per le sessioni: in sviluppo e nelle prove un segreto fisso.
  return "dev-only-insecure-secret-change-me";
}

/** La chiave del tabellone: 32 caratteri da indirizzo (lettere, cifre, - e _). */
export function boardKey(): string {
  return createHmac("sha256", secret()).update("volley-lignano:tabellone-palestra").digest("base64url").slice(0, KEY_LENGTH);
}

/** Vero se è la chiave giusta (confronto a tempo costante). */
export function isBoardKey(candidate: string): boolean {
  if (!KEY_PATTERN.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(boardKey()));
}

/** L'indirizzo del tabellone, da aprire sul tablet. */
export function boardHref(): string {
  return `/tabellone/${boardKey()}`;
}
