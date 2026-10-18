import { expect, test, type Page } from "@playwright/test";

/**
 * La grafica della diretta video (/diretta/grafica), quella che OBS mette sopra le camere: sfondo trasparente, barra del
 * punteggio con battuta e time-out, schede di time-out e fine set, la partita finta `?prova=1`. Il punteggio arriva
 * da un endpoint simulato (gli stessi dati del banner del sito), così non serve uno Scout acceso.
 */

test.use({ serviceWorkers: "block", viewport: { width: 1920, height: 1080 } });

type Live = {
  team: "u14u15" | "minivolley";
  category: "U14" | "U15" | null;
  home: { name: string; color: string; score: number; sets: number };
  away: { name: string; color: string; score: number; sets: number };
  serving: "home" | "away" | null;
  sets: { home: number; away: number }[];
  timeouts: { home: number; away: number };
  finished: boolean;
  point?: { side: "home" | "away"; kind: "set" | "match" } | null;
  notStarted?: true;
  updatedAt: string;
};

function live(over: Partial<Live> = {}): Live {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: 10, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 8, sets: 0 },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

/**
 * L'endpoint del punteggio pubblico simulato: risponde sempre con la lettura corrente, che il test cambia a mano
 * (`set`), oppure con un errore di rete (`fail`). Non conta le chiamate: in sviluppo React lancia due volte
 * la lettura iniziale, e un conto delle chiamate sfaserebbe la sequenza.
 */
async function feed(page: Page, first: Live | null) {
  const state: { reading: Live | null; failing: boolean } = { reading: first, failing: false };
  const urls: string[] = [];
  // Il filtro prende anche l'indirizzo con i parametri: la grafica chiede `?prima=1`.
  await page.route(/\/api\/livescore\/pubblico/, async (route) => {
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

/** Per guardare la grafica come la vedrebbe OBS: sopra un fondo a scacchi (si capisce subito se è trasparente). */
async function checkerboard(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty("background", "repeating-conic-gradient(#5b6b7a 0 25%, #8a99a8 0 50%) 0 0 / 48px 48px", "important");
  });
}

const shots = (name: string) => (process.env.GRAFICA_SHOTS ? { path: `${process.env.GRAFICA_SHOTS}/${name}.png` } : undefined);

test("la grafica ha lo sfondo trasparente, nessun avviso del sito e mostra punteggio, battuta e time-out", async ({ page }) => {
  await feed(page, live({ timeouts: { home: 1, away: 0 }, point: null }));
  await page.goto("/diretta/grafica");
  const bug = page.locator("[data-grafica-bug]");
  await expect(bug).toBeVisible();

  // Trasparente: né la pagina né il corpo hanno un colore (OBS lo mette sopra le camere).
  for (const target of ["document.documentElement", "document.body"]) {
    expect(await page.evaluate((t) => getComputedStyle(eval(t)).backgroundColor, target)).toBe("rgba(0, 0, 0, 0)");
  }
  // Su 1920 di larghezza la barra è larga 640 px: tutto scala con la larghezza.
  expect((await bug.boundingBox())?.width).toBeCloseTo(640, 0);

  await expect(page.locator("[data-grafica-category]")).toHaveText("U15F");
  await expect(page.locator("[data-grafica-phase]")).toHaveText("1° set");
  await expect(page.locator('[data-grafica-team="home"] [data-grafica-name]')).toHaveText("Volley Lignano");
  await expect(page.locator('[data-grafica-team="away"] [data-grafica-name]')).toHaveText("Pol. Esempio");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("10");
  await expect(page.locator('[data-grafica-score="away"]')).toHaveText("8");
  await expect(page.locator('[data-grafica-serving="home"]')).toBeVisible();
  await expect(page.locator('[data-grafica-serving="away"]')).toHaveCount(0);
  await expect(page.locator('[data-grafica-timeouts-side="home"]')).toHaveAttribute("data-grafica-timeouts", "1");
  await expect(page.locator('[data-grafica-timeouts-side="away"]')).toHaveAttribute("data-grafica-timeouts", "0");
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);
  // Niente di quello che il sito mostra ai visitatori.
  await expect(page.getByText(/Installa l'app|Attiva le notifiche|Risultato non ufficiale/)).toHaveCount(0);
  await checkerboard(page);
  await page.screenshot(shots("barra"));
});

test("con il live acceso e ancora nessun punto la barra c'è già, a 0–0 e senza battuta, e il primo punto non apre schede", async ({ page }) => {
  const source = await feed(
    page,
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 0 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      serving: null,
      notStarted: true,
    }),
  );
  await page.goto("/diretta/grafica");
  await expect(page.locator("[data-grafica-bug]")).toBeVisible();
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("0");
  await expect(page.locator('[data-grafica-score="away"]')).toHaveText("0");
  await expect(page.locator('[data-grafica-team="away"] [data-grafica-name]')).toHaveText("Pol. Esempio");
  await expect(page.locator("[data-grafica-serving]")).toHaveCount(0);
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);
  // Chiede la risposta che comprende anche la partita non ancora iniziata (il banner del sito non la riceve).
  expect(source.urls.length).toBeGreaterThan(0);
  expect(source.urls.every((url) => new URL(url).searchParams.get("prima") === "1")).toBe(true);

  // Primo punto: la barra segue, la battuta compare e non si apre nessuna scheda.
  source.set(live({ home: { name: "Volley Lignano", color: "#1c5bae", score: 1, sets: 0 }, away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 }, serving: "home" }));
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("1", { timeout: 15_000 });
  await expect(page.locator('[data-grafica-serving="home"]')).toBeVisible();
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);
});

test("un time-out nuovo apre la scheda con il conto alla rovescia, un set chiuso la scheda «Fine set», la partita finita il finale", async ({ page }) => {
  test.setTimeout(90_000);
  const source = await feed(page, live({ point: null }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("10");
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);

  // La squadra ospite chiama time-out.
  source.set(live({ timeouts: { home: 0, away: 1 } }));
  const timeout = page.locator('[data-grafica-card="timeout"]');
  await expect(timeout).toBeVisible({ timeout: 15_000 });
  await expect(timeout).toContainText("Time-out");
  await expect(timeout).toContainText("Pol. Esempio");
  await expect(page.locator("[data-grafica-countdown]")).toHaveText(/^0:(2\d|30)$/);
  await expect(page.locator('[data-grafica-timeouts-side="away"]')).toHaveAttribute("data-grafica-timeouts", "1");
  await checkerboard(page);
  await page.screenshot(shots("timeout"));

  // Set point per Lignano.
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 24, sets: 0 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 20, sets: 0 },
      timeouts: { home: 0, away: 1 },
      point: { side: "home", kind: "set" },
    }),
  );
  const point = page.locator("[data-grafica-point]");
  await expect(point).toHaveText("Set point", { timeout: 15_000 });
  await expect(point).toHaveAttribute("data-grafica-point", "home-set");
  await page.screenshot(shots("set-point"));

  // Set chiuso, 25-20.
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 1 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      sets: [{ home: 25, away: 20 }],
      serving: "away",
    }),
  );
  const setCard = page.locator('[data-grafica-card="set"]');
  await expect(setCard).toBeVisible({ timeout: 15_000 });
  await expect(setCard).toContainText("Fine 1° set");
  await expect(page.locator("[data-grafica-set-score]")).toHaveText("25–20");
  await expect(page.locator("[data-grafica-phase]")).toHaveText("2° set");
  await expect(page.locator('[data-grafica-partial="1"]')).toContainText("25–20");
  await expect(page.locator('[data-grafica-sets="home"]')).toHaveText("1");
  await expect(page.locator('[data-grafica-serving="away"]')).toBeVisible();
  await page.screenshot(shots("fine-set"));

  // Partita finita, 2-0.
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      sets: [{ home: 25, away: 20 }, { home: 25, away: 19 }],
      serving: null,
      finished: true,
    }),
  );
  const final = page.locator('[data-grafica-card="final"]');
  await expect(final).toBeVisible({ timeout: 15_000 });
  await expect(final).toContainText("Vince Volley Lignano");
  await expect(page.locator("[data-grafica-final-score]")).toHaveText("2–0");
  await expect(page.locator("[data-grafica-phase]")).toHaveText("Finale");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("2");
  await expect(page.locator('[data-grafica-serving="home"]')).toHaveCount(0);
  await page.screenshot(shots("finale"));
});

test("senza partita in diretta, o con il Minivolley, non si vede niente; se la rete cade resta l'ultimo punteggio", async ({ page }) => {
  await feed(page, null);
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica="idle"]')).toHaveCount(1);
  await expect(page.locator("[data-grafica-bug]")).toHaveCount(0);

  const minivolley = await page.context().newPage();
  await feed(minivolley, live({ team: "minivolley", category: null }));
  await minivolley.goto("/diretta/grafica");
  await expect(minivolley.locator('[data-grafica="idle"]')).toHaveCount(1);
  await minivolley.waitForTimeout(2_500);
  await expect(minivolley.locator("[data-grafica-bug]")).toHaveCount(0);
  await minivolley.close();

  const offline = await page.context().newPage();
  const line = await feed(offline, live());
  await offline.goto("/diretta/grafica");
  await expect(offline.locator('[data-grafica-score="home"]')).toHaveText("10");
  line.fail(true);
  await offline.waitForTimeout(4_500);
  await expect(offline.locator('[data-grafica-score="home"]')).toHaveText("10");
  await offline.close();
});

test("?prova=1 mostra una partita finta che si anima da sola, ?posizione e ?scala la spostano e la ridimensionano", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/diretta/grafica?prova=1");
  await expect(page.locator("[data-grafica-bug]")).toBeVisible();
  await expect(page.locator("[data-grafica-demo]")).toHaveCount(1);
  // La partita finta passa dal time-out…
  await expect(page.locator('[data-grafica-card="timeout"]')).toBeVisible({ timeout: 30_000 });
  // …dal set point…
  await expect(page.locator("[data-grafica-point]")).toBeVisible({ timeout: 30_000 });
  // …e dalla fine del primo set.
  await expect(page.locator('[data-grafica-card="set"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-grafica-set-score]")).toHaveText("25–21");

  const corner = await page.context().newPage();
  await corner.goto("/diretta/grafica?prova=1&posizione=basso-destra&scala=150");
  const bug = corner.locator("[data-grafica-bug]");
  await expect(bug).toBeVisible();
  const box = (await bug.boundingBox())!;
  // 150%: 960 px di larghezza, e il lato destro-basso dello schermo.
  expect(box.width).toBeCloseTo(960, 0);
  expect(box.x + box.width).toBeGreaterThan(1700);
  expect(box.y).toBeGreaterThan(540);
  await corner.close();
});
