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
  away: { name: string; color: string; score: number; sets: number; logo?: string | null };
  serving: "home" | "away" | null;
  sets: { home: number; away: number }[];
  timeouts: { home: number; away: number };
  finished: boolean;
  point?: { side: "home" | "away"; kind: "set" | "match" } | null;
  notStarted?: true;
  recap?: Recap;
  updatedAt: string;
};

type RecapTeam = { attack: number; block: number; ace: number; gifts: number; run: number; timeouts: number };
type Recap = { n: number; minutes: number | null; home: RecapTeam; away: RecapTeam };

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

/** Un PNG di un pixel: il «logo» dell'avversaria nelle prove. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");

const RECAP_1: Recap = {
  n: 1,
  minutes: 27,
  home: { attack: 12, block: 3, ace: 2, gifts: 8, run: 5, timeouts: 1 },
  away: { attack: 10, block: 1, ace: 1, gifts: 9, run: 4, timeouts: 1 },
};
const RECAP_2: Recap = {
  n: 2,
  minutes: 24,
  home: { attack: 13, block: 4, ace: 1, gifts: 7, run: 4, timeouts: 1 },
  away: { attack: 11, block: 2, ace: 1, gifts: 8, run: 3, timeouts: 1 },
};

test("di partenza ci sono le due barre: la piccola in alto a sinistra e la larga in basso al centro, con nomi, set, punti, battuta e time-out", async ({ page }) => {
  await feed(
    page,
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 12, sets: 1 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 9, sets: 0 },
      sets: [{ home: 25, away: 21 }],
      timeouts: { home: 1, away: 0 },
      point: null,
    }),
  );
  await page.goto("/diretta/grafica");
  const small = page.locator("[data-grafica-bug]");
  const wide = page.locator("[data-grafica-wide]");
  await expect(small).toBeVisible();
  await expect(wide).toBeVisible();

  // La piccola in alto a sinistra, la larga in basso e centrata: 84 rem su 1920 px sono 1344 px.
  const smallBox = (await small.boundingBox())!;
  const wideBox = (await wide.boundingBox())!;
  expect(smallBox.x).toBeLessThan(100);
  expect(smallBox.y).toBeLessThan(100);
  expect(wideBox.width).toBeCloseTo(1344, 0);
  expect(wideBox.x + wideBox.width / 2).toBeCloseTo(960, 0);
  expect(wideBox.y + wideBox.height).toBeGreaterThan(1000);
  expect(wideBox.y).toBeGreaterThan(900);

  await expect(page.locator('[data-grafica-wide-name="home"]')).toHaveText("Volley Lignano");
  await expect(page.locator('[data-grafica-wide-name="away"]')).toHaveText("Pol. Esempio");
  await expect(page.locator('[data-grafica-wide-score="home"]')).toHaveText("12");
  await expect(page.locator('[data-grafica-wide-score="away"]')).toHaveText("9");
  await expect(page.locator('[data-grafica-wide-sets="home"]')).toHaveText("1");
  await expect(page.locator('[data-grafica-wide-sets="away"]')).toHaveText("0");
  await expect(page.locator("[data-grafica-wide-phase]")).toHaveText("2° set");
  await expect(page.locator('[data-grafica-wide-serving="home"]')).toBeVisible();
  await expect(page.locator('[data-grafica-wide-serving="away"]')).toHaveCount(0);
  await expect(page.locator('[data-grafica-wide-timeouts-side="home"]')).toHaveAttribute("data-grafica-wide-timeouts", "1");
  await expect(page.locator('[data-grafica-wide-timeouts-side="away"]')).toHaveAttribute("data-grafica-wide-timeouts", "0");
  // Nessun logo dal portale: lo stemma nostro e le iniziali loro, in tutte e due le barre.
  await expect(page.locator('[data-grafica-logo="home"]')).toHaveCount(2);
  await expect(page.locator('[data-grafica-logo="monogram"]')).toHaveCount(2);
  await checkerboard(page);
  await page.screenshot(shots("barre"));
});

test("la barra larga mostra set point e match point, e a partita finita i set vinti", async ({ page }) => {
  const source = await feed(page, live({ point: { side: "home", kind: "set" } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator("[data-grafica-wide-point]")).toHaveText("Set point");
  await expect(page.locator("[data-grafica-wide-point]")).toHaveAttribute("data-grafica-wide-point", "home-set");
  source.set(live({ point: { side: "away", kind: "match" }, home: { name: "Volley Lignano", color: "#1c5bae", score: 20, sets: 1 }, away: { name: "Pol. Esempio", color: "#e11d48", score: 24, sets: 1 }, sets: [{ home: 25, away: 20 }, { home: 18, away: 25 }] }));
  await expect(page.locator("[data-grafica-wide-point]")).toHaveText("Match point", { timeout: 15_000 });
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 1 },
      sets: [{ home: 25, away: 20 }, { home: 18, away: 25 }, { home: 15, away: 12 }],
      serving: null,
      finished: true,
    }),
  );
  await expect(page.locator("[data-grafica-wide-phase]")).toHaveText("Finale", { timeout: 15_000 });
  await expect(page.locator('[data-grafica-wide-score="home"]')).toHaveText("2");
  await expect(page.locator('[data-grafica-wide-score="away"]')).toHaveText("1");
  await expect(page.locator("[data-grafica-wide-serving]")).toHaveCount(0);
  await expect(page.locator("[data-grafica-wide-point]")).toHaveCount(0);
});

test("?stile=piccola tiene solo la barra in alto, ?stile=larga solo quella in basso (con le schede sopra)", async ({ page }) => {
  test.setTimeout(90_000);
  await feed(page, live({ point: null }));
  await page.goto("/diretta/grafica?stile=piccola");
  await expect(page.locator("[data-grafica-bug]")).toBeVisible();
  await expect(page.locator("[data-grafica-wide]")).toHaveCount(0);

  const wideOnly = await page.context().newPage();
  const source = await feed(wideOnly, live({ point: null }));
  await wideOnly.goto("/diretta/grafica?stile=larga");
  await expect(wideOnly.locator("[data-grafica-wide]")).toBeVisible();
  await expect(wideOnly.locator("[data-grafica-bug]")).toHaveCount(0);
  await expect(wideOnly.locator("[data-grafica]")).toHaveAttribute("data-grafica-style", "larga");

  // Un time-out apre la scheda sopra la barra larga, non sotto la piccola che non c'è.
  source.set(live({ timeouts: { home: 0, away: 1 } }));
  const card = wideOnly.locator('[data-grafica-card="timeout"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  const cardBox = (await card.boundingBox())!;
  const wideBox = (await wideOnly.locator("[data-grafica-wide]").boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(wideBox.y + 1);
  await wideOnly.close();
});

test("il logo dell'avversaria compare nelle due barre; senza logo, o se non si carica, restano le iniziali", async ({ page }) => {
  await page.route("**/prova-logo.png", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
  await feed(page, live({ away: { name: "Pol. Esempio", color: "#e11d48", score: 8, sets: 0, logo: "/prova-logo.png" } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-logo="away"]')).toHaveCount(2);
  await expect(page.locator('[data-grafica-logo="home"]')).toHaveCount(2);
  await expect(page.locator('[data-grafica-logo="monogram"]')).toHaveCount(0);
  await expect(page.locator('[data-grafica-wide] [data-grafica-logo="away"] img')).toHaveAttribute("src", "/prova-logo.png");

  // Il logo non si carica (404): al suo posto il tondo con le iniziali, in tutte e due le barre.
  const broken = await page.context().newPage();
  await broken.route("**/logo-rotto.png", (route) => route.fulfill({ status: 404, contentType: "image/png", body: "" }));
  await feed(broken, live({ away: { name: "Pol. Esempio", color: "#e11d48", score: 8, sets: 0, logo: "/logo-rotto.png" } }));
  await broken.goto("/diretta/grafica");
  await expect(broken.locator('[data-grafica-logo="monogram"]')).toHaveCount(2, { timeout: 15_000 });
  await expect(broken.locator('[data-grafica-logo="away"]')).toHaveCount(0);
  await broken.close();
});

test("a fine set compare il resoconto con i due loghi e i numeri di squadra, a fine partita il finale con i set", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/prova-logo.png", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
  const away = { name: "Pol. Esempio", color: "#e11d48", logo: "/prova-logo.png" };
  const source = await feed(page, live({ point: null, away: { ...away, score: 20, sets: 0 }, home: { name: "Volley Lignano", color: "#1c5bae", score: 24, sets: 0 } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-wide-score="home"]')).toHaveText("24");
  await expect(page.locator("[data-grafica-recap]")).toHaveCount(0);

  // Set chiuso, 25-21: il resoconto sostituisce la striscia «Fine set».
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 1 },
      away: { ...away, score: 0, sets: 0 },
      sets: [{ home: 25, away: 21 }],
      serving: "away",
      recap: RECAP_1,
    }),
  );
  const panel = page.locator('[data-grafica-recap="1"]');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toHaveAttribute("data-grafica-card", "set");
  await expect(panel.locator("[data-grafica-recap-title]")).toHaveText("Fine 1° set");
  await expect(panel.locator("[data-grafica-recap-minutes]")).toHaveText("Durata 27′");
  await expect(page.locator("[data-grafica-set-score]")).toHaveText("25–21");
  await expect(panel.locator('[data-grafica-recap-name="home"]')).toHaveText("Volley Lignano");
  await expect(panel.locator('[data-grafica-recap-name="away"]')).toHaveText("Pol. Esempio");
  await expect(panel.locator('[data-grafica-logo="home"]')).toHaveCount(1);
  await expect(panel.locator('[data-grafica-logo="away"]')).toHaveCount(1);
  for (const [name, home, awayValue] of [["attack", "12", "10"], ["block", "3", "1"], ["ace", "2", "1"], ["gifts", "8", "9"], ["run", "5", "4"], ["timeouts", "1", "1"]]) {
    await expect(panel.locator(`[data-grafica-recap-value="${name}-home"]`)).toHaveText(home);
    await expect(panel.locator(`[data-grafica-recap-value="${name}-away"]`)).toHaveText(awayValue);
  }
  await expect(panel).toContainText("Errori avversari");
  // Una sola scheda di fine set: non c'è anche la striscia piccola.
  await expect(page.locator('[data-grafica-card="set"]')).toHaveCount(1);
  await checkerboard(page);
  await page.screenshot(shots("resoconto"));

  // Partita finita, 2-0: il pannello diventa «Finale», con i set vinti e i numeri dell'ultimo set.
  source.set(
    live({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
      away: { ...away, score: 0, sets: 0 },
      sets: [{ home: 25, away: 21 }, { home: 25, away: 22 }],
      serving: null,
      finished: true,
      recap: RECAP_2,
    }),
  );
  const final = page.locator('[data-grafica-card="final"]');
  await expect(final).toBeVisible({ timeout: 15_000 });
  await expect(final.locator("[data-grafica-recap-title]")).toHaveText("Finale");
  await expect(page.locator("[data-grafica-final-score]")).toHaveText("2–0");
  await expect(final).toContainText("Ultimo set · 2°");
  await expect(final.locator("[data-grafica-recap-minutes]")).toHaveText("2° set · 24′");
  await expect(final.locator('[data-grafica-recap-value="attack-home"]')).toHaveText("13");
  await expect(final.locator("[data-grafica-recap-sets] > span")).toHaveCount(2);
  await page.screenshot(shots("finale-resoconto"));
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
  // …con il resoconto del set (la partita finta porta i numeri di squadra) e la barra larga sotto.
  await expect(page.locator('[data-grafica-recap="1"]')).toBeVisible();
  await expect(page.locator('[data-grafica-recap-value="attack-home"]')).toHaveText("12");
  await expect(page.locator("[data-grafica-wide]")).toBeVisible();

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
