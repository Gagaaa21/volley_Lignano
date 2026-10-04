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

/**
 * I loghi delle squadre si scaricano solo da qui: stesso controllo dei siti
 * della federazione e, in più, solo il percorso delle immagini dei loghi
 * (/mngArea/Societa/img/<numero>/Loghi/<file>.png|jpg|gif|webp). Così il
 * sito non può essere usato per scaricare altro.
 */
export function isAllowedLogoUrl(raw: string): boolean {
  if (!isAllowedFederationUrl(raw)) return false;
  const url = new URL(raw);
  return (
    url.search === "" &&
    /^\/mngArea\/Societa\/img\/\d+\/Loghi\/[A-Za-z0-9_.-]+\.(png|jpe?g|gif|webp)$/i.test(url.pathname)
  );
}
