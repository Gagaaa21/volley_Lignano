import { test, expect } from "@playwright/test";
import { DEV_USERNAME, dismissTourIfShown, login, loginAsDev, logout, uniqueName } from "./helpers";

test.describe("Autenticazione", () => {
  test("credenziali errate mostrano un errore e restano su /login", async ({ page }) => {
    await login(page, DEV_USERNAME, "password-sicuramente-sbagliata");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Nome utente o password errati.")).toBeVisible();
    // Sotto, cosa controllare: maiuscole e la password vecchia che il telefono propone da solo.
    await expect(page.locator("[data-login-hint]")).toContainText("telefono può proporre da solo quella vecchia");
  });

  test("i campi dell'accesso non si correggono da soli sul telefono", async ({ page }) => {
    await page.goto("/login");
    for (const label of ["Nome utente", "Password"]) {
      const field = page.getByLabel(label, { exact: true });
      await expect(field).toHaveAttribute("autocapitalize", "none");
      await expect(field).toHaveAttribute("autocorrect", "off");
      await expect(field).toHaveAttribute("spellcheck", "false");
    }
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

    // La password temporanea è appena stata scritta per entrare: non si chiede di nuovo (il telefono ci metteva da solo
    // quella vecchia e il cambio veniva rifiutato).
    await expect(page.getByText("Sei entrato con una password temporanea")).toBeVisible();
    await expect(page.getByLabel("Password attuale")).toHaveCount(0);
    await page.getByLabel("Nuova password", { exact: true }).fill("NuovaPass123");
    await page.getByLabel("Conferma nuova password").fill("NuovaPass123");
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);

    // Il cambio scelto da sé, invece, chiede sempre la password attuale.
    await page.goto("/admin/cambia-password");
    await expect(page.getByLabel("Password attuale")).toBeVisible();
    await page.getByLabel("Password attuale").fill(tempPassword);
    await page.getByLabel("Nuova password", { exact: true }).fill("AltraPass123");
    await page.getByLabel("Conferma nuova password").fill("AltraPass123");
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page.getByText("La password attuale non è corretta.")).toBeVisible();
  });

  test("password rimessa dal Developer: si entra anche con maiuscole nel nome e uno spazio in più", async ({ page }) => {
    await loginAsDev(page);

    const username = uniqueName("e2ereset");
    const fullName = `Allenatore ${username}`;
    await page.goto("/admin/staff");
    await page.getByLabel("Nome e cognome").fill(fullName);
    await page.getByLabel("Nome utente").fill(username);
    await page.getByLabel("Password temporanea").fill("PrimaPass123");
    await page.getByRole("button", { name: /crea account admin/i }).click();
    await expect(page.getByText("Account creato")).toBeVisible();
    await expect(page.locator("[data-staff-credentials-copy]")).toBeVisible();

    // Il Developer rimette la password: uno spazio prima e dopo (come la tastiera del telefono) non finisce nella password.
    await page.goto("/admin/staff");
    await page.getByRole("link", { name: `Modifica ${fullName}` }).click();
    await expect(page).toHaveURL(/\/admin\/staff\/[^/]+$/);
    const newPassword = page.getByLabel(/Nuova password temporanea/);
    await expect(newPassword).toHaveAttribute("autocapitalize", "none");
    await newPassword.fill("  Rimessa2026 ");
    await page.getByRole("button", { name: /salva modifiche/i }).click();
    await expect(page.locator("[data-staff-credentials]")).toContainText("Nuova password: Rimessa2026");
    await expect(page.locator("[data-staff-credentials-copy]")).toBeVisible();

    await logout(page);
    // Prima lettera maiuscola (la mette il telefono) e uno spazio in fondo alla password: si entra lo stesso.
    await login(page, username.charAt(0).toUpperCase() + username.slice(1), "Rimessa2026 ");
    await expect(page).toHaveURL(/\/cambia-password/);
    await expect(page.getByLabel("Password attuale")).toHaveCount(0);
    await page.getByLabel("Nuova password", { exact: true }).fill("SceltaDaMe123");
    await page.getByLabel("Conferma nuova password").fill("SceltaDaMe123");
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);
    await dismissTourIfShown(page);

    // La vecchia temporanea non vale più, la nuova sì.
    await logout(page);
    await login(page, username, "Rimessa2026");
    await expect(page.getByText("Nome utente o password errati.")).toBeVisible();
    await login(page, username, "SceltaDaMe123");
    await expect(page).toHaveURL(/\/admin(\?|$)/);
  });
});
