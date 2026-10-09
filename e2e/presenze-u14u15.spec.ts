import { test, expect } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName, localDate } from "./helpers";

test.describe("Presenze U14/U15", () => {
  test("anagrafica con Categoria, registro presente-di-default con assenze", async ({ page }) => {
    await loginAsDev(page);
    await switchTeam(page, "u14u15");

    // Nuova atleta: mostra "Categoria", non "Gruppo".
    await page.goto("/admin/presenze/atlete/nuova");
    await expect(page.getByLabel(/Categoria/i)).toBeVisible();
    await expect(page.locator("label", { hasText: "Gruppo" })).toHaveCount(0);

    const fullName = uniqueName("Atleta U14 ") + " Test";
    await page.getByLabel("Nome e cognome").fill(fullName);
    await page.getByLabel(/Categoria/i).selectOption("U14");
    await page.getByRole("button", { name: /salva atleta/i }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });

    const bodyText = await page.textContent("body");
    expect(bodyText).toContain(fullName);

    // Crea un allenamento U14/U15 di oggi per poterci registrare le presenze.
    await page.goto("/admin/allenamenti/nuovo");
    await page.getByRole("radio", { name: "Singolo giorno" }).check({ force: true });
    await page.getByLabel("Luogo").fill("Palestra di prova E2E");
    const todayStr = localDate();
    await page.locator('input[name="startDate"]').fill(todayStr);
    await page.getByRole("button", { name: /salva allenamento/i }).click();
    await page.waitForURL(/\/admin\/allenamenti\/elenco$/, { timeout: 20_000 });

    await page.goto("/admin/presenze");
    const registraLink = page.locator('a[href*="/admin/presenze/registra/"]').first();
    await expect(registraLink).toBeVisible();
    await registraLink.click();
    await page.waitForURL(/\/admin\/presenze\/registra\//, { timeout: 20_000 });

    // Di default tutte presenti.
    await expect(page.getByText(/presenti su/)).toBeVisible();
    const presentText = await page.locator("text=/\\d+ presenti su \\d+/").first().textContent();
    expect(presentText).toMatch(/^\d+ presenti su \d+$/);
    const [presentCount, totalCount] = presentText!.match(/\d+/g)!.map(Number);
    expect(presentCount).toBe(totalCount);

    // Segna la nuova atleta assente. Serve la card riga (classe "rounded-xl"),
    // non ".last()" su un generico "div" con hasText: quel selettore
    // risolverebbe al div più interno che contiene ancora il nome (quello
    // con nome+badge categoria), che non include i pulsanti Presente/Assente
    // — sono un div fratello, non un discendente.
    const row = page.locator("div.rounded-xl", { hasText: fullName });
    await row.getByRole("button", { name: "Assente" }).click({ force: true });
    await page.getByRole("button", { name: /assenza non giustificata/i }).click({ force: true });
    await page.getByRole("button", { name: /salva presenze/i }).click({ force: true });
    await page.waitForURL(/\/admin\/presenze\/storico/, { timeout: 20_000 });
  });
});
