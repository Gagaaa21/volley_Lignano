import { expect, test } from "@playwright/test";
import { loginAsDev } from "./helpers";

/**
 * «Chiedi a tutti di attivare le notifiche» (Centro di controllo): chi aveva
 * chiuso da poco il messaggio «Attiva le notifiche» lo rivede dopo la
 * richiesta del Developer, e chiudendolo di nuovo non ricompare.
 *
 * Questo file si chiama zz-… perché deve girare per ultimo: la richiesta è
 * globale (vale per tutti i browser) e lascerebbe il messaggio in basso a
 * coprire i pulsanti degli spec successivi, che lo evitano segnando solo
 * «chiuso poco fa».
 */
test("la richiesta del Developer fa riapparire il messaggio a chi lo aveva chiuso", async ({ browser, page }) => {
  const baseURL = test.info().project.use.baseURL;
  const visitor = await browser.newContext({ baseURL });
  // Come un visitatore che ha già visto installazione e notifiche e ha chiuso il messaggio poco fa.
  await visitor.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
      // Chromium in prova può dichiarare i permessi già negati: qui serve «non ancora deciso».
      Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    } catch {
      // localStorage non disponibile: il test fallirebbe comunque sull'attesa sotto.
    }
  });
  const guest = await visitor.newPage();
  await guest.goto("/");
  await guest.waitForLoadState("networkidle");
  await expect(guest.getByText("Attiva le notifiche")).toHaveCount(0);

  // --- Il Developer invia la richiesta. ---
  await loginAsDev(page);
  await page.goto("/admin/centro-controllo");
  await expect(page.locator("[data-notify-prompt-last]")).toContainText("Nessuna richiesta inviata finora.");
  await page.getByRole("button", { name: "Chiedi a tutti di attivare le notifiche" }).click();
  await expect(page.getByRole("status")).toContainText("Richiesta inviata");
  await page.reload();
  await expect(page.locator("[data-notify-prompt-last]")).toContainText("Ultima richiesta inviata il");

  // Premuta di nuovo subito, la richiesta viene rifiutata (c'è un'ora di pausa).
  await page.getByRole("button", { name: "Chiedi a tutti di attivare le notifiche" }).click();
  await expect(page.getByText(/Hai già inviato la richiesta da poco/)).toBeVisible();

  // --- Il visitatore ora rivede il messaggio (in produzione la rete può tenere la risposta fino a un minuto). ---
  await expect(async () => {
    await guest.reload();
    await expect(guest.getByText("Attiva le notifiche")).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 90_000 });

  // Chiuso di nuovo, non ricompare finché il Developer non ne invia un'altra.
  await guest.getByRole("button", { name: "No grazie" }).click();
  await guest.reload();
  await guest.waitForLoadState("networkidle");
  await expect(guest.getByText("Attiva le notifiche")).toHaveCount(0);

  await visitor.close();
});
