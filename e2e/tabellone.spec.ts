import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Il tabellone per la palestra (/tabellone/<chiave>): un tablet al posto del tabellone segnapunti. Non è sul sito pubblico: si
 * apre solo con il link con la chiave, che lo staff trova nello Scout, e da lì funziona senza accesso. Nelle prove dell'aspetto il
 * punteggio arriva da un endpoint simulato (in attesa, squadre e punti, set vinti, chi batte, time-out con il conto dei 30
 * secondi, parziali, finale, rete persa, «Scambia lati», tema chiaro e scuro); in quella vera da uno Scout salvato con la
 * diretta spenta.
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
  timeoutRun?: { side: "home" | "away"; at: number; id: string };
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
  await page.route(/\/api\/tabellone\//, async (route) => {
    urls.push(route.request().url());
    if (state.failing) return route.abort("failed");
    return route.fulfill({ json: { live: state.reading } });
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

/** Il link del tabellone come lo trova lo staff nello Scout; poi si esce, come il tablet della palestra che non ha l'accesso. */
async function boardLink(page: Page): Promise<string> {
  await loginAsDev(page);
  await page.goto("/admin/scout");
  const href = (await page.locator("[data-tabellone-card] [data-tabellone-open]").getAttribute("href"))!;
  expect(href).toMatch(/^\/tabellone\/[A-Za-z0-9_-]{32}$/);
  await page.context().clearCookies();
  return href;
}
const points = (page: Page, side: "home" | "away") => page.locator(`[data-board-points="${side}"]`);

test("in attesa, poi punti, set, chi batte e time-out dallo Scout; il conto del time-out si chiude quando si riprende", async ({ page }) => {
  const link = await boardLink(page);
  const score = await feed(page, null);
  await page.goto(link);
  await expect(board(page)).toHaveAttribute("data-tabellone", "waiting");
  await expect(page.getByText("In attesa della partita")).toBeVisible();
  // Il punteggio del tabellone (anche con la diretta spenta), non quello del sito pubblico, con la chiave del link.
  expect(new URL(score.urls[0]).pathname).toBe(`/api${link}`);

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
  // Lo Scout dice anche quando l'ha segnato: il conto parte da lì.
  const withTimeout = live(12, 9, {
    sets: [{ home: 25, away: 20 }],
    timeouts: { home: 0, away: 1 },
    home: { name: "Volley Lignano", color: "#1c5bae", score: 12, sets: 1 },
    timeoutRun: { side: "away", at: Date.now(), id: "to-e2e" },
  });
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
  score.set({ ...withTimeout, timeoutRun: undefined, home: { ...withTimeout.home, score: 13 } });
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

test("senza rete resta l'ultimo punteggio con l'avviso; «Scambia lati» e il tema chiaro o scuro, ricordati dal tablet", async ({ page }) => {
  const link = await boardLink(page);
  const score = await feed(page, live(7, 5));
  await page.goto(link);
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
  // Il tema: scuro di partenza, chiaro con un tocco, e resta.
  const background = () => board(page).evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(board(page)).toHaveAttribute("data-tabellone-theme", "scuro");
  expect(await background()).toBe("rgb(5, 15, 24)");
  await page.locator("[data-board-theme-toggle]").click();
  await expect(board(page)).toHaveAttribute("data-tabellone-theme", "chiaro");
  await expect(page.locator("[data-board-theme-toggle]")).toHaveText("Tema scuro");
  await expect.poll(background).toBe("rgb(238, 242, 246)");
  const ink = await points(page, "home").evaluate((element) => getComputedStyle(element).color);
  expect(ink).toBe("rgb(11, 26, 42)");
  await page.reload();
  await expect(points(page, "home")).toHaveText("8");
  await expect(board(page)).toHaveAttribute("data-tabellone-theme", "chiaro");
  await page.locator("[data-board-theme-toggle]").click();
  await expect(board(page)).toHaveAttribute("data-tabellone-theme", "scuro");
  // In verticale le squadre una sopra l'altra, e niente barre di scorrimento.
  await page.setViewportSize({ width: 800, height: 1280 });
  const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(size).toEqual([800, 1280]);
});

test("non è sul sito pubblico: senza la chiave giusta niente; con il link si apre senza accesso; nello Scout la scheda", async ({ page, playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  for (const path of ["/api/tabellone/" + "x".repeat(32), "/api/tabellone/corta"]) {
    const denied = await anonymous.get(path);
    expect(denied.status(), path).toBe(404);
  }
  expect((await anonymous.get("/api/tabellone/" + "x".repeat(32))).headers()["cache-control"]).toMatch(/no-store/);
  // Le pagine: una chiave sbagliata non c'è, l'indirizzo pubblico di prima nemmeno; senza chiave, il login.
  expect((await anonymous.get("/tabellone/" + "x".repeat(32))).status()).toBe(404);
  expect((await anonymous.get("/diretta/tabellone")).status()).toBe(404);
  await anonymous.dispose();
  await page.goto("/tabellone");
  await expect(page).toHaveURL(/\/login/);

  // Nello Scout la scheda con il link; /tabellone per lo staff porta allo stesso link.
  await loginAsDev(page);
  await page.goto("/admin/scout");
  const card = page.locator("[data-tabellone-card]");
  await expect(card).toBeVisible();
  const link = (await card.locator("[data-tabellone-open]").getAttribute("href"))!;
  expect(link).toMatch(/^\/tabellone\/[A-Za-z0-9_-]{32}$/);
  await expect(card.locator("[data-tabellone-try]")).toHaveAttribute("href", `${link}?prova=1`);
  await page.goto("/tabellone?prova=1");
  await expect(page).toHaveURL(`${link}?prova=1`);

  // Il tablet senza accesso: il link funziona lo stesso, e la partita finta gira senza Scout.
  await page.context().clearCookies();
  await page.goto(`${link}?prova=1`);
  await expect(board(page)).not.toHaveAttribute("data-tabellone", "loading");
  await expect(page.getByText("Partita finta di prova")).toBeVisible();
  expect((await page.request.get(`/api${link}`)).status()).toBe(200);
});

test("dallo Scout vero, con la diretta spenta: il tabellone ha punti, set e time-out, il sito pubblico niente", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const opponent = uniqueName("Tabellone ");
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra tabellone e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const matchId = (await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href"))!.split("/").pop()!;
  try {
    // Il primo set 25-20, nel secondo 3-1 con un time-out loro; diretta spenta.
    await page.goto(`/admin/scout/${matchId}`);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    const base = Date.now() - 1_800_000;
    const events: unknown[] = [];
    let n = 0;
    const rally = (actor: "us" | "opp") => events.push({ type: "rally", id: `r${n}`, at: base + ++n * 20_000, actor, how: "attack", player: null, victim: null });
    for (let i = 0; i < 20; i++) {
      rally("us");
      rally("opp");
    }
    for (let i = 0; i < 5; i++) rally("us");
    events.push({ type: "setEnd", id: "end-1", at: base + ++n * 20_000, nextServer: "opp" });
    for (const actor of ["us", "opp", "us", "us"] as const) rally(actor);
    events.push({ type: "timeout", id: "to-1", at: base + ++n * 20_000, side: "opp" });
    const saved = await page.evaluate(
      async ({ matchId, events }) =>
        (
          await fetch(`/api/scout/${matchId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us", publicLive: false }, roster: { us: [], opp: [] }, events, finished: false },
              baseVersion: null,
            }),
          })
        ).status,
      { matchId, events },
    );
    expect(saved).toBe(200);

    // Il link del tabellone, poi il tablet senza accesso.
    await page.goto("/admin/scout");
    const link = (await page.locator("[data-tabellone-open]").getAttribute("href"))!;
    await page.context().clearCookies();

    // La copia si aggiorna a risposta già partita: si aspetta che arrivi.
    type Board = { live: { home: { name: string; score: number; sets: number }; away: { name: string; score: number; sets: number }; timeouts: { home: number; away: number }; sets: unknown[] } | null };
    const read = async () => (await (await page.request.get(`/api${link}`)).json()) as Board;
    await expect.poll(async () => (await read()).live?.away.name, { timeout: 15_000 }).toBe(opponent);
    const { live: boardLive } = await read();
    expect(boardLive).toMatchObject({ home: { score: 3, sets: 1 }, away: { score: 1, sets: 0 }, timeouts: { home: 0, away: 1 }, sets: [{ home: 25, away: 20 }] });
    // Il sito pubblico, con la diretta spenta, questa partita non la vede.
    const pub = (await (await page.request.get("/api/livescore/pubblico?prima=1&regia=1")).json()) as { live: { away: { name: string } } | null };
    expect(pub.live?.away.name ?? null).not.toBe(opponent);

    await page.goto(link);
    await expect(points(page, "home")).toHaveText("3", { timeout: 15_000 });
    await expect(points(page, "away")).toHaveText("1");
    await expect(page.locator('[data-board-sets="home"]')).toHaveText("1");
    await expect(page.locator('[data-board-timeouts="away"]')).toHaveAttribute("data-used", "1");
    await expect(page.locator("[data-board-partials]")).toHaveText("25-20");
  } finally {
    await loginAsDev(page);
    await deleteMatchById(page, matchId).catch(() => {});
  }
  // Cancellata la partita, il tabellone non ha più niente.
  await page.goto("/admin/scout");
  const link = (await page.locator("[data-tabellone-open]").getAttribute("href"))!;
  await expect.poll(async () => (await (await page.request.get(`/api${link}`)).json()).live, { timeout: 15_000 }).toBeNull();
});
