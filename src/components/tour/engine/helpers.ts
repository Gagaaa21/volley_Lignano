import type { Rect } from "./types";

export const LOCATE_TIMEOUT_MS = 4000;
export const POLL_INTERVAL_MS = 80;

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function closeMobileMenuIfOpen() {
  const toggle = document.querySelector<HTMLElement>('[data-tour="mobile-menu-toggle"]');
  if (toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click();
}

/**
 * Cerca l'elemento reale da evidenziare per questo passo. Le voci di nav
 * normali esistono una sola volta nel DOM (il contenitore attorno cambia
 * solo visibilità mobile/desktop), ma il menu Developer e — su schermi
 * stretti — il menu ad hamburger nascondono i propri link finché non
 * vengono aperti: si prova prima direttamente, poi si aprono da soli
 * (leggendo lo stato reale da aria-expanded, niente configurazione per
 * passo) e si riprova, fino a un timeout oltre il quale il passo — es. uno
 * riservato al Developer mostrato per errore, o "Modalità prova" assente
 * perché già attiva — viene semplicemente saltato. Riusata identica da
 * tour admin, tour pubblico e mini-tour di sezione: i toggle mobile/dev
 * semplicemente non esistono fuori dall'area riservata, quindi i due `if`
 * sotto non scattano mai in quei contesti, senza bisogno di parametrizzare
 * nulla.
 */
export async function locateTarget(id: string): Promise<HTMLElement | null> {
  const deadline = Date.now() + LOCATE_TIMEOUT_MS;
  let triedMobile = false;
  let triedDev = false;

  while (Date.now() < deadline) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
    const visible = candidates.find(isVisible);
    if (visible) return visible;

    const mobileToggle = document.querySelector<HTMLElement>('[data-tour="mobile-menu-toggle"]');
    if (
      mobileToggle &&
      isVisible(mobileToggle) &&
      mobileToggle.getAttribute("aria-expanded") !== "true" &&
      !triedMobile
    ) {
      triedMobile = true;
      mobileToggle.click();
      await nextFrame();
      continue;
    }

    const devToggle = document.querySelector<HTMLElement>('[data-tour="dev-menu-toggle"]');
    if (devToggle && isVisible(devToggle) && devToggle.getAttribute("aria-expanded") !== "true" && !triedDev) {
      triedDev = true;
      devToggle.click();
      await nextFrame();
      continue;
    }

    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}
