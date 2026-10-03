import { test, expect, type Page } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName } from "./helpers";

async function createAthlete(page: Page, fullName: string) {
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(fullName);
  await page.getByLabel(/Categoria/i).selectOption("U14");
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
}

/** Apre il modulo "Nuovo test" dell'atleta passando dall'elenco (la pagina
 * iniziale di Test fisici avvia il tour di Gem, questa no). */
async function openNewTestForm(page: Page, fullName: string) {
  await page.goto("/admin/test-fisici/nuovo");
  await page.getByRole("link", { name: fullName }).click();
  await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
}

/** La riga della sessione nell'elenco "Sessioni registrate" (è l'ultimo dei
 * link verso quella sessione: le matite sulle schede vengono prima). */
function sessionLink(page: Page, date: string) {
  return page.locator(`a[href$="/sessione/${date}"]`).last();
}

async function saveAndWaitForAthletePage(page: Page, button: RegExp) {
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(/\/admin\/test-fisici\/atleta\/[^/]+$/, { timeout: 20_000 });
}

test.describe("Test fisici", () => {
  test.beforeEach(async ({ page }) => {
    // I banner "Installa l'app" / "Attiva le notifiche" sono fissi in basso e
    // possono coprire il pulsante di salvataggio dei moduli lunghi: qui
    // risultano già mostrati.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vl-pwa-install-prompted", "1");
        localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      } catch {
        // storage non disponibile: pazienza, il banner può comparire.
      }
    });
  });

  test("una sessione già inserita si può modificare: valori, righe libere, date e note", async ({ page }) => {
    await loginAsDev(page);
    await switchTeam(page, "u14u15");

    const fullName = uniqueName("Atleta Test ") + " Salto";
    await createAthlete(page, fullName);

    // Prima sessione: peso, due salti e una riga libera.
    await openNewTestForm(page, fullName);
    await page.getByLabel("Data della sessione").fill("2026-03-10");
    await page.getByLabel("Peso in kg").fill("50");
    await page.getByLabel("Salto 1, altezza in centimetri").fill("40");
    await page.getByLabel("Salto 2, altezza in centimetri").fill("42");
    await page.getByLabel("Nome del dato").first().fill("Sit and reach");
    await page.getByLabel("Valore", { exact: true }).first().fill("7");
    await saveAndWaitForAthletePage(page, /salva test/i);
    const athletePage = page.url();

    // La sessione compare nell'elenco e si apre già compilata.
    await sessionLink(page, "2026-03-10").click();
    await page.waitForURL(/\/sessione\/2026-03-10$/, { timeout: 20_000 });
    await expect(page.getByLabel("Data della sessione")).toHaveValue("2026-03-10");
    await expect(page.getByLabel("Peso in kg")).toHaveValue("50");
    await expect(page.getByLabel("Salto 1, altezza in centimetri")).toHaveValue("40");
    await expect(page.getByLabel("Salto 2, altezza in centimetri")).toHaveValue("42");
    await expect(page.getByLabel("Salto 3, altezza in centimetri")).toHaveValue("");
    await expect(page.getByLabel("Nome del dato").first()).toHaveValue("Sit and reach");
    await expect(page.getByLabel("Valore", { exact: true }).first()).toHaveValue("7");

    // Corregge un salto, aggiunge il terzo, svuota il peso, cambia la riga
    // libera, sposta la data e scrive una nota.
    await page.getByLabel("Salto 2, altezza in centimetri").fill("45");
    await page.getByLabel("Salto 3, altezza in centimetri").fill("44");
    await page.getByLabel("Peso in kg").fill("");
    await page.getByLabel("Valore", { exact: true }).first().fill("8");
    await page.getByLabel("Data della sessione").fill("2026-03-12");
    await page.getByLabel(/Note/).fill("nota e2e");
    await saveAndWaitForAthletePage(page, /salva modifiche/i);

    // La data vecchia non c'è più, la nuova sì, con tutti i cambiamenti.
    await expect(page.locator('a[href$="/sessione/2026-03-10"]')).toHaveCount(0);
    await sessionLink(page, "2026-03-12").click();
    await page.waitForURL(/\/sessione\/2026-03-12$/, { timeout: 20_000 });
    await expect(page.getByLabel("Salto 1, altezza in centimetri")).toHaveValue("40");
    await expect(page.getByLabel("Salto 2, altezza in centimetri")).toHaveValue("45");
    await expect(page.getByLabel("Salto 3, altezza in centimetri")).toHaveValue("44");
    await expect(page.getByLabel("Peso in kg")).toHaveValue("");
    await expect(page.getByLabel("Valore", { exact: true }).first()).toHaveValue("8");
    await expect(page.getByLabel(/Note/)).toHaveValue("nota e2e");

    // Una seconda sessione, poi un tentativo di spostarla su una data già
    // occupata: errore chiaro e nulla di quanto digitato va perso.
    await page.goto(athletePage);
    await page.getByRole("link", { name: /nuovo test/i }).click();
    await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
    await page.getByLabel("Data della sessione").fill("2026-03-20");
    await page.getByLabel("Peso in kg").fill("51");
    await saveAndWaitForAthletePage(page, /salva test/i);

    await sessionLink(page, "2026-03-20").click();
    await page.waitForURL(/\/sessione\/2026-03-20$/, { timeout: 20_000 });
    await page.getByLabel("Peso in kg").fill("52");
    await page.getByLabel("Data della sessione").fill("2026-03-12");
    await page.getByRole("button", { name: /salva modifiche/i }).click();
    await expect(page.getByText(/c'è già una sessione registrata/)).toBeVisible();
    await expect(page.getByLabel("Peso in kg")).toHaveValue("52");
    await expect(page.getByLabel("Data della sessione")).toHaveValue("2026-03-12");

    // Con una data libera il salvataggio riesce e il peso è quello nuovo.
    await page.getByLabel("Data della sessione").fill("2026-03-21");
    await saveAndWaitForAthletePage(page, /salva modifiche/i);
    await sessionLink(page, "2026-03-21").click();
    await page.waitForURL(/\/sessione\/2026-03-21$/, { timeout: 20_000 });
    await expect(page.getByLabel("Peso in kg")).toHaveValue("52");
  });
});
