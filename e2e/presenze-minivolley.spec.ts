import { test, expect } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName } from "./helpers";

test.describe("Presenze Minivolley", () => {
  test("anagrafica con Gruppo, aggiunta in blocco con dedup, checklist solo-presenti", async ({ page }) => {
    await loginAsDev(page);
    await switchTeam(page, "minivolley");

    await page.goto("/admin/presenze/atlete/nuova");
    await expect(page.getByLabel(/Gruppo/i)).toBeVisible();
    await expect(page.locator("label", { hasText: "Categoria" })).toHaveCount(0);

    const uniqueSuffix = uniqueName("");
    const firstName = `Prova${uniqueSuffix}`;
    const lastName = "Lignano";
    const fullName = `${firstName} ${lastName}`;
    await page.getByLabel("Nome e cognome").fill(fullName);
    await page.getByLabel(/Gruppo/i).selectOption("lignano");
    await page.getByRole("button", { name: /salva atleta/i }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
    let bodyText = await page.textContent("body");
    expect(bodyText).toContain("CDA Lignano");
    expect(bodyText).toContain(fullName);

    // Aggiunta in blocco: due righe con gruppo + una malformata.
    await page.goto("/admin/presenze/atlete/elenco");
    const rowsText = [
      `Minivolley S3 Lignano Sabbiadoro\t${firstName}Bulk\tUno`,
      `Minivolley S3 San Michele al Tagliamento\t${firstName}Bulk\tDue`,
      "Riga Senza Colonne Valide " + uniqueSuffix,
    ].join("\n");
    await page.getByLabel("Nominativi").fill(rowsText);
    await page.getByRole("button", { name: /aggiungi elenco/i }).click();
    await page.waitForTimeout(400);
    bodyText = await page.textContent("body");
    expect(bodyText).toContain("3 atlete aggiunte");

    // Incollare di nuovo lo stesso elenco: tutte già esistenti, 0 create.
    await page.getByLabel("Nominativi").fill(rowsText);
    await page.getByRole("button", { name: /aggiungi elenco/i }).click();
    await page.waitForTimeout(400);
    bodyText = await page.textContent("body");
    expect(bodyText).toContain("0 atlete aggiunte");
    expect(bodyText).toContain("3 già esistenti");

    // Allenamento Minivolley di oggi, per registrare le presenze.
    await page.goto("/admin/allenamenti/nuovo");
    await page.getByRole("radio", { name: "Singolo giorno" }).check({ force: true });
    await page.getByLabel("Luogo").fill("Palestra Minivolley E2E");
    const todayStr = new Date().toISOString().slice(0, 10);
    await page.locator('input[name="startDate"]').fill(todayStr);
    await page.getByRole("button", { name: /salva allenamento/i }).click();
    await page.waitForURL(/\/admin\/allenamenti\/elenco$/, { timeout: 20_000 });

    await page.goto("/admin/presenze");
    const registraLink = page.locator('a[href*="/admin/presenze/registra/"]').first();
    await expect(registraLink).toBeVisible();
    await registraLink.click();
    await page.waitForURL(/\/admin\/presenze\/registra\//, { timeout: 20_000 });

    await expect(page.getByText("0 presenti su")).toBeVisible();
    await expect(page.getByText("CDA Lignano")).toBeVisible();
    await expect(page.getByText("CDA San Michele")).toBeVisible();

    await page.getByRole("button", { name: fullName }).click();
    await expect(page.getByText("1 presenti su")).toBeVisible();
    await page.getByRole("button", { name: /salva presenze/i }).click({ force: true });
    await page.waitForURL(/\/admin\/presenze\/storico/, { timeout: 20_000 });
  });

  test("un allenamento Minivolley di ieri non conta come da registrare", async ({ page }) => {
    await loginAsDev(page);
    await switchTeam(page, "minivolley");

    // Il test precedente ha già registrato le presenze dell'allenamento di
    // oggi: prima di aggiungerne uno di ieri, il contatore "da registrare"
    // deve essere a zero.
    await page.goto("/admin");
    await expect(page.getByText("Presenze da registrare")).toBeVisible();
    const before = await page
      .locator("text=Presenze da registrare")
      .locator("xpath=preceding-sibling::p")
      .first()
      .textContent();
    expect(before?.trim()).toBe("0");
    await expect(page.getByText(/allenamenti senza presenze registrate/)).toHaveCount(0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    await page.goto("/admin/allenamenti/nuovo");
    await page.getByRole("radio", { name: "Singolo giorno" }).check({ force: true });
    await page.getByLabel("Luogo").fill("Palestra Ieri E2E");
    await page.locator('input[name="startDate"]').fill(yesterdayStr);
    await page.getByRole("button", { name: /salva allenamento/i }).click();
    await page.waitForURL(/\/admin\/allenamenti\/elenco$/, { timeout: 20_000 });

    // Un allenamento di ieri, senza presenze registrate, non deve far
    // salire il contatore "da registrare" per il Minivolley (regola
    // "ignora gli allenamenti antecedenti a oggi").
    await page.goto("/admin");
    const after = await page
      .locator("text=Presenze da registrare")
      .locator("xpath=preceding-sibling::p")
      .first()
      .textContent();
    expect(after?.trim()).toBe("0");
    await expect(page.getByText(/allenamenti senza presenze registrate/)).toHaveCount(0);
  });
});
