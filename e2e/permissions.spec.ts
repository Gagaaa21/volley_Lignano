import { test, expect } from "@playwright/test";
import { dismissTourIfShown, login, loginAsDev, logout, uniqueName } from "./helpers";

test.describe("Permessi Centro di controllo", () => {
  test("un Admin con permessi ristretti non vede né raggiunge le sezioni non permesse", async ({ page }) => {
    await loginAsDev(page);

    const username = uniqueName("restricted");
    const password = "Restrict123";

    await page.goto("/admin/staff");
    await page.getByLabel("Nome e cognome").fill("Admin Ristretto E2E");
    await page.getByLabel("Nome utente").fill(username);
    await page.getByLabel("Password temporanea").fill(password);
    await page.getByRole("button", { name: /crea account admin/i }).click();
    await expect(page.getByText("Account creato")).toBeVisible();

    await page.goto("/admin/centro-controllo");
    const row = page.locator("form", { hasText: `@${username}` }).first();
    await expect(row).toBeVisible();

    // Toglie tutte le pagine tranne "Guida" (serve per raggiungere
    // /admin/guida e verificarne il filtro).
    for (const label of ["Allenamenti", "Partite", "Schede", "Presenze", "Live score", "Pronostici", "Staff"]) {
      const chip = row.locator("label", { hasText: label }).first();
      const input = chip.locator('input[type="checkbox"]');
      if ((await input.count()) > 0 && (await input.isChecked())) {
        await chip.click();
        await page.waitForTimeout(250);
      }
    }

    // Con una sessione Gaga ancora attiva, /login reindirizza a /admin
    // (vedi src/proxy.ts): serve disconnettersi prima di accedere come
    // l'account appena creato.
    await logout(page);
    await login(page, username, password);
    await expect(page).toHaveURL(/\/cambia-password/);
    await page.getByLabel("Password attuale").fill(password);
    await page.getByLabel("Nuova password", { exact: true }).fill("Restrict1234");
    await page.getByLabel("Conferma nuova password").fill("Restrict1234");
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);

    await dismissTourIfShown(page);

    // /admin/guida non mostra sezioni non permesse.
    await page.goto("/admin/guida");
    const guidaText = await page.textContent("body");
    expect(guidaText).not.toContain("Registro presenze collegato");
    expect(guidaText).not.toContain("Gestione degli account che accedono");

    // Accesso diretto a una sezione non permessa reindirizza a /admin.
    await page.goto("/admin/staff");
    await expect(page).toHaveURL(/\/admin\/?$/);
  });
});
