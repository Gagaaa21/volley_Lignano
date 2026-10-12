import { expect, test, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Live score: quando si segna un time-out parte il conto alla rovescia (30 secondi, regole 2026/2027): scheda grande
 * sotto il tabellone, ultimi 10 secondi in arancione, a zero «Time-out finito» con due bip, e si chiude da sola. Il
 * tempo si fa scorrere con l'orologio finto di Playwright: niente attese vere.
 */

const LIGNANO = "Volley Lignano";
const OPPONENT = "Time-out Test";

/** Un finto audio: conta i bip suonati (ogni bip è un oscillatore che parte), senza bisogno di casse. */
async function installFakeAudio(page: Page) {
  await page.addInitScript(() => {
    const starts: number[] = [];
    (window as unknown as { __beeps: number[] }).__beeps = starts;
    class FakeOscillator {
      type = "";
      frequency = { value: 0 };
      connect(node: unknown) {
        return node;
      }
      start(at: number) {
        starts.push(at);
      }
      stop() {}
    }
    class FakeGain {
      gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
      connect(node: unknown) {
        return node;
      }
    }
    class FakeContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return new FakeOscillator();
      }
      createGain() {
        return new FakeGain();
      }
      resume() {
        return Promise.resolve();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  });
}

const beeps = (page: Page) => page.evaluate(() => (window as unknown as { __beeps: number[] }).__beeps.length);

/** Pagina del Live score da zero, partita in corso (6 contro 6, senza libero). */
async function startMatch(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    localStorage.setItem(
      "vl-livescore-format",
      JSON.stringify({ mode: "match", withLineup: true, playersPerSide: 6, useLibero: false, rules: { format: "bo3", setPoints: 25, lastSetPoints: 15 } }),
    );
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "Senza", exact: true }).click();
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  for (const [index, number] of ["11", "12", "13", "14", "15", "16"].entries()) {
    await page.locator(`[data-court-side="left"] [data-court-position="${index + 1}"]`).locator("input").fill(number);
  }
  for (const [index, number] of ["21", "22", "23", "24", "25", "26"].entries()) {
    await page.locator(`[data-court-side="right"] [data-court-position="${index + 1}"]`).locator("input").fill(number);
  }
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
}

const card = (page: Page) => page.locator("[data-livescore-timeout]");
const clock = (page: Page) => page.locator("[data-livescore-timeout-clock]");
/** I pulsanti «Time-out» del tabellone, nell'ordine in cui stanno: prima quello della squadra a sinistra (Volley Lignano), poi l'altro. */
const timeoutButtons = (page: Page) => page.getByRole("button", { name: /^Time-out \d\/2/ });
const timeoutOf = (page: Page, team: string) => timeoutButtons(page).nth(team === LIGNANO ? 0 : 1);

/** Orologio finto e fermo: il tempo passa solo quando lo si fa passare, così i secondi non dipendono dalla velocità della macchina. */
async function freezeClock(page: Page) {
  const start = Date.now();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 1000);
}

test("time-out: parte il conto alla rovescia da 30 secondi, diventa arancione, finisce con due bip e si chiude da solo", async ({ page }) => {
  test.setTimeout(180_000);
  await installFakeAudio(page);
  await startMatch(page);
  await freezeClock(page);

  // Prima di toccare niente: nessun conto alla rovescia.
  await expect(card(page)).toHaveCount(0);

  // Il time-out di Volley Lignano: partono 30 secondi, il contatore della squadra passa a 1/2.
  await timeoutOf(page, LIGNANO).click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-phase", "running");
  await expect(card(page)).toContainText(LIGNANO);
  await expect(card(page)).toContainText("Time-out · 1° di 2");
  await expect(clock(page)).toHaveText("0:30");
  await expect(timeoutOf(page, LIGNANO)).toHaveAccessibleName("Time-out 1/2");
  await expect(timeoutOf(page, OPPONENT)).toHaveAccessibleName("Time-out 0/2");
  // Il conto è grande, da vedere da lontano.
  const digits = await clock(page).boundingBox();
  expect(digits!.height).toBeGreaterThanOrEqual(40);

  // Il tempo passa: 5 secondi, poi si entra negli ultimi 10.
  await page.clock.fastForward(5_000);
  await expect(clock(page)).toHaveText("0:25");
  await expect(card(page)).toHaveAttribute("data-phase", "running");
  await page.clock.fastForward(15_000);
  await expect(clock(page)).toHaveText("0:10");
  await expect(card(page)).toHaveAttribute("data-phase", "warning");
  expect(await beeps(page)).toBe(0); // il suono arriva solo a zero

  // A zero: «Time-out finito» e due bip, una volta sola.
  await page.clock.fastForward(10_000);
  await expect(card(page)).toHaveAttribute("data-phase", "over");
  await expect(clock(page)).toHaveText("0:00");
  await expect(card(page)).toContainText("Time-out finito");
  await expect.poll(() => beeps(page)).toBe(2);
  await page.clock.fastForward(3_000);
  expect(await beeps(page)).toBe(2);

  // Dopo qualche secondo la scheda se ne va da sola.
  await page.clock.fastForward(8_000);
  await expect(card(page)).toHaveCount(0);

  // Il time-out dell'altra squadra (il suo primo): nuova scheda, a nome suo.
  await timeoutOf(page, OPPONENT).click();
  await expect(card(page)).toContainText(OPPONENT);
  await expect(card(page)).toContainText("Time-out · 1° di 2");
  await expect(clock(page)).toHaveText("0:30");

  // Un altro time-out (di Volley Lignano, il 2° del set) prende il posto di quello in corso.
  await timeoutOf(page, LIGNANO).click();
  await expect(card(page)).toHaveCount(1);
  await expect(card(page)).toContainText(LIGNANO);
  await expect(card(page)).toContainText("Time-out · 2° di 2");
  await expect(clock(page)).toHaveText("0:30");

  // «Fine time-out» lo chiude prima.
  await page.getByRole("button", { name: "Fine time-out" }).click();
  await expect(card(page)).toHaveCount(0);

  // Il terzo tocco azzera il conteggio (una correzione): niente conto alla rovescia.
  await timeoutOf(page, LIGNANO).click();
  await expect(card(page)).toHaveCount(0);
  await expect(timeoutOf(page, LIGNANO)).toHaveAccessibleName("Time-out 0/2");
  await expect(timeoutOf(page, OPPONENT)).toHaveAccessibleName("Time-out 1/2");
});

test("time-out: il conto si ferma quando il gioco riprende, e il suono si può spegnere", async ({ page }) => {
  test.setTimeout(180_000);
  await installFakeAudio(page);
  await startMatch(page);
  await freezeClock(page);

  // Un punto segnato mentre il conto è in corso: il gioco è ripreso, la scheda sparisce.
  await timeoutOf(page, LIGNANO).click();
  await expect(card(page)).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^Punto ${LIGNANO}`) }).click();
  await expect(card(page)).toHaveCount(0);

  // Suono spento: a zero niente bip, e la scelta resta sul dispositivo.
  await timeoutOf(page, OPPONENT).click();
  const sound = page.locator("[data-livescore-timeout-sound]");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("vl-livescore-timeout-sound"))).toBe("off");
  await page.clock.fastForward(31_000);
  await expect(card(page)).toHaveAttribute("data-phase", "over");
  expect(await beeps(page)).toBe(0);
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(card(page)).toHaveCount(0);

  // Riaccendendolo si torna a sentire.
  await timeoutOf(page, OPPONENT).click();
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(31_000);
  await expect(card(page)).toHaveAttribute("data-phase", "over");
  await expect.poll(() => beeps(page)).toBe(2);

  // «Nuovo» chiude tutto: nessun conto rimasto in giro.
  await page.getByRole("button", { name: "Nuovo", exact: true }).click();
  await expect(card(page)).toHaveCount(0);
});

test.describe("sul telefono", () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

  test("time-out: il conto alla rovescia sta nella larghezza dello schermo e i suoi pulsanti si toccano", async ({ page }) => {
    test.setTimeout(120_000);
    await installFakeAudio(page);
    await startMatch(page);
    await freezeClock(page);

    // Da telefono i time-out stanno nel tabellone: gli stessi pulsanti, lo stesso conto.
    await timeoutOf(page, LIGNANO).click();
    await expect(card(page)).toBeVisible();
    await expect(clock(page)).toHaveText("0:30");
    const box = await card(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    for (const name of [/Fine time-out/, /suono del time-out/]) {
      const button = card(page).getByRole("button", { name });
      const b = await button.boundingBox();
      expect(b).not.toBeNull();
      expect(b!.x + b!.width).toBeLessThanOrEqual(375);
      expect(b!.height).toBeGreaterThanOrEqual(36);
    }
    await page.clock.fastForward(31_000);
    await expect(card(page)).toHaveAttribute("data-phase", "over");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Nuovo", exact: true }).click();
  });
});
