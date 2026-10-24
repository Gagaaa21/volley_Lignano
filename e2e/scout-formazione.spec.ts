import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout: la formazione in campo (facoltativa, come nel Live score) e le fasi
 * di gioco. Con la formazione lo Scout ruota da solo, fa entrare la libero,
 * propone chi batte e conta i cambi; senza, funziona come prima. Con i tocchi
 * dice sempre di chi è il turno e quale fase viene adesso.
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
  await page.getByLabel("Luogo della partita").fill("Palestra formazione e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");

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

/** Sceglie in un menù la giocatrice con quel numero di maglia (le voci sono «9 · Anna V.»). */
async function chooseNumber(select: Locator, number: string) {
  const value = await select.locator("option", { hasText: new RegExp(`^${number} ·`) }).first().getAttribute("value");
  expect(value, `nel menù non c'è la giocatrice n. ${number}`).toBeTruthy();
  await select.selectOption(value!);
}

/** La rosa di prova: sei titolari, la libero e due riserve. */
const ROSTER: [string, string][] = [
  ["Anna Verdi", "9"],
  ["Bea Neri", "2"],
  ["Carla Bruni", "5"],
  ["Dora Gallo", "7"],
  ["Elena Costa", "11"],
  ["Fede Riva", "14"],
  ["Giada Conti", "1"],
  ["Hilda Fonte", "3"],
  ["Irene Lupi", "10"],
];

/** Posizioni 1…6 di partenza: nostre (numeri di maglia) e loro. */
const US_START = ["9", "2", "5", "7", "11", "14"];
const OPP_START = ["21", "22", "23", "24", "25", "26"];

/**
 * La preparazione: la rosa, la formazione in campo (libero n. 1, centrali 5 e 14)
 * e il livello scelto; poi si comincia.
 */
async function prepare(page: Page, matchId: string, level: Level) {
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  for (const [name, number] of ROSTER) await addPlayer(page, name, number);

  const card = page.locator("[data-scout-lineup]");
  await expect(card).toContainText("Formazione in campo");
  for (const [index, number] of US_START.entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
  for (const [index, number] of OPP_START.entries()) await card.locator(`[data-scout-lineup-cell="opp-${index + 1}"]`).fill(number);
  await chooseNumber(card.locator("#scout-lineup-us-libero"), "1");
  await chooseNumber(card.locator("#scout-lineup-us-host1"), "5");
  await chooseNumber(card.locator("#scout-lineup-us-host2"), "14");
  // Anche su schermo largo le sei caselle sono larghe uguali (la fila a rete non è più stretta): i nomi si leggono.
  const front = await card.locator('[data-scout-lineup-cell="us-3"]').boundingBox();
  const back = await card.locator('[data-scout-lineup-cell="us-6"]').boundingBox();
  expect(Math.abs(front!.width - back!.width)).toBeLessThan(2);
  expect(front!.width).toBeGreaterThan(150);
  await card.locator("[data-scout-lineup-confirm]").click();
  await expect(card.locator("[data-scout-lineup-done]")).toBeVisible();

  await page.locator(`[data-scout-level="${level}"]`).click();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
}

const strip = (page: Page) => page.locator("[data-scout-court-strip]");
/** Da che parte del campo è la palla: nella fascia sopra i pulsanti e sul tabellone. */
async function expectBall(page: Page, side: "us" | "opp", phase?: string) {
  await expect(page.locator("[data-scout-ball]")).toHaveAttribute("data-scout-ball-side", side);
  await expect(page.locator(`[data-scout-board-ball="${side}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-scout-board-ball="${side === "us" ? "opp" : "us"}"]`)).toHaveCount(0);
  await expect(page.locator("[data-scout-ball]")).toContainText(side === "us" ? "Palla nostra" : "Palla loro");
  if (phase) await expect(page.locator("[data-scout-ball]")).toContainText(phase);
}
/** Una posizione della nostra metà campo, nella striscia «In campo». */
const usSpot = (page: Page, position: number) => strip(page).locator(`[data-scout-court="us"] [data-scout-court-position="${position}"]`);
const oppSpot = (page: Page, position: number) => strip(page).locator(`[data-scout-court="opp"] [data-scout-court-position="${position}"]`);

/** Dove sta ogni posizione nel campo della finestra «chi?» (il centro della casella, nella finestra del browser). */
async function spotCenters(sheet: Locator): Promise<Record<number, { x: number; y: number }>> {
  return sheet.locator("[data-scout-spot]").evaluateAll((elements) =>
    Object.fromEntries(
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return [Number(element.getAttribute("data-scout-spot")), { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
      }),
    ),
  );
}

test("«chi?» si sceglie dal campo: rete in alto, 4-3-2 davanti e 5-6-1 dietro, la libero spenta a muro, chi batte, la panchina e il loro campo", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Campo chi "));
  await prepare(page, matchId, "base");

  // Muro nostro: il nostro campo. Davanti 4-3-2 (n. 7, 5, 2), dietro 5-6-1 (n. 11, la libero n. 1 al posto della 14, e la 9 che batte).
  await page.locator('[data-scout-add="us-block"]').click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  const court = sheet.locator("[data-scout-court-picker='us']");
  await expect(court).toBeVisible();
  await expect(court).toContainText("Rete");
  await expect(court).toContainText("linea dei 3 m");
  const c = await spotCenters(sheet);
  expect(Object.keys(c).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  // Una fila sopra l'altra, da sinistra a destra come si vedono: 4 3 2 davanti, 5 6 1 dietro; ognuna sotto la sua.
  for (const [front, back] of [[4, 5], [3, 6], [2, 1]]) {
    expect(Math.abs(c[front].x - c[back].x), `la ${back} non sta sotto la ${front}`).toBeLessThan(2);
    expect(c[front].y, `la ${front} non è davanti alla ${back}`).toBeLessThan(c[back].y);
  }
  expect(c[4].x).toBeLessThan(c[3].x);
  expect(c[3].x).toBeLessThan(c[2].x);
  expect(Math.abs(c[4].y - c[3].y)).toBeLessThan(2);
  expect(Math.abs(c[5].y - c[1].y)).toBeLessThan(2);
  await expect(sheet.locator('[data-scout-spot="4"]')).toContainText("7");
  await expect(sheet.locator('[data-scout-spot="3"]')).toContainText("5");
  await expect(sheet.locator('[data-scout-spot="2"]')).toContainText("2");
  await expect(sheet.locator('[data-scout-spot="5"]')).toContainText("11");
  await expect(sheet.locator('[data-scout-spot="1"]')).toContainText("9");
  // La libero (n. 1, al posto della centrale in seconda linea) c'è, ma a muro non si sceglie.
  const libero = sheet.locator('[data-scout-spot="6"]');
  await expect(libero).toContainText("libero");
  await expect(libero).toHaveAttribute("aria-disabled", "true");
  await expect(sheet.locator('[data-scout-spot="6"][data-scout-pick]')).toHaveCount(0);
  await expect(sheet).toContainText("A muro vanno solo le giocatrici davanti");
  // Chi batte ha il pallone verde. Chi è in panchina sta sotto (anche la centrale sostituita dalla libero).
  await expect(sheet.locator('[data-scout-spot="1"]').getByLabel("Batte")).toBeVisible();
  await expect(sheet.locator('[data-scout-spot] [aria-label="Batte"]')).toHaveCount(1);
  await expect(sheet.locator("[data-scout-bench] [data-scout-pick]")).toHaveCount(3);
  await expect(sheet.locator("[data-scout-bench]")).toContainText("Hilda");
  await expect(sheet.locator("[data-scout-bench]")).toContainText("Irene");
  await expect(sheet.locator("[data-scout-bench]")).toContainText("Fede");
  // Muro della n. 5 (posizione 3), poi chi attaccava: il loro campo (21…26 nelle posizioni 1…6), tutte da scegliere.
  await sheet.locator('[data-scout-spot="3"]').click();
  await expect(page.getByRole("dialog", { name: "Chi attaccava?" })).toBeVisible();
  const theirs = page.locator("[data-scout-court-picker='opp']");
  await expect(theirs).toBeVisible();
  const o = await spotCenters(page.locator("[data-scout-sheet^='player']"));
  expect(o[4].y).toBeLessThan(o[5].y);
  expect(Math.abs(o[4].x - o[5].x)).toBeLessThan(2);
  await expect(theirs.locator('[data-scout-spot="4"]')).toContainText("24");
  await expect(theirs.locator('[data-scout-spot="1"]')).toContainText("21");
  await expect(theirs.locator("[data-scout-pick][data-scout-on-court]")).toHaveCount(6);
  await expect(theirs).not.toContainText("libero");
  await expect(theirs.getByLabel("Batte")).toHaveCount(0);
  await theirs.locator('[data-scout-spot="4"]').click();
  await expect(score(page)).toHaveText("1–0");
  await expect(page.locator('[data-scout-rally="1"]')).toContainText("su n. 24");

  // Ace nostro: è di chi batte (n. 9, posizione 1) e si segna da solo, senza chiedere «chi?».
  const last = page.locator("[data-scout-last]");
  await page.locator('[data-scout-add="us-ace"]').click();
  await expect(score(page)).toHaveText("2–0");
  await expect(sheet).toHaveCount(0);
  await expect(last).toContainText("Ace");
  await expect(last).toContainText("Anna");
  await expect(page.locator('[data-scout-rally="2"]')).toContainText("Anna");
  // Non era lei? «Cambia» apre il campo com'era in quello scambio (il pallone su chi batteva): si tocca chi è stata.
  await last.locator("[data-scout-serve-change]").click();
  await sheet.waitFor();
  await expect(sheet).toContainText("Ace: chi è stata?");
  await expect(sheet.locator('[data-scout-spot="1"]').getByLabel("Batte")).toBeVisible();
  await expect(sheet).not.toContainText("A muro vanno solo");
  await sheet.locator('[data-scout-spot="2"]').click();
  await expect(sheet).toHaveCount(0);
  await expect(score(page)).toHaveText("2–0");
  await expect(last).toContainText("Bea");
  await expect(page.locator('[data-scout-rally="2"]')).toContainText("Bea");
  await expect(page.locator('[data-scout-rally="2"]')).not.toContainText("Anna");

  // Loro hanno la battuta solo quando fanno punto (e ruotano): il loro ace è della loro nuova posizione 1, la n. 22.
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("2–1");
  await page.locator('[data-scout-add="opp-ace"]').click();
  await expect(score(page)).toHaveText("2–2");
  await expect(sheet).toHaveCount(0);
  await expect(last).toContainText("n. 22");
  await last.locator("[data-scout-serve-change]").click();
  await sheet.waitFor();
  await expect(sheet.locator("[data-scout-court-picker='opp'] [data-scout-spot='1']").getByLabel("Batte")).toBeVisible();
  await expect(sheet.locator("[data-scout-court-picker='opp'] [data-scout-spot='1']")).toContainText("22");
  await sheet.getByRole("button", { name: "Chiudi" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(last).toContainText("n. 22");
  // Anche la loro battuta sbagliata va a chi batte.
  await page.locator('[data-scout-add="us-error"]').click();
  await page.locator('[data-scout-error="serveError"]').click();
  await expect(score(page)).toHaveText("3–2");
  await expect(sheet).toHaveCount(0);
  await expect(last).toContainText("Battuta sbagliata");
  await expect(last).toContainText("n. 22");
  // Battiamo noi: un ace loro non torna, e allora «chi?» si chiede come sempre (e senza «Cambia» dopo).
  await page.locator('[data-scout-add="opp-ace"]').click();
  await sheet.waitFor();
  await sheet.locator("[data-scout-court-picker='opp'] [data-scout-spot='3']").click();
  await expect(score(page)).toHaveText("3–3");
  await expect(last.locator("[data-scout-serve-change]")).toHaveCount(0);

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test("formazione in campo: rotazioni, libero, chi batte, cambi con avvertimento, set dopo set e tabellino", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Formazione "));

  await prepare(page, matchId, "base");

  // In partenza: la nostra n. 9 batte (pallone verde), la libero n. 1 è al posto della centrale 14 in seconda linea (posizione 6).
  await expect(strip(page)).toBeVisible();
  await expect(strip(page)).toContainText("1ª rot.");
  await expect(usSpot(page, 1)).toContainText("9");
  await expect(usSpot(page, 1).getByLabel("Batte")).toBeVisible();
  await expect(usSpot(page, 6)).toContainText("1");
  await expect(usSpot(page, 6)).toContainText("libero");
  await expect(usSpot(page, 6)).toHaveAttribute("title", /libero/);
  await expect(oppSpot(page, 1)).toContainText("21");
  await expect(strip(page)).toContainText("Cambi 0/8");

  // La palla è dalla parte di chi batte: all'inizio è nostra.
  await expectBall(page, "us", "Battuta");

  // 1) Punto loro (attacco, senza chiedere chi): conquistano la battuta e ruotano.
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("0–1");
  await expectBall(page, "opp", "Battuta");
  await expect(strip(page)).toContainText(/Loro\s*2ª rot\./);
  await expect(strip(page)).toContainText(/Noi\s*1ª rot\./);
  await expect(oppSpot(page, 1)).toContainText("22");
  await expect(oppSpot(page, 1).getByLabel("Batte")).toBeVisible();

  // 2) Punto nostro: «chi» si sceglie dal campo, con la posizione di ognuna, e la panchina sotto.
  await page.locator('[data-scout-add="us-attack"]').click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  await expect(sheet.locator("[data-scout-court-picker='us']")).toBeVisible();
  await expect(sheet.locator('[data-scout-pick][data-scout-on-court="1"]')).toContainText("Anna");
  await expect(sheet.locator("[data-scout-pick]", { hasText: "Hilda" })).not.toHaveAttribute("data-scout-on-court", /.*/);
  await expect(sheet.locator("[data-scout-bench] [data-scout-pick]", { hasText: "Hilda" })).toBeVisible();
  await sheet.locator("[data-scout-pick]", { hasText: "Anna" }).click();
  await expect(score(page)).toHaveText("1–1");
  await expectBall(page, "us", "Battuta");
  // Riconquistiamo la battuta e ruotiamo: batte la n. 2 e la centrale 14 è in posizione 5, dove adesso c'è la libero.
  await expect(strip(page)).toContainText(/Noi\s*2ª rot\./);
  await expect(usSpot(page, 1)).toContainText("2");
  await expect(usSpot(page, 1).getByLabel("Batte")).toBeVisible();
  await expect(usSpot(page, 5)).toContainText("libero");
  await expect(usSpot(page, 6)).not.toContainText("libero");

  // 3) Chi batte e vince tiene la battuta: nessuna rotazione.
  await addPoint(page, "us-attack", { text: "Bea" });
  await expect(score(page)).toHaveText("2–1");
  await expect(strip(page)).toContainText(/Noi\s*2ª rot\./);

  // 4) Un cambio: esce la n. 2 (posizione 1), entra la n. 3 dalla panchina.
  const subSheet = page.locator('[data-scout-sheet="sub"]');
  await page.locator('[data-scout-sub-open="us"]').click();
  await expect(subSheet).toContainText("cambi fatti: 0 su 8");
  await expect(subSheet.locator("[data-scout-sub-confirm]")).toBeDisabled();
  await subSheet.locator('[data-scout-sub-out="1"]').click();
  await subSheet.locator("[data-scout-sub-in]", { hasText: "Hilda" }).click();
  await expect(subSheet.locator("[data-scout-sub-warning]")).toHaveCount(0);
  await subSheet.locator("[data-scout-sub-confirm]").click();
  await expect(subSheet).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("3");
  await expect(strip(page)).toContainText("Cambi 1/8");

  // 5) Un cambio che non è regolare: la riserva appena entrata può uscire solo per chi ha sostituito. Avvisa, ma non vieta.
  await page.locator('[data-scout-sub-open="us"]').click();
  await subSheet.locator('[data-scout-sub-out="1"]').click();
  await subSheet.locator("[data-scout-sub-in]", { hasText: "Irene" }).click();
  await expect(subSheet.locator("[data-scout-sub-warning]")).toContainText("può essere sostituita solo da lei");
  await expect(subSheet.locator("[data-scout-sub-confirm]")).toBeEnabled();
  await subSheet.getByRole("button", { name: "Annulla" }).click();
  await expect(subSheet).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("3");

  // 5b) La titolare uscita può rientrare, ma solo al posto di chi l'ha sostituita: Bea (n. 2) è segnata «rientra» e,
  // scegliendola, «Chi esce» passa da solo alla sua sostituta (Hilda, n. 3, in posizione 1), senza nessun avvertimento.
  await page.locator('[data-scout-sub-open="us"]').click();
  const comeBack = subSheet.locator("[data-scout-sub-reentry-chip]");
  await expect(comeBack).toHaveCount(1);
  await expect(comeBack).toContainText("rientra");
  await expect(subSheet.locator("[data-scout-sub-in]", { hasText: "Irene" })).not.toHaveAttribute("data-scout-sub-reentry-chip", "");
  await comeBack.click();
  await expect(subSheet.locator('[data-scout-sub-out="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(subSheet.locator("[data-scout-sub-reentry]")).toContainText("Rientra al posto di");
  await expect(subSheet.locator("[data-scout-sub-reentry]")).toContainText("posizione 1");
  await expect(subSheet.locator("[data-scout-sub-warning]")).toHaveCount(0);
  // Se invece esce un'altra, la titolare non rientra al suo posto: avvisa.
  await subSheet.locator('[data-scout-sub-out="2"]').click();
  await expect(subSheet.locator("[data-scout-sub-warning]")).toContainText("solo al posto di chi l'ha sostituita");
  await subSheet.getByRole("button", { name: "Annulla" }).click();
  await expect(subSheet).toHaveCount(0);

  // 6) «Annulla ultimo» toglie anche il cambio: torna in campo la n. 2.
  await page.locator("[data-scout-undo]").click();
  await expect(usSpot(page, 1)).toContainText("2");
  await expect(strip(page)).toContainText("Cambi 0/8");
  // Si rifà il cambio, perché resti nel tabellino.
  await page.locator('[data-scout-sub-open="us"]').click();
  await subSheet.locator('[data-scout-sub-out="1"]').click();
  await subSheet.locator("[data-scout-sub-in]", { hasText: "Hilda" }).click();
  await subSheet.locator("[data-scout-sub-confirm]").click();
  await expect(usSpot(page, 1)).toContainText("3");

  // Tutto salvato: ricaricando, la formazione c'è ancora (anche il cambio).
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.reload();
  await expect(score(page)).toHaveText("2–1");
  await expect(usSpot(page, 1)).toContainText("3");
  await expect(strip(page)).toContainText("Cambi 1/8");

  // 7) Si chiude il 1° set: il 2° riparte dalla formazione di partenza (la n. 9 in battuta, non la riserva né la rotazione fatta).
  await page.getByRole("button", { name: "Chiudi il set adesso" }).click();
  await page.locator("[data-scout-close-set]").click();
  await expect(page.locator("[data-scout-set-end]")).toHaveCount(0);
  await expect(score(page)).toHaveText("0–0");
  for (const [index, number] of US_START.entries()) {
    const position = index + 1;
    // La libero è al posto della centrale 14 in posizione 6; negli altri posti ci sono le titolari di partenza.
    await expect(usSpot(page, position)).toContainText(position === 6 ? "1" : number);
  }
  await expect(strip(page)).toContainText(/Noi\s*1ª rot\./);
  await expect(strip(page)).toContainText(/Loro\s*1ª rot\./);
  await expect(strip(page)).toContainText("Cambi 0/8");
  // La battuta si alterna: nel 2° set batte l'avversaria, con la n. 21.
  await expect(oppSpot(page, 1).getByLabel("Batte")).toBeVisible();
  await expect(oppSpot(page, 1)).toContainText("21");

  // Tabellino: formazioni di partenza e cambi del 1° set, anche nel PDF.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  const lineups = page.locator("[data-scout-lineups-card]");
  await expect(lineups).toBeVisible();
  const usRow = lineups.locator('[data-scout-lineup-row="1-us"]');
  await expect(usRow).toContainText("Volley Lignano");
  for (const number of US_START) await expect(usRow).toContainText(number);
  await expect(usRow.locator("td").last()).toHaveText("1");
  await expect(lineups.locator('[data-scout-lineup-row="1-opp"]')).toContainText("21");
  await expect(lineups.locator("[data-scout-subs-list]")).toContainText("posizione 1: esce 2, entra 3");
  const pdf = await page.request.get(`/api/scout/${matchId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await deleteMatchById(page, matchId);
});

test("livello «Con ricezioni»: i tre passi dello scambio dicono a che punto si è", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Passi "));

  await prepare(page, matchId, "ricezioni");

  // Batte la nostra squadra: la ricezione non si segna, il passo di adesso è la battuta nostra.
  const now = page.locator('[data-scout-flow-step="now"]');
  await expect(page.locator('[data-scout-reception="idle"]')).toBeVisible();
  await expect(now).toHaveCount(1);
  await expect(now).toContainText("Battuta nostra");

  await expectBall(page, "us", "Battuta");

  // Punto loro: ora battono loro e tocca alla ricezione nostra.
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("0–1");
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();
  await expect(now).toContainText("Ricezione nostra");
  await expect(page.locator('[data-scout-flow-step="done"]')).toHaveCount(1);
  // La palla parte da loro (battono)…
  await expectBall(page, "opp", "Battuta");
  // …e, segnata la nostra ricezione, è dalla nostra parte.
  const reception = page.locator('[data-scout-reception="open"]');
  await reception.locator("[data-scout-who]", { hasText: "Anna" }).click();
  await reception.locator('[data-scout-grades="reception"] [data-scout-grade="+"]').click();
  await expect(page.locator('[data-scout-reception="done"]')).toBeVisible();
  await expectBall(page, "us", "In gioco");

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test("rotazione sbagliata: la finestra «Rotazione» gira la squadra avanti o indietro senza toccare punteggio né cambi, compare nel registro, si annulla e resta dopo il salvataggio", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Rotazione "));
  await prepare(page, matchId, "base");

  // Punto loro (battono loro) e punto nostro (riconquistiamo la battuta e ruotiamo): 1–1, siamo alla 2ª rotazione e batte la n. 2 (Bea).
  await addPoint(page, "opp-attack", null);
  await addPoint(page, "us-attack", { text: "Anna" });
  await expect(score(page)).toHaveText("1–1");
  await expect(usSpot(page, 1)).toContainText("Bea");
  await expect(strip(page)).toContainText("2ª rot.");

  const openUs = strip(page).locator('[data-scout-rotate-open="us"]');
  const sheet = page.locator('[data-scout-sheet="rotate"]');
  const previewSpot = (position: number) => sheet.locator(`[data-scout-rotate-preview="us"] [data-scout-preview-position="${position}"]`);

  // Si apre, senza correzione non si può applicare, Esc la chiude e non cambia niente.
  await openUs.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-scout-rotate-steps]")).toHaveAttribute("data-scout-rotate-steps", "0");
  await expect(sheet.locator("[data-scout-rotate-confirm]")).toBeDisabled();
  await expect(previewSpot(1)).toContainText("Bea");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("Bea");

  // Indietro di 1: l'anteprima mostra la rotazione di prima (batte la n. 9) e la riga «Dopo» dice 1ª; il campo vero non si muove finché non si applica.
  await openUs.click();
  await sheet.locator("[data-scout-rotate-back]").click();
  await expect(sheet.locator("[data-scout-rotate-steps]")).toHaveText("Indietro di 1");
  await expect(previewSpot(1)).toContainText("Anna");
  await expect(sheet.locator("[data-scout-rotate-after]")).toHaveAttribute("data-scout-rotate-after", "1");
  await expect(sheet.locator("[data-scout-rotate-after]")).toContainText("batte");
  await expect(usSpot(page, 1)).toContainText("Bea");
  // Indietro di 2 e di nuovo avanti di 1: si torna a «indietro di 1».
  await sheet.locator("[data-scout-rotate-back]").click();
  await expect(sheet.locator("[data-scout-rotate-steps]")).toHaveText("Indietro di 2");
  await expect(previewSpot(1)).toContainText("Fede");
  await sheet.locator("[data-scout-rotate-forward]").click();
  await expect(sheet.locator("[data-scout-rotate-steps]")).toHaveText("Indietro di 1");
  await sheet.locator("[data-scout-rotate-confirm]").click();
  await expect(sheet).toHaveCount(0);

  // Applicata: batte la n. 9, il punteggio è lo stesso, loro non sono toccati e il registro lo racconta.
  await expect(usSpot(page, 1)).toContainText("Anna");
  await expect(strip(page)).toContainText("1ª rot.");
  await expect(score(page)).toHaveText("1–1");
  await expect(oppSpot(page, 1)).toContainText("22");
  const note = page.locator("[data-scout-rotation-note]");
  await expect(note).toHaveCount(1);
  await expect(note).toContainText("Rotazione nostra corretta");
  await expect(note).toContainText("indietro di 1");
  await expect(note).toContainText("sul 1–1");
  await expect(page.locator("[data-scout-last]")).toContainText("rotazione nostra corretta");

  // Annulla ultimo: la correzione sparisce e si torna a com'era, sempre sull'1–1.
  await page.locator("[data-scout-undo]").click();
  await expect(usSpot(page, 1)).toContainText("Bea");
  await expect(note).toHaveCount(0);
  await expect(score(page)).toHaveText("1–1");

  // Avanti di 2: si salva (il server accetta la correzione) e dopo aver ricaricato la pagina la squadra sta ancora lì; col cestino del registro si toglie.
  await openUs.click();
  await sheet.locator("[data-scout-rotate-forward]").click();
  await sheet.locator("[data-scout-rotate-forward]").click();
  await expect(sheet.locator("[data-scout-rotate-steps]")).toHaveText("Avanti di 2");
  await sheet.locator("[data-scout-rotate-confirm]").click();
  await expect(usSpot(page, 1)).toContainText("Dora");
  await expect(note).toContainText("avanti di 2");
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.reload();
  await expect(score(page)).toHaveText("1–1");
  await expect(usSpot(page, 1)).toContainText("Dora");
  await expect(note).toHaveCount(1);
  await note.getByRole("button", { name: "Togli questa correzione" }).click();
  await expect(note).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("Bea");

  // Anche la squadra avversaria ha il suo pulsante.
  await strip(page).locator('[data-scout-rotate-open="opp"]').click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Rotazione · loro");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});
