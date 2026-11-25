import { expect, test } from "@playwright/test";
import { loginAsDev } from "./helpers";

/**
 * La pulsantiera della diretta (/admin/scout/pulsantiera) e le sue scritte nella grafica (/diretta/grafica): un tocco salva la
 * scritta, la grafica la mostra al centro e la toglie da sola; quella già presente quando si apre la grafica non riparte; i suoni
 * caricati si servono come audio e si tolgono. Solo la scritta: mai una giocatrice.
 */

test.use({ serviceWorkers: "block" });

const LIVE = {
  team: "u14u15",
  category: "U14",
  home: { name: "Volley Lignano", color: "#1c5bae", score: 14, sets: 1 },
  away: { name: "Avversarie", color: "#c0392b", score: 11, sets: 0 },
  serving: "home",
  sets: [{ home: 25, away: 19 }],
  timeouts: { home: 0, away: 1 },
  finished: false,
  updatedAt: "2026-11-21T15:30:00.000Z",
};

type Cue = { id: string; kind: string; age: number; sound: number | null };

/** Un file WAV vero e piccolissimo (mezzo secondo di silenzio a 8 kHz). */
function wav(): Buffer {
  const samples = 4000;
  const buffer = Buffer.alloc(44 + samples);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(8000, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples, 40);
  buffer.fill(128, 44);
  return buffer;
}

test("grafica: la scritta della pulsantiera entra al centro ed esce da sola; quella di prima non riparte", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const state: { cue: Cue | null } = { cue: { id: "di-prima", kind: "ace", age: 2000, sound: null } };
  await page.route(/\/api\/livescore\/pubblico/, (route) => route.fulfill({ json: { live: LIVE, cue: state.cue, cueSounds: {} } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator("main")).toHaveAttribute("data-grafica", "live");
  // Quella che c'era già quando si è aperta la grafica non riparte.
  await page.waitForTimeout(2500);
  await expect(page.locator("[data-grafica-cue]")).toHaveCount(0);

  state.cue = { id: "nuova", kind: "monsterBlock", age: 300, sound: null };
  const cue = page.locator('[data-grafica-cue="monsterBlock"]');
  await expect(cue).toBeVisible({ timeout: 5000 });
  await expect(cue).toContainText("MONSTER");
  await expect(cue).toContainText("BLOCK");
  // Solo la scritta: nessun numero di maglia né nome.
  expect(await cue.innerText()).not.toMatch(/\d/);
  // Esce da sola dopo pochi secondi, e la stessa scritta riletta non riparte.
  await expect(cue).toHaveCount(0, { timeout: 7000 });
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-grafica-cue]")).toHaveCount(0);
});

test("grafica senza partita in diretta: la scritta arriva lo stesso in pochi secondi (prima si rileggeva ogni 15)", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const state: { cue: Cue | null } = { cue: null };
  await page.route(/\/api\/livescore\/pubblico/, (route) => route.fulfill({ json: { live: null, cue: state.cue, cueSounds: {} } }));
  await page.goto("/diretta/grafica");
  await expect(page.locator("main")).toHaveAttribute("data-grafica", "idle");
  await page.waitForTimeout(1500);
  state.cue = { id: "a-casa", kind: "ace", age: 200, sound: null };
  // Senza il campanello in tempo reale (qui non c'è Supabase) la grafica rilegge ogni 5 secondi: arriva entro 6.
  await expect(page.locator('[data-grafica-cue="ace"]')).toBeVisible({ timeout: 6500 });
});

test("pulsantiera: un tocco manda la scritta, i suoni si caricano, si servono come audio e si tolgono", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await page.goto("/admin/scout/pulsantiera");
  await page.locator('[data-cue-button="ace"]').click();
  await expect(page.locator("[data-pulsantiera-message]")).toContainText("In onda: Ace");
  await expect(page.locator('[data-cue-button="ace"]')).toHaveAttribute("data-cue-live", "");
  const reading = await (await page.request.get("/api/livescore/pubblico?regia=1")).json();
  expect(reading.cue).toMatchObject({ kind: "ace", sound: null });
  expect(Object.keys(reading.cue).sort()).toEqual(["age", "id", "kind", "sound"]);
  // La lettura leggera che la grafica fa quando suona il campanello: la stessa scritta, nessuna copia della rete.
  const light = await page.request.get("/api/diretta/scritta");
  expect(light.headers()["cache-control"]).toBe("no-store");
  const lightReading = await light.json();
  expect(lightReading.cue).toMatchObject({ id: reading.cue.id, kind: "ace", sound: null });
  expect(Object.keys(lightReading).sort()).toEqual(["cue", "cueSounds"]);

  // Il suono del tasto: l'Ace è solo animazione; si carica un file, lo si scarica come audio, poi lo si toglie e torna muto.
  await page.locator("[data-pulsantiera-sounds] summary").click();
  const row = page.locator('[data-sound-row="ace"]');
  await expect(row.locator("[data-sound-source]")).toHaveText("Solo animazione, senza suono");
  await expect(row.locator("[data-sound-play]")).toBeDisabled();
  await expect(page.locator('[data-sound-row="monsterBlock"] [data-sound-source]')).toHaveText("Suono originale");
  const file = wav();
  await row.locator("[data-sound-file]").setInputFiles({ name: "jingle.wav", mimeType: "audio/wav", buffer: file });
  await expect(row.locator("[data-sound-source]")).toHaveText("Il tuo file");
  const after = await (await page.request.get("/api/livescore/pubblico?regia=1")).json();
  const version = after.cueSounds.ace as number;
  expect(version).toBeGreaterThan(0);
  const sound = await page.request.get(`/api/diretta/suono/ace?v=${version}`);
  expect(sound.status()).toBe(200);
  expect(sound.headers()["content-type"]).toBe("audio/wav");
  expect(sound.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await sound.body()).length).toBe(file.length);

  await row.locator("[data-sound-remove]").click();
  await expect(row.locator("[data-sound-source]")).toHaveText("Solo animazione, senza suono");
  expect((await page.request.get(`/api/diretta/suono/ace?v=${version}`)).status()).toBe(404);

  // Un file che non è audio si rifiuta.
  await row.locator("[data-sound-file]").setInputFiles({ name: "pagina.html", mimeType: "text/html", buffer: Buffer.from("<h1>no</h1>") });
  await expect(page.locator("[data-pulsantiera-message]")).toContainText("Formato non riconosciuto");
  // Un tipo di tasto inventato non ha suono.
  expect((await page.request.get("/api/diretta/suono/inventato?v=1")).status()).toBe(404);
});

test("pulsantiera: dalla scheda Diretta video si apre la pagina, e senza accesso non si entra", async ({ page, browser }) => {
  await loginAsDev(page);
  await page.goto("/admin/scout");
  // La scheda Diretta video è chiusa finché non ci sono link salvati: si apre toccandone il titolo.
  const card = page.locator("[data-diretta-card]");
  if (!(await card.evaluate((el) => (el as HTMLDetailsElement).open))) await card.locator("summary").click();
  await card.locator("[data-diretta-pulsantiera]").click();
  await expect(page).toHaveURL(/\/admin\/scout\/pulsantiera/);
  await expect(page.locator("[data-cue-button]")).toHaveCount(6);
  // Senza accesso: rimanda al login.
  const anonymous = await browser.newPage();
  await anonymous.goto(new URL("/admin/scout/pulsantiera", page.url()).href);
  await expect(anonymous).toHaveURL(/\/login/);
  await anonymous.close();
});
