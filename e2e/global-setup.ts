import { chromium, type FullConfig } from "@playwright/test";
import { DEV_PASSWORD, DEV_USERNAME } from "./helpers";

/**
 * L'account seed "Gaga" nasce con mustChangePassword true e password
 * "Gaga211" solo al primo avvio del server demo in-memory: qui, una sola
 * volta prima di tutta la suite, la fissiamo a DEV_PASSWORD così ogni spec
 * può accedere direttamente senza rigestire il cambio password forzato.
 * Prova prima la password di seed, poi DEV_PASSWORD (nel caso la suite sia
 * già stata eseguita in precedenza contro lo stesso server, senza
 * riavviarlo).
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const context = await browser.newContext();
  // I banner fissi "Installa l'app" / "Attiva le notifiche" possono coprire il
  // pulsante "Aggiorna password": qui risultano già mostrati.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: si prosegue senza.
    }
  });
  const page = await context.newPage();

  let reachedAdmin = false;
  for (const candidate of ["Gaga211", DEV_PASSWORD]) {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Nome utente").fill(DEV_USERNAME);
    await page.getByLabel("Password", { exact: true }).fill(candidate);
    await page.getByRole("button", { name: /accedi/i }).click();
    await page.waitForURL(/\/admin|\/cambia-password/, { timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/cambia-password")) {
      await page.getByLabel("Password attuale").fill(candidate);
      await page.getByLabel("Nuova password", { exact: true }).fill(DEV_PASSWORD);
      await page.getByLabel("Conferma nuova password").fill(DEV_PASSWORD);
      await page.getByRole("button", { name: /aggiorna password/i }).click();
      await page.waitForURL(/\/admin(\?|$)/, { timeout: 30_000 });
      reachedAdmin = true;
      break;
    }
    if (page.url().includes("/admin")) {
      reachedAdmin = true;
      break;
    }
  }

  if (!reachedAdmin) {
    const bodyText = await page.textContent("body").catch(() => null);
    await browser.close();
    throw new Error(
      `[global-setup] impossibile accedere come ${DEV_USERNAME} né con la password di seed né con DEV_PASSWORD. ` +
        `URL finale: ${page.url()}. Testo pagina: ${bodyText?.slice(0, 200)}`,
    );
  }

  // Verifica esplicita che la password sia stata effettivamente persistita
  // (non solo che il redirect client-side sia avvenuto per QUESTA sessione):
  // apriamo un contesto del tutto nuovo e riproviamo il login con
  // DEV_PASSWORD, così un'eventuale regressione qui fallisce subito con un
  // messaggio chiaro invece di manifestarsi più tardi come "credenziali
  // errate" in ogni singolo spec file.
  const verifyContext = await browser.newContext();
  const verifyPage = await verifyContext.newPage();
  await verifyPage.goto(`${baseURL}/login`);
  await verifyPage.getByLabel("Nome utente").fill(DEV_USERNAME);
  await verifyPage.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await verifyPage.getByRole("button", { name: /accedi/i }).click();
  await verifyPage.waitForURL(/\/admin/, { timeout: 30_000 }).catch(() => {});
  await verifyPage.waitForLoadState("networkidle");
  if (!verifyPage.url().includes("/admin")) {
    const bodyText = await verifyPage.textContent("body").catch(() => null);
    await browser.close();
    throw new Error(
      `[global-setup] DEV_PASSWORD non funziona da un contesto nuovo dopo il cambio password. ` +
        `URL: ${verifyPage.url()}. Testo pagina: ${bodyText?.slice(0, 200)}`,
    );
  }
  await verifyContext.close();

  await browser.close();
}
