import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout a schermo intero: il riquadro ricopre la finestra e, su schermi larghi,
 * si divide in due colonne (pulsanti per segnare e comandi a sinistra; tabellone fisso
 * in alto, chi è in campo e registro a destra). Su telefono resta una colonna sola.
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

/** In panchina, oltre alle sette: una squadra vera ha 12–14 giocatrici, e le tessere di «chi» vanno su due righe. */
const BENCH: [string, string][] = [
  ["Hilda Fonte", "3"],
  ["Ilaria Rossi", "4"],
  ["Lia Bianchi", "6"],
  ["Mia Verdi", "8"],
  ["Nora Gallo", "10"],
  ["Olga Riva", "12"],
];

/**
 * Una partita pronta: sette giocatrici (più la panchina, se serve), la formazione (così c'è «In campo», e le schede
 * mostrano il campo) e il primo punto da segnare. Senza `lineup` la formazione non si scrive e chi gioca si sceglie da numeri.
 */
async function prepare(
  page: Page,
  matchId: string,
  level: "base" | "ricezioni" = "base",
  { bench = false, lineup = true }: { bench?: boolean; lineup?: boolean } = {},
) {
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
    ...(bench ? BENCH : []),
  ]) {
    await addPlayer(page, name, number);
  }
  if (!lineup) {
    // Senza la formazione i numeri dell'avversaria si scrivono a parte, come nel Livello Base.
    await page.getByLabel("Numeri di maglia dell'avversaria").fill("21 22 23 24 25 26");
    await page.getByLabel("Numeri di maglia dell'avversaria").press("Enter");
    await expect(page.locator('[data-scout-opponent="26"]')).toBeVisible();
  }
  if (lineup) {
    const card = page.locator("[data-scout-lineup]");
    for (const [index, number] of ["9", "2", "5", "7", "11", "14"].entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
    for (const [index, number] of ["21", "22", "23", "24", "25", "26"].entries()) await card.locator(`[data-scout-lineup-cell="opp-${index + 1}"]`).fill(number);
    await chooseNumber(card.locator("#scout-lineup-us-libero"), "1");
    await chooseNumber(card.locator("#scout-lineup-us-host1"), "5");
    await chooseNumber(card.locator("#scout-lineup-us-host2"), "14");
    await card.locator("[data-scout-lineup-confirm]").click();
    await expect(card.locator("[data-scout-lineup-done]")).toBeVisible();
  }
  if (level !== "base") await page.locator(`[data-scout-level="${level}"]`).click();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
}

/** Punto loro con il pulsante del livello Base (attacco: si segna subito, senza chiedere chi). */
async function opponentPoint(page: Page) {
  await page.locator('[data-scout-add="opp-attack"]').click();
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

  // Due colonne: a sinistra i pulsanti per segnare, a destra il tabellone (fisso in alto), «In campo» e il registro.
  const main = page.locator("[data-scout-main-pane]");
  const side = page.locator("[data-scout-log-pane]");
  await expect(side.locator("[data-scout-board]")).toBeVisible();
  await expect(main.locator("[data-scout-board]")).toHaveCount(0);
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

/** Dove sta ogni posizione del campo dentro `scope` (il centro della casella, nella finestra del browser). */
async function spotCenters(scope: Locator): Promise<Record<number, { x: number; y: number }>> {
  return scope.locator("[data-scout-spot]").evaluateAll((elements) =>
    Object.fromEntries(
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return [Number(element.getAttribute("data-scout-spot")), { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
      }),
    ),
  );
}

/** Quanto scorre l'area dei comandi a sinistra (0 = entra tutta). */
const mainOverflow = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector("[data-scout-main-scroll]") as HTMLElement;
    return element.scrollHeight - element.clientHeight;
  });

/** La finestra della ricezione: si apre da sola quando battono loro, come quelle dei tasti dei punti. */
const receptionSheet = (page: Page) => page.locator('[data-scout-sheet="reception"]');

/** La finestra c'è e sta tutta dentro la finestra del browser: niente da cercare scorrendo. */
async function expectReceptionWindowInView(page: Page) {
  await expect(receptionSheet(page)).toBeVisible();
  const { width, height } = page.viewportSize()!;
  const b = await box(receptionSheet(page));
  expect(b.y, "la finestra esce dal bordo alto").toBeGreaterThanOrEqual(-1);
  expect(b.y + b.height, "la finestra esce dal bordo basso").toBeLessThanOrEqual(height + 1);
  expect(b.x, "la finestra esce a sinistra").toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width, "la finestra esce a destra").toBeLessThanOrEqual(width + 1);
}

/** Si segna la ricezione sul campo della finestra: la giocatrice in posizione `spot` e il voto; la finestra si chiude. */
async function receiveOnCourt(page: Page, spot: number, grade: string, name: string) {
  const reception = page.locator('[data-scout-reception="open"]');
  await reception.locator(`[data-scout-spot="${spot}"]`).click();
  await reception.locator(`[data-scout-grades="reception"] [data-scout-grade="${grade}"]`).click();
  await expect(receptionSheet(page)).toHaveCount(0);
  await expect(page.locator('[data-scout-reception="done"]')).toContainText(name);
}

test.describe("su iPad in orizzontale (1180×820)", () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test("livello Base: i pulsanti dei punti riempiono l'altezza, il registro la sua colonna e gli strumenti stanno in fondo", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Spazio base "));
    await prepare(page, matchId);
    await fullscreenButton(page).click();
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect.poll(() => stageFillsWindow(page)).toBe(true);

    const viewport = page.viewportSize()!;
    const entry = await box(page.locator("[data-scout-entry]"));
    const footer = await box(page.locator("[data-scout-footer]"));
    // I quattro pulsanti di ciascuna squadra arrivano fino agli strumenti: niente spazio vuoto sotto, e sono alti da toccare bene.
    expect(footer.y - (entry.y + entry.height), "spazio vuoto sotto i pulsanti dei punti").toBeLessThanOrEqual(24);
    expect((await box(page.locator('[data-scout-add="us-attack"]'))).height).toBeGreaterThanOrEqual(150);
    expect((await box(page.locator('[data-scout-add="opp-ace"]'))).height).toBeGreaterThanOrEqual(150);
    // «Annulla ultimo» e gli strumenti restano in fondo alla finestra.
    expect(footer.y + footer.height).toBeGreaterThanOrEqual(viewport.height - 40);
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
    expect(await mainOverflow(page)).toBeLessThanOrEqual(1);
    // A destra il registro arriva in fondo alla colonna, anche se è ancora vuoto.
    const log = await box(page.locator("[data-scout-log-scroll]"));
    expect(log.y + log.height, "il registro non riempie la colonna").toBeGreaterThanOrEqual(viewport.height - 40);

    // Si segna: la pagina non scorre e il punto sta nel registro.
    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expect(page.locator('[data-scout-log-pane] [data-scout-rally="1"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });

  test("livello Con ricezioni, con la formazione e 13 giocatrici: quando battono loro si apre da sola la finestra con il campo e i voti grandi", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione finestra "));
    await prepare(page, matchId, "ricezioni", { bench: true });
    await fullscreenButton(page).click();
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect.poll(() => stageFillsWindow(page)).toBe(true);

    // Batte la nostra squadra: nessuna finestra, e i pulsanti dei punti riempiono l'altezza.
    await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();
    await expect(receptionSheet(page)).toHaveCount(0);
    expect((await box(page.locator('[data-scout-add="us-attack"]'))).height).toBeGreaterThanOrEqual(120);

    // Punto loro: ora battono loro e la finestra si apre da sola, col campo (non una riga di numeri).
    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expectReceptionWindowInView(page);
    const reception = page.locator('[data-scout-reception="open"]');
    await expect(reception).toHaveAttribute("data-scout-reception-court");
    await expect(reception.locator("[data-scout-chips]")).toHaveCount(0);
    // I tre passi dello scambio dicono a che punto si è.
    await expect(reception.locator('[data-scout-flow-step="now"]')).toContainText("Ricezione nostra");
    const court = reception.locator("[data-scout-court-picker='us']");
    await expect(court).toBeVisible();
    await expect(court).toContainText("Rete");
    const c = await spotCenters(reception);
    expect(Object.keys(c).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const [front, back] of [[4, 5], [3, 6], [2, 1]]) {
      expect(Math.abs(c[front].x - c[back].x), `la ${back} non sta sotto la ${front}`).toBeLessThan(2);
      expect(c[front].y).toBeLessThan(c[back].y);
    }
    expect(c[4].x).toBeLessThan(c[3].x);
    expect(c[3].x).toBeLessThan(c[2].x);
    // Sono tutte da toccare, la libero compresa (la n. 1, al posto della centrale in seconda linea).
    await expect(reception.locator("[data-scout-spot][data-scout-who]")).toHaveCount(6);
    await expect(reception.locator('[data-scout-spot="6"]')).toContainText("libero");
    for (const position of [1, 2, 3, 4, 5, 6]) expect((await box(reception.locator(`[data-scout-spot="${position}"]`))).height, `la casella ${position} è bassa`).toBeGreaterThanOrEqual(52);

    // La finestra è larga: i voti sono grandi, in due colonne e tre righe, accanto al campo.
    const grades = await reception.locator('[data-scout-grades="reception"] [data-scout-grade]').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      }),
    );
    expect(grades).toHaveLength(6);
    expect([...new Set(grades.map((g) => g.x))], "i voti non sono su due colonne").toHaveLength(2);
    expect([...new Set(grades.map((g) => g.y))], "i voti non sono su tre righe").toHaveLength(3);
    for (const g of grades) {
      expect(g.h, "un voto è basso").toBeGreaterThanOrEqual(56);
      expect(g.w, "un voto è stretto").toBeGreaterThanOrEqual(90);
    }
    expect(Math.min(...grades.map((g) => g.x)), "i voti non stanno a destra del campo").toBeGreaterThan(c[2].x);

    // Dietro la finestra la pagina non cambia: la riga «Ricezione nostra» e i pulsanti dei punti restano grandi, senza scorrere.
    await expect(page.locator('[data-scout-reception="prompt"]')).toBeVisible();
    expect((await box(page.locator('[data-scout-add="us-attack"]'))).height).toBeGreaterThanOrEqual(120);
    expect(await mainOverflow(page)).toBeLessThanOrEqual(1);

    // La panchina e «Non so» sono in una riga sola sotto il campo.
    const bench = reception.locator('[data-scout-bench="inline"] button');
    await expect(reception.locator('[data-scout-who="unknown"]')).toBeVisible();
    expect(await bench.count()).toBeGreaterThanOrEqual(7);
    const tops = await bench.evaluateAll((buttons) => [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)))]);
    expect(tops, "la panchina va su più righe").toHaveLength(1);

    // Senza dire chi i voti restano spenti; si tocca la giocatrice sul campo (posizione 1: la n. 9) e il voto si accende.
    await expect(reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]')).toBeDisabled();
    await reception.locator('[data-scout-spot="1"]').click();
    await expect(reception.locator('[data-scout-spot="1"]')).toHaveAttribute("aria-pressed", "true");
    await expect(reception).toContainText("Anna Verdi");
    await expect(reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]')).toBeEnabled();
    // Cambiando idea si tocca un'altra: resta scelta una sola.
    await reception.locator('[data-scout-spot="3"]').click();
    await expect(reception.locator('[data-scout-spot="3"]')).toHaveAttribute("aria-pressed", "true");
    await expect(reception.locator('[data-scout-spot="1"]')).toHaveAttribute("aria-pressed", "false");
    await reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]').click();

    // Segnata la ricezione la finestra si chiude: in pagina resta «Ricezione segnata» e il punto si segna come sempre.
    await expect(receptionSheet(page)).toHaveCount(0);
    await expect(page.locator('[data-scout-reception="done"]')).toContainText("Carla Bruni");
    expect((await box(page.locator('[data-scout-add="us-attack"]'))).height).toBeGreaterThanOrEqual(120);

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });

  test("la finestra della ricezione si chiude con «Salta» o con Esc, si riapre dal pulsante in pagina e toccare fuori non la chiude", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione chiusa "));
    await prepare(page, matchId, "ricezioni");
    await fullscreenButton(page).click();
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect.poll(() => stageFillsWindow(page)).toBe(true);

    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expectReceptionWindowInView(page);

    // Un tocco fuori dalla finestra non la chiude (un tocco di troppo non deve cancellare la ricezione).
    await page.mouse.click(4, 4);
    await expect(receptionSheet(page)).toBeVisible();
    // Esc la chiude; in pagina resta la riga con il pulsante.
    await page.keyboard.press("Escape");
    await expect(receptionSheet(page)).toHaveCount(0);
    const prompt = page.locator('[data-scout-reception="prompt"]');
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("Ricezione nostra");
    // Il pulsante la riapre e «Salta la ricezione» la richiude.
    await prompt.locator("[data-scout-reception-open]").click();
    await expectReceptionWindowInView(page);
    await page.locator("[data-scout-reception-skip]").click();
    await expect(receptionSheet(page)).toHaveCount(0);

    // Senza ricezione il punto si segna lo stesso: punto nostro (attacco di Anna); ora batte la nostra squadra, niente finestra.
    await page.locator('[data-scout-add="us-attack"]').click();
    const sheet = page.locator("[data-scout-sheet^='player']");
    await sheet.waitFor();
    await sheet.locator("[data-scout-pick]", { hasText: "Anna" }).click();
    await expect(score(page)).toHaveText("1–1");
    await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();
    await expect(receptionSheet(page)).toHaveCount(0);

    // Al punto loro dopo battono ancora loro: la finestra si apre di nuovo da sola (la chiusura valeva per lo scambio di prima).
    await opponentPoint(page);
    await expect(score(page)).toHaveText("1–2");
    await expectReceptionWindowInView(page);

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });

  test("livello Con ricezioni, senza formazione e con 13 giocatrici: la finestra ha la riga di numeri, la zona e i voti", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione numeri "));
    await prepare(page, matchId, "ricezioni", { bench: true, lineup: false });
    await fullscreenButton(page).click();
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect.poll(() => stageFillsWindow(page)).toBe(true);

    // Punto loro: ora tocca alla nostra ricezione; senza formazione la finestra non ha il campo ma una riga di numeri.
    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expectReceptionWindowInView(page);
    const reception = page.locator('[data-scout-reception="open"]');
    await expect(reception.locator("[data-scout-court-picker]")).toHaveCount(0);
    await expect(reception.locator("[data-scout-chips] > button")).toHaveCount(14);
    // Dietro la finestra i pulsanti dei punti restano grandi, come a ogni altro momento.
    expect((await box(page.locator('[data-scout-add="us-attack"]'))).height).toBeGreaterThanOrEqual(64);

    // Si segna: la giocatrice, la zona (facoltativa) e il voto.
    await expect(reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]')).toBeDisabled();
    await reception.locator("[data-scout-who]", { hasText: "Anna" }).click();
    await reception.locator("details summary").click();
    await reception.locator('[data-scout-zone-pick="6"]').click();
    await reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]').click();
    await expect(receptionSheet(page)).toHaveCount(0);
    await expect(page.locator('[data-scout-reception="done"]')).toContainText("Anna Verdi");
    await expect(page.locator('[data-scout-reception="done"]')).toContainText("zona 6");

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });

  test("pagina normale (senza schermo intero): quando battono loro la finestra della ricezione si apre da sola e sta tutta nello schermo", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione pagina "));
    await prepare(page, matchId, "ricezioni", { bench: true });
    await expect(page.locator("[data-scout-columns]")).toHaveCount(0);
    await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();
    await expect(receptionSheet(page)).toHaveCount(0);

    // Punto loro (dal tasto dei punti, come sempre): subito dopo si apre la finestra, col campo e i voti in vista.
    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expectReceptionWindowInView(page);
    const reception = page.locator('[data-scout-reception="open"]');
    await expect(reception).toHaveAttribute("data-scout-reception-court");
    const height = page.viewportSize()!.height;
    const grade = await box(reception.locator('[data-scout-grades="reception"] [data-scout-grade="#"]'));
    expect(grade.y + grade.height, "i voti sono oltre il bordo basso").toBeLessThanOrEqual(height);
    await receiveOnCourt(page, 2, "!", "Bea Neri");

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });
});

test.describe("su iPad in verticale (820×1180)", () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test("schermo intero in una colonna (app installata): la finestra della ricezione si apre da sola e sta tutta nello schermo", async ({ page }) => {
    test.setTimeout(240_000);
    // Come sull'iPad con l'app installata: niente schermo intero vero, il riquadro ricopre la finestra.
    await page.addInitScript(() => {
      const proto = Element.prototype as unknown as Record<string, unknown>;
      delete proto.requestFullscreen;
      delete proto.webkitRequestFullscreen;
    });
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione verticale "));
    await prepare(page, matchId, "ricezioni", { bench: true });
    await fullscreenButton(page).click();
    // In verticale non ci sono due colonne: la finestra si apre sopra la colonna che scorre.
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await expect.poll(() => stageFillsWindow(page)).toBe(true);

    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    await expectReceptionWindowInView(page);
    await expect(page.locator('[data-scout-reception="open"]')).toHaveAttribute("data-scout-reception-court");
    // Esc chiude solo la finestra: lo schermo intero (simulato, si chiude anch'esso con Esc) resta com'è.
    await page.keyboard.press("Escape");
    await expect(receptionSheet(page)).toHaveCount(0);
    await expect(page.locator('[data-scout-columns="fullscreen"]')).toBeVisible();
    await page.locator("[data-scout-reception-open]").click();
    await expectReceptionWindowInView(page);
    await receiveOnCourt(page, 2, "!", "Bea Neri");

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });
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
    // Il tabellone resta in cima alla colonna dei comandi.
    await expect(main.locator("[data-scout-board]")).toHaveCount(1);
    await expect(side.locator("[data-scout-board]")).toHaveCount(0);
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

  test("Con ricezioni, con la formazione: la finestra sale dal basso, il campo sopra e i voti sotto in una colonna, senza scorrere di lato", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const matchId = await createMatch(page, uniqueName("Ricezione telefono "));
    await prepare(page, matchId, "ricezioni", { bench: true });
    await expect(receptionSheet(page)).toHaveCount(0);
    await opponentPoint(page);
    await expect(score(page)).toHaveText("0–1");
    // Si apre da sola e sta tutta nello schermo (scorre dentro, se serve).
    await expectReceptionWindowInView(page);
    const reception = page.locator('[data-scout-reception="open"]');
    await expect(reception).toHaveAttribute("data-scout-reception-court");

    // Sul telefono la finestra è stretta: il campo sta sopra i voti, che sono su tre colonne e due righe, grandi da toccare.
    const court = await box(reception.locator("[data-scout-court-picker='us']"));
    const grades = await reception.locator('[data-scout-grades="reception"] [data-scout-grade]').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      }),
    );
    expect(grades).toHaveLength(6);
    expect(court.y + court.height, "i voti non stanno sotto il campo").toBeLessThanOrEqual(Math.min(...grades.map((g) => g.y)) + 1);
    expect([...new Set(grades.map((g) => g.x))], "i voti non sono su tre colonne").toHaveLength(3);
    expect([...new Set(grades.map((g) => g.y))], "i voti non sono su due righe").toHaveLength(2);
    for (const g of grades) expect(g.h, "un voto è basso").toBeGreaterThanOrEqual(44);
    for (const position of [1, 2, 3, 4, 5, 6]) expect((await box(reception.locator(`[data-scout-spot="${position}"]`))).height).toBeGreaterThanOrEqual(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    // Si segna: la giocatrice sul campo, il voto; la finestra si chiude.
    await receiveOnCourt(page, 2, "!", "Bea Neri");

    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await deleteMatchById(page, matchId);
  });
});
