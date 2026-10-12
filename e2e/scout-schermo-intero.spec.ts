import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout a schermo intero: il riquadro ricopre la finestra e, su schermi larghi,
 * si divide in due colonne (tabellone, pulsanti per segnare e comandi a sinistra;
 * chi è in campo e registro a destra). Su telefono resta una colonna sola.
 */

// Come in scout.spec.ts: il service worker risponderebbe da sé alle richieste.
test.use({ serviceWorkers: "block" });

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
  await page.getByLabel("Luogo della partita").fill("Palestra schermo intero e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");
const stage = (page: Page) => page.locator("[data-scout-stage]");
const fullscreenButton = (page: Page) => page.locator("[data-scout-fullscreen]");

async function chooseNumber(select: Locator, number: string) {
  const value = await select.locator("option", { hasText: new RegExp(`^${number} ·`) }).first().getAttribute("value");
  expect(value, `nel menù non c'è la giocatrice n. ${number}`).toBeTruthy();
  await select.selectOption(value!);
}

async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

/** Una partita pronta: sette giocatrici, la formazione (così c'è «In campo») e il primo punto da segnare. */
async function prepare(page: Page, matchId: string) {
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  for (const [name, number] of [
    ["Anna Verdi", "9"],
    ["Bea Neri", "2"],
    ["Carla Bruni", "5"],
    ["Dora Gallo", "7"],
    ["Elena Costa", "11"],
    ["Fede Riva", "14"],
    ["Giada Conti", "1"],
  ]) {
    await addPlayer(page, name, number);
  }
  const card = page.locator("[data-scout-lineup]");
  for (const [index, number] of ["9", "2", "5", "7", "11", "14"].entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
  for (const [index, number] of ["21", "22", "23", "24", "25", "26"].entries()) await card.locator(`[data-scout-lineup-cell="opp-${index + 1}"]`).fill(number);
  await chooseNumber(card.locator("#scout-lineup-us-libero"), "1");
  await chooseNumber(card.locator("#scout-lineup-us-host1"), "5");
  await chooseNumber(card.locator("#scout-lineup-us-host2"), "14");
  await card.locator("[data-scout-lineup-confirm]").click();
  await expect(card.locator("[data-scout-lineup-done]")).toBeVisible();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
}

/** Punto loro con il pulsante del livello Base (attacco della n. 21). */
async function opponentPoint(page: Page) {
  await page.locator('[data-scout-add="opp-attack"]').click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  await sheet.locator('[data-scout-pick="opp-21"]').click();
}

/** Il riquadro dello Scout ricopre tutta la finestra? */
async function stageFillsWindow(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector("[data-scout-stage]") as HTMLElement;
    const r = element.getBoundingClientRect();
    return r.x === 0 && r.y === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight;
  });
}

/** Il menu del sito (il pulsante dell'account) è coperto dallo Scout? Coperto, non nascosto: sta sotto il riquadro a tutto schermo. */
async function siteMenuCoveredByStage(page: Page) {
  const b = await page.getByRole("button", { name: "Menu account" }).boundingBox();
  if (!b) return true;
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest("[data-scout-stage]"));
  }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b, "elemento non visibile").not.toBeNull();
  return b!;
};

test("schermo intero su schermo largo: due colonne (campo e registro a destra), si segna, si esce con «Esci»", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Intero "));
  await prepare(page, matchId);

  // Prima: pagina normale, una colonna, con il menu del sito e «In campo» sopra i pulsanti.
  await expect(page.locator("[data-scout-columns]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu account" })).toBeVisible();
  expect(await siteMenuCoveredByStage(page)).toBe(false);
  await expect(page.locator('[data-tour="section-scout-entry"] [data-scout-court-strip]')).toHaveCount(1);
  await expect(fullscreenButton(page)).toContainText("Schermo intero");
  await expect(fullscreenButton(page)).toHaveAttribute("aria-pressed", "false");

  // Schermo intero: il riquadro riempie la finestra, il menu del sito non si vede.
  await fullscreenButton(page).click();
  await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
  await expect(fullscreenButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(fullscreenButton(page)).toContainText("Esci");
  await expect.poll(() => stageFillsWindow(page)).toBe(true);
  expect(await siteMenuCoveredByStage(page)).toBe(true);

  // Due colonne: a sinistra tabellone e pulsanti, a destra «In campo» e registro, tutti nella finestra.
  const main = page.locator("[data-scout-main-pane]");
  const side = page.locator("[data-scout-log-pane]");
  await expect(main.locator("[data-scout-board]")).toBeVisible();
  await expect(main.locator('[data-scout-add="us-attack"]')).toBeVisible();
  await expect(side.locator("[data-scout-court-strip]")).toBeVisible();
  await expect(main.locator("[data-scout-court-strip]")).toHaveCount(0);
  await expect(side.getByRole("heading", { name: "Registro" })).toBeVisible();
  const mainBox = await box(main);
  const sideBox = await box(side);
  expect(sideBox.x).toBeGreaterThanOrEqual(mainBox.x + mainBox.width - 1);
  const viewport = page.viewportSize()!;
  expect(sideBox.x + sideBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  // Si segna a schermo intero: il punto compare nel registro a destra, senza scorrere.
  await opponentPoint(page);
  await expect(score(page)).toHaveText("0–1");
  await expect(side.locator('[data-scout-rally="1"]')).toBeVisible();
  const row = await box(side.locator('[data-scout-rally="1"]'));
  expect(row.y + row.height).toBeLessThanOrEqual(viewport.height);

  // «Esci»: torna la pagina normale, il punto c'è ancora e «In campo» è di nuovo sopra i pulsanti.
  await fullscreenButton(page).click();
  await expect(page.locator("[data-scout-columns]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu account" })).toBeVisible();
  expect(await siteMenuCoveredByStage(page)).toBe(false);
  await expect(page.locator('[data-tour="section-scout-entry"] [data-scout-court-strip]')).toHaveCount(1);
  await expect(score(page)).toHaveText("0–1");
  await expect(page.locator('[data-scout-rally="1"]')).toBeVisible();

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test("schermo intero senza lo schermo intero vero (iPhone, app installata): il riquadro ricopre la finestra e si chiude con Esc", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    delete proto.requestFullscreen;
    delete proto.webkitRequestFullscreen;
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Simulato "));
  await prepare(page, matchId);

  await fullscreenButton(page).click();
  await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
  await expect(stage(page)).toHaveCSS("position", "fixed");
  expect(await stageFillsWindow(page)).toBe(true);
  expect(await siteMenuCoveredByStage(page)).toBe(true);
  await opponentPoint(page);
  await expect(score(page)).toHaveText("0–1");

  // Esc lo chiude.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-scout-columns]")).toHaveCount(0);
  await expect(stage(page)).not.toHaveCSS("position", "fixed");
  await expect(page.getByRole("button", { name: "Menu account" })).toBeVisible();
  expect(await siteMenuCoveredByStage(page)).toBe(false);
  await expect(score(page)).toHaveText("0–1");

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test.describe("sul telefono", () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

  test("schermo intero: una colonna sola, «In campo» sopra i pulsanti e il registro sotto, senza scorrere di lato", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      const proto = Element.prototype as unknown as Record<string, unknown>;
      delete proto.requestFullscreen;
      delete proto.webkitRequestFullscreen;
    });
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Telefono "));
    await prepare(page, matchId);

    // Il pulsante c'è anche sul telefono (solo l'icona, con il nome per chi usa il lettore di schermo).
    await expect(fullscreenButton(page)).toHaveAccessibleName("Schermo intero");
    await fullscreenButton(page).click();
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect(fullscreenButton(page)).toHaveAccessibleName("Esci da schermo intero");
    expect(await stageFillsWindow(page)).toBe(true);

    // Una colonna: «In campo» e i pulsanti stanno prima del registro, nello stesso verso di scorrimento.
    const main = page.locator("[data-scout-main-pane]");
    const side = page.locator("[data-scout-log-pane]");
    await expect(main.locator("[data-scout-court-strip]")).toHaveCount(1);
    await expect(side.locator("[data-scout-court-strip]")).toHaveCount(0);
    const mainBox = await box(main);
    await side.scrollIntoViewIfNeeded();
    const sideBox = await box(side);
    expect(sideBox.width).toBeLessThanOrEqual(375);
    // Il registro è più in basso dei pulsanti (coordinate della finestra, dopo lo scorrimento si confronta l'ordine nel DOM).
    const order = await page.evaluate(() => {
      const a = document.querySelector("[data-scout-main-pane]")!;
      const b = document.querySelector("[data-scout-log-pane]")!;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? "main prima" : "log prima";
    });
    expect(order).toBe("main prima");
    expect(mainBox.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-scout-columns]")).toHaveCount(0);
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });
});
