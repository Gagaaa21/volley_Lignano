import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Live score su schermo largo (tablet in orizzontale, computer): il tabellone sta in alto e sotto ci sono tre
 * colonne: i punti, i time-out e i cambi di una squadra; il campo (più piccolo) con le azioni della partita;
 * gli stessi comandi dell'altra squadra. Si controlla a 1180×820 (un iPad da 11 pollici in orizzontale), fuori
 * e dentro lo schermo intero, e che i comandi facciano il loro lavoro. Il telefono ha il suo test in
 * livescore-regole.spec.ts.
 */
test.use({ viewport: { width: 1180, height: 820 } });

const LIGNANO = "Volley Lignano";
const OPPONENT = "Largo Test";

interface SavedFormat {
  withLineup?: boolean;
  playersPerSide?: number;
  useLibero?: boolean;
  rules: { format: string; setPoints: number; lastSetPoints: number };
}

/** Pagina del Live score da zero, con il formato già scelto (si ricorda sul dispositivo). */
async function openFresh(page: Page, format: SavedFormat) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript((saved) => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    localStorage.setItem("vl-livescore-format", JSON.stringify({ mode: "match", withLineup: true, ...saved }));
  }, format);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
}

const cell = (page: Page, side: "left" | "right", position: number) =>
  page.locator(`[data-court-side="${side}"] [data-court-position="${position}"]`);

async function fillPositions(page: Page, side: "left" | "right", numbers: string[]) {
  for (const [index, number] of numbers.entries()) await cell(page, side, index + 1).locator("input").fill(number);
}

/** Squadre, formazioni e libero scritte, partita iniziata. */
async function startMatch(page: Page) {
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
  await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
  await page.locator("#a-setup-libero").fill("17");
  await page.locator("#a-setup-host1").selectOption("13");
  await page.locator("#a-setup-host2").selectOption("16");
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b, "elemento non visibile").not.toBeNull();
  return b!;
};

/** I due punteggi grandi, da sinistra a destra. */
async function scores(page: Page): Promise<number[]> {
  const text = await page.locator("[data-livescore-scores]").first().innerText();
  return text.split(/\s+/).filter(Boolean).map(Number);
}

const column = (page: Page, side: "left" | "right") => page.locator(`[data-livescore-team-column="${side}"]`);

/** Il riquadro del live score ricopre tutta la finestra? */
async function stageFillsWindow(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-livescore-stage]") as HTMLElement;
    const r = stage.getBoundingClientRect();
    return r.x === 0 && r.y === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight;
  });
}

/** La schermata a tutto schermo scorre? (scrollHeight oltre l'altezza visibile) */
const stageOverflow = (page: Page) =>
  page.evaluate(() => {
    const stage = document.querySelector("[data-livescore-stage]") as HTMLElement;
    return stage.scrollHeight - stage.clientHeight;
  });

/** Niente scorrimento laterale. */
const sideOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Tabellone sopra, a sinistra e a destra i comandi delle due squadre, in mezzo il campo, più piccolo di prima. */
async function expectThreeColumns(page: Page) {
  const [left, right, courtLeft, courtRight, board] = await Promise.all([
    box(column(page, "left")),
    box(column(page, "right")),
    box(page.locator('[data-court-side="left"]')),
    box(page.locator('[data-court-side="right"]')),
    box(page.locator("[data-livescore-scores]")),
  ]);
  expect(left.x + left.width, "la colonna di sinistra sta a sinistra del campo").toBeLessThanOrEqual(courtLeft.x + 1);
  expect(right.x, "la colonna di destra sta a destra del campo").toBeGreaterThanOrEqual(courtRight.x + courtRight.width - 1);
  expect(board.y + board.height, "il tabellone sta sopra il campo").toBeLessThanOrEqual(courtLeft.y);
  const courtWidth = courtRight.x + courtRight.width - courtLeft.x;
  expect(courtWidth, "il campo è più piccolo di prima (prima riempiva tutta la larghezza)").toBeLessThan(0.62 * 1180);
  expect(courtWidth, "ma resta leggibile").toBeGreaterThan(380);
}

test("schermo largo: i punti ai lati del campo, il tabellone sopra, le azioni sotto; a schermo intero entra tutto senza scorrere", async ({ page }) => {
  test.setTimeout(240_000);
  await openFresh(page, { playersPerSide: 6, useLibero: true, rules: { format: "bo3", setPoints: 5, lastSetPoints: 10 } });
  await page.getByRole("button", { name: "Con libero" }).click();
  await startMatch(page);

  // Fuori dallo schermo intero: tre colonne, campo più piccolo.
  await expectThreeColumns(page);
  expect(await sideOverflow(page)).toBeLessThanOrEqual(1);

  const left = column(page, "left");
  const right = column(page, "right");
  // Il pulsante dei punti della squadra a sinistra sta nella colonna di sinistra, grande; l'altro a destra.
  const pointLeft = left.getByRole("button", { name: new RegExp(`^Punto ${LIGNANO}`) });
  const pointRight = right.getByRole("button", { name: new RegExp(`^Punto ${OPPONENT}`) });
  for (const point of [pointLeft, pointRight]) {
    const b = await box(point);
    expect(b.height).toBeGreaterThanOrEqual(150);
    expect(b.width).toBeGreaterThanOrEqual(170);
  }
  // Time-out e cambi di ogni squadra stanno sotto il suo pulsante dei punti.
  for (const [side, col] of [["left", left], ["right", right]] as const) {
    const point = await box(col.getByRole("button", { name: /^Punto / }));
    for (const name of [/Time-out 0\/2/, /Sostituzione .*: 0 cambi in questo set/]) {
      const b = await box(col.getByRole("button", { name }));
      expect(b.y, `${side}: sotto il pulsante dei punti`).toBeGreaterThanOrEqual(point.y + point.height - 1);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  }
  // Le azioni della partita sono sotto il campo, in mezzo; «Annulla» è il tasto più largo.
  const courtBottom = (await box(page.locator('[data-court-side="left"]'))).y + (await box(page.locator('[data-court-side="left"]'))).height;
  const widths: Record<string, number> = {};
  for (const name of ["Annulla", "Cambio", "Chiudi set", "Inverti", "Formazioni", "Diretta", "Nuovo"]) {
    const b = await box(page.getByRole("button", { name, exact: true }));
    expect(b.y, `«${name}» sotto il campo`).toBeGreaterThanOrEqual(courtBottom);
    expect(b.height, `«${name}» a portata di dito`).toBeGreaterThanOrEqual(48);
    widths[name] = b.width;
  }
  expect(widths["Annulla"]).toBeGreaterThan(widths["Chiudi set"] * 1.5);

  // Ogni azione ha il suo colore, lo stesso ovunque compaia: i sette tasti della barra hanno sfondi diversi tra loro,
  // il time-out è diverso dai cambi, e i cambi di una squadra hanno lo stesso colore del «Cambio» della barra.
  const background = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  const tones = await Promise.all(
    ["Annulla", "Cambio", "Chiudi set", "Inverti", "Formazioni", "Diretta", "Nuovo"].map((name) => background(page.getByRole("button", { name, exact: true }))),
  );
  expect(new Set(tones).size, `sette colori diversi, trovati: ${tones.join(" | ")}`).toBe(7);
  const timeoutTone = await background(left.getByRole("button", { name: /Time-out 0\/2/ }));
  const substitutionTone = await background(left.getByRole("button", { name: /Sostituzione .*: 0 cambi in questo set/ }));
  expect(timeoutTone, "time-out e cambi non si assomigliano").not.toBe(substitutionTone);
  expect(substitutionTone, "i cambi hanno il colore del «Cambio»").toBe(tones[1]);

  // Si gioca: pulsanti dei punti, tastiera, time-out e «Annulla».
  await pointLeft.click();
  await pointLeft.click();
  await expect.poll(() => scores(page)).toEqual([2, 0]);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scores(page)).toEqual([2, 1]);
  await left.getByRole("button", { name: /Time-out 0\/2/ }).click();
  await expect(left.getByRole("button", { name: /Time-out 1\/2/ })).toBeVisible();
  await expect(right.getByRole("button", { name: /Time-out 0\/2/ })).toBeVisible();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect.poll(() => scores(page)).toEqual([2, 0]);
  // «Cambi» di una squadra apre la sostituzione già su quella squadra.
  await right.getByRole("button", { name: /Sostituzione .*: 0 cambi in questo set/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`cambi di ${OPPONENT}`);
  await expect(dialog).toContainText("0 su 8"); // dal 2026/2027 i cambi a set sono 8, non più 6
  await dialog.getByRole("button", { name: "Chiudi" }).click();
  await expect(dialog).toHaveCount(0);

  // Schermo intero: riempie la finestra, le tre colonne restano, e tutto sta nello schermo senza scorrere.
  await page.getByRole("button", { name: "Schermo intero" }).click();
  await expect(page.getByRole("button", { name: "Esci", exact: true })).toBeVisible();
  await expect.poll(() => stageFillsWindow(page)).toBe(true);
  await expectThreeColumns(page);
  expect(await stageOverflow(page)).toBeLessThanOrEqual(1);
  expect(await sideOverflow(page)).toBeLessThanOrEqual(1);
  const lowest = await Promise.all(
    ["Annulla", "Nuovo"].map(async (name) => {
      const b = await box(page.getByRole("button", { name, exact: true }));
      return b.y + b.height;
    }),
  );
  for (const bottom of lowest) expect(bottom).toBeLessThanOrEqual(820);
  // Il tabellone è grande: le cifre sono alte e stanno dentro il suo riquadro.
  const digit = await box(page.locator("[data-livescore-digit]").first());
  expect(digit.height).toBeGreaterThanOrEqual(60);
  const boardBox = await box(page.locator("[data-livescore-scores]"));
  expect(digit.y).toBeGreaterThanOrEqual(boardBox.y - 1);
  expect(digit.y + digit.height).toBeLessThanOrEqual(boardBox.y + boardBox.height + 1);

  // Fine set (a 5 punti): la scheda compare, i punti si fermano, la schermata non scorre e le cifre restano nel tabellone.
  await pointLeft.click();
  await pointLeft.click();
  await pointLeft.click();
  const setEnd = page.locator("[data-livescore-set-end]");
  await expect(setEnd).toBeVisible();
  await expect(pointLeft).toBeDisabled();
  await expect(pointRight).toBeDisabled();
  expect(await stageOverflow(page)).toBeLessThanOrEqual(1);
  const shrunk = await box(page.locator("[data-livescore-digit]").first());
  const shrunkBoard = await box(page.locator("[data-livescore-scores]"));
  expect(shrunk.y).toBeGreaterThanOrEqual(shrunkBoard.y - 1);
  expect(shrunk.y + shrunk.height).toBeLessThanOrEqual(shrunkBoard.y + shrunkBoard.height + 1);
  await expectThreeColumns(page);

  // Chiuso il set i campi si invertono: la colonna di sinistra è quella dell'altra squadra, come il campo e il tabellone.
  await page.locator("[data-livescore-close-set]").click();
  await expect(left.getByRole("button", { name: new RegExp(`^Punto ${OPPONENT}`) })).toBeVisible();
  await expect(right.getByRole("button", { name: new RegExp(`^Punto ${LIGNANO}`) })).toBeVisible();
  // La freccia ← segna per la squadra che sta a sinistra (adesso l'avversaria).
  await page.locator("[data-livescore-first-server='A']").click();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => scores(page)).toEqual([1, 0]);

  // Si esce con «Esci».
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page.getByRole("button", { name: "Schermo intero" })).toBeVisible();
  expect(await stageFillsWindow(page)).toBe(false);
  await expectThreeColumns(page);

  // Lascia il live score pulito per chi viene dopo.
  await page.getByRole("button", { name: "Nuovo", exact: true }).click();
});

test("schermo largo, solo punteggio: nessun campo, pulsanti dei punti molto alti ai lati e le azioni in mezzo", async ({ page }) => {
  test.setTimeout(120_000);
  await openFresh(page, { withLineup: false, rules: { format: "bo3", setPoints: 5, lastSetPoints: 10 } });
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-scores]")).toBeVisible();

  await page.getByRole("button", { name: "Schermo intero" }).click();
  await expect.poll(() => stageFillsWindow(page)).toBe(true);
  await expect(page.locator("[data-court-side]")).toHaveCount(0);
  expect(await stageOverflow(page)).toBeLessThanOrEqual(1);
  expect(await sideOverflow(page)).toBeLessThanOrEqual(1);

  const left = column(page, "left");
  const right = column(page, "right");
  const pointLeft = left.getByRole("button", { name: new RegExp(`^Punto ${LIGNANO}`) });
  const pointRight = right.getByRole("button", { name: new RegExp(`^Punto ${OPPONENT}`) });
  for (const point of [pointLeft, pointRight]) {
    const b = await box(point);
    expect(b.height, "senza il campo i pulsanti dei punti prendono tutta l'altezza").toBeGreaterThanOrEqual(240);
  }
  // Senza formazione non ci sono i cambi, ma i time-out sì.
  await expect(page.getByRole("button", { name: /Sostituzione/ })).toHaveCount(0);
  await expect(left.getByRole("button", { name: /Time-out 0\/2/ })).toBeVisible();
  await expect(right.getByRole("button", { name: /Time-out 0\/2/ })).toBeVisible();
  // Le azioni stanno in mezzo, tra le due colonne.
  const [l, r, undo] = await Promise.all([box(left), box(right), box(page.getByRole("button", { name: "Annulla", exact: true }))]);
  expect(undo.x).toBeGreaterThanOrEqual(l.x + l.width - 1);
  expect(undo.x + undo.width).toBeLessThanOrEqual(r.x + 1);

  await pointLeft.click();
  await pointRight.click();
  await pointRight.click();
  await expect.poll(() => scores(page)).toEqual([1, 2]);
  await page.getByRole("button", { name: "Nuovo", exact: true }).click();
});

test("schermo largo, impostazione: i dati a sinistra, il campo più piccolo a destra e «Inizia» sempre in vista", async ({ page }) => {
  test.setTimeout(120_000);
  await openFresh(page, { playersPerSide: 6, useLibero: true, rules: { format: "bo3", setPoints: 5, lastSetPoints: 10 } });
  await page.getByRole("button", { name: "Con libero" }).click();

  const opponent = page.getByLabel(/Nome avversaria/);
  const court = page.locator('[data-tour="section-livescore-court"]');
  const check = async () => {
    const [o, c] = await Promise.all([box(opponent), box(court)]);
    expect(c.x, "il campo sta a destra dei dati dell'avversaria").toBeGreaterThanOrEqual(o.x + o.width);
    expect(c.width, "ed è più piccolo di prima").toBeLessThan(0.62 * 1180);
    expect(c.width).toBeGreaterThan(380);
    expect(await sideOverflow(page)).toBeLessThanOrEqual(1);
  };
  await check();

  // A schermo intero la schermata scorre, ma «Inizia» resta in vista.
  await page.getByRole("button", { name: "Schermo intero" }).click();
  await expect.poll(() => stageFillsWindow(page)).toBe(true);
  await check();
  const start = await box(page.getByRole("button", { name: "Inizia" }));
  expect(start.y).toBeGreaterThanOrEqual(0);
  expect(start.y + start.height).toBeLessThanOrEqual(820);

  // Si può compilare e iniziare da lì.
  await opponent.fill(OPPONENT);
  await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
  await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
  await page.locator("#a-setup-libero").fill("17");
  await page.locator("#a-setup-host1").selectOption("13");
  await page.locator("#a-setup-host2").selectOption("16");
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
  await expectThreeColumns(page);
  await page.getByRole("button", { name: "Nuovo", exact: true }).click();
});
