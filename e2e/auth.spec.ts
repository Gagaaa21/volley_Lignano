import { test, expect } from "@playwright/test";
import { DEV_USERNAME, login, loginAsDev, logout, uniqueName } from "./helpers";

test.describe("Autenticazione", () => {
  test("credenziali errate mostrano un errore e restano su /login", async ({ page }) => {
    await login(page, DEV_USERNAME, "password-sicuramente-sbagliata");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Nome utente o password errati.")).toBeVisible();
  });

  test("un nuovo account è forzato a cambiare password al primo accesso", async ({ page }) => {
    await loginAsDev(page);

    const username = uniqueName("e2euser");
    const tempPassword = "TempPass123";

    await page.goto("/admin/staff");
    await page.getByLabel("Nome e cognome").fill("Utente Di Prova");
    await page.getByLabel("Nome utente").fill(username);
    await page.getByLabel("Password temporanea").fill(tempPassword);
    await page.getByRole("button", { name: /crea account admin/i }).click();
    await expect(page.getByText("Account creato")).toBeVisible();

    // Con una sessione Gaga ancora attiva, /login reindirizza a /admin
    // (vedi src/proxy.ts): serve disconnettersi prima di accedere come
    // l'account appena creato.
    await logout(page);
    await login(page, username, tempPassword);
    await expect(page).toHaveURL(/\/cambia-password/);

    await page.getByLabel("Password attuale").fill(tempPassword);
    await page.getByLabel("Nuova password", { exact: true }).fill("NuovaPass123");
    await page.getByLabel("Conferma nuova password").fill("NuovaPass123");
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);
  });
});
