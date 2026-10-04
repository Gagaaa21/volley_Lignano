/**
 * L'indirizzo del girone lo imposta un Developer dal Centro di controllo: si
 * accettano solo pagine https della federazione (federvolley.it e
 * portalefipav.net, sottodomini dei comitati compresi), mai indirizzi
 * qualunque, così il server non diventa un modo per raggiungere altri siti.
 *
 * Solo fuori produzione sono accettati anche gli indirizzi locali (http su
 * localhost / 127.0.0.1): servono ai test automatici, che fanno leggere al
 * sito pagine di prova senza toccare il portale vero.
 */
export function isAllowedFederationUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === "https:" && /(^|\.)(federvolley\.it|portalefipav\.net)$/i.test(url.hostname)) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  );
}
