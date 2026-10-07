import { expect, test } from "@playwright/test";
import { loginAsDev } from "./helpers";

/**
 * «Invia notifica manuale» (Centro di controllo): il modulo parte vuoto e senza
 * destinatari scelti, così una notifica non parte mai con il testo di esempio
 * né verso una squadra a cui non si era pensato.
 */
test("il modulo della notifica manuale parte vuoto e chiede a chi mandarla", async ({ page }) => {
  await loginAsDev(page);
  await page.goto("/admin/centro-controllo");

  const title = page.getByLabel("Titolo");
  const body = page.getByLabel("Testo");
  await expect(title).toHaveValue("");
  await expect(body).toHaveValue("");
  await expect(title).toHaveAttribute("placeholder", /Convocazioni disponibili/);
  await expect(page.locator('input[name="audience"]:checked')).toHaveCount(0);

  // Testo scritto ma nessun destinatario: non parte e lo dice.
  await title.fill("Prova");
  await body.fill("Testo di prova");
  await page.getByRole("button", { name: "Invia notifica" }).click();
  await expect(page.getByText("Scegli a chi mandare la notifica.")).toBeVisible();
});
