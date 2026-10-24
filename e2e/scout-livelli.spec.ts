import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout, i due livelli: si sceglie quanto segnare prima di ogni partita.
 * «Con ricezioni» aggiunge la striscia della ricezione; il tabellino, il PDF e
 * l'elenco seguono il livello. Le partite segnate prima dei livelli restano
 * «Base», quelle del vecchio livello «Completo» si leggono «Con ricezioni».
 */

// Come in scout.spec.ts: il service worker risponderebbe da sé alle richieste.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

type Level = "base" | "ricezioni";

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra livelli e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");
const rally = (page: Page, n: number) => page.locator(`[data-scout-rally="${n}"]`);
const chip = (page: Page, n: number, kind: string) => rally(page, n).locator(`[data-scout-touch-chip="${kind}"]`);

async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

/** Segna un punto con i pulsanti del livello Base: lato e modo, e poi chi (testo della giocatrice o numero avversario). L'attacco vincente loro non lo chiede: si segna subito. */
async function addPoint(page: Page, button: string, who: { text: string } | { opp: string } | null) {
  await page.locator(`[data-scout-add="${button}"]`).click();
  if (button === "opp-attack") return;
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  if (who === null) await sheet.locator('[data-scout-pick="unknown"]').click();
  else if ("opp" in who) await sheet.locator(`[data-scout-pick="opp-${who.opp}"]`).click();
  else await sheet.locator("[data-scout-pick]", { hasText: who.text }).click();
}

/** La preparazione: due giocatrici, tre numeri avversari e il livello scelto, poi si comincia. */
async function prepare(page: Page, matchId: string, level: Level) {
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await addPlayer(page, "Giulia Bianchi", "4");
  await addPlayer(page, "Sara Rossi", "7");
  await page.getByLabel("Numeri di maglia dell'avversaria").fill("3, 5 8");
  await page.getByLabel("Numeri di maglia dell'avversaria").press("Enter");
  await expect(page.locator('[data-scout-opponent="5"]')).toBeVisible();
  // Di partenza il livello è «Base»; si sceglie quello voluto. Le scelte sono due: «Completo» non c'è più.
  await expect(page.locator("[data-scout-level]")).toHaveCount(2);
  await expect(page.locator('[data-scout-level="completo"]')).toHaveCount(0);
  await expect(page.locator('[data-scout-level="base"]')).toHaveAttribute("aria-checked", "true");
  const choice = page.locator(`[data-scout-level="${level}"]`);
  await choice.click();
  await expect(choice).toHaveAttribute("aria-checked", "true");
  // Sotto, i dettagli del livello: su schermo largo tre colonne, ognuna con il suo titolo sopra il suo elenco (tutti alla stessa altezza).
  const lists = page.locator(`[data-scout-level-details="${level}"] [data-scout-level-list]`);
  await expect(lists).toHaveCount(3);
  const columns = await lists.evaluateAll((elements) =>
    elements.map((element) => {
      const title = element.querySelector("span")!.getBoundingClientRect();
      const items = element.querySelector("ul")!.getBoundingClientRect();
      return { titleX: title.x, titleY: title.y, itemsX: items.x, itemsY: items.y };
    }),
  );
  for (const column of columns) {
    expect(Math.abs(column.titleX - column.itemsX)).toBeLessThan(2);
    expect(column.titleY).toBeLessThan(column.itemsY);
  }
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    expect(new Set(columns.map((column) => Math.round(column.titleY))).size).toBe(1);
    expect(columns[0].titleX).toBeLessThan(columns[1].titleX);
    expect(columns[1].titleX).toBeLessThan(columns[2].titleX);
  }
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
  await expect(page.locator(`[data-scout-level-label="${level}"]`)).toBeVisible();
}

/** Livello «Con ricezioni»: nella striscia aperta si sceglie chi ha ricevuto, la zona (facoltativa) e il voto. */
async function receive(page: Page, who: string, grade: string, zone?: number) {
  const strip = page.locator('[data-scout-reception="open"]');
  await strip.locator("[data-scout-who]", { hasText: who }).click();
  if (zone) {
    await strip.locator("details summary").click();
    await strip.locator(`[data-scout-zone-pick="${zone}"]`).click();
  }
  await strip.locator(`[data-scout-grades="reception"] [data-scout-grade="${grade}"]`).click();
}

async function expectPdf(page: Page, matchId: string) {
  const pdf = await page.request.get(`/api/scout/${matchId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const pdfSet = await page.request.get(`/api/scout/${matchId}/pdf?set=1`);
  expect(pdfSet.status()).toBe(200);
}

test("livello «Con ricezioni»: la striscia della ricezione, l'errore chiude lo scambio e il tabellino ha la ricezione", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Ricezioni "));

  await prepare(page, matchId, "ricezioni");
  // Batte la nostra squadra: la ricezione non c'è, il riquadro lo dice.
  await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();

  // 1) Punto loro (attacco, senza chiedere chi): ora battono loro e la striscia si apre.
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("0–1");
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();
  // Senza dire chi ha ricevuto i voti restano spenti.
  await expect(page.locator('[data-scout-reception="open"] [data-scout-grade="+"]')).toBeDisabled();

  // 2) Ricezione sbagliata di Giulia (=): lo scambio si chiude da solo, punto loro.
  await receive(page, "Giulia B.", "=");
  await expect(score(page)).toHaveText("0–2");
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();

  // 3) Ricezione positiva di Sara in zona 6: lo scambio resta aperto, il punto si segna come sempre.
  await receive(page, "Sara R.", "+", 6);
  await expect(page.locator('[data-scout-reception="done"]')).toContainText("Sara Rossi");
  await expect(page.locator('[data-scout-reception="done"]')).toContainText("zona 6");
  await addPoint(page, "us-attack", { text: "Sara R." });
  await expect(score(page)).toHaveText("1–2");
  // Cambio palla: ora batte la nostra squadra.
  await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();

  // 4) Ancora un punto loro, e una ricezione segnata per sbaglio che si toglie con «Cambia».
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("1–3");
  await receive(page, "Giulia B.", "!");
  await expect(page.locator('[data-scout-reception="done"]')).toBeVisible();
  await page.locator("[data-scout-reception-undo]").click();
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();
  // La stessa cosa con «Annulla ultimo».
  await receive(page, "Giulia B.", "!");
  await page.locator("[data-scout-undo]").click();
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();

  // 5) Ricezione negativa di Giulia e punto nostro.
  await receive(page, "Giulia B.", "-");
  await addPoint(page, "us-attack", { text: "Giulia B." });
  await expect(score(page)).toHaveText("2–3");

  // Il registro mostra i tocchi sotto gli scambi che li hanno.
  await expect(page.locator("[data-scout-rally]")).toHaveCount(5);
  await expect(rally(page, 1).locator("[data-scout-rally-touches]")).toHaveCount(0);
  await expect(chip(page, 2, "reception:=")).toBeVisible();
  await expect(chip(page, 3, "reception:+")).toBeVisible();
  await expect(rally(page, 4).locator("[data-scout-rally-touches]")).toHaveCount(0);
  await expect(chip(page, 5, "reception:-")).toBeVisible();

  // Tutto salvato: ricaricando la pagina c'è ancora, con il livello.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.reload();
  await expect(score(page)).toHaveText("2–3");
  await expect(page.locator('[data-scout-level-label="ricezioni"]')).toBeVisible();
  await expect(chip(page, 3, "reception:+")).toBeVisible();

  // Elenco: la partita porta la targhetta del livello.
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${matchId}"]`)).toContainText("Con ricezioni");

  // Tabellino: targhetta, scheda della ricezione (3 ricezioni, 1 positiva, 1 errore), niente mappe né rotazioni.
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator('[data-scout-level-badge="ricezioni"]')).toBeVisible();
  await expect(page.locator("[data-scout-reception-card]")).toBeVisible();
  const tiles = page.locator("[data-scout-reception-tiles]");
  await expect(tiles).toContainText("1 su 3 ricezioni");
  await expect(tiles).toContainText("33% delle ricezioni");
  await expect(page.locator("[data-scout-reception-row]")).toHaveCount(2);
  await expect(page.locator("[data-scout-zones-card]")).toHaveCount(0);
  await expect(page.locator("[data-scout-rotations-card]")).toHaveCount(0);
  const usTable = page.locator('[data-scout-table="us"]');
  await expect(usTable.locator("thead")).toContainText(/Pos%/i);
  // Gli attacchi tentati non si segnano: nel foglio non ci sono le loro colonne (Attacco ha Err, Mur e Pt); in mezzo, il cambio palla dopo la ricezione.
  await expect(usTable.locator('[data-col="attacco-tot"], [data-col="attacco-pct"]')).toHaveCount(0);
  await expect(usTable.locator('[data-scout-total="us"] [data-col="attacco-pt"]')).toBeVisible();
  await expect(usTable.locator('[data-scout-total="us"] [data-col="ricezione-tot"]')).not.toHaveText("–");
  await expect(page.locator("[data-scout-sideout-by-reception]")).toBeVisible();
  await expectPdf(page, matchId);

  // Stagione: compare la ricezione, e dice su quante partite si basa.
  await page.goto("/admin/scout?vista=stagione");
  await expect(page.locator("[data-scout-season-reception]")).toBeVisible();
  await expect(page.locator("[data-scout-season-note]")).toBeVisible();

  await deleteMatchById(page, matchId);
});

test("livelli: le partite segnate prima restano Base, quelle del vecchio Completo si leggono Con ricezioni, i dati strani si rifiutano", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Vecchia "));

  const put = (data: unknown, baseVersion: number | null) =>
    page.evaluate(
      async ({ matchId, data, baseVersion }) => {
        const response = await fetch(`/api/scout/${matchId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, baseVersion }),
        });
        return { status: response.status, body: (await response.json()) as { version?: number } };
      },
      { matchId, data, baseVersion },
    );
  const read = () =>
    page.evaluate(
      async (id) => ((await (await fetch(`/api/scout/${id}`)).json()) as { scout: { version: number; settings: { level?: string } } }).scout,
      matchId,
    );
  const settings = { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" };
  const attack = (id: string, at: number, actor: "us" | "opp") => ({ type: "rally", id, at, actor, how: "attack", player: null, victim: null });
  const base = Date.now() - 3_600_000;

  // Uno scout salvato prima dei livelli (niente `level` nelle impostazioni) si apre come Base.
  await page.goto("/admin/scout");
  const legacy = await put({ settings, roster: { us: [], opp: [] }, events: [attack("v1", base, "us"), attack("v2", base + 30_000, "opp")], finished: false }, null);
  expect(legacy.status).toBe(200);
  expect((await read()).settings.level).toBe("base");
  await page.goto(`/admin/scout/${matchId}`);
  await expect(score(page)).toHaveText("1–1");
  await expect(page.locator('[data-scout-level-label="base"]')).toBeVisible();
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeVisible();
  await expect(page.locator("[data-scout-reception]")).toHaveCount(0);

  // Uno scout del vecchio livello Completo (ogni tocco) si salva ancora, e si legge come «Con ricezioni»; un livello o un voto inventati no.
  const version = legacy.body.version!;
  const touchEvent = { type: "touch", id: "t1", at: base + 60_000, side: "us", skill: "serve", player: null, grade: "#", zone: null };
  const touchAt = (id: string, at: number, side: "us" | "opp", skill: string, grade: string) => ({ type: "touch", id, at, side, skill, player: null, grade, zone: null });
  const rallyByTouches = [
    touchAt("t2", base + 90_000, "us", "serve", "!"),
    touchAt("t3", base + 91_000, "opp", "reception", "+"),
    touchAt("t4", base + 92_000, "opp", "attack", "="),
  ];
  const full = await put(
    {
      settings: { ...settings, level: "completo" },
      roster: { us: [], opp: [] },
      events: [attack("v1", base, "us"), attack("v2", base + 30_000, "opp"), touchEvent, ...rallyByTouches],
      finished: false,
    },
    version,
  );
  expect(full.status).toBe(200);
  expect((await read()).settings.level).toBe("ricezioni");
  const badLevel = await put({ settings: { ...settings, level: "turbo" }, roster: { us: [], opp: [] }, events: [], finished: false }, full.body.version!);
  expect(badLevel.status).toBe(400);
  const badGrade = await put(
    { settings: { ...settings, level: "completo" }, roster: { us: [], opp: [] }, events: [{ ...touchEvent, grade: "?" }], finished: false },
    full.body.version!,
  );
  expect(badGrade.status).toBe(400);

  // La partita del vecchio Completo si apre a «Con ricezioni», con i punti dati dai tocchi: l'ace e l'attacco loro sbagliato, 3-1.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.locator('[data-scout-level-label="ricezioni"]')).toBeVisible();
  await expect(score(page)).toHaveText("3–1");
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeVisible();
  await expect(chip(page, 4, "attack:=")).toBeVisible();
  // Il tabellino la legge allo stesso modo.
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator('[data-scout-level-badge="ricezioni"]')).toBeVisible();
  await expect(page.locator("[data-scout-result-us]")).toHaveText("0");
  await expect(page.locator('[data-scout-table="us"] [data-scout-total="us"] [data-col="punti-tot"]')).toHaveText("2");
  await expect(page.locator("[data-scout-attack-phases]")).toHaveCount(0);
  await expectPdf(page, matchId);

  await deleteMatchById(page, matchId);
});
