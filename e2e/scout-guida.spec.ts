import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * La guida dello Scout e il manuale d'uso in PDF: il riquadro «Prima volta con
 * lo Scout?», la guida che parte da sola su una partita vera e si segue fino in
 * fondo (anche dal telefono), la guida di ogni pagina dal punto interrogativo,
 * il manuale scaricabile solo da chi ha il permesso.
 */

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  // Niente «vl-scout-welcome-dismissed»: il riquadro di benvenuto deve comparire.
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
  await page.getByLabel("Luogo della partita").fill("Palestra guida e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T00:01`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const card = (page: Page) => page.locator("[data-tour-card]");

/** Segue la guida passo dopo passo fino a «Fine»; restituisce gli identificativi dei passi, in ordine. */
async function walkTour(page: Page, check?: (step: string) => Promise<void>): Promise<string[]> {
  const ids: string[] = [];
  for (let guard = 0; guard < 40; guard++) {
    await expect(card(page)).toBeVisible();
    const id = (await card(page).getAttribute("data-tour-step"))!;
    ids.push(id);
    if (check) await check(id);
    const next = card(page).getByRole("button", { name: /^(Avanti|Fine)$/ });
    const label = (await next.textContent())?.trim();
    await next.click();
    if (label === "Fine") break;
    await expect(card(page)).not.toHaveAttribute("data-tour-step", id);
  }
  await expect(card(page)).toHaveCount(0);
  return ids;
}

test("manuale d'uso: si scarica, è un PDF vero e senza accesso non si apre", async ({ page, request }) => {
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Il pulsante c'è in cima all'elenco e porta al PDF.
  await page.goto("/admin/scout");
  await expect(page.locator("[data-scout-manual-link]").first()).toHaveAttribute("href", "/api/scout/manuale");

  const response = await page.request.get("/api/scout/manuale");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="[a-z0-9-]*manuale[a-z0-9-]*\.pdf"$/);
  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(200_000);
  // Il PDF è lo stesso a ogni richiesta della giornata.
  const again = await page.request.get("/api/scout/manuale");
  expect((await again.body()).length).toBe(body.length);

  // Un visitatore senza accesso riceve 401, non il file.
  const anonymous = await request.get("/api/scout/manuale");
  expect(anonymous.status()).toBe(401);
});

test("riquadro «Prima volta con lo Scout?»: avvia la guida su una partita vera e si segue fino in fondo", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Guida "));

  await page.goto("/admin/scout");
  const welcome = page.locator("[data-scout-welcome]");
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("Prima volta con lo Scout?");
  await expect(welcome.locator("[data-scout-manual-link]")).toHaveAttribute("href", "/api/scout/manuale");
  // «Avvia la guida» porta alla prossima partita ancora da segnare, con la guida che parte da sola.
  const start = welcome.locator("[data-scout-guide-start]");
  await expect(start).toHaveAttribute("href", /^\/admin\/scout\/[0-9a-f-]+\?guida=1$/);
  await start.click();
  await page.waitForURL(/\/admin\/scout\/[0-9a-f-]+$/);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-tour-card", "rich");
  await expect(card(page).locator("[data-tour-chapter]")).toBeVisible();
  await expect(card(page)).toContainText(/1 di \d+/);
  // Il parametro dell'indirizzo sparisce: un ricaricamento non rilancia la guida.
  expect(page.url()).not.toContain("guida=1");
  await card(page).getByRole("button", { name: "Salta il tour" }).click();
  await expect(card(page)).toHaveCount(0);
  // Avviata la guida, il riquadro di benvenuto non si ripresenta.
  await page.goto("/admin/scout");
  await expect(page.locator("[data-scout-welcome]")).toHaveCount(0);

  // La guida di una partita nuova spiega la preparazione, dal tabellone al pulsante «Comincia».
  await page.goto(`/admin/scout/${matchId}?guida=1`);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-setup-intro");
  await expect(card(page).locator("[data-tour-chapter]")).toContainText("Preparare la partita");
  await expect(card(page)).toContainText(/1 di \d+/);
  expect(page.url()).not.toContain("guida=1");
  const ids = await walkTour(page);
  expect(ids.length).toBeGreaterThanOrEqual(10);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(
    expect.arrayContaining([
      "scout-setup-intro",
      "section-scout-board",
      "scout-setup-roster",
      "scout-setup-number",
      "scout-setup-opp",
      "scout-setup-rules",
      "section-scout-live",
      "scout-start",
      "scout-sync",
      "scout-manual",
    ]),
  );
  expect(ids.indexOf("scout-setup-roster")).toBeLessThan(ids.indexOf("scout-start"));

  // Ricaricando la pagina la guida non riparte; resta dietro al punto interrogativo, e «Salta il tour» la chiude quando vuoi.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await page.locator("[data-tour-start]").click();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-setup-intro");
  await card(page).getByRole("button", { name: "Avanti" }).click();
  await card(page).getByRole("button", { name: "Salta il tour" }).click();
  await expect(card(page)).toHaveCount(0);

  await deleteMatchById(page, matchId);
});

test("riquadro «Prima volta con lo Scout?»: «Non mostrare più» lo toglie per sempre", async ({ page }) => {
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/scout");
  const welcome = page.locator("[data-scout-welcome]");
  await expect(welcome).toBeVisible();
  await welcome.locator("[data-scout-welcome-dismiss]").click();
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-scout-welcome]")).toHaveCount(0);
  // Anche nella vista «Stagione».
  await page.goto("/admin/scout?vista=stagione");
  await expect(page.locator("[data-scout-welcome]")).toHaveCount(0);
});

test("ogni pagina dello Scout ha la sua guida dal punto interrogativo: elenco, stagione, partita e tabellino", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Pagine "));

  // Elenco delle partite: dal benvenuto al manuale.
  await page.goto("/admin/scout");
  await page.locator("[data-tour-start]").click();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-hub-intro");
  await expect(card(page)).toContainText("A cosa serve lo Scout");
  await expect(card(page).locator("[data-tour-tip]")).toBeVisible();
  const hub = await walkTour(page);
  expect(hub).toEqual(["scout-hub-intro", "scout-hub-tabs", "section-scout-matches", "scout-hub-action", "scout-hub-manual", "scout-hub-before", "scout-hub-go"]);

  // Vista «Stagione» (senza partite scoutizzate non ci sono i riquadri dei totali: la guida non li nomina).
  await page.goto("/admin/scout?vista=stagione");
  await page.locator("[data-tour-start]").click();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-hub-intro");
  await card(page).getByRole("button", { name: "Chiudi il tour" }).click();
  await expect(card(page)).toHaveCount(0);

  // Partita avviata (qualche punto già segnato): la guida spiega come si segna.
  const base = Date.now() - 600_000;
  const put = await page.evaluate(
    async ({ matchId, base }) => {
      const events = Array.from({ length: 4 }, (_, i) => ({
        type: "rally",
        id: `g-${i}`,
        at: base + i * 30_000,
        actor: i % 2 === 0 ? "us" : "opp",
        how: "attack",
        player: null,
        victim: null,
      }));
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" }, roster: { us: [], opp: [] }, events, finished: false },
          baseVersion: null,
        }),
      });
      return response.status;
    },
    { matchId, base },
  );
  expect(put).toBe(200);

  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.locator("[data-scout-board]")).toBeVisible();
  await page.locator("[data-tour-start]").click();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-play-intro");
  const play = await walkTour(page);
  expect(play).toEqual(
    expect.arrayContaining(["scout-play-intro", "section-scout-board", "scout-entry-us", "scout-entry-error", "scout-player", "scout-block", "scout-last", "section-scout-tools", "scout-live-toggle", "section-scout-log", "scout-sync", "scout-tabellino", "scout-manual", "scout-play-end"]),
  );
  expect(play).not.toContain("scout-setup-intro");

  // Tabellino: una guida per ogni blocco di numeri.
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator("[data-scout-result]")).toBeVisible();
  await page.locator("[data-tour-start]").click();
  await expect(card(page)).toHaveAttribute("data-tour-step", "scout-tab-result");
  const tab = await walkTour(page);
  expect(tab).toEqual(["scout-tab-result", "scout-tab-sets", "scout-tab-bp", "scout-tab-how", "scout-tab-errors", "scout-tab-flow", "scout-tab-players", "scout-tab-legend", "scout-tab-pdf"]);

  await deleteMatchById(page, matchId);
});

test("la guida dal telefono: la scheda sta nello schermo e i pulsanti si raggiungono a ogni passo", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Telefono "));

  await page.goto(`/admin/scout/${matchId}?guida=1`);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-tour-card", "rich");

  const ids = await walkTour(page, async (id) => {
    // La scheda sta dentro lo schermo (pannello in basso) e il pulsante per andare avanti si vede senza scorrere.
    const box = (await card(page).boundingBox())!;
    expect(box.x, `${id}: scheda a sinistra`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${id}: scheda a destra`).toBeLessThanOrEqual(390.5);
    expect(box.y, `${id}: scheda in alto`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${id}: scheda in basso`).toBeLessThanOrEqual(844.5);
    await expect(card(page).getByRole("button", { name: /^(Avanti|Fine)$/ }), `${id}: pulsante «Avanti» raggiungibile`).toBeInViewport({ ratio: 0.9 });
  });
  expect(ids.length).toBeGreaterThanOrEqual(10);

  await deleteMatchById(page, matchId);
});
