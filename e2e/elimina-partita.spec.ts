import { expect, test, type Page } from "@playwright/test";
import { localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Eliminare una partita: accanto a «Elimina» c'è «Avvisa chi segue il calendario», acceso di partenza solo per una partita che
 * deve ancora cominciare. Così togliere una partita di prova (una prova generale della diretta, già cominciata) non avvisa le
 * famiglie, e togliere una partita futura le avvisa come prima.
 */

test.use({ serviceWorkers: "block" });

async function createMatch(page: Page, opponent: string, when: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra elimina e2e");
  await page.getByLabel("Data e ora").fill(when);
  // Una prova: nessun avviso nemmeno alla creazione.
  await page.getByLabel("Avvisa chi segue il calendario").uncheck();
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

test("eliminare una partita: avviso acceso di partenza solo se deve ancora cominciare, e si può spegnere", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const past = await createMatch(page, uniqueName("Prova passata "), `${localDate(-1)}T20:00`);
  const future = await createMatch(page, uniqueName("Prova futura "), `${localDate(3)}T20:00`);

  for (const [id, expected] of [
    [past, false],
    [future, true],
  ] as const) {
    await page.goto(`/admin/partite/${id}/modifica`);
    const notify = page.locator("[data-delete-notify] input[name=notify]");
    if (expected) await expect(notify).toBeChecked();
    else await expect(notify).not.toBeChecked();
  }

  // Si elimina senza avviso (spento a mano sulla futura) e la partita sparisce dall'elenco.
  for (const id of [past, future]) {
    await page.goto(`/admin/partite/${id}/modifica`);
    await page.locator("[data-delete-notify] input[name=notify]").uncheck();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Elimina", exact: true }).click();
    await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
    expect((await page.request.get(`/admin/partite/${id}`)).status()).toBe(404);
  }
});
