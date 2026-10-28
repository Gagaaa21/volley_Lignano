import { expect, test } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Sul telefono la barra delle sezioni scorre di lato e molte voci restano nascoste: il pulsante «Tutte le sezioni» apre un pannello
 * con tutte le voci, raggruppate per quello che si fa. Sul computer la barra le ha già tutte in vista e il pulsante non c'è.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

test.describe("dal telefono", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("«Tutte le sezioni» elenca ogni voce raggruppata, porta alla sezione scelta e si chiude con Esc", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const toggle = page.locator("[data-sections-toggle]");
    const panel = page.locator("[data-sections-panel]");
    await expect(toggle).toBeVisible();
    await expect(panel).toHaveCount(0);

    await toggle.click();
    await expect(panel).toBeVisible();
    for (const title of ["Ogni giorno", "Allenare", "In partita", "Gestione"]) await expect(panel).toContainText(title);
    // Tutte le voci della barra (anche quelle che da telefono restano fuori dallo schermo) stanno nel pannello.
    for (const name of ["Dashboard", "Partite", "Assenze", "Presenze", "Schede", "Test fisici", "Scout", "Live score", "Pronostici", "Trasferte", "Certificati", "Staff", "Guida"]) {
      await expect(panel.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(panel.locator('[aria-current="page"]')).toContainText("Dashboard");

    // Esc chiude; si riapre e si sceglie una voce: il pannello si chiude da solo.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await toggle.click();
    await panel.getByRole("link", { name: "Certificati", exact: true }).click();
    await page.waitForURL(/\/admin\/certificati$/);
    await expect(panel).toHaveCount(0);
  });
});

test("dal computer la barra ha già tutte le sezioni: il pulsante «Tutte le sezioni» non c'è", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDev(page);
  await page.goto("/admin");
  await expect(page.locator("[data-sections-toggle]")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Sezioni area tecnici" }).getByRole("link", { name: "Guida" })).toBeVisible();
});
