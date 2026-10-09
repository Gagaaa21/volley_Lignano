import { test, expect } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName } from "./helpers";

test("calendario pubblico U14/U15: con tutte presenti resta scritto Presente su ogni riga", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  for (const n of ["Prima", "Seconda"]) {
    await page.goto("/admin/presenze/atlete/nuova");
    await page.getByLabel("Nome e cognome").fill(uniqueName(`Atleta ${n} `) + " Test");
    await page.getByLabel(/Categoria/i).selectOption("U14");
    await page.getByRole("button", { name: /salva atleta/i }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
  }
  await page.goto("/admin/allenamenti/nuovo");
  await page.getByRole("radio", { name: "Singolo giorno" }).check({ force: true });
  await page.getByLabel("Luogo").fill("Palestra presenze E2E");
  await page.locator('input[name="startDate"]').fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: /salva allenamento/i }).click();
  await page.waitForURL(/\/admin\/allenamenti\/elenco$/, { timeout: 20_000 });
  await page.goto("/admin/presenze");
  // Il registro di questo allenamento (la pagina può elencarne altri, di prove precedenti).
  await page
    .getByText("Palestra presenze E2E")
    .locator("xpath=ancestor::div[contains(@class,'px-4')][1]")
    .getByRole("link", { name: /registra presenze/i })
    .click();
  await page.waitForURL(/\/admin\/presenze\/registra\//);
  await page.getByRole("button", { name: /salva presenze/i }).click({ force: true });
  await page.waitForURL(/\/admin\/presenze\/storico/, { timeout: 20_000 });

  // Niente banner di installazione/notifiche né tour del sito pubblico a coprire la pagina.
  await page.context().addInitScript(() => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  await page.goto("/");
  await page.getByText("Palestra presenze E2E").first().click();
  const dialog = page.getByRole("dialog");
  // Di default tutte presenti: "N/N presenti", e "Presente" scritto su ogni riga (non solo quando manca qualcuna).
  const summary = (await dialog.getByText(/^\d+\/\d+ presenti$/).textContent())!;
  const [present, total] = summary.match(/\d+/g)!.map(Number);
  expect(total).toBeGreaterThanOrEqual(2);
  expect(present).toBe(total);
  await expect(dialog.getByText("Presente", { exact: true })).toHaveCount(total);
});
