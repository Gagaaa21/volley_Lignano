import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout, i tre livelli: si sceglie quanto segnare prima di ogni partita.
 * «Con ricezioni» aggiunge la striscia della ricezione, «Completo» segue ogni
 * tocco della palla; il tabellino, il PDF e l'elenco seguono il livello, e le
 * partite segnate prima dei livelli restano «Base».
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

type Level = "base" | "ricezioni" | "completo";
type Skill = "serve" | "reception" | "set" | "attack" | "block" | "dig";

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
  // Di partenza il livello è «Base»; si sceglie quello voluto.
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

/** Livello «Completo»: un tocco, con fondamentale, squadra, chi, zona (facoltativa) e voto. */
async function touch(page: Page, t: { skill: Skill; side: "us" | "opp"; who: string; grade: string; zone?: number }) {
  const entry = page.locator("[data-scout-touch-entry]");
  await entry.locator(`[data-scout-skill="${t.skill}"]`).click();
  await entry.locator(`[data-scout-side="${t.side}"]`).click();
  const who = t.side === "opp" ? entry.locator(`[data-scout-who="opp-${t.who}"]`) : entry.locator("[data-scout-who]", { hasText: t.who });
  await who.click();
  if (t.zone) {
    const pick = entry.locator(`[data-scout-zone-pick="${t.zone}"]`);
    if (!(await pick.isVisible())) await entry.locator('details[data-tour="scout-touch-zone"] summary').click();
    await pick.click();
  }
  await entry.locator(`[data-scout-grades="touch"] [data-scout-grade="${t.grade}"]`).click();
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
  await expect(usTable.locator("thead")).not.toContainText(/Eff%/i);
  await expectPdf(page, matchId);

  // Stagione: compare la ricezione, e dice su quante partite si basa.
  await page.goto("/admin/scout?vista=stagione");
  await expect(page.locator("[data-scout-season-reception]")).toBeVisible();
  await expect(page.locator("[data-scout-season-note]")).toBeVisible();

  await deleteMatchById(page, matchId);
});

test("livello «Completo»: ogni tocco, il punto lo dà il voto, si corregge e il tabellino ha mappe e rotazioni", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Completo "));

  await prepare(page, matchId, "completo");
  // Al posto dei pannelli c'è lo «Scambio in corso»; i pulsanti dei punti restano sotto «Falli, sanzioni o solo il punto».
  const entry = page.locator("[data-scout-touch-entry]");
  await expect(entry).toBeVisible();
  await expect(page.locator('[data-scout-skill="serve"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeHidden();
  await expect(page.locator("[data-scout-other-ways]")).toBeVisible();

  // 1) Ace di Giulia: il voto # alla battuta chiude lo scambio → 1-0.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "#" });
  await expect(score(page)).toHaveText("1–0");
  await expect(chip(page, 1, "serve:#")).toBeVisible();

  // 2) Battuta in campo, ricezione positiva loro, attacco loro sbagliato (=) → punto nostro, 2-0. Tre tocchi nello scambio.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "!" });
  await expect(page.locator("[data-scout-pending] [data-scout-touch-chip]")).toHaveCount(1);
  // Lo Scout propone da solo la ricezione dell'altra squadra.
  await expect(page.locator('[data-scout-skill="reception"]')).toHaveAttribute("data-scout-suggested", "true");
  await touch(page, { skill: "reception", side: "opp", who: "5", grade: "+" });
  await expect(page.locator('[data-scout-skill="attack"]')).toHaveAttribute("data-scout-suggested", "true");
  await touch(page, { skill: "attack", side: "opp", who: "5", grade: "=" });
  await expect(score(page)).toHaveText("2–0");
  await expect(rally(page, 2).locator("[data-scout-touch-chip]")).toHaveCount(3);

  // 3) Battuta sbagliata di Giulia (=) → punto loro, 2-1, e ora battono loro.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "=" });
  await expect(score(page)).toHaveText("2–1");

  // 4) Battono loro: ricezione di Giulia in zona 6, alzata di Sara, attacco di Sara in zona 4 e punto → cambio palla, 3-1.
  await touch(page, { skill: "serve", side: "opp", who: "8", grade: "!" });
  await touch(page, { skill: "reception", side: "us", who: "Giulia B.", grade: "+", zone: 6 });
  await touch(page, { skill: "set", side: "us", who: "Sara R.", grade: "+" });
  await touch(page, { skill: "attack", side: "us", who: "Sara R.", grade: "#", zone: 4 });
  await expect(score(page)).toHaveText("3–1");
  await expect(rally(page, 4).locator("[data-scout-touch-chip]")).toHaveCount(4);

  // 5) «Annulla ultimo» toglie l'ultimo tocco, non tutto lo scambio.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "!" });
  await expect(page.locator("[data-scout-pending] [data-scout-touch-chip]")).toHaveCount(1);
  await page.locator("[data-scout-undo]").click();
  await expect(page.locator("[data-scout-pending] [data-scout-touch-chip]")).toHaveCount(0);
  await expect(score(page)).toHaveText("3–1");

  // 6) Per un fallo o se si perde il filo: i pulsanti dei punti, con il tocco già segnato che resta.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "!" });
  await page.locator("[data-scout-other-ways] summary").click();
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("3–2");
  await expect(chip(page, 5, "serve:!")).toBeVisible();
  await expect(page.locator("[data-scout-rally]")).toHaveCount(5);

  // 7) Si corregge lo scambio 4: ricezione da positiva a neutra, e si toglie l'alzata.
  await page.getByLabel("Correggi lo scambio 4", { exact: true }).click();
  const dialog = page.locator('[data-scout-sheet="edit"]');
  await expect(dialog.locator("[data-scout-touch-edit]")).toHaveCount(4);
  await expect(dialog).toContainText("Lo scambio è finito con l'ultimo tocco");
  await dialog.getByLabel("Voto: Ricezione").selectOption("!");
  await dialog.getByLabel("Togli il tocco: Alzata").click();
  await expect(dialog.locator("[data-scout-touch-edit]")).toHaveCount(3);
  await dialog.locator("[data-scout-edit-save]").click();
  await expect(chip(page, 4, "reception:!")).toBeVisible();
  await expect(chip(page, 4, "set:+")).toHaveCount(0);
  await expect(rally(page, 4).locator("[data-scout-touch-chip]")).toHaveCount(3);
  await expect(score(page)).toHaveText("3–2");

  // Tutto salvato: ricaricando c'è ancora.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.reload();
  await expect(score(page)).toHaveText("3–2");
  await expect(chip(page, 4, "reception:!")).toBeVisible();
  await expect(page.locator('[data-scout-level-label="completo"]')).toBeVisible();

  // Si può tornare al Base anche a partita iniziata: i pulsanti dei punti tornano, quello già segnato resta.
  await page.locator("[data-scout-open-setup]").click();
  await page.locator('[data-scout-sheet="setup"] [data-scout-level="base"]').click();
  await page.locator('[data-scout-sheet="setup"]').getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator('[data-scout-level-label="base"]')).toBeVisible();
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeVisible();
  await expect(page.locator("[data-scout-touch-entry]")).toHaveCount(0);
  await expect(chip(page, 4, "reception:!")).toBeVisible();

  // Tabellino: i tocchi segnati contano anche se il livello è stato rimesso a Base; mappe e rotazioni ci sono.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator('[data-scout-level-badge="completo"]')).toBeVisible();
  await expect(page.locator("[data-scout-reception-card]")).toBeVisible();
  await expect(page.locator("[data-scout-zones-card]")).toBeVisible();
  await expect(page.locator("[data-scout-rotations-card]")).toBeVisible();
  const usTable = page.locator('[data-scout-table="us"]');
  await expect(usTable.locator("thead")).toContainText(/Eff%/i);
  const sara = usTable.locator("[data-scout-player-row]", { hasText: "Sara Rossi" });
  await expect(sara.locator("td").nth(2)).toHaveText("1"); // un solo punto: l'attacco vincente dello scambio 4
  await expectPdf(page, matchId);

  await deleteMatchById(page, matchId);
});

test("livello «Completo»: l'attacco loro non chiede chi (i voti sono subito attivi), il nostro sì", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Completo senza chi "));

  await prepare(page, matchId, "completo");
  const entry = page.locator("[data-scout-touch-entry]");
  const grade = (g: string) => entry.locator(`[data-scout-grades="touch"] [data-scout-grade="${g}"]`);

  // Battuta in campo e ricezione loro: lo Scout propone da solo l'attacco loro.
  await touch(page, { skill: "serve", side: "us", who: "Giulia B.", grade: "!" });
  await touch(page, { skill: "reception", side: "opp", who: "5", grade: "+" });
  const attack = entry.locator('[data-scout-skill="attack"]');
  await expect(attack).toHaveAttribute("data-scout-suggested", "true");
  await expect(attack).toHaveAttribute("aria-pressed", "true");
  await expect(entry.locator('[data-scout-side="opp"]')).toHaveAttribute("aria-pressed", "true");

  // Non si sceglie nessuno: «Non so» è già scelto e il voto è attivo. Un attacco a terra (#) dà il punto loro.
  await expect(entry.locator('[data-scout-who="unknown"]')).toHaveAttribute("aria-pressed", "true");
  await expect(grade("#")).toBeEnabled();
  await grade("#").click();
  await expect(score(page)).toHaveText("0–1");
  await expect(rally(page, 1).locator("[data-scout-touch-chip]")).toHaveCount(3);
  await expect(rally(page, 1)).toContainText("Squadra");

  // L'attacco nostro invece chiede chi: finché non si sceglie, i voti restano spenti.
  await attack.click();
  await entry.locator('[data-scout-side="us"]').click();
  await expect(grade("#")).toBeDisabled();
  await entry.locator("[data-scout-who]", { hasText: "Sara R." }).click();
  await expect(grade("#")).toBeEnabled();

  // Tutto salvato prima di lasciare la pagina (altrimenti il suo avviso «modifiche non salvate» si prende la conferma dell'eliminazione).
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test("livelli: le partite segnate prima restano Base, il livello si salva con la partita e i dati strani si rifiutano", async ({ page }) => {
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
  await expect(page.locator("[data-scout-touch-entry]")).toHaveCount(0);

  // Il livello e i tocchi si salvano; un livello o un voto inventati no.
  const version = legacy.body.version!;
  const touchEvent = { type: "touch", id: "t1", at: base + 60_000, side: "us", skill: "serve", player: null, grade: "#", zone: null };
  const full = await put(
    { settings: { ...settings, level: "completo" }, roster: { us: [], opp: [] }, events: [attack("v1", base, "us"), attack("v2", base + 30_000, "opp"), touchEvent], finished: false },
    version,
  );
  expect(full.status).toBe(200);
  expect((await read()).settings.level).toBe("completo");
  const badLevel = await put({ settings: { ...settings, level: "turbo" }, roster: { us: [], opp: [] }, events: [], finished: false }, full.body.version!);
  expect(badLevel.status).toBe(400);
  const badGrade = await put(
    { settings: { ...settings, level: "completo" }, roster: { us: [], opp: [] }, events: [{ ...touchEvent, grade: "?" }], finished: false },
    full.body.version!,
  );
  expect(badGrade.status).toBe(400);

  // La partita salvata con il livello Completo si apre così, e l'ace segnato come tocco ha dato il punto: 2-1.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.locator('[data-scout-level-label="completo"]')).toBeVisible();
  await expect(score(page)).toHaveText("2–1");

  await deleteMatchById(page, matchId);
});
