import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Ricontrollo con l'IA della divisione in blocchi delle schede già salvate.
 * L'IA è un finto Gemini (e2e/fixtures/fake-gemini.mjs, avviato da playwright.config.ts):
 * si decide a ogni passo se risponde bene, è sovraccarico o ha finito le richieste.
 */
const FAKE_AI = "http://localhost:4010";

async function setAI(request: APIRequestContext, mode: "ok" | "busy" | "quota") {
  const response = await request.post(`${FAKE_AI}/__mode?m=${mode}`);
  expect(response.ok(), "Il finto Gemini non risponde: il server di prova va avviato da Playwright").toBe(true);
}

// Le righe "LAVORO … (40 min)" e "GIOCO (35 min)" le riconosce l'IA, non le regole fisse.
const TEXT = `1. Attivazione – 10'
Elastici
Foam roller

2. Core – 15'
Addominali
Plank

LAVORO ANALITICO SULL'ATTACCO (40 min)
Attacchi a muro

GIOCO (35 min)
6 contro 6 a tema`;

test("ricontrollo schede: errori chiari, riprova, salvataggio confermato, niente fuori dal riquadro", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // La scheda nasce "divisa male": con l'IA spenta restano le regole fisse, che vedono solo 2 blocchi.
  await setAI(request, "busy");
  await page.goto("/admin/schede/nuova");
  await page.getByLabel("Titolo scheda").fill(uniqueName("Ricontrollo "));
  await page.getByLabel(/Incolla il contenuto/).fill(TEXT);
  await page.getByRole("button", { name: "Crea scheda" }).click();
  await page.waitForURL(/\/admin\/schede\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText("2 blocchi")).toBeVisible();

  const panel = page.locator('[data-plan-split-check="single"]');

  // IA sovraccarica: lo dice, non dà la scheda per giusta, si può riprovare.
  await panel.getByRole("button", { name: "Ricontrolla con l'IA" }).click();
  const failures = panel.locator("[data-plan-split-failures]");
  await expect(failures).toContainText("non ha risposto", { timeout: 30_000 });
  await expect(panel.getByText("nulla da correggere")).toHaveCount(0);
  const { requests } = await (await request.get(`${FAKE_AI}/__requests`)).json();
  expect(requests, "Il server di sviluppo non usa il finto Gemini: la porta 3000 era già occupata?").toBeGreaterThan(0);

  // L'IA torna: "Riprova" propone le 4 parti, che stanno nel riquadro anche stretto o su telefono.
  await setAI(request, "ok");
  await failures.getByRole("button", { name: "Riprova" }).click();
  const proposal = panel.locator("[data-plan-split-proposal]");
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await expect(failures).toHaveCount(0);
  await expect(proposal).toContainText("Con l'IA · 4 blocchi");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await proposal.evaluate((el) => el.scrollWidth - el.clientWidth), `larghezza ${width}`).toBeLessThanOrEqual(0);
    expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth), `larghezza ${width}`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Applica: conferma con i blocchi riletti dal database, e la scheda cambia davvero.
  await proposal.getByRole("button", { name: "Applica", exact: true }).click();
  await expect(proposal).toContainText("Salvata: ora la scheda ha 4 blocchi", { timeout: 30_000 });
  await page.reload();
  await expect(page.getByText("4 blocchi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "LAVORO ANALITICO SULL'ATTACCO" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "GIOCO" })).toBeVisible();

  // Limite giornaliero finito: dall'elenco lo dice con parole chiare, elenca le schede saltate, non dice "tutto a posto".
  await setAI(request, "quota");
  await page.goto("/admin/schede");
  const all = page.locator('[data-plan-split-check="all"]');
  await all.getByRole("button", { name: /^Controlla/ }).click();
  await expect(all.locator("[data-plan-split-failures]")).toContainText("finito le richieste", { timeout: 60_000 });
  await expect(all.locator("[data-plan-split-failures] li").first()).toBeVisible();
  await expect(all.getByRole("button", { name: /^Riprova/ })).toBeVisible();
  await expect(all.getByText("già divise bene")).toHaveCount(0);
  await setAI(request, "ok");
});
