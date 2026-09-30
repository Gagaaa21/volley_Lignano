import { test, expect } from "@playwright/test";

test.describe("Sito pubblico", () => {
  test("home U14/U15 carica il calendario", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Calendario allenamenti/i })).toBeVisible();
  });

  test("home Minivolley carica il calendario", async ({ page }) => {
    await page.goto("/minivolley");
    await expect(page.getByRole("heading", { name: /Calendario allenamenti/i })).toBeVisible();
  });

  test("pagina presenze Minivolley carica (raggruppata per CDA quando ci sono dati)", async ({ page }) => {
    await page.goto("/minivolley/presenze");
    await expect(page.getByRole("heading", { name: "Presenze" })).toBeVisible();
    const bodyText = await page.textContent("body");
    const hasData = bodyText?.includes("CDA Lignano") || bodyText?.includes("CDA San Michele");
    const isEmpty = bodyText?.includes("Nessuna presenza registrata per ora.");
    expect(hasData || isEmpty).toBe(true);
  });
});
