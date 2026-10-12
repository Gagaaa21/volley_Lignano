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

type Level = "base" | "ricezioni" | "completo";
type Skill = "serve" | "reception" | "set" | "attack" | "block" | "dig";

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

/** Segna un punto con i pulsanti del livello Base: lato e modo, e poi chi (testo della giocatrice o numero avversario). */
async function addPoint(page: Page, button: string, who: { text: string } | { opp: string } | null) {
  await page.locator(`[data-scout-add="${button}"]`).click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  if (who === null) await sheet.locator('[data-scout-pick="unknown"]').click();
  else if ("opp" in who) await sheet.locator(`[data-scout-pick="opp-${who.opp}"]`).click();
  else await sheet.locator("[data-scout-pick]", { hasText: who.text }).click();
}

/** Livello «Completo»: un tocco, con fondamentale, squadra, chi e voto. */
async function touch(page: Page, t: { skill: Skill; side: "us" | "opp"; who: string; grade: string }) {
  const entry = page.locator("[data-scout-touch-entry]");
  await entry.locator(`[data-scout-skill="${t.skill}"]`).click();
  await entry.locator(`[data-scout-side="${t.side}"]`).click();
  const who = t.side === "opp" ? entry.locator(`[data-scout-who="opp-${t.who}"]`) : entry.locator("[data-scout-who]", { hasText: t.who });
  await who.click();
  await entry.locator(`[data-scout-grades="touch"] [data-scout-grade="${t.grade}"]`).click();
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
  await expect(card).toContainText("Formazione in campo (facoltativa)");
  for (const [index, number] of US_START.entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
  for (const [index, number] of OPP_START.entries()) await card.locator(`[data-scout-lineup-cell="opp-${index + 1}"]`).fill(number);
  await chooseNumber(card.locator("#scout-lineup-us-libero"), "1");
  await chooseNumber(card.locator("#scout-lineup-us-host1"), "5");
  await chooseNumber(card.locator("#scout-lineup-us-host2"), "14");
  await card.locator("[data-scout-lineup-confirm]").click();
  await expect(card.locator("[data-scout-lineup-done]")).toBeVisible();

  await page.locator(`[data-scout-level="${level}"]`).click();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
}

const strip = (page: Page) => page.locator("[data-scout-court-strip]");
/** Una posizione della nostra metà campo, nella striscia «In campo». */
const usSpot = (page: Page, position: number) => strip(page).locator(`[data-scout-court="us"] [data-scout-court-position="${position}"]`);
const oppSpot = (page: Page, position: number) => strip(page).locator(`[data-scout-court="opp"] [data-scout-court-position="${position}"]`);

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
  await expect(strip(page)).toContainText("Cambi 0/6");

  // 1) Punto loro (attacco della n. 21): conquistano la battuta e ruotano.
  await addPoint(page, "opp-attack", { opp: "21" });
  await expect(score(page)).toHaveText("0–1");
  await expect(strip(page)).toContainText(/Loro\s*2ª rot\./);
  await expect(strip(page)).toContainText(/Noi\s*1ª rot\./);
  await expect(oppSpot(page, 1)).toContainText("22");
  await expect(oppSpot(page, 1).getByLabel("Batte")).toBeVisible();

  // 2) Punto nostro: chi sceglie «chi» vede prima le giocatrici in campo, con la posizione, poi la panchina.
  await page.locator('[data-scout-add="us-attack"]').click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  await expect(sheet.locator("[data-scout-pick]").first()).toHaveAttribute("data-scout-on-court", "1");
  await expect(sheet.locator("[data-scout-pick]", { hasText: "Hilda" })).not.toHaveAttribute("data-scout-on-court", /.*/);
  await sheet.locator("[data-scout-pick]", { hasText: "Anna" }).click();
  await expect(score(page)).toHaveText("1–1");
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
  await expect(subSheet).toContainText("cambi fatti: 0 su 6");
  await expect(subSheet.locator("[data-scout-sub-confirm]")).toBeDisabled();
  await subSheet.locator('[data-scout-sub-out="1"]').click();
  await subSheet.locator("[data-scout-sub-in]", { hasText: "Hilda" }).click();
  await expect(subSheet.locator("[data-scout-sub-warning]")).toHaveCount(0);
  await subSheet.locator("[data-scout-sub-confirm]").click();
  await expect(subSheet).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("3");
  await expect(strip(page)).toContainText("Cambi 1/6");

  // 5) Un cambio che non è regolare: la riserva appena entrata può uscire solo per chi ha sostituito. Avvisa, ma non vieta.
  await page.locator('[data-scout-sub-open="us"]').click();
  await subSheet.locator('[data-scout-sub-out="1"]').click();
  await subSheet.locator("[data-scout-sub-in]", { hasText: "Irene" }).click();
  await expect(subSheet.locator("[data-scout-sub-warning]")).toContainText("può essere sostituita solo da lei");
  await expect(subSheet.locator("[data-scout-sub-confirm]")).toBeEnabled();
  await subSheet.getByRole("button", { name: "Annulla" }).click();
  await expect(subSheet).toHaveCount(0);
  await expect(usSpot(page, 1)).toContainText("3");

  // 6) «Annulla ultimo» toglie anche il cambio: torna in campo la n. 2.
  await page.locator("[data-scout-undo]").click();
  await expect(usSpot(page, 1)).toContainText("2");
  await expect(strip(page)).toContainText("Cambi 0/6");
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
  await expect(strip(page)).toContainText("Cambi 1/6");

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
  await expect(strip(page)).toContainText("Cambi 0/6");
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

test("fasi di gioco: lo Scout dice di chi è il turno e quale fase viene adesso, scambio dopo scambio", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Fasi "));

  await prepare(page, matchId, "completo");

  const card = page.locator("[data-scout-phase-card]");
  /** Cosa propone lo Scout adesso: fondamentale e squadra, sulla scheda e nel percorso della palla. */
  async function expectNext(skill: Skill, side: "us" | "opp") {
    await expect(card).toHaveAttribute("data-scout-phase", skill);
    await expect(card).toHaveAttribute("data-scout-phase-side", side);
    await expect(card).toContainText(`Ora tocca a · ${side === "us" ? "noi" : "loro"}`);
    await expect(page.locator('[data-scout-phase-chip][data-scout-phase-state="now"]')).toHaveAttribute("data-scout-phase-chip", `${skill}:${side}`);
    await expect(page.locator("[data-scout-phase-why]")).not.toHaveText("");
  }

  // Si comincia dalla battuta: tocca a noi, e con la formazione c'è già scritto chi batte (la n. 9).
  await expectNext("serve", "us");
  await expect(card).toContainText("Battuta");
  await expect(card).toContainText("Anna");
  // Le fasi che di solito seguono sono tratteggiate; la rete compare dove la palla passa dall'altra parte.
  await expect(page.locator('[data-scout-phase-chip][data-scout-phase-state="next"]').first()).toBeVisible();
  await expect(page.locator('[data-scout-phase-link="net"]').first()).toBeAttached();

  // Battuta in campo → riceve l'altra squadra.
  await touch(page, { skill: "serve", side: "us", who: "Anna", grade: "!" });
  await expectNext("reception", "opp");
  // Ricezione scarsa (/): la palla è tornata di là → attacca la nostra squadra.
  await touch(page, { skill: "reception", side: "opp", who: "21", grade: "/" });
  await expectNext("attack", "us");
  // Attacco che continua (+): lo difendono loro.
  await touch(page, { skill: "attack", side: "us", who: "Bea", grade: "+" });
  await expectNext("dig", "opp");
  // Difesa buona: tocca all'attacco di chi ha difeso.
  await touch(page, { skill: "dig", side: "opp", who: "22", grade: "+" });
  await expectNext("attack", "opp");
  // Attacco murato (/): ora il muro è della squadra che ha murato, cioè la nostra.
  await touch(page, { skill: "attack", side: "opp", who: "22", grade: "/" });
  await expectNext("block", "us");
  // Muro che tocca la palla (+): difende chi ha murato.
  await touch(page, { skill: "block", side: "us", who: "Carla", grade: "+" });
  await expectNext("dig", "us");
  // Difesa che rimanda di là (/): attacca l'altra squadra.
  await touch(page, { skill: "dig", side: "us", who: "Dora", grade: "/" });
  await expectNext("attack", "opp");
  await expect(page.locator("[data-scout-pending] [data-scout-touch-chip]")).toHaveCount(7);

  // Un attacco a terra chiude lo scambio: punto loro, battono loro e si ricomincia dalla battuta.
  await touch(page, { skill: "attack", side: "opp", who: "23", grade: "#" });
  await expect(score(page)).toHaveText("0–1");
  await expect(page.locator("[data-scout-pending] [data-scout-touch-chip]")).toHaveCount(0);
  await expectNext("serve", "opp");

  // «Come si alternano le fasi»: la spiegazione sta lì, a portata di mano, ed è la stessa del manuale.
  const help = page.locator("[data-scout-phase-help]");
  await expect(help).not.toHaveAttribute("open", "");
  await help.locator("summary").click();
  await expect(help).toContainText("1 · Battuta.");
  await expect(help).toContainText("6 · Il punto.");
  await expect(help).toContainText("conquista la battuta");

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
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

  // Punto loro: ora battono loro e tocca alla ricezione nostra.
  await addPoint(page, "opp-attack", { opp: "21" });
  await expect(score(page)).toHaveText("0–1");
  await expect(page.locator('[data-scout-reception="open"]')).toBeVisible();
  await expect(now).toContainText("Ricezione nostra");
  await expect(page.locator('[data-scout-flow-step="done"]')).toHaveCount(1);

  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});
