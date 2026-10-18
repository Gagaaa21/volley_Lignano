import { expect, test, type Page } from "@playwright/test";

/**
 * La pagina dei genitori /diretta: il lettore YouTube con il punteggio dello Scout sopra, la scelta della camera, il ritardo
 * del punteggio, lo schermo intero. YouTube e il punteggio sono simulati: non serve la rete né uno Scout acceso.
 */

test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });

const CAMPO = "AAAAAAAAAAA";
const DIETRO = "BBBBBBBBBBB";

type Live = {
  team: "u14u15";
  category: "U15";
  home: { name: string; color: string; score: number; sets: number };
  away: { name: string; color: string; score: number; sets: number };
  serving: "home" | "away" | null;
  sets: { home: number; away: number }[];
  timeouts: { home: number; away: number };
  finished: boolean;
  updatedAt: string;
};

const live = (home: number, away: number): Live => ({
  team: "u14u15",
  category: "U15",
  home: { name: "Volley Lignano", color: "#1c5bae", score: home, sets: 0 },
  away: { name: "Pol. Esempio", color: "#e11d48", score: away, sets: 0 },
  serving: "home",
  sets: [],
  timeouts: { home: 0, away: 0 },
  finished: false,
  updatedAt: new Date().toISOString(),
});

/** YouTube e le due letture che la pagina fa: tutto simulato, e il punteggio si cambia a mano. */
async function mockSite(page: Page, options: { cameras: { name: string; id: string }[]; delaySeconds?: number; score?: Live | null }) {
  const state = { score: options.score === undefined ? live(10, 8) : options.score };
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><body style='margin:0;background:#1d3557;color:#fff;font:20px sans-serif'>video</body>" }),
  );
  await page.route("**/api/diretta", (route) => route.fulfill({ json: { cameras: options.cameras, delaySeconds: options.delaySeconds ?? 15 } }));
  // La grafica chiede `?prima=1`: il filtro deve prendere anche l'indirizzo con i parametri.
  await page.route(/\/api\/livescore\/pubblico/, (route) => route.fulfill({ json: { live: state.score } }));
  return {
    score: (next: Live | null) => {
      state.score = next;
    },
  };
}

const overlay = (page: Page) => page.frameLocator("[data-diretta-overlay]");

/**
 * Il riquadro del punteggio è davvero trasparente: sopra un fondo viola la fascia a destra, a metà altezza (dove le barre non
 * ci sono: la piccola sta in alto a sinistra, la larga in basso al centro) è identica con il riquadro e senza. Se il riquadro
 * avesse uno sfondo pieno (succede quando il tema del sito e quello della grafica non coincidono) i due scatti sarebbero diversi.
 */
async function expectOverlayTransparent(page: Page) {
  await page.evaluate(() => {
    (document.querySelector("[data-diretta-player]") as HTMLElement).style.display = "none";
    (document.querySelector("[data-diretta-stage] > div") as HTMLElement).style.background = "rgb(255, 0, 255)";
  });
  const box = (await page.locator("[data-diretta-stage]").boundingBox())!;
  const clip = { x: box.x + box.width * 0.86, y: box.y + box.height * 0.25, width: box.width * 0.12, height: box.height * 0.4 };
  const withOverlay = await page.screenshot({ clip });
  await page.evaluate(() => ((document.querySelector("[data-diretta-overlay]") as HTMLElement).style.visibility = "hidden"));
  const without = await page.screenshot({ clip });
  expect(withOverlay.equals(without)).toBe(true);
}
const shots = (name: string) => (process.env.GRAFICA_SHOTS ? { path: `${process.env.GRAFICA_SHOTS}/${name}.png` } : undefined);

test("senza link la pagina dice che la diretta non è ancora iniziata, e non carica nessun video", async ({ page }) => {
  await mockSite(page, { cameras: [] });
  await page.goto("/diretta");
  await expect(page.locator("[data-diretta-idle]")).toContainText("La diretta non è ancora iniziata");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-diretta-cameras]")).toHaveCount(0);
});

test("con una camera: il lettore giusto, senza lo schermo intero di YouTube, e il punteggio sopra che non ruba i tocchi", async ({ page }) => {
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");

  const player = page.locator("[data-diretta-player]");
  await expect(player).toHaveAttribute("data-diretta-player", CAMPO);
  const src = new URL((await player.getAttribute("src"))!);
  expect(src.origin + src.pathname).toBe(`https://www.youtube-nocookie.com/embed/${CAMPO}`);
  expect(src.searchParams.get("fs")).toBe("0");
  // Una camera sola: niente pulsanti da scegliere.
  await expect(page.locator("[data-diretta-cameras]")).toHaveCount(0);

  // Il punteggio sta sopra il lettore, trasparente, e i tocchi passano al lettore.
  const grafica = page.locator("[data-diretta-overlay]");
  await expect(grafica).toHaveCSS("pointer-events", "none");
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");
  await expect(overlay(page).locator('[data-grafica-score="away"]')).toHaveText("8");
  const stage = (await page.locator("[data-diretta-stage]").boundingBox())!;
  const bug = (await overlay(page).locator("[data-grafica-bug]").boundingBox())!;
  const frame = (await grafica.boundingBox())!;
  expect(frame.width).toBeCloseTo(stage.width, 0);
  // Su un riquadro largo la barra è un terzo della larghezza, come in OBS.
  expect(bug.width).toBeGreaterThan(frame.width * 0.3);
  expect(bug.width).toBeLessThan(frame.width * 0.36);
  await expect(page.getByText("Risultato non ufficiale")).toBeVisible();
  // Nessun avviso del sito (installa l'app, notifiche) sopra il video.
  await expect(page.getByText(/Installa l'app|Attiva le notifiche/)).toHaveCount(0);
});

test("con più camere i genitori scelgono quale guardare, e la scelta resta", async ({ page }) => {
  await mockSite(page, {
    cameras: [
      { name: "Campo", id: CAMPO },
      { name: "Dietro", id: DIETRO },
    ],
  });
  await page.goto("/diretta");
  const player = page.locator("[data-diretta-player]");
  await expect(player).toHaveAttribute("data-diretta-player", CAMPO);
  await expect(page.locator('[data-diretta-camera="Campo"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-diretta-camera="Dietro"]')).toHaveAttribute("aria-pressed", "false");

  await page.locator('[data-diretta-camera="Dietro"]').click();
  await expect(player).toHaveAttribute("data-diretta-player", DIETRO);
  await expect(page.locator('[data-diretta-camera="Dietro"]')).toHaveAttribute("aria-pressed", "true");
  // Il punteggio non si ricarica cambiando camera.
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");

  await page.reload();
  await expect(page.locator("[data-diretta-player]")).toHaveAttribute("data-diretta-player", DIETRO);
});

test("il ritardo parte da quello dello staff, ognuno lo regola da solo e la grafica lo riceve senza ricaricarsi", async ({ page }) => {
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }], delaySeconds: 20 });
  await page.goto("/diretta");
  await expect(page.locator("[data-diretta-delay]")).toHaveText("20 s");
  const grafica = page.locator("[data-diretta-overlay]");
  expect(await grafica.getAttribute("src")).toContain("ritardo=20");
  await expect(overlay(page).locator("[data-grafica]")).toHaveAttribute("data-grafica-delay", "20");

  await page.locator("[data-diretta-delay-down]").click();
  await page.locator("[data-diretta-delay-down]").click();
  await page.locator("[data-diretta-delay-down]").click();
  await expect(page.locator("[data-diretta-delay]")).toHaveText("17 s");
  await expect(overlay(page).locator("[data-grafica]")).toHaveAttribute("data-grafica-delay", "17");
  // Cambiare il ritardo non ricarica la grafica: l'indirizzo è lo stesso di prima.
  expect(await grafica.getAttribute("src")).toContain("ritardo=20");

  await page.locator("[data-diretta-delay-up]").click();
  await expect(overlay(page).locator("[data-grafica]")).toHaveAttribute("data-grafica-delay", "18");

  // La scelta resta nel telefono, anche se lo staff cambia il valore di partenza.
  await page.reload();
  await expect(page.locator("[data-diretta-delay]")).toHaveText("18 s");
  await expect(overlay(page).locator("[data-grafica]")).toHaveAttribute("data-grafica-delay", "18");
});

test("su un telefono in verticale la barra si ingrandisce per restare leggibile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");
  const frame = (await page.locator("[data-diretta-overlay]").boundingBox())!;
  expect(frame.width).toBeGreaterThan(300);
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");
  // 180%: la barra occupa circa il 60% della larghezza (su un riquadro largo ne occupa un terzo).
  await expect
    .poll(async () => ((await overlay(page).locator("[data-grafica-bug]").boundingBox())?.width ?? 0) / frame.width, { timeout: 10_000 })
    .toBeGreaterThan(0.55);
  const bug = (await overlay(page).locator("[data-grafica-bug]").boundingBox())!;
  expect(bug.width / frame.width).toBeLessThan(0.65);
  await page.screenshot(shots("diretta-telefono"));
});

test("nel lettore ci sono le due barre, e la larga resta dentro il riquadro anche su un telefono", async ({ page }) => {
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");
  const frame = (await page.locator("[data-diretta-overlay]").boundingBox())!;
  await expect(overlay(page).locator("[data-grafica-bug]")).toBeVisible();
  const wide = overlay(page).locator("[data-grafica-wide]");
  await expect(wide).toBeVisible();
  await expect(overlay(page).locator('[data-grafica-wide-score="home"]')).toHaveText("10");
  // Su un riquadro largo la barra larga è circa il 70% della larghezza, centrata e in basso.
  const box = (await wide.boundingBox())!;
  expect(box.width).toBeGreaterThan(frame.width * 0.55);
  expect(box.width).toBeLessThan(frame.width * 0.75);
  expect(box.x + box.width / 2).toBeCloseTo(frame.x + frame.width / 2, 0);
  expect(box.y).toBeGreaterThan(frame.y + frame.height * 0.7);

  // Su un telefono in verticale (barre ingrandite) non esce dal riquadro: i nomi si accorciano.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const small = (await page.locator("[data-diretta-overlay]").boundingBox())!;
  await expect(overlay(page).locator('[data-grafica-wide-score="home"]')).toHaveText("10");
  await expect
    .poll(async () => {
      const b = await overlay(page).locator("[data-grafica-wide]").boundingBox();
      return b ? b.width / small.width : 0;
    }, { timeout: 10_000 })
    .toBeGreaterThan(0.8);
  const phone = (await overlay(page).locator("[data-grafica-wide]").boundingBox())!;
  expect(phone.x).toBeGreaterThanOrEqual(small.x - 1);
  expect(phone.x + phone.width).toBeLessThanOrEqual(small.x + small.width + 1);
  await page.screenshot(shots("diretta-telefono-barre"));
});

test("lo schermo intero è del riquadro intero (video e punteggio), e si esce con lo stesso pulsante", async ({ page }) => {
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");
  const stage = page.locator("[data-diretta-stage]");
  await expect(stage).not.toHaveAttribute("data-diretta-full", "");
  await page.locator("[data-diretta-fullscreen]").click();
  await expect(stage).toHaveAttribute("data-diretta-full", "");
  await expect(page.locator("[data-diretta-fullscreen]")).toHaveAttribute("aria-label", "Esci dallo schermo intero");
  // Il punteggio è ancora lì, dentro lo stesso riquadro.
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toBeVisible();
  await page.locator("[data-diretta-fullscreen]").click();
  await expect(stage).not.toHaveAttribute("data-diretta-full", "");
});

test("la grafica ritarda il punteggio: la prima lettura si vede subito, le altre dopo il ritardo", async ({ page }) => {
  test.setTimeout(60_000);
  const site = await mockSite(page, { cameras: [] });
  await page.goto("/diretta/grafica?ritardo=4&intervallo=2");
  const home = page.locator('[data-grafica-score="home"]');
  await expect(home).toHaveText("10", { timeout: 10_000 });

  site.score(live(11, 8));
  // Letta entro un paio di secondi, ma mostrata solo dopo il ritardo: per un po' c'è ancora il punteggio di prima.
  await page.waitForTimeout(2_000);
  await expect(home).toHaveText("10");
  await expect(home).toHaveText("11", { timeout: 12_000 });

  // Senza ritardo (come in OBS) la lettura nuova si vede subito.
  const obs = await page.context().newPage();
  const obsSite = await mockSite(obs, { cameras: [] });
  await obs.goto("/diretta/grafica");
  await expect(obs.locator('[data-grafica-score="home"]')).toHaveText("10", { timeout: 10_000 });
  obsSite.score(live(12, 8));
  await expect(obs.locator('[data-grafica-score="home"]')).toHaveText("12", { timeout: 6_000 });
  await obs.close();
});

test("ritardo e scala si cambiano da fuori con un messaggio, e solo dalla stessa pagina", async ({ page }) => {
  await mockSite(page, { cameras: [] });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/diretta/grafica?ritardo=10");
  const main = page.locator("[data-grafica]");
  await expect(main).toHaveAttribute("data-grafica-delay", "10");
  await expect(page.locator("[data-grafica-bug]")).toBeVisible({ timeout: 10_000 });
  expect((await page.locator("[data-grafica-bug]").boundingBox())?.width).toBeCloseTo(640, 0);

  await page.evaluate(() => window.postMessage({ type: "vl-opzioni", ritardo: 0, scala: 150 }, window.location.origin));
  await expect(main).toHaveAttribute("data-grafica-delay", "0");
  await expect.poll(async () => (await page.locator("[data-grafica-bug]").boundingBox())?.width).toBeCloseTo(960, 0);

  // Valori assurdi si ripuliscono: ritardo a 60 al massimo, scala ignorata se fuori dai limiti.
  await page.evaluate(() => window.postMessage({ type: "vl-opzioni", ritardo: 9999, scala: 5 }, window.location.origin));
  await expect(main).toHaveAttribute("data-grafica-delay", "60");
  await expect.poll(async () => (await page.locator("[data-grafica-bug]").boundingBox())?.width).toBeCloseTo(640, 0);
});

test("lo sfondo della grafica sopra il lettore resta trasparente anche con il tema scuro del sito", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vl-theme", "dark"));
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");
  const frameDoc = overlay(page).locator("html");
  await expect(frameDoc).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(overlay(page).locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.waitForTimeout(500);
  await expectOverlayTransparent(page);
});

test("e anche con il tema chiaro", async ({ page }) => {
  await mockSite(page, { cameras: [{ name: "Campo", id: CAMPO }] });
  await page.goto("/diretta");
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");
  await page.waitForTimeout(500);
  await expectOverlayTransparent(page);
});

test("la pagina si può guardare in chiaro: screenshot", async ({ page }) => {
  await mockSite(page, {
    cameras: [
      { name: "Campo", id: CAMPO },
      { name: "Dietro", id: DIETRO },
    ],
  });
  await page.goto("/diretta");
  await expect(overlay(page).locator('[data-grafica-score="home"]')).toHaveText("10");
  await page.waitForTimeout(500);
  await page.screenshot(shots("diretta-chiaro"));
});
