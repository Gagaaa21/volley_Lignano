import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout: la formazione a ogni set, senza riscriverla. A ogni set nuovo si apre da sola «Formazione del N° set» (già scritta
 * come quella del set prima, o come è stata preparata in Partite); chi esce nel cambio si tocca sul campo, con numero e
 * nome; la libero si cambia dallo stesso Cambio; se non si segue la formazione un avviso propone di impostarla.
 */

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra formazione set e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const strip = (page: Page) => page.locator("[data-scout-court-strip]");
const usSpot = (page: Page, position: number) => strip(page).locator(`[data-scout-court="us"] [data-scout-court-position="${position}"]`);
const lineupSheet = (page: Page) => page.locator('[data-scout-sheet="lineup"]');
const subSheet = (page: Page) => page.locator('[data-scout-sheet="sub"]');

async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

/** Sceglie in un menù la giocatrice con quel numero di maglia (le voci sono «9 · Anna V.»). */
async function chooseNumber(select: Locator, number: string) {
  const value = await select.locator("option", { hasText: new RegExp(`^${number} ·`) }).first().getAttribute("value");
  expect(value, `nel menù non c'è la giocatrice n. ${number}`).toBeTruthy();
  await select.selectOption(value!);
}

/** Il numero e il nome della giocatrice scelta in un menù. */
const chosenText = (select: Locator) => select.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? "");

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
const US_START = ["9", "2", "5", "7", "11", "14"];

/** Segna un punto nostro (attacco) dicendo chi. */
async function usPoint(page: Page, who: string) {
  await page.locator('[data-scout-add="us-attack"]').click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  await sheet.locator("[data-scout-pick]", { hasText: who }).click();
}

/** Chiude il set in corso (a favore di chi è avanti) e lascia la scelta di chi batte per primo com'è. */
async function closeSet(page: Page) {
  await page.getByRole("button", { name: "Chiudi il set adesso" }).click();
  await page.locator("[data-scout-close-set]").click();
  await expect(page.locator("[data-scout-set-end]")).toHaveCount(0);
}

test("a ogni set nuovo si sceglie la formazione; il cambio mostra il campo con i nomi e ha il cambio della libero", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Formazione set "));
  try {
    // Preparazione: la rosa, la formazione (libero n. 1, centrali 5 e 14) e si comincia.
    await page.goto(`/admin/scout/${matchId}`);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    for (const [name, number] of ROSTER) await addPlayer(page, name, number);
    const card = page.locator("[data-scout-lineup]");
    await expect(card).toContainText("Formazione in campo");
    for (const [index, number] of US_START.entries()) await chooseNumber(card.locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
    await chooseNumber(card.locator("#scout-lineup-us-libero"), "1");
    await chooseNumber(card.locator("#scout-lineup-us-host1"), "5");
    await chooseNumber(card.locator("#scout-lineup-us-host2"), "14");
    // Niente «Conferma la formazione»: «Comincia» applica da sola quella scritta.
    await page.locator("[data-scout-start]").click();
    await expect(score(page)).toHaveText("0–0");

    // «In campo» mostra numero e nome di ognuna, ognuna dove sta.
    await expect(strip(page)).toBeVisible();
    await expect(usSpot(page, 1)).toContainText("9");
    await expect(usSpot(page, 1)).toContainText("Anna");
    await expect(usSpot(page, 4)).toContainText("Dora");
    await expect(usSpot(page, 6)).toContainText("libero");
    await expect(usSpot(page, 6)).toContainText("Giada");

    // Il cambio: il campo come in realtà (4-3-2 davanti, 5-6-1 dietro), con numero e nome, non sei caselle in fila da 1 a 6.
    await page.locator('[data-scout-sub-open="us"]').click();
    await expect(subSheet(page)).toContainText("cambi fatti: 0 su 8");
    const centers = await subSheet(page)
      .locator("[data-scout-sub-out]")
      .evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((element) => {
            const r = element.getBoundingClientRect();
            return [Number(element.getAttribute("data-scout-sub-out")), { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
          }),
        ),
      );
    expect(Object.keys(centers).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const [front, back] of [[4, 5], [3, 6], [2, 1]]) {
      expect(Math.abs(centers[front].x - centers[back].x), `la ${back} non sta sotto la ${front}`).toBeLessThan(2);
      expect(centers[front].y, `la ${front} non è davanti alla ${back}`).toBeLessThan(centers[back].y);
    }
    expect(centers[4].x).toBeLessThan(centers[3].x);
    expect(centers[3].x).toBeLessThan(centers[2].x);
    expect(Math.abs(centers[4].y - centers[2].y)).toBeLessThan(2);
    expect(Math.abs(centers[5].y - centers[1].y)).toBeLessThan(2);
    const out = (position: number) => subSheet(page).locator(`[data-scout-sub-out="${position}"]`);
    await expect(out(4)).toContainText("7");
    await expect(out(4)).toContainText("Dora");
    await expect(out(1)).toContainText("Anna");
    await expect(out(1).getByLabel("Batte")).toBeVisible();
    // Prima di confermare, il cambio a parole.
    await out(4).click();
    await subSheet(page).locator("[data-scout-sub-in]", { hasText: "Hilda" }).click();
    await expect(subSheet(page).locator("[data-scout-sub-summary]")).toContainText("Esce 7 Dora");
    await expect(subSheet(page).locator("[data-scout-sub-summary]")).toContainText("posizione 4");
    await expect(subSheet(page).locator("[data-scout-sub-summary]")).toContainText("entra 3 Hilda");
    await subSheet(page).getByRole("button", { name: "Annulla" }).click();
    await expect(subSheet(page)).toHaveCount(0);

    // Il cambio della libero: non è un cambio ufficiale, si fa dallo stesso Cambio. Entra la n. 10 al posto della n. 1.
    await page.locator('[data-scout-sub-open="us"]').click();
    await subSheet(page).locator("[data-scout-libero-open]").click();
    await expect(subSheet(page).locator("[data-scout-libero-panel]")).toContainText("Adesso la libero è 1 Giada");
    await expect(subSheet(page).locator("[data-scout-libero-confirm]")).toBeDisabled();
    await subSheet(page).locator("[data-scout-libero-in]", { hasText: "Irene" }).click();
    await subSheet(page).locator("[data-scout-libero-confirm]").click();
    await expect(subSheet(page)).toHaveCount(0);
    await expect(usSpot(page, 6)).toContainText("libero");
    await expect(usSpot(page, 6)).toContainText("Irene");
    await expect(usSpot(page, 6)).not.toContainText("Giada");
    await expect(strip(page)).toContainText("Cambi 0/8");

    // Un punto, e si chiude il 1° set.
    await usPoint(page, "Anna");
    await expect(score(page)).toHaveText("1–0");
    await closeSet(page);
    await expect(score(page)).toHaveText("0–0");

    // 2° set: si apre da sola la formazione, già scritta come quella del set prima (e con la libero di adesso).
    await expect(lineupSheet(page)).toBeVisible();
    await expect(lineupSheet(page)).toContainText("Formazione del 2° set");
    await expect(lineupSheet(page).locator("[data-scout-lineup-source]")).toHaveAttribute("data-scout-lineup-source", "carried");
    expect(await chosenText(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]'))).toMatch(/^9 · Anna/);
    expect(await chosenText(lineupSheet(page).locator("#scout-lineup-us-libero"))).toMatch(/^10 · Irene/);
    // Il pulsante per confermare è sempre in vista, senza scorrere.
    await expect(lineupSheet(page).locator("[data-scout-lineup-confirm]")).toBeInViewport();
    // Cambia chi batte: al posto della n. 9 la n. 3. «Come nel set precedente» riporta indietro.
    await chooseNumber(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]'), "3");
    await lineupSheet(page).locator("[data-scout-lineup-previous]").click();
    expect(await chosenText(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]'))).toMatch(/^9 · Anna/);
    await chooseNumber(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]'), "3");
    await lineupSheet(page).locator("[data-scout-lineup-confirm]").click();
    await expect(lineupSheet(page)).toHaveCount(0);
    await expect(usSpot(page, 1)).toContainText("3");
    await expect(usSpot(page, 1)).toContainText("Hilda");
    await expect(strip(page)).toContainText(/Noi\s*1ª rot\./);

    // Con la formazione scritta la domanda non torna, anche dopo aver ricaricato. Nel 2° set battono loro: il nostro punto è un cambio palla,
    // quindi si ruota (a battere va la n. 2, la n. 3 passa in posizione 6) e la libero n. 10 resta al posto della centrale 14.
    await usPoint(page, "Hilda");
    await expect(score(page)).toHaveText("1–0");
    await expect(page.locator("[data-scout-sync]")).toHaveAttribute("data-scout-sync", "saved");
    await page.reload();
    await expect(score(page)).toHaveText("1–0");
    await expect(lineupSheet(page)).toHaveCount(0);
    await expect(usSpot(page, 1)).toContainText("Bea");
    await expect(usSpot(page, 6)).toContainText("Hilda");
    await expect(usSpot(page, 5)).toContainText("Irene");
    await expect(usSpot(page, 5)).toContainText("libero");
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});

test("senza formazione: un avviso propone di impostarla; la finestra la scrive e poi «chi?» è tra le sei in campo", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Formazione avviso "));
  try {
    await page.goto(`/admin/scout/${matchId}`);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    for (const [name, number] of ROSTER) await addPlayer(page, name, number);
    // «Comincia» sta sempre in vista in fondo allo schermo, anche prima di scorrere la preparazione.
    await expect(page.locator("[data-scout-start]")).toBeInViewport();
    await page.locator("[data-scout-start]").click();
    await expect(score(page)).toHaveText("0–0");

    // Senza formazione si sceglie tra tutte le giocatrici: l'avviso lo dice e propone di impostarla.
    const nudge = page.locator("[data-scout-lineup-nudge]");
    await expect(nudge).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
    await page.locator('[data-scout-add="us-attack"]').click();
    const picker = page.locator("[data-scout-sheet^='player']");
    await picker.waitFor();
    await expect(picker.locator("[data-scout-pick]:not([data-scout-pick='unknown'])")).toHaveCount(ROSTER.length);
    await expect(picker.locator("[data-scout-court-picker='us']")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);

    // Dall'avviso si apre la formazione: sei posizioni e basta, e vale subito.
    await nudge.locator("[data-scout-lineup-nudge-open]").click();
    await expect(lineupSheet(page)).toContainText("Formazione del 1° set");
    for (const [index, number] of US_START.entries()) await chooseNumber(lineupSheet(page).locator(`[data-scout-lineup-cell="us-${index + 1}"]`), number);
    await lineupSheet(page).locator("[data-scout-lineup-confirm]").click();
    await expect(lineupSheet(page)).toHaveCount(0);
    await expect(nudge).toHaveCount(0);
    await expect(usSpot(page, 1)).toContainText("Anna");

    // Adesso «chi?» è il campo con le sei in campo (e la panchina sotto), con il pallone verde su chi batte: un ace è di chi sta in posizione 1.
    await page.locator('[data-scout-add="us-ace"]').click();
    await picker.waitFor();
    const court = picker.locator("[data-scout-court-picker='us']");
    await expect(court).toBeVisible();
    await expect(court.locator("[data-scout-pick]")).toHaveCount(6);
    await expect(court.locator('[data-scout-spot="1"]')).toContainText("Anna");
    await expect(court.locator('[data-scout-spot="1"]').getByLabel("Batte")).toBeVisible();
    await court.locator('[data-scout-spot="1"]').click();
    await expect(score(page)).toHaveText("1–0");
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});

/** Lettere al posto delle cifre: un cognome che finisce con un numero verrebbe letto come numero di maglia. */
function lettersTag(): string {
  return Date.now()
    .toString(36)
    .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);
}

test("la formazione preparata in Partite arriva già scritta in Scout, per ogni set, senza riscriverla", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const tag = lettersTag();
  const names = ["Anna", "Bea", "Carla", "Dora", "Elena", "Fede", "Giada", "Hilda"].map((first) => `${first} ${tag}`);

  // Le atlete in anagrafica (tutte insieme).
  await page.goto("/admin/presenze/atlete/elenco");
  await page.waitForLoadState("networkidle");
  // La casella è controllata da React: se si scrive prima che la pagina sia pronta il testo sparisce. L'anteprima dice che è stato letto.
  await expect(async () => {
    await page.getByLabel("Nominativi").fill(names.join("\n"));
    await expect(page.locator("[data-bulk-preview]")).toContainText(`${names.length} atlete lette`, { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText(`${names.length} atlete aggiunte.`)).toBeVisible({ timeout: 20_000 });

  const matchId = await createMatch(page, uniqueName("Formazione Partite "));
  try {
    // In Partite: convocate le otto e preparate le formazioni dei primi due set (nell'ordine in cui si convocano: 1…8).
    await page.goto(`/admin/partite/${matchId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    await expect(dialog).toBeVisible();
    for (const name of names) {
      await dialog.locator("div.rounded-xl", { has: page.getByText(name, { exact: true }) }).last().getByRole("button", { name: "Convocata", exact: true }).click();
    }
    const ids = await dialog.locator('input[name="calledUpAthleteIds"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(ids).toHaveLength(names.length);
    const slot = (position: number, athleteId: string | null, role: string | null) => ({ position, athleteId, role, isCaptain: false });
    const emptySet = { slots: [1, 2, 3, 4, 5, 6].map((position) => slot(position, null, null)), liberoIds: [null, null] };
    const sets = [
      // 1° set: Anna, Bea, Carla (centrale), Dora, Elena, Fede (centrale) e Giada libero.
      { slots: [slot(1, ids[0], "OH"), slot(2, ids[1], "OP"), slot(3, ids[2], "MB"), slot(4, ids[3], "OH"), slot(5, ids[4], "S"), slot(6, ids[5], "MB")], liberoIds: [ids[6], null] },
      // 2° set: ruota tutte di un posto (a battere è Bea).
      { slots: [slot(1, ids[1], "OP"), slot(2, ids[2], "MB"), slot(3, ids[3], "OH"), slot(4, ids[4], "S"), slot(5, ids[5], "MB"), slot(6, ids[0], "OH")], liberoIds: [ids[6], null] },
      emptySet,
      emptySet,
      emptySet,
    ];
    // Le formazioni si compongono trascinando: qui si scrive direttamente quello che il modulo manderebbe.
    await dialog.locator('input[name="sets"]').evaluate((input, json) => {
      (input as HTMLInputElement).value = json;
    }, JSON.stringify(sets));
    await dialog.getByRole("button", { name: "Salva convocazioni e formazioni" }).click();
    await expect(dialog.getByText("Salvato.")).toBeVisible({ timeout: 20_000 });

    // In Scout: la formazione del 1° set è già scritta (libero e centrali compresi), e «Comincia» la applica da sola.
    await page.goto(`/admin/scout/${matchId}`);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const card = page.locator("[data-scout-lineup]");
    await expect(card.locator("[data-scout-lineup-source]")).toHaveAttribute("data-scout-lineup-source", "saved");
    await expect(card.locator('[data-scout-lineup-cell="us-1"]')).toHaveValue(ids[0]);
    await expect(card.locator('[data-scout-lineup-cell="us-4"]')).toHaveValue(ids[3]);
    await expect(card.locator("#scout-lineup-us-libero")).toHaveValue(ids[6]);
    await expect(card.locator("#scout-lineup-us-host1")).toHaveValue(ids[2]);
    await expect(card.locator("#scout-lineup-us-host2")).toHaveValue(ids[5]);
    await page.locator("[data-scout-start]").click();
    await expect(score(page)).toHaveText("0–0");
    await expect(strip(page)).toBeVisible();
    await expect(usSpot(page, 1)).toHaveAttribute("data-scout-court-player", ids[0]);
    await expect(usSpot(page, 1)).toContainText("Anna");
    await expect(usSpot(page, 6)).toContainText("libero");
    await expect(usSpot(page, 6)).toContainText("Giada");

    // Un punto, si chiude il set: la formazione del 2° set è quella preparata in Partite (non quella del set prima).
    await usPoint(page, "Anna");
    await closeSet(page);
    await expect(lineupSheet(page)).toContainText("Formazione del 2° set");
    await expect(lineupSheet(page).locator("[data-scout-lineup-source]")).toHaveAttribute("data-scout-lineup-source", "saved");
    await expect(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]')).toHaveValue(ids[1]);
    await expect(lineupSheet(page).locator('[data-scout-lineup-cell="us-6"]')).toHaveValue(ids[0]);
    // «Come nel set precedente» riporta alla formazione di prima; la salvata si recupera con il suo pulsante.
    await lineupSheet(page).locator("[data-scout-lineup-previous]").click();
    await expect(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]')).toHaveValue(ids[0]);
    await lineupSheet(page).locator("[data-scout-lineup-saved]").click();
    await expect(lineupSheet(page).locator('[data-scout-lineup-cell="us-1"]')).toHaveValue(ids[1]);
    await lineupSheet(page).locator("[data-scout-lineup-confirm]").click();
    await expect(lineupSheet(page)).toHaveCount(0);
    await expect(usSpot(page, 1)).toHaveAttribute("data-scout-court-player", ids[1]);
    await expect(usSpot(page, 1)).toContainText("Bea");
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});
