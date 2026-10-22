/**
 * Numeri di telefono di autisti e genitori. Si tengono come li ha scritti chi li ha inseriti (con spazi o trattini, come
 * si leggono meglio); si ripuliscono solo per il link che apre la chiamata dal telefono (`tel:`).
 */

const ALLOWED_CHARACTERS = /^[+\d\s().\-/]+$/;
const MIN_DIGITS = 6;
/** Il massimo di uno standard internazionale (E.164): oltre non può essere un numero. */
const MAX_DIGITS = 15;
const MAX_LENGTH = 30;

const digitsOf = (value: string) => value.replace(/\D/g, "");

/** Toglie gli spazi in più ai lati e in mezzo; non cambia le cifre. */
export function cleanPhone(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Un numero plausibile: cifre, spazi, trattini e parentesi; il + solo all'inizio; da 6 a 15 cifre. */
export function isValidPhone(raw: string): boolean {
  const value = cleanPhone(raw);
  if (!value || value.length > MAX_LENGTH || !ALLOWED_CHARACTERS.test(value)) return false;
  if (value.lastIndexOf("+") > 0) return false;
  const digits = digitsOf(value).length;
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS;
}

/** Il link che fa partire la chiamata (`tel:+39…`), oppure null se il numero non è valido. «0039…» vale come «+39…». */
export function phoneHref(raw: string): string | null {
  if (!isValidPhone(raw)) return null;
  const value = cleanPhone(raw);
  const digits = digitsOf(value);
  if (value.startsWith("+")) return `tel:+${digits}`;
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`;
  return `tel:${digits}`;
}

/** Il nome per riconoscere la stessa persona anche con maiuscole, accenti e spazi diversi. */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
