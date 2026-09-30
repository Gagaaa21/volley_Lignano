import type { Page } from "@playwright/test";

export const DEV_USERNAME = "Gaga";
/** Password fissa impostata da global-setup al primo avvio della suite
 * (l'account seed "Gaga" nasce con mustChangePassword true e password
 * "Gaga211" solo sul primo avvio del server demo in-memory) — tutti gli
 * spec la assumono già così, non ripetono il cambio password forzato. */
export const DEV_PASSWORD = "Gaga2112e2eTest";

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Nome utente").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /accedi/i }).click();
}

/** Chiude il tour guidato se è partito da solo (primo accesso di un
 * account): non blocca il test se non compare. L'avvio è deciso da un
 * effect React dopo l'hydration, quindi può comparire con un ritardo
 * percepibile in questo ambiente — un timeout troppo corto qui fa proseguire
 * il test mentre il tour sta per aprirsi, e il suo primo passo ("welcome",
 * path "/admin") fa un router.push("/admin") che spazza via qualunque altra
 * pagina si stia interagendo nel frattempo. Dopo il click, "Salta il tour"
 * invoca un server action per registrare che il tour è stato visto (fire-
 * and-forget lato client): aspettare che la rete torni idle evita di
 * navigare altrove prima che quella scrittura sia arrivata al server, che
 * farebbe ripartire il tour alla pagina successiva. */
export async function dismissTourIfShown(page: Page) {
  // locator.isVisible({ timeout }) NON aspetta: il parametro timeout è
  // deprecato e ignorato, controlla lo stato all'istante e basta (vedi
  // JSDoc del tipo in playwright-core). Serve waitFor(), che invece
  // effettivamente esegue polling fino al timeout indicato.
  const skipBtn = page.getByRole("button", { name: "Salta il tour" });
  const appeared = await skipBtn
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await skipBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

export async function loginAsDev(page: Page) {
  await login(page, DEV_USERNAME, DEV_PASSWORD);
  await page.waitForURL(/\/admin(\?|$)/, { timeout: 30_000 });
  await dismissTourIfShown(page);
}

/** src/proxy.ts reindirizza sempre /login a /admin quando esiste già una
 * sessione valida (vedi isLoginRoute && session): per accedere con un
 * account diverso da quello corrente serve prima disconnettersi, altrimenti
 * page.goto("/login") atterra silenziosamente su /admin invece di mostrare
 * il form. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Esci" }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
}

export async function switchTeam(page: Page, team: "u14u15" | "minivolley") {
  // page.goto è una navigazione piena (non client-side): rimonta l'intero
  // layout, tour guidato incluso, che può ripartire brevemente prima che
  // l'effect legga la sessione aggiornata — richiude l'eventuale overlay
  // prima di cercare lo switcher, altrimenti ne blocca il click.
  await page.goto("/admin");
  await dismissTourIfShown(page);
  const teamSwitcher = page.locator('[data-tour="team-switcher"]');
  const btn = teamSwitcher.getByRole("button", { name: team === "minivolley" ? /minivolley/i : /u14|u15/i }).first();
  if ((await btn.count()) > 0 && !(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(400);
  }
}

/** Nome/utente univoco per test indipendenti (la suite gira in sequenza
 * sullo stesso server demo, mai resettato tra un file e l'altro). */
export function uniqueName(prefix: string) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}
