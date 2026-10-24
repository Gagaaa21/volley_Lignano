import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Lo Scout dal telefono (360 px, i più stretti): niente scorre di lato, nemmeno con il live sul sito acceso e mentre si salva;
 * la formazione si scrive su due metà campo, una per squadra con la rete in alto, dove si legge chi sta a rete; «Comincia» porta
 * al tabellone. Anche il Live score e la scheda «Diretta video» stanno nello schermo.
 */

// Come in scout.spec.ts: il service worker risponderebbe da sé alle richieste.
test.use({ serviceWorkers: "block", viewport: { width: 360, height: 780 }, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra telefono e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

async function chooseNumber(select: Locator, number: string) {
  const value = await select.locator("option", { hasText: new RegExp(`^${number} ·`) }).first().getAttribute("value");
  expect(value, `nel menù non c'è la giocatrice n. ${number}`).toBeTruthy();
  await select.selectOption(value!);
}

/** La pagina non si sposta di lato: niente è più largo dello schermo. */
async function expectNoSideScroll(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

/** Lettere al posto delle cifre: i nomi sono unici anche se nell'anagrafica ci sono atlete con lo stesso nome. */
const TAG = Date.now()
  .toString(36)
  .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);
const ROSTER: [string, string][] = [
  [`Anna ${TAG}`, "9"],
  [`Bea ${TAG}`, "2"],
  [`Carla ${TAG}`, "5"],
  [`Dora ${TAG}`, "7"],
  [`Elena ${TAG}`, "11"],
  [`Fede ${TAG}`, "14"],
];

test("dal telefono: niente scorre di lato, la formazione si legge su due metà campo e «Comincia» porta al tabellone", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Telefono "));
  try {
    await page.goto(`/admin/scout/${matchId}`);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    for (const [name, number] of ROSTER) await addPlayer(page, name, number);

    // Sul telefono la formazione ha due metà campo, una per squadra: la prima linea (4-3-2) in alto, sotto la rete.
    const card = page.locator("[data-scout-lineup]");
    await expect(card.locator("[data-scout-lineup-halves]")).toBeVisible();
    const ours = card.locator('[data-scout-lineup-half="us"]');
    await expect(ours.locator("[data-scout-lineup-cell]")).toHaveCount(6);
    await expect(card.locator('[data-scout-lineup-half="opp"] [data-scout-lineup-cell]')).toHaveCount(6);
    for (const [index, number] of ["9", "2", "5", "7", "11", "14"].entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
    // Le posizioni si misurano tutte insieme: tra una misura e l'altra la pagina può ancora scorrere (dopo l'ultima scelta).
    const spots = Object.fromEntries(
      await card.locator("[data-scout-lineup-cell^='us-']").evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return [element.getAttribute("data-scout-lineup-cell")!, { x: box.x, y: box.y, width: box.width }] as const;
        }),
      ),
    );
    // Chi sta a rete si legge: le caselle della prima linea sono larghe quanto quelle dietro.
    expect(spots["us-3"].width).toBeGreaterThan(60);
    expect(Math.abs(spots["us-3"].width - spots["us-6"].width)).toBeLessThan(2);
    // La 4 sta sopra la 5, la 2 sopra la 1: come la vede la squadra dalla sua parte.
    expect(spots["us-4"].y).toBeLessThan(spots["us-5"].y);
    expect(Math.abs(spots["us-4"].x - spots["us-5"].x)).toBeLessThan(2);
    expect(spots["us-2"].y).toBeLessThan(spots["us-1"].y);
    // I numeri dell'avversaria si scrivono di seguito: Invio passa alla posizione dopo.
    await card.locator('[data-scout-lineup-cell="opp-1"]').fill("21");
    await card.locator('[data-scout-lineup-cell="opp-1"]').press("Enter");
    await page.keyboard.type("22");
    await expect(card.locator('[data-scout-lineup-cell="opp-2"]')).toHaveValue("22");
    await card.locator("[data-scout-lineup-confirm]").click();
    await expect(card.locator("[data-scout-lineup-done]")).toBeVisible();

    await page.locator("[data-scout-public-live]").check({ force: true });
    await expectNoSideScroll(page);

    // «Comincia» sta in fondo alla preparazione: dopo si è in cima, al tabellone.
    await page.locator("[data-scout-start]").click();
    await expect(page.locator("[data-scout-score]")).toHaveText("0–0");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator("[data-scout-live-badge]")).toBeVisible();
    await expectNoSideScroll(page);

    // Un punto: l'intestazione resta nello schermo anche mentre salva.
    await page.locator('[data-scout-add="us-attack"]').click();
    await page.locator("[data-scout-sheet^='player'] [data-scout-pick]", { hasText: "Anna" }).first().click();
    await expect(page.locator("[data-scout-score]")).toHaveText("1–0");
    await expectNoSideScroll(page);
    await expect(page.locator("[data-scout-sync]")).toHaveAttribute("data-scout-sync", "saved", { timeout: 20_000 });
    await expectNoSideScroll(page);
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});

test("dal telefono: il Live score (anche con quattro formule) e la scheda «Diretta video» stanno nello schermo", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Il tabellone è uno solo per tutto il sito: si cancella quello lasciato da una prova precedente (come in livescore-regole).
  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("group", { name: "Tipo" }).getByRole("button", { name: "Allenamento", exact: true }).click();
  await expect(page.getByRole("group", { name: "Formula" }).getByRole("button", { name: "Libera" })).toBeVisible();
  await expectNoSideScroll(page);

  await page.goto("/admin/scout");
  await expect(page.locator("[data-diretta-card]")).toBeVisible();
  await expectNoSideScroll(page);
  // Lo stato della diretta sta accanto al titolo: la descrizione ha tutta la larghezza della scheda.
  const card = await page.locator("[data-diretta-card] summary").boundingBox();
  const status = await page.locator("[data-diretta-status]").boundingBox();
  expect(status!.y - card!.y).toBeLessThan(60);
});
