import { expect, test, type Page } from "@playwright/test";

/**
 * La grafica della diretta video (/diretta/grafica), quella che OBS / Streamlabs mette sopra le camere, come una regia di
 * Serie A: sfondo trasparente, barra del punteggio in alto a sinistra (con SET POINT e la serie in corso), sottopancia di
 * time-out e cambi, grafiche a schermo intero (presentazione, formazione, fine set, finale), la partita finta `?prova=1` e la
 * verifica delle misure `?verifica=1`. Il punteggio arriva da un endpoint simulato (gli stessi dati del banner del sito), così
 * non serve uno Scout acceso; l'orologio della pagina è finto dove serve saltare i secondi di una grafica.
 */

test.use({ serviceWorkers: "block", viewport: { width: 1920, height: 1080 } });

type Player = { number: string | null; name?: string };
type RecapTeam = { attack: number; block: number; ace: number; gifts: number; run: number; timeouts: number };
type Recap = { n: number; minutes: number | null; home: RecapTeam; away: RecapTeam };
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
  setStats?: { home: RecapTeam; away: RecapTeam };
  matchStats?: { home: RecapTeam; away: RecapTeam };
  run?: { side: "home" | "away"; points: number };
  subs?: { id: string; in: Player; out: Player; score: { home: number; away: number } }[];
  lineup?: { set: number; positions: (Player | null)[]; libero: Player | null };
  info?: { date: string; venue: string | null; home: boolean; friendly: boolean };
  updatedAt: string;
};

const HOME = { name: "Volley Lignano", color: "#1c5bae" };
const AWAY = { name: "Pol. Esempio", color: "#e11d48" };

function live(over: Partial<Live> = {}): Live {
  return {
    team: "u14u15",
    category: "U15",
    home: { ...HOME, score: 10, sets: 0 },
    away: { ...AWAY, score: 8, sets: 0 },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

const score = (home: number, away: number, sets: [number, number] = [0, 0]) => ({
  home: { ...HOME, score: home, sets: sets[0] },
  away: { ...AWAY, score: away, sets: sets[1] },
});

const stat = (attack: number, block: number, ace: number, gifts: number, run = 3, timeouts = 0): RecapTeam => ({ attack, block, ace, gifts, run, timeouts });
const RECAP_1: Recap = { n: 1, minutes: 27, home: stat(12, 3, 2, 8, 5, 1), away: stat(10, 1, 1, 9, 4, 1) };
const RECAP_2: Recap = { n: 2, minutes: 24, home: stat(13, 4, 1, 7, 4, 1), away: stat(11, 2, 1, 8, 3, 1) };
const LINEUP = (set: number, names = false) => ({
  set,
  positions: (
    [
      ["7", "Rossi"],
      ["12", "Bianchi"],
      ["3", "Verdi"],
      ["9", "Neri"],
      ["15", "Galli"],
      ["4", "Conti"],
    ] as const
  ).map(([number, name]) => (names ? { number, name } : { number })),
  libero: names ? { number: "1", name: "Riva" } : { number: "1" },
});
const INFO = { date: "2026-10-31T18:00", venue: "Palazzetto dello Sport, Lignano", home: true, friendly: false };

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

/** Fa passare il tempo nella pagina (orologio finto) e lascia finire le animazioni CSS, che vanno a tempo vero. */
async function pass(page: Page, ms: number) {
  await page.clock.runFor(ms);
  await page.waitForTimeout(300);
}

test("sfondo trasparente, nessun avviso del sito e la barra in alto a sinistra con nomi corti, punti, battuta e time-out", async ({ page }) => {
  await feed(page, live({ timeouts: { home: 1, away: 0 }, point: null }));
  await page.goto("/diretta/grafica");
  const bug = page.locator("[data-grafica-bug]");
  await expect(bug).toBeVisible();

  // Trasparente: né la pagina né il corpo hanno un colore (OBS lo mette sopra le camere).
  for (const target of ["document.documentElement", "document.body"]) {
    expect(await page.evaluate((t) => getComputedStyle(eval(t)).backgroundColor, target)).toBe("rgba(0, 0, 0, 0)");
  }
  // Su 1920 di larghezza la barra è larga 576 px (36 rem) e sta nell'angolo in alto a sinistra: tutto scala con la larghezza.
  const box = (await bug.boundingBox())!;
  expect(box.width).toBeCloseTo(576, 0);
  expect(box.x).toBeCloseTo(64, 0);
  expect(box.y).toBeLessThan(100);
  // Di partenza una barra sola, come in SuperLega: niente barra larga in basso.
  await expect(page.locator("[data-grafica-wide]")).toHaveCount(0);

  await expect(page.locator("[data-grafica-category]")).toHaveText("U15F");
  await expect(page.locator("[data-grafica-phase]")).toHaveText("1° set");
  await expect(page.locator('[data-grafica-team="home"] [data-grafica-name]')).toHaveText("Lignano");
  await expect(page.locator('[data-grafica-team="away"] [data-grafica-name]')).toHaveText("Esempio");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("10");
  await expect(page.locator('[data-grafica-score="away"]')).toHaveText("8");
  await expect(page.locator('[data-grafica-serving="home"]')).toBeVisible();
  await expect(page.locator('[data-grafica-serving="away"]')).toHaveCount(0);
  await expect(page.locator('[data-grafica-timeouts-side="home"]')).toHaveAttribute("data-grafica-timeouts", "1");
  await expect(page.locator('[data-grafica-timeouts-side="away"]')).toHaveAttribute("data-grafica-timeouts", "0");
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);
  await expect(page.locator("[data-grafica-flag]")).toHaveCount(0);
  // Niente di quello che il sito mostra ai visitatori.
  await expect(page.getByText(/Installa l'app|Attiva le notifiche|Risultato non ufficiale/)).toHaveCount(0);
  await checkerboard(page);
  await page.screenshot(shots("barra"));
});

test("prima del via: presentazione a schermo intero, poi la formazione; al primo punto escono e resta la barra", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  const source = await feed(page, live({ ...score(0, 0), serving: null, notStarted: true, lineup: LINEUP(1), info: INFO }));
  await page.goto("/diretta/grafica");
  const intro = page.locator('[data-grafica-full="intro"]');
  await expect(intro).toBeVisible();
  await expect(intro.locator("[data-grafica-full-eyebrow]")).toHaveText("Under 15 femminile");
  await expect(intro.locator("[data-grafica-full-title]")).toHaveText("Oggi in campo");
  await expect(intro).toContainText("Volley Lignano");
  await expect(intro).toContainText("Pol. Esempio");
  await expect(intro.locator("[data-grafica-intro-date]")).toHaveText("Sabato 31 ottobre · ore 18:00");
  await expect(intro.locator("[data-grafica-intro-venue]")).toHaveText("Palazzetto dello Sport, Lignano");
  // Chiede la risposta che comprende anche la partita non ancora iniziata (il banner del sito non la riceve).
  expect(source.urls.every((url) => new URL(url).searchParams.get("prima") === "1")).toBe(true);
  // A schermo intero la barra si nasconde.
  await expect(page.locator("[data-grafica-bug]").locator("xpath=..")).toHaveClass(/opacity-0/);
  await pass(page, 1_500);
  await checkerboard(page);
  await page.screenshot(shots("presentazione"));

  // Dopo 12 secondi la formazione: sei maglie con il numero, la libero a parte, la 1 batte. Senza nomi: solo i numeri.
  await pass(page, 11_000);
  const lineup = page.locator('[data-grafica-full="lineup"]');
  await expect(lineup).toBeVisible();
  await expect(lineup.locator("[data-grafica-full-title]")).toHaveText("Formazione · 1° set");
  await expect(lineup.locator('[data-grafica-lineup-spot="1"] [data-grafica-lineup-number]')).toHaveText("7");
  await expect(lineup.locator('[data-grafica-lineup-spot="4"] [data-grafica-lineup-number]')).toHaveText("9");
  await expect(lineup.locator('[data-grafica-lineup-spot="libero"] [data-grafica-lineup-number]')).toHaveText("1");
  await expect(lineup.locator("[data-grafica-lineup-name]")).toHaveCount(0);
  await pass(page, 1_500);
  await page.screenshot(shots("formazione"));

  // Primo punto: la formazione esce subito (con la transizione) e resta la barra, senza altre grafiche.
  source.set(live({ ...score(1, 0), serving: "home", lineup: LINEUP(1), info: INFO }));
  await pass(page, 2_500);
  await pass(page, 1_000);
  await expect(page.locator("[data-grafica-full]")).toHaveCount(0);
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("1");
  await expect(page.locator('[data-grafica-serving="home"]')).toBeVisible();
  await expect(page.locator("[data-grafica-card]")).toHaveCount(0);
});

test("con i nomi accesi la formazione e i cambi li mostrano, accanto al numero", async ({ page }) => {
  await page.clock.install();
  const source = await feed(page, live({ ...score(0, 0), serving: null, notStarted: true, lineup: LINEUP(1, true) }));
  await page.goto("/diretta/grafica");
  await pass(page, 12_500);
  const lineup = page.locator('[data-grafica-full="lineup"]');
  await expect(lineup).toBeVisible();
  await expect(lineup.locator('[data-grafica-lineup-spot="1"] [data-grafica-lineup-name]')).toHaveText("Rossi");
  await expect(lineup.locator('[data-grafica-lineup-spot="libero"] [data-grafica-lineup-name]')).toHaveText("Riva");

  source.set(live({ ...score(3, 2), lineup: LINEUP(1, true) }));
  await pass(page, 2_500);
  source.set(live({ ...score(3, 2), lineup: LINEUP(1, true), subs: [{ id: "s1", in: { number: "10", name: "Costa" }, out: { number: "12", name: "Bianchi" }, score: { home: 3, away: 2 } }] }));
  await pass(page, 2_500);
  const card = page.locator('[data-grafica-card="sub"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-grafica-sub-player="in"] [data-grafica-sub-name]')).toHaveText("Costa");
  await expect(card.locator('[data-grafica-sub-player="out"] [data-grafica-sub-name]')).toHaveText("Bianchi");
});

test("un cambio nostro: sottopancia in basso a sinistra con chi entra e chi esce; un cambio doppio è una grafica sola", async ({ page }) => {
  await page.clock.install();
  const source = await feed(page, live({ point: null }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("10");
  source.set(
    live({
      subs: [
        { id: "s1", in: { number: "10" }, out: { number: "12" }, score: { home: 10, away: 8 } },
        { id: "s2", in: { number: "8" }, out: { number: "3" }, score: { home: 10, away: 8 } },
      ],
    }),
  );
  await pass(page, 2_500);
  const card = page.locator('[data-grafica-card="sub"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("Cambi");
  await expect(card).toContainText("Lignano");
  await expect(card.locator("[data-grafica-sub]")).toHaveCount(2);
  await expect(card.locator('[data-grafica-sub="s1"] [data-grafica-sub-player="in"] [data-grafica-sub-number]')).toHaveText("10");
  await expect(card.locator('[data-grafica-sub="s1"] [data-grafica-sub-player="out"] [data-grafica-sub-number]')).toHaveText("12");
  // Senza nomi: «Entra» / «Esce» al posto del nome.
  await expect(card.locator('[data-grafica-sub="s1"] [data-grafica-sub-player="in"] [data-grafica-sub-name]')).toHaveText("Entra");
  await expect(card.locator("[data-grafica-sub-score]")).toHaveText("10–8");
  // In basso a sinistra, nell'area sicura.
  const box = (await card.boundingBox())!;
  expect(box.x).toBeCloseTo(64, 0);
  expect(box.y + box.height).toBeGreaterThan(950);
  expect(box.y + box.height).toBeLessThan(1080 - 40);
  await pass(page, 500);
  await checkerboard(page);
  await page.screenshot(shots("cambio"));
  // Dopo 8 secondi se ne va, e le stesse letture non lo ripetono.
  await pass(page, 8_500);
  await expect(page.locator('[data-grafica-card="sub"]')).toHaveCount(0);
});

test("time-out con il conto alla rovescia e i punti del set, set point, serie in corso, fine set e finale a schermo intero", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  const setStats = { home: stat(5, 2, 1, 2), away: stat(4, 1, 0, 3) };
  const source = await feed(page, live({ point: null, setStats }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("10");

  // La squadra ospite chiama time-out.
  source.set(live({ timeouts: { home: 0, away: 1 }, setStats }));
  await pass(page, 2_500);
  const timeout = page.locator('[data-grafica-card="timeout"]');
  await expect(timeout).toBeVisible();
  await expect(timeout).toContainText("Time-out");
  await expect(timeout).toContainText("Esempio");
  await expect(page.locator("[data-grafica-countdown]")).toHaveText(/^0:(2\d|30)$/);
  await expect(timeout.locator("[data-grafica-timeout-stats]")).toContainText("Punti nel 1° set");
  await expect(timeout.locator('[data-grafica-timeout-value="home-attack"]')).toHaveText("5");
  await expect(timeout.locator('[data-grafica-timeout-value="away-gifts"]')).toHaveText("3");
  await expect(page.locator('[data-grafica-timeouts-side="away"]')).toHaveAttribute("data-grafica-timeouts", "1");
  await checkerboard(page);
  await page.screenshot(shots("timeout"));

  // Serie di 4 punti di Lignano: la striscia sotto la barra.
  await pass(page, 30_000);
  await expect(timeout).toHaveCount(0);
  source.set(live({ ...score(14, 8), timeouts: { home: 0, away: 1 }, run: { side: "home", points: 4 } }));
  await pass(page, 2_500);
  await expect(page.locator("[data-grafica-run]")).toHaveText("Parziale 4–0");
  await expect(page.locator('[data-grafica-flag="run"]')).toContainText("Lignano");

  // Set point per Lignano: prende il posto della serie.
  source.set(live({ ...score(24, 20), timeouts: { home: 0, away: 1 }, point: { side: "home", kind: "set" }, run: { side: "home", points: 5 } }));
  await pass(page, 2_500);
  const point = page.locator("[data-grafica-point]");
  await expect(point).toHaveText("Set point");
  await expect(point).toHaveAttribute("data-grafica-point", "home-set");
  await expect(page.locator("[data-grafica-run]")).toHaveCount(0);
  await page.screenshot(shots("set-point"));

  // Set chiuso, 25-21: il riepilogo a schermo intero, con la tabella dei set e i numeri del set.
  source.set(live({ ...score(0, 0, [1, 0]), sets: [{ home: 25, away: 21 }], serving: "away", recap: RECAP_1 }));
  await pass(page, 2_500);
  const setCard = page.locator('[data-grafica-full="set"]');
  await expect(setCard).toBeVisible();
  await expect(setCard.locator("[data-grafica-full-title]")).toHaveText("Fine 1° set");
  await expect(setCard.locator("[data-grafica-recap-minutes]")).toHaveText("Durata 27′");
  await expect(setCard.locator("[data-grafica-set-score]")).toHaveText("25–21");
  await expect(setCard.locator('[data-grafica-sets-row="home"]')).toContainText("25");
  await expect(setCard.locator('[data-grafica-sets-won="home"]')).toHaveText("1");
  for (const [name, home, away] of [["attack", "12", "10"], ["block", "3", "1"], ["ace", "2", "1"], ["gifts", "8", "9"], ["run", "5", "4"], ["timeouts", "1", "1"]]) {
    await expect(setCard.locator(`[data-grafica-recap-value="${name}-home"]`)).toHaveText(home);
    await expect(setCard.locator(`[data-grafica-recap-value="${name}-away"]`)).toHaveText(away);
  }
  await pass(page, 1_500);
  await page.screenshot(shots("fine-set"));
  // Intanto la barra (nascosta) è già al 2° set.
  await expect(page.locator("[data-grafica-phase]")).toHaveText("2° set");
  await expect(page.locator('[data-grafica-partial="1"]')).toContainText("25–21");

  // Dopo 15 secondi il riepilogo se ne va.
  await pass(page, 15_000);
  await expect(page.locator("[data-grafica-full]")).toHaveCount(0);

  // Partita finita, 2-0: risultato finale con il vincitore, i set e i numeri della partita.
  const matchStats = { home: stat(25, 7, 3, 15, 5, 2), away: stat(21, 3, 2, 17, 4, 2) };
  source.set(
    live({ ...score(0, 0, [2, 0]), sets: [{ home: 25, away: 21 }, { home: 25, away: 22 }], serving: null, finished: true, recap: RECAP_2, matchStats }),
  );
  await pass(page, 2_500);
  const final = page.locator('[data-grafica-full="final"]');
  await expect(final).toBeVisible();
  await expect(final.locator("[data-grafica-full-title]")).toHaveText("Risultato finale");
  await expect(final.locator("[data-grafica-final-winner]")).toHaveText("Vince Lignano");
  await expect(final.locator("[data-grafica-final-score]")).toHaveText("2–0");
  await expect(final).toContainText("Numeri della partita");
  await expect(final.locator('[data-grafica-recap-value="attack-home"]')).toHaveText("25");
  await pass(page, 1_500);
  await page.screenshot(shots("finale"));
  // Finito il finale, la barra con i set vinti.
  await pass(page, 30_000);
  await expect(page.locator("[data-grafica-full]")).toHaveCount(0);
  await expect(page.locator("[data-grafica-phase]")).toHaveText("Finale");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("2");
  await expect(page.locator('[data-grafica-serving="home"]')).toHaveCount(0);
});

test("a fine set la formazione del set nuovo va in onda dopo il riepilogo, quando lo staff la conferma", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  const source = await feed(page, live({ ...score(24, 20), lineup: LINEUP(1) }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-score="home"]')).toHaveText("24");
  source.set(live({ ...score(0, 0, [1, 0]), sets: [{ home: 25, away: 20 }], serving: "away", recap: RECAP_1 }));
  await pass(page, 2_500);
  await expect(page.locator('[data-grafica-full="set"]')).toBeVisible();
  source.set(live({ ...score(0, 0, [1, 0]), sets: [{ home: 25, away: 20 }], serving: "away", recap: RECAP_1, lineup: LINEUP(2) }));
  await pass(page, 2_500);
  await expect(page.locator('[data-grafica-full="set"]')).toBeVisible();
  await pass(page, 13_000);
  const lineup = page.locator('[data-grafica-full="lineup"]');
  await expect(lineup).toBeVisible();
  await expect(lineup.locator("[data-grafica-full-title]")).toHaveText("Formazione · 2° set");
});

test("?stile=larga mette la barra larga in basso al centro, con i sottopancia sopra; ?stile=entrambe tutte e due", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  const source = await feed(page, live({ point: { side: "home", kind: "set" }, ...score(24, 20, [1, 0]), sets: [{ home: 25, away: 21 }], timeouts: { home: 1, away: 0 } }));
  await page.goto("/diretta/grafica?stile=larga");
  const wide = page.locator("[data-grafica-wide]");
  await expect(wide).toBeVisible();
  await expect(page.locator("[data-grafica-bug]")).toHaveCount(0);
  await expect(page.locator("[data-grafica]")).toHaveAttribute("data-grafica-style", "larga");
  // Larga 84 rem (1344 px su 1920) e centrata in basso.
  const wideBox = (await wide.boundingBox())!;
  expect(wideBox.width).toBeCloseTo(1344, 0);
  expect(wideBox.x + wideBox.width / 2).toBeCloseTo(960, 0);
  expect(wideBox.y + wideBox.height).toBeGreaterThan(1000);
  await expect(page.locator('[data-grafica-wide-name="home"]')).toHaveText("Lignano");
  await expect(page.locator('[data-grafica-wide-name="away"]')).toHaveText("Esempio");
  await expect(page.locator('[data-grafica-wide-score="home"]')).toHaveText("24");
  await expect(page.locator('[data-grafica-wide-sets="home"]')).toHaveText("1");
  await expect(page.locator("[data-grafica-wide-phase]")).toHaveText("2° set");
  await expect(page.locator("[data-grafica-wide-point]")).toHaveText("Set point");
  await expect(page.locator('[data-grafica-wide-timeouts-side="home"]')).toHaveAttribute("data-grafica-wide-timeouts", "1");

  // Un time-out apre il sottopancia sopra la barra larga, senza coprirla.
  source.set(live({ point: { side: "home", kind: "set" }, ...score(24, 20, [1, 0]), sets: [{ home: 25, away: 21 }], timeouts: { home: 1, away: 1 } }));
  await pass(page, 2_500);
  const card = page.locator('[data-grafica-card="timeout"]');
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(wideBox.y + 1);

  const both = await page.context().newPage();
  await feed(both, live());
  await both.goto("/diretta/grafica?stile=entrambe");
  await expect(both.locator("[data-grafica-bug]")).toBeVisible();
  await expect(both.locator("[data-grafica-wide]")).toBeVisible();
  await both.close();
});

/** Un PNG di un pixel: il «logo» dell'avversaria nelle prove. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");

test("il logo dell'avversaria compare nella barra; senza logo, o se non si carica, restano le iniziali", async ({ page }) => {
  await page.route("**/prova-logo.png", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
  await feed(page, live({ away: { ...AWAY, score: 8, sets: 0, logo: "/prova-logo.png" } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator('[data-grafica-bug] [data-grafica-logo="away"] img')).toHaveAttribute("src", "/prova-logo.png");
  await expect(page.locator('[data-grafica-bug] [data-grafica-logo="home"]')).toHaveCount(1);
  await expect(page.locator('[data-grafica-logo="monogram"]')).toHaveCount(0);

  // Il logo non si carica (404): al suo posto il tondo con le iniziali.
  const broken = await page.context().newPage();
  await broken.route("**/logo-rotto.png", (route) => route.fulfill({ status: 404, contentType: "image/png", body: "" }));
  await feed(broken, live({ away: { ...AWAY, score: 8, sets: 0, logo: "/logo-rotto.png" } }));
  await broken.goto("/diretta/grafica");
  await expect(broken.locator('[data-grafica-bug] [data-grafica-logo="monogram"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(broken.locator('[data-grafica-logo="away"]')).toHaveCount(0);
  await broken.close();
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

test("?prova=1 mostra la partita finta con tutte le grafiche; ?posizione e ?scala spostano e ridimensionano la barra", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  await page.goto("/diretta/grafica?prova=1");
  await expect(page.locator("[data-grafica-demo]")).toHaveCount(1);
  // Prima del via la presentazione, poi la formazione…
  await expect(page.locator('[data-grafica-full="intro"]')).toBeVisible();
  await pass(page, 13_000);
  await expect(page.locator('[data-grafica-full="lineup"]')).toBeVisible();
  // …poi la barra, il time-out, la serie, il cambio, il set point e il fine set con i numeri.
  await pass(page, 14_000);
  await expect(page.locator("[data-grafica-bug]")).toBeVisible();
  const seen = new Set<string>();
  for (let i = 0; i < 60 && seen.size < 5; i++) {
    await page.clock.runFor(1_500);
    for (const [name, selector] of [
      ["timeout", '[data-grafica-card="timeout"]'],
      ["run", "[data-grafica-run]"],
      ["sub", '[data-grafica-card="sub"]'],
      ["point", "[data-grafica-point]"],
      ["set", '[data-grafica-full="set"]'],
    ] as const) {
      if (await page.locator(selector).count()) seen.add(name);
    }
  }
  expect([...seen].sort()).toEqual(["point", "run", "set", "sub", "timeout"]);
  await expect(page.locator('[data-grafica-full="set"] [data-grafica-set-score]')).toHaveText("25–20");
  await expect(page.locator('[data-grafica-full="set"] [data-grafica-recap-value="attack-home"]')).toHaveText("12");

  const corner = await page.context().newPage();
  await corner.clock.install();
  await corner.goto("/diretta/grafica?prova=1&posizione=basso-destra&scala=150");
  await corner.clock.runFor(30_000);
  const bug = corner.locator("[data-grafica-bug]");
  await expect(bug).toBeVisible();
  const box = (await bug.boundingBox())!;
  // 150%: 864 px di larghezza, e il lato destro-basso dello schermo.
  expect(box.width).toBeCloseTo(864, 0);
  expect(box.x + box.width).toBeGreaterThan(1700);
  expect(box.y).toBeGreaterThan(540);
  await corner.close();
});

test("?verifica=1 dice la misura vera della sorgente: verde a 1920×1080, rossa e con cosa correggere se è piccola o storta", async ({ browser }) => {
  for (const [width, height, status, text] of [
    [1920, 1080, "ok", "Perfetta"],
    [1280, 720, "small", "si sgrana"],
    [800, 600, "ratio", "Adatta allo schermo"],
  ] as const) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto("/diretta/grafica?verifica=1");
    const verify = page.locator("[data-grafica-verify]");
    await expect(verify).toHaveAttribute("data-grafica-verify", status);
    await expect(page.locator("[data-grafica-verify-size]")).toHaveText(`${width} × ${height}`);
    await expect(verify).toContainText(text);
    // Sotto, la partita finta.
    await expect(page.locator("[data-grafica-demo]")).toHaveCount(1);
    if (status === "ok") await page.screenshot(shots("verifica"));
    await context.close();
  }
});
