import { expect, test, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Live score: il tabellone applica le regole della pallavolo e guida chi lo
 * usa a bordo campo. Set a 5 punti (10 il decisivo) per non dover segnare 25
 * punti a set: il formato si ricorda sul dispositivo (localStorage), quindi lo
 * si scrive prima di aprire la pagina.
 */

interface SavedFormat {
  playersPerSide?: number;
  useLibero?: boolean;
  rules: { format: string; setPoints: number; lastSetPoints: number };
}

/** Pagina del Live score da zero, con il formato già scelto. */
async function openFresh(page: Page, format: SavedFormat) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript((saved) => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    localStorage.setItem("vl-livescore-format", JSON.stringify({ mode: "match", withLineup: true, ...saved }));
  }, format);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  // Il tabellone è uno solo per tutto il sito: si cancella quello lasciato da una prova precedente.
  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
}

const cell = (page: Page, side: "left" | "right", position: number) =>
  page.locator(`[data-court-side="${side}"] [data-court-position="${position}"]`);

/** Scrive i numeri di maglia nelle sei posizioni di una squadra (dalla 1 alla 6). */
async function fillPositions(page: Page, side: "left" | "right", numbers: string[]) {
  for (const [index, number] of numbers.entries()) await cell(page, side, index + 1).locator("input").fill(number);
}

const pointButton = (page: Page, team: string) => page.getByRole("button", { name: new RegExp(`^Punto ${team}`) });

async function score(page: Page, team: string, points: number) {
  for (let i = 0; i < points; i++) await pointButton(page, team).click();
}

/** I due punteggi grandi, da sinistra a destra. */
async function scores(page: Page): Promise<number[]> {
  const text = await page.locator("[data-livescore-scores]").first().innerText();
  return text.split(/\s+/).filter(Boolean).map(Number);
}

const LIGNANO = "Volley Lignano";
const OPPONENT = "Regole Test";

test("i set seguono il regolamento: fine set, campi invertiti, formazione di partenza, sorteggio e cambio campo nel decisivo", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await openFresh(page, { playersPerSide: 6, useLibero: false, rules: { format: "bo3", setPoints: 5, lastSetPoints: 10 } });

  await page.getByRole("button", { name: "2 set su 3" }).click();
  await page.getByRole("button", { name: "6 vs 6" }).click();
  await page.getByRole("button", { name: "Senza", exact: true }).click();
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
  await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
  await page.getByRole("button", { name: "Inizia" }).click();

  // 1° set: la partita parte con la nostra battuta, e il tabellone dice chi batte e chi batterà.
  await expect(page.locator("[data-livescore-set-start]")).toContainText("1° set: pronti a partire");
  await expect(page.locator("[data-livescore-set]")).toContainText("1° set");
  await expect(page.locator("[data-livescore-set]")).toContainText("si vince a 5");
  await expect(page.locator("[data-livescore-serving]")).toContainText(`Batte ${LIGNANO}`);
  await expect(page.locator("[data-livescore-serving]")).toContainText("11");
  await expect(page.locator("[data-livescore-next]")).toContainText(`Se vince ${OPPONENT}, batte n. 22`);

  // Con la tastiera: → segna per la squadra a destra, e conquista la battuta (ruota: batte la 22).
  await page.keyboard.press("ArrowRight");
  expect(await scores(page)).toEqual([0, 1]);
  await expect(page.locator("[data-livescore-serving]")).toContainText(`Batte ${OPPONENT}`);
  await expect(page.locator("[data-livescore-serving]")).toContainText("22");
  // Sul bottone: Lignano riconquista la battuta (ruota: batte la 12) e poi la tiene fino al set point.
  await score(page, LIGNANO, 4);
  expect(await scores(page)).toEqual([4, 1]);
  await expect(page.locator("[data-livescore-setpoint]")).toContainText("Set point");
  await expect(page.locator("[data-livescore-setpoint]")).toContainText(LIGNANO);
  await expect(page.locator("[data-livescore-set-end]")).toHaveCount(0);

  // 5-1: set vinto. I punti restano fermi finché non si chiude, e si può tornare indietro di un punto.
  await score(page, LIGNANO, 1);
  const setEnd = page.locator("[data-livescore-set-end]");
  await expect(setEnd).toContainText(`${LIGNANO} vince il 1° set`);
  await expect(pointButton(page, LIGNANO)).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  expect(await scores(page)).toEqual([5, 1]);
  await setEnd.getByRole("button", { name: "Annulla ultimo punto" }).click();
  await expect(setEnd).toHaveCount(0);
  expect(await scores(page)).toEqual([4, 1]);
  await score(page, LIGNANO, 1);
  await expect(setEnd).toBeVisible();
  await page.locator("[data-livescore-close-set]").click();

  // 2° set: campi invertiti, formazioni di partenza rimesse (non quelle ruotate), batte per prima l'altra squadra.
  const setStart = page.locator("[data-livescore-set-start]");
  await expect(setStart).toContainText("2° set: pronti a partire");
  await expect(setStart).toContainText("Campi invertiti, formazioni di partenza ripristinate");
  await expect(setStart).toContainText("la battuta si alterna a ogni set");
  await expect(page.locator("[data-livescore-first-server='B']")).toHaveAttribute("aria-pressed", "true");
  expect(await scores(page)).toEqual([0, 0]);
  await expect(cell(page, "left", 1)).toContainText("21");
  await expect(cell(page, "right", 1)).toContainText("11");
  await expect(page.locator("[data-livescore-serving]")).toContainText(`Batte ${OPPONENT}`);
  await expect(page.locator("[data-livescore-serving]")).toContainText("21");
  // La nostra squadra ora sta a destra: la freccia → segna per lei.
  await page.keyboard.press("ArrowRight");
  expect(await scores(page)).toEqual([0, 1]);
  await page.keyboard.press("Backspace");
  expect(await scores(page)).toEqual([0, 0]);

  // L'altra squadra vince il 2° set: 1-1.
  await score(page, OPPONENT, 5);
  await expect(setEnd).toContainText(`${OPPONENT} vince il 2° set`);
  await page.locator("[data-livescore-close-set]").click();

  // 3° set, il decisivo: la battuta si sorteggia, e finché non si sceglie i punti non si possono segnare.
  await expect(setStart).toContainText("3° set (decisivo): sorteggio");
  await expect(pointButton(page, LIGNANO)).toBeDisabled();
  await expect(pointButton(page, OPPONENT)).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  expect(await scores(page)).toEqual([0, 0]);
  await page.locator("[data-livescore-first-server='A']").click();
  await expect(page.locator("[data-livescore-set]")).toContainText("si vince a 10");
  await expect(page.locator("[data-livescore-serving]")).toContainText(`Batte ${LIGNANO}`);
  await expect(pointButton(page, LIGNANO)).toBeEnabled();

  // Nel decisivo si cambia campo quando una squadra arriva a 8 punti.
  await score(page, LIGNANO, 7);
  await expect(page.locator("[data-livescore-side-change]")).toHaveCount(0);
  await score(page, LIGNANO, 1);
  const sideChange = page.locator("[data-livescore-side-change]");
  await expect(sideChange).toContainText("Cambio campo");
  const leftBefore = await cell(page, "left", 1).innerText();
  await sideChange.getByRole("button", { name: "Cambia campo" }).click();
  await expect(sideChange).toHaveCount(0);
  await expect(cell(page, "left", 1)).not.toHaveText(leftBefore);
  // Il punteggio segue la squadra (ora a destra): si può chiudere il set a 10.
  expect(await scores(page)).toEqual([0, 8]);
  await score(page, LIGNANO, 2);
  await expect(setEnd).toContainText(`${LIGNANO} vince il 3° set`);
  await page.locator("[data-livescore-close-set]").click();
  await expect(page.getByText(`${LIGNANO} ha vinto la partita (2 set a 1)`)).toBeVisible();
});

test("la libero entra al posto della centrale in seconda linea, non batte mai ed esce quando la centrale va a rete", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openFresh(page, { playersPerSide: 6, useLibero: true, rules: { format: "bo5", setPoints: 25, lastSetPoints: 15 } });

  await page.getByRole("button", { name: "6 vs 6" }).click();
  await page.getByRole("button", { name: "Con libero" }).click();
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
  await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
  // Libero n. 17, che sostituisce le centrali 13 e 16.
  await page.locator("#a-setup-libero").fill("17");
  await page.locator("#a-setup-host1").selectOption("13");
  await page.locator("#a-setup-host2").selectOption("16");
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-serving]")).toContainText(`Batte ${LIGNANO}`);

  /** In che posizione (della nostra squadra, a sinistra) c'è adesso la libero; null se non è in campo. */
  const liberoAt = async () => {
    for (let position = 1; position <= 6; position++) {
      // textContent: l'etichetta è in maiuscolo solo per lo stile (innerText la darebbe «LIBERO»).
      if (/libero/i.test((await cell(page, "left", position).textContent()) ?? "")) return position;
    }
    return null;
  };
  const ours = () => page.keyboard.press("ArrowLeft");
  const theirs = () => page.keyboard.press("ArrowRight");

  // Si parte: la centrale 16 è in posizione 6 (dietro), la libero è già lì al suo posto.
  expect(await liberoAt()).toBe(6);
  await expect(cell(page, "left", 6)).toContainText("17");

  // Punto loro, poi punto nostro: riconquistiamo la battuta e ruotiamo. La 16 passa in posizione 5: lì c'è la libero.
  await theirs();
  expect(await liberoAt()).toBe(6);
  await ours();
  await expect(cell(page, "left", 1)).toContainText("12");
  expect(await liberoAt()).toBe(5);
  await expect(cell(page, "left", 5)).toContainText("17");
  await expect(cell(page, "left", 6)).toContainText("11");

  // Chi batte e vince tiene la battuta: non si ruota.
  await ours();
  await expect(cell(page, "left", 1)).toContainText("12");
  expect(await liberoAt()).toBe(5);

  // Ancora una rotazione: in battuta va la centrale 13 (la libero non batte), e la 16 è a rete: la libero esce.
  await theirs();
  await ours();
  await expect(cell(page, "left", 1)).toContainText("13");
  expect(await liberoAt()).toBeNull();

  // La 13 perde lo scambio in battuta: ora riceviamo, e la libero entra al suo posto.
  await theirs();
  expect(await liberoAt()).toBe(1);
  await expect(cell(page, "left", 1)).toContainText("17");

  // Riconquistiamo la battuta e ruotiamo: la 13 va in posizione 6, dietro, e la libero la sostituisce ancora.
  await ours();
  expect(await liberoAt()).toBe(6);
  await expect(cell(page, "left", 6)).toContainText("17");
});

test("i punti del set si cambiano dall'impostazione, e con i 3 set fissi l'ultimo non è un decisivo (niente sorteggio né cambio a 8)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openFresh(page, { playersPerSide: 6, useLibero: false, rules: { format: "bo5", setPoints: 25, lastSetPoints: 15 } });

  // Con i 3 set fissi compare l'avviso sul terzo set; la formula «Libera» non ha punti da scegliere.
  const points = page.locator("[data-livescore-points]");
  await expect(points).toBeVisible();
  await page.getByRole("button", { name: "3 set fissi" }).click();
  await expect(page.getByText("il regolamento della gara stabilisce se il 3° va a 15 o a 25")).toBeVisible();

  // Un valore fuori misura non conta: finché non si corregge, a restare valido è quello di prima.
  const setPoints = page.locator("#livescore-set-points");
  const lastSetPoints = page.locator("#livescore-last-set-points");
  await expect(setPoints).toHaveValue("25");
  await expect(lastSetPoints).toHaveValue("15");
  await setPoints.fill("3");
  await expect(setPoints).toHaveAttribute("aria-invalid", "true");
  await setPoints.blur();
  await expect(setPoints).toHaveValue("25");
  await setPoints.fill("10");
  await lastSetPoints.fill("12");

  await page.getByRole("button", { name: "6 vs 6" }).click();
  await page.getByRole("button", { name: "Senza", exact: true }).click();
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
  await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-set]")).toContainText("si vince a 10");

  const setEnd = page.locator("[data-livescore-set-end]");
  const closeSet = page.locator("[data-livescore-close-set]");
  await score(page, LIGNANO, 10);
  await expect(setEnd).toContainText(`${LIGNANO} vince il 1° set`);
  await closeSet.click();
  await score(page, OPPONENT, 10);
  await expect(setEnd).toContainText(`${OPPONENT} vince il 2° set`);
  await closeSet.click();

  // 3° set: con i 3 set fissi non c'è sorteggio (la battuta si alterna: tocca di nuovo a noi) e il limite è quello dell'ultimo set.
  const setStart = page.locator("[data-livescore-set-start]");
  await expect(setStart).toContainText("3° set: pronti a partire");
  await expect(setStart).not.toContainText("sorteggio");
  await expect(page.locator("[data-livescore-first-server='A']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-livescore-set]")).toContainText("si vince a 12");
  await expect(pointButton(page, LIGNANO)).toBeEnabled();
  // Né a 8 né dopo si cambia campo: succede solo nel set decisivo di una gara al meglio dei 3 o dei 5.
  await score(page, LIGNANO, 8);
  await expect(page.locator("[data-livescore-side-change]")).toHaveCount(0);
  await score(page, LIGNANO, 4);
  await expect(setEnd).toContainText(`${LIGNANO} vince il 3° set`);
  await closeSet.click();
  await expect(page.getByText(`${LIGNANO} ha vinto la partita (2 set a 1)`)).toBeVisible();
});

test.describe("sul telefono", () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

  test("si imposta e si segna senza scorrere di lato, con i pulsanti dei punti grandi", async ({ page }) => {
    test.setTimeout(120_000);
    await openFresh(page, { playersPerSide: 6, useLibero: false, rules: { format: "bo5", setPoints: 25, lastSetPoints: 15 } });

    const sideOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Impostazione: niente blocco «usa un tablet» e niente scorrimento laterale.
    await expect(page.getByLabel(/Nome avversaria/)).toBeVisible();
    expect(await sideOverflow()).toBeLessThanOrEqual(1);

    await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
    await fillPositions(page, "left", ["11", "12", "13", "14", "15", "16"]);
    await fillPositions(page, "right", ["21", "22", "23", "24", "25", "26"]);
    expect(await sideOverflow()).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Inizia" }).click();

    // Partita: stato, campo e pulsanti dei punti stanno nella larghezza dello schermo.
    await expect(page.locator("[data-livescore-status]")).toBeVisible();
    await expect(page.locator("[data-livescore-set-start]")).toBeVisible();
    expect(await sideOverflow()).toBeLessThanOrEqual(1);
    const button = pointButton(page, LIGNANO);
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);

    // Si segna con un tocco, e il set point compare come sul tablet.
    await score(page, LIGNANO, 24);
    await expect(page.locator("[data-livescore-setpoint]")).toContainText("Set point");
    await score(page, LIGNANO, 1);
    await expect(page.locator("[data-livescore-set-end]")).toBeVisible();
    expect(await sideOverflow()).toBeLessThanOrEqual(1);
  });
});
