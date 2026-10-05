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

/**
 * Alcuni indirizzi copiati dal browser hanno un `PId` che il portale
 * riconosce solo per rimandare alla pagina «base» (`?PId=…`), buttando via i
 * filtri del girone (CId, StId, …): la pagina letta è vuota. Se è successo,
 * restituisce l'indirizzo di arrivo con i filtri di quello originale rimessi;
 * altrimenti null (stessa pagina e filtri ancora presenti, o altro sito).
 */
export function restoreLostFilters(original: string, arrivedAt: string): string | null {
  let from: URL;
  let to: URL;
  try {
    from = new URL(original);
    to = new URL(arrivedAt);
  } catch {
    return null;
  }
  if (from.origin !== to.origin || from.pathname !== to.pathname) return null;
  if (!from.searchParams.has("CId") || to.searchParams.has("CId")) return null;
  const fixed = new URL(to.toString());
  for (const [key, value] of from.searchParams) {
    if (key !== "PId") fixed.searchParams.set(key, value);
  }
  return fixed.toString();
}
