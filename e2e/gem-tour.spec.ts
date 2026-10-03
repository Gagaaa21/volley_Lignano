import { test, expect, type Page } from "@playwright/test";
import { loginAsDev } from "./helpers";

const gemDialog = (page: Page) => page.getByRole("dialog", { name: /^Gem:/ });

/** Su un server appena avviato l'account Gaga non ha ancora chiuso il tour
 * generale dell'area tecnici: il suo primo passo fa un router.push("/admin")
 * e spazza via la pagina appena aperta. Se compare lo chiude e riapre
 * Test fisici, così il test non dipende da quanti spec lo hanno preceduto. */
async function openTestFisici(page: Page) {
  await page.goto("/admin/test-fisici");
  const skipMainTour = page.getByRole("button", { name: "Salta il tour" });
  const mainTourShown = await skipMainTour
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (mainTourShown) {
    await skipMainTour.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto("/admin/test-fisici");
  }
}

test.describe("Tour di Gem", () => {
  test.beforeEach(async ({ page }) => {
    // Niente banner PWA fissi in basso a coprire il fumetto.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vl-pwa-install-prompted", "1");
        localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      } catch {
        // localStorage non disponibile: il test funziona comunque.
      }
    });
  });

  test("parte da solo anche per chi aveva già visto la prima edizione, poi non ripete", async ({ page }) => {
    await loginAsDev(page);

    // Chi aveva già aperto e chiuso il tour della prima edizione ha questa
    // chiave nel browser: non deve più fermare Gem.
    await page.evaluate(() => localStorage.setItem("vl-gem-tour-seen", "1"));

    await openTestFisici(page);
    await expect(gemDialog(page)).toBeVisible({ timeout: 15_000 });

    await gemDialog(page).getByRole("button", { name: "Chiudi il tour" }).click();
    await expect(gemDialog(page)).toBeHidden();

    // Dopo averlo chiuso, alla visita successiva Gem resta nascosto.
    await page.goto("/admin/test-fisici");
    await page.waitForTimeout(2_500);
    await expect(gemDialog(page)).toBeHidden();

    // ...ma il "?" accanto al titolo lo riapre sempre.
    await page.getByRole("button", { name: "Guida di questa sezione" }).click();
    await expect(gemDialog(page)).toBeVisible();
  });
});
