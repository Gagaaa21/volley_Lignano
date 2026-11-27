import { expect, test, type Page } from "@playwright/test";
import { loginAsDev } from "./helpers";

/**
 * Il tabellone per la palestra (/diretta/tabellone): un tablet al posto del tabellone segnapunti. Il punteggio arriva da un
 * endpoint simulato (gli stessi dati della grafica di Streamlabs), così non serve uno Scout acceso: in attesa, squadre e punti,
 * set vinti, chi batte, time-out con il conto dei 30 secondi, parziali, finale, rete persa, «Scambia lati» ricordato dal tablet.
 */

test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });

type Live = {
  team: "u14u15";
  category: "U15";
  home: { name: string; color: string; score: number; sets: number };
  away: { name: string; color: string; score: number; sets: number };
  serving: "home" | "away" | null;
  sets: { home: number; away: number }[];
  timeouts: { home: number; away: number };
  finished: boolean;
  notStarted?: true;
  setRules?: { target: number; deciding: boolean };
  updatedAt: string;
};

function live(home: number, away: number, over: Partial<Live> = {}): Live {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: home, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: away, sets: 0 },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

/** L'endpoint del punteggio simulato: risponde con la lettura corrente (che il test cambia) o con un errore di rete. */
async function feed(page: Page, first: Live | null) {
  const state: { reading: Live | null; failing: boolean } = { reading: first, failing: false };
  const urls: string[] = [];
  await page.route(/\/api\/livescore\/pubblico/, async (route) => {
    urls.push(route.request().url());
    if (state.failing) return route.abort("failed");
    return route.fulfill({ json: { live: state.reading, cue: null, cueSounds: {} } });
  });
  return {
    urls,
    set: (reading: Live | null) => {
      state.reading = reading;
    },
    fail: (failing: boolean) => {
      state.failing = failing;
    },
  };
}

const board = (page: Page) => page.locator("[data-tabellone]");
const points = (page: Page, side: "home" | "away") => page.locator(`[data-board-points="${side}"]`);

test("in attesa, poi punti, set, chi batte e time-out dallo Scout; il conto del time-out si chiude quando si riprende", async ({ page }) => {
  const score = await feed(page, null);
  await page.goto("/diretta/tabellone");
  await expect(board(page)).toHaveAttribute("data-tabellone", "waiting");
  await expect(page.getByText("In attesa della partita")).toBeVisible();
  // Come la grafica di Streamlabs: anche a 0–0 e senza la copia della rete di Vercel.
  expect(new URL(score.urls[0]).search).toBe("?prima=1&regia=1");

  score.set(live(0, 0, { notStarted: true, serving: null }));
  await expect(board(page)).toHaveAttribute("data-tabellone", "pregame", { timeout: 15_000 });
  await expect(page.locator("[data-board-set-label]")).toHaveText("Si comincia");

  score.set(live(12, 9, { sets: [{ home: 25, away: 20 }], home: { name: "Volley Lignano", color: "#1c5bae", score: 12, sets: 1 } }));
  await expect(board(page)).toHaveAttribute("data-tabellone", "live", { timeout: 5_000 });
  await expect(points(page, "home")).toHaveText("12");
  await expect(points(page, "away")).toHaveText("9");
  await expect(page.locator('[data-board-sets="home"]')).toHaveText("1");
  await expect(page.locator('[data-board-sets="away"]')).toHaveText("0");
  await expect(page.locator("[data-board-set-label]")).toHaveText("2° set");
  await expect(page.locator("[data-board-partials]")).toHaveText("25-20");
  await expect(page.locator('[data-board-team="home"] [data-board-serving]')).toBeVisible();
  await expect(page.locator('[data-board-team="away"] [data-board-serving]')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Pol. Esempio" })).toBeVisible();

  // Time-out dell'avversaria: il pallino si accende e parte il conto dei 30 secondi.
  const withTimeout = live(12, 9, { sets: [{ home: 25, away: 20 }], timeouts: { home: 0, away: 1 }, home: { name: "Volley Lignano", color: "#1c5bae", score: 12, sets: 1 } });
  score.set(withTimeout);
  await expect(page.locator('[data-board-timeouts="away"]')).toHaveAttribute("data-used", "1", { timeout: 5_000 });
  const alert = page.locator('[data-board-timeout-alert="away"]');
  await expect(alert).toHaveText(/^Time-out (30|29|28)$/);
  await expect(page.locator('[data-board-timeout-alert="home"]')).toHaveCount(0);
  await page.waitForTimeout(2_500);
  const seconds = Number((await alert.textContent())!.replace(/\D/g, ""));
  expect(seconds).toBeLessThanOrEqual(28);
  expect(seconds).toBeGreaterThanOrEqual(25);
  // Si riprende a giocare: il conto sparisce, il pallino resta.
  score.set({ ...withTimeout, home: { ...withTimeout.home, score: 13 } });
  await expect(points(page, "home")).toHaveText("13", { timeout: 5_000 });
  await expect(alert).toHaveCount(0);
  await expect(page.locator('[data-board-timeouts="away"]')).toHaveAttribute("data-used", "1");

  // Fine partita: i set vinti al posto dei punti, i parziali, niente pallone di chi batte.
  score.set({
    ...live(0, 0, { finished: true, serving: "home" }),
    home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 1 },
    sets: [{ home: 25, away: 20 }, { home: 24, away: 26 }, { home: 15, away: 12 }],
  });
  await expect(board(page)).toHaveAttribute("data-tabellone", "finished", { timeout: 5_000 });
  await expect(page.locator("[data-board-set-label]")).toHaveText("Finale");
  await expect(points(page, "home")).toHaveText("2");
  await expect(points(page, "away")).toHaveText("1");
  await expect(page.locator("[data-board-partials]")).toHaveText("25-20  ·  24-26  ·  15-12");
  await expect(page.locator("[data-board-serving]")).toHaveCount(0);
});

test("senza rete resta l'ultimo punteggio con l'avviso; «Scambia lati» mette Lignano a destra e il tablet se lo ricorda", async ({ page }) => {
  const score = await feed(page, live(7, 5));
  await page.goto("/diretta/tabellone");
  await expect(points(page, "home")).toHaveText("7");
  const left = async (side: "home" | "away") => (await page.locator(`[data-board-team="${side}"]`).boundingBox())!.x;
  expect(await left("home")).toBeLessThan(await left("away"));

  score.fail(true);
  await expect(page.locator("[data-board-stale]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-board-stale]")).toContainText("Senza connessione: ultimo punteggio ricevuto alle");
  await expect(points(page, "home")).toHaveText("7");
  score.fail(false);
  score.set(live(8, 5));
  await expect(points(page, "home")).toHaveText("8", { timeout: 5_000 });
  await expect(page.locator("[data-board-stale]")).toHaveCount(0);

  await page.locator("[data-board-swap]").click();
  await expect(board(page)).toHaveAttribute("data-tabellone-swapped", "true");
  expect(await left("home")).toBeGreaterThan(await left("away"));
  await page.reload();
  await expect(points(page, "home")).toHaveText("8");
  await expect(board(page)).toHaveAttribute("data-tabellone-swapped", "true");
  expect(await left("home")).toBeGreaterThan(await left("away"));
  // In verticale le squadre una sopra l'altra, e niente barre di scorrimento.
  await page.setViewportSize({ width: 800, height: 1280 });
  const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(size).toEqual([800, 1280]);
});

test("nello Scout la scheda «Tabellone per la palestra» porta al tabellone e alla partita finta", async ({ page }) => {
  await loginAsDev(page);
  await page.goto("/admin/scout");
  const card = page.locator("[data-tabellone-card]");
  await expect(card).toBeVisible();
  await expect(card.locator("[data-tabellone-open]")).toHaveAttribute("href", "/diretta/tabellone");
  await expect(card.locator("[data-tabellone-try]")).toHaveAttribute("href", "/diretta/tabellone?prova=1");
  // La partita finta gira senza Scout.
  await page.goto("/diretta/tabellone?prova=1");
  await expect(board(page)).not.toHaveAttribute("data-tabellone", "loading");
  await expect(page.getByText("Partita finta di prova")).toBeVisible();
});
