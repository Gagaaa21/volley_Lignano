import { expect, test, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Live score: formati dal 2 contro 2 al 6 contro 6, «Solo punteggio» senza
 * formazione e diretta sul sito pubblico, accesa e spenta da un admin. Il
 * tabellone è uno solo per tutto il sito: ogni test riparte da «Nuovo» e lo
 * richiude alla fine.
 */

async function openLiveScore(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  // Una partita lasciata da una prova precedente si ricarica da sola: si riparte da zero.
  const reset = page.getByRole("button", { name: "Nuovo" });
  if (await reset.isVisible().catch(() => false)) await reset.click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
}

const cells = (page: Page, side: "left" | "right") => page.locator(`[data-court-side="${side}"] [data-court-position]`);
const cell = (page: Page, side: "left" | "right", position: number) =>
  page.locator(`[data-court-side="${side}"] [data-court-position="${position}"]`);

test("formati da 2 a 6 giocatrici: il campo e la rotazione si adattano", async ({ page }) => {
  test.setTimeout(120_000);
  await openLiveScore(page);

  await page.getByRole("button", { name: "Partita", exact: true }).click();
  await page.getByRole("button", { name: "Con formazione" }).click();
  for (const n of [2, 3, 5, 6, 4]) {
    await page.getByRole("button", { name: `${n} vs ${n}` }).click();
    await expect(cells(page, "left")).toHaveCount(n);
    await expect(cells(page, "right")).toHaveCount(n);
    // Nel 2 contro 2 (affiancate, senza seconda linea) la libero non c'è.
    await expect(page.getByRole("button", { name: "Con libero" })).toHaveCount(n === 2 ? 0 : 1);
  }
  // Senza libero i campi della libero non ci sono; con la libero sì.
  await page.getByRole("button", { name: "Con libero" }).click();
  await expect(page.locator("#a-setup-libero")).toBeVisible();
  await page.getByRole("button", { name: "Senza", exact: true }).click();
  await expect(page.locator("#a-setup-libero")).toHaveCount(0);

  await page.getByLabel(/Nome avversaria/).fill("Rotazione Test");
  for (let p = 1; p <= 4; p++) {
    await cell(page, "left", p).locator("input").fill(`1${p}`);
    await cell(page, "right", p).locator("input").fill(`2${p}`);
  }
  await page.getByRole("button", { name: "Inizia" }).click();

  // Serve Lignano: se segna, tiene la battuta e non ruota nessuno.
  await page.getByRole("button", { name: "Punto Volley Lignano" }).click();
  await expect(cell(page, "left", 1)).toContainText("11");
  // L'avversaria conquista la battuta e ruota: in battuta va chi era in 2.
  await page.getByRole("button", { name: "Punto Rotazione Test" }).click();
  await expect(cell(page, "right", 1)).toContainText("22");
  await expect(cell(page, "right", 4)).toContainText("21");
  await expect(cell(page, "left", 1)).toContainText("11");

  // Sostituzione dal pulsante «Cambio»: esce la 11 (in battuta), entra la 19.
  await page.getByRole("button", { name: "Cambio" }).click();
  const dialog = page.locator("[data-livescore-substitution]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Pos\. 1/ }).click();
  await dialog.getByLabel("Entra").fill("12");
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(dialog).toContainText("già in campo");
  await dialog.getByLabel("Entra").fill("19");
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cell(page, "left", 1)).toContainText("19");
  // Un tocco sulla giocatrice in campo apre il cambio con lei già scelta.
  await cell(page, "right", 3).getByRole("button", { name: /Sostituisci/ }).click();
  await expect(dialog.getByRole("button", { name: /Pos\. 3/ })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByLabel("Entra").fill("29");
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(cell(page, "right", 3)).toContainText("29");
  // «Annulla» toglie anche un cambio.
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(cell(page, "right", 3)).toContainText("24");

  // Senza la diretta accesa il sito pubblico non vede nulla.
  const res = await page.request.get("/api/livescore/pubblico");
  expect((await res.json()).live).toBeNull();

  await page.getByRole("button", { name: "Nuovo" }).click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
});

test("solo punteggio con diretta pubblica: si vede sul sito senza nomi, e si spegne", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await openLiveScore(page);

  await page.getByRole("button", { name: "Allenamento", exact: true }).click();
  // In Allenamento la diretta non esiste.
  await expect(page.getByText("Diretta sul sito pubblico")).toHaveCount(0);

  await page.getByRole("button", { name: "Partita", exact: true }).click();
  await page.getByRole("button", { name: "Solo punteggio" }).click();
  await expect(page.locator("[data-court-position]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "4 vs 4" })).toHaveCount(0);
  // Senza formazione non si segue chi batte: niente «Chi serve per prima?».
  await expect(page.getByText("Chi serve per prima?")).toHaveCount(0);
  await page.getByLabel(/Nome avversaria/).fill("Pallavolo Diretta");
  await page.getByText("Diretta sul sito pubblico").click();
  await page.getByRole("button", { name: "Inizia" }).click();

  // In partita: niente campo né «Formazioni», la diretta risulta accesa.
  await expect(page.locator("[data-court-position]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Formazioni" })).toHaveCount(0);
  await expect(page.locator("[data-livescore-public-toggle]")).toHaveText(/In diretta/);
  await page.getByRole("button", { name: "Punto Volley Lignano" }).click();
  await page.getByRole("button", { name: "Punto Volley Lignano" }).click();
  await page.getByRole("button", { name: "Punto Pallavolo Diretta" }).click();

  // Il sito pubblico, senza accesso, mostra il riquadro «In diretta».
  const visitor = await browser.newContext();
  await visitor.addInitScript(() => {
    localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  const site = await visitor.newPage();
  await expect
    .poll(async () => (await (await site.request.get("/api/livescore/pubblico")).json()).live?.home?.score, {
      timeout: 15_000,
    })
    .toBe(2);
  await site.goto("/");
  const banner = site.locator("[data-public-livescore]");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText("In diretta");
  await expect(banner).toContainText("Risultato non ufficiale");
  await expect(banner).toContainText("Volley Lignano");
  await expect(banner).toContainText("Pallavolo Diretta");
  await expect(site.locator("[data-public-livescore-score]")).toContainText("2, Pallavolo Diretta 1");

  // Un altro punto arriva da solo, senza ricaricare la pagina.
  await page.getByRole("button", { name: "Punto Pallavolo Diretta" }).click();
  await expect(site.locator("[data-public-livescore-score]")).toContainText("Pallavolo Diretta 2", { timeout: 20_000 });

  // Il Minivolley non vede la diretta della U14/U15.
  await site.goto("/minivolley");
  await site.waitForLoadState("networkidle");
  await expect(site.locator("[data-public-livescore]")).toHaveCount(0);

  // Spenta dall'admin, sparisce dal sito.
  await page.locator("[data-livescore-public-toggle]").click();
  await expect(page.locator("[data-livescore-public-toggle]")).toHaveText(/Diretta/);
  await expect
    .poll(async () => (await (await site.request.get("/api/livescore/pubblico")).json()).live, { timeout: 15_000 })
    .toBeNull();
  await site.goto("/");
  await site.waitForLoadState("networkidle");
  await expect(site.locator("[data-public-livescore]")).toHaveCount(0);
  await visitor.close();

  await page.getByRole("button", { name: "Nuovo" }).click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
});
