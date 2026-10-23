/**
 * Il codice segreto del link di un'atleta. Chi ha il link può segnare le non disponibilità di quella sola atleta, quindi il
 * codice non deve poter essere indovinato: 24 byte casuali (192 bit) del generatore sicuro del sistema, scritti in 32
 * caratteri (lettere, cifre, «-» e «_») che stanno bene in un indirizzo.
 */

const BYTES = 24;
export const FAMILY_TOKEN_LENGTH = 32;

const TOKEN_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${FAMILY_TOKEN_LENGTH}}$`);

export function newFamilyToken(): string {
  const bytes = new Uint8Array(BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // 24 byte fanno 32 caratteri di base64 senza riempimento: «+» e «/» diventano «-» e «_» (adatti a un indirizzo).
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

/** Ha la forma di un codice: serve a scartare subito indirizzi inventati, senza nemmeno interrogare il database. */
export function isFamilyToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Il percorso della pagina del genitore. */
export function familyLinkPath(token: string): string {
  return `/disponibilita/${token}`;
}
