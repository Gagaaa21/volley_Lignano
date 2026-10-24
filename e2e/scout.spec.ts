import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, dismissTourIfShown, localDate, login, loginAsDev, logout, switchTeam, uniqueName } from "./helpers";

/**
 * Scout: si segna punto per punto chi fa punto e come, e ne esce il tabellino.
 * Si prova la strada vera (preparare la squadra, segnare con i pulsanti,
 * correggere, chiudere i set, aprire tabellino e PDF), il salvataggio con la
 * rete che cade e con due dispositivi, e i permessi.
 */

// Il service worker del sito (public/sw.js) risponde da sé alle richieste e `page.route` non le vedrebbe:
// per simulare la rete che cade lo si tiene fuori. Quando la rete manca davvero risponde 503, e qui si fa lo stesso.
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

async function createMatch(page: Page, opponent: string, options: { tournament?: boolean } = {}): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  if (options.tournament) await page.getByText("Torneo", { exact: true }).click();
  await page.getByLabel(options.tournament ? "Torneo / squadre coinvolte" : "Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra scout e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");

/** Aggiunge una giocatrice a mano nel passo «Prima di cominciare» (o in «Squadre e regole»). */
async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

/** Segna un punto con i pulsanti: lato, modo, e poi chi (indice di maglia o null). L'attacco vincente loro non lo chiede: si segna subito. */
async function addPoint(page: Page, button: string, who: { text: string } | { opp: string } | null) {
  await page.locator(`[data-scout-add="${button}"]`).click();
  if (button === "opp-attack") return;
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  if (who === null) await sheet.locator('[data-scout-pick="unknown"]').click();
  else if ("opp" in who) await sheet.locator(`[data-scout-pick="opp-${who.opp}"]`).click();
  else await sheet.locator("[data-scout-pick]", { hasText: who.text }).click();
}

/** Contenuto di una partita costruito a mano, per partire da un punto avanzato senza segnare tutti gli scambi. */
function rallies(count: number, side: "us" | "opp", startAt = 1, base = Date.now() - 3_600_000) {
  return Array.from({ length: count }, (_, i) => ({
    type: "rally" as const,
    id: `seed-${side}-${startAt + i}`,
    at: base + (startAt + i) * 30_000,
    actor: side,
    how: "attack" as const,
    player: null,
    victim: null,
  }));
}

function scoutData(events: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" },
    roster: { us: [], opp: [] },
    events,
    finished: false,
    ...overrides,
  };
}

async function putScout(page: Page, matchId: string, data: unknown, baseVersion: number | null) {
  return page.evaluate(
    async ({ matchId, data, baseVersion }) => {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, baseVersion }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    },
    { matchId, data, baseVersion },
  );
}

test("scout: si prepara la squadra, si segnano i punti, si corregge e si legge il tabellino", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Scout ");
  const matchId = await createMatch(page, opponent);

  // Nell'elenco la partita è ancora «Da segnare»; dalla scheda della partita si arriva allo scout.
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${matchId}"]`)).toContainText("Da segnare");
  await page.goto(`/admin/partite/${matchId}`);
  await page.locator("[data-match-scout-link]").click();
  await page.waitForURL(`**/admin/scout/${matchId}`);

  // Prima di cominciare: due giocatrici (una libero) e tre numeri avversari.
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await addPlayer(page, "Giulia Bianchi", "4");
  await addPlayer(page, "Sara Rossi", "7");
  await page.getByLabel("Sara Rossi: libero").click();
  await page.getByLabel("Numeri di maglia dell'avversaria").fill("3, 5 8");
  await page.getByLabel("Numeri di maglia dell'avversaria").press("Enter");
  await expect(page.locator('[data-scout-opponent="5"]')).toBeVisible();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");

  // 1) Attacco vincente nostro di Giulia → 1-0
  await addPoint(page, "us-attack", { text: "Giulia B." });
  await expect(score(page)).toHaveText("1–0");
  // 2) Ace loro del n. 5 → 1-1
  await addPoint(page, "opp-ace", { opp: "5" });
  await expect(score(page)).toHaveText("1–1");
  // 3) Errore loro: battuta sbagliata del n. 3 → 2-1 (punto nostro)
  await page.locator('[data-scout-add="us-error"]').click();
  await page.locator('[data-scout-error="serveError"]').click();
  await page.locator("[data-scout-sheet^='player'] [data-scout-pick=\"opp-3\"]").click();
  await expect(score(page)).toHaveText("2–1");
  // 4) Muro nostro di Giulia sull'attacco del n. 8 (due passaggi: chi muro, chi attaccava) → 3-1
  await page.locator('[data-scout-add="us-block"]').click();
  // La libero non può murare: non compare tra le scelte.
  await expect(page.locator("[data-scout-sheet^='player'] [data-scout-pick]", { hasText: "Sara R." })).toHaveCount(0);
  await page.locator("[data-scout-sheet^='player'] [data-scout-pick]", { hasText: "Giulia B." }).click();
  await expect(page.getByRole("dialog", { name: "Chi attaccava?" })).toBeVisible();
  await page.locator('[data-scout-pick="opp-8"]').click();
  await expect(score(page)).toHaveText("3–1");
  // 5) Rotazione sbagliata nostra (fallo di squadra: non chiede chi) → 3-2
  await page.locator('[data-scout-add="opp-error"]').click();
  await page.locator('[data-scout-error="rotationFault"]').click();
  await expect(score(page)).toHaveText("3–2");
  // 6) Ace loro di un numero nuovo scritto al volo (n. 11) → 3-3
  await page.locator('[data-scout-add="opp-ace"]').click();
  await page.locator("[data-scout-new-number]").fill("11");
  await page.locator("[data-scout-new-number]").press("Enter");
  await expect(score(page)).toHaveText("3–3");

  // Il registro ha sei scambi, dall'ultimo.
  await expect(page.locator("[data-scout-rally]")).toHaveCount(6);
  await expect(page.locator('[data-scout-rally="6"]')).toContainText("n. 11");
  await expect(page.locator('[data-scout-rally="4"]')).toContainText("Giulia Bianchi");
  await expect(page.locator('[data-scout-rally="4"]')).toContainText("su n. 8");

  // Annulla toglie l'ultimo punto.
  await page.locator("[data-scout-undo]").click();
  await expect(score(page)).toHaveText("3–2");
  await expect(page.locator("[data-scout-rally]")).toHaveCount(5);

  // Si corregge il primo scambio: l'attacco era di Sara, non di Giulia.
  await page.getByLabel("Correggi lo scambio 1", { exact: true }).click();
  await page.locator("#scout-edit-player").selectOption({ label: "Sara Rossi (7)" });
  await page.locator("[data-scout-edit-save]").click();
  await expect(page.locator('[data-scout-rally="1"]')).toContainText("Sara Rossi");

  // Si cambia un errore in attacco vincente: lo scambio 2 (ace loro) diventa «attacco sbagliato loro» e il punto passa a noi.
  await page.getByLabel("Correggi lo scambio 2", { exact: true }).click();
  await page.locator("#scout-edit-how").selectOption("attackError");
  await expect(page.getByText("Il punto va a noi.")).toBeVisible();
  await page.locator("[data-scout-edit-save]").click();
  await expect(score(page)).toHaveText("4–1");

  // Tutto è salvato sul server: ricaricando la pagina è ancora così.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.reload();
  await expect(score(page)).toHaveText("4–1");
  await expect(page.locator("[data-scout-rally]")).toHaveCount(5);

  // L'elenco dice a che punto siamo.
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${matchId}"]`)).toContainText("In corso · 1° set 4–1");

  // Tabellino: risultato provvisorio, e i numeri tornano.
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator("[data-scout-result]")).toContainText("Partita in corso");
  const usTable = page.locator('[data-scout-table="us"]');
  const sara = usTable.locator('[data-scout-player-row]', { hasText: "Sara Rossi" });
  const giulia = usTable.locator('[data-scout-player-row]', { hasText: "Giulia Bianchi" });
  // Sara: 1 attacco vincente (punto corretto); Giulia: 1 muro.
  await expect(sara.locator('[data-col="punti-tot"]')).toHaveText("1");
  await expect(giulia.locator('[data-col="punti-tot"]')).toHaveText("1");
  await expect(giulia.locator('[data-col="muro-pt"]')).toHaveText("1");
  // Senza formazione non si sa chi batteva: le battute di ognuna restano vuote, ma il totale della squadra c'è.
  await expect(sara.locator('[data-col="battuta-tot"]')).toHaveText("–");
  // Squadra nostra: 2 punti da giocatrici, più 2 errori loro (battuta del n. 3 e attacco sbagliato corretto) e il fallo di rotazione loro non c'è: era nostro.
  await expect(page.locator('[data-scout-total="us"] [data-col="punti-tot"]')).toHaveText("2");
  // Il set con i parziali e, per ogni squadra, i punti vinti del set (ace, attacco, muro, errori dell'avversaria).
  await expect(page.locator('[data-scout-sheet-set="1"]')).toContainText("4–1");
  await expect(page.locator('[data-scout-table="us"] [data-scout-set-row="1"] [data-col="vinti-gifts"]')).toHaveText("2");
  // Avversaria: n. 3 con battuta sbagliata, n. 8 attacco murato, e un errore di squadra nostro (rotazione) → il punto è loro.
  const oppTable = page.locator('[data-scout-table="opp"]');
  await expect(oppTable.locator('[data-scout-player-row]', { hasText: "n. 3" })).toBeVisible();
  await expect(oppTable.locator('[data-scout-player-row]', { hasText: "n. 8" })).toBeVisible();
  // «Come si è fatto punto»: noi 4 punti in totale, loro 1.
  const how = page.locator("[data-scout-how-table]");
  await expect(how.locator('[data-scout-how="Punti totali"]')).toContainText("4");
  await expect(how.locator('[data-scout-how="Punti totali"]')).toContainText("1");

  // PDF: un vero PDF, col nome giusto; senza punti non c'è.
  const pdf = await page.request.get(`/api/scout/${matchId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toMatch(/^attachment; filename="tabellino-(?:u1[45]-)?scout-.*\.pdf"$/);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Stagione: la giocatrice compare nel riepilogo.
  await page.goto("/admin/scout?vista=stagione");
  await expect(page.locator("[data-scout-season]")).toBeVisible();
  await expect(page.locator('[data-scout-table="us"]')).toContainText("Sara Rossi");

  await deleteMatchById(page, matchId);
});

test("scout: l'attacco vincente loro si segna con un tocco solo, senza chiedere chi; gli altri punti lo chiedono ancora", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Senza chi "));

  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await addPlayer(page, "Giulia Bianchi", "4");
  await page.getByLabel("Numeri di maglia dell'avversaria").fill("5");
  await page.getByLabel("Numeri di maglia dell'avversaria").press("Enter");
  await expect(page.locator('[data-scout-opponent="5"]')).toBeVisible();
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");

  const sheet = page.locator("[data-scout-sheet^='player']");

  // 1) Attacco loro: il punto è segnato subito, nessuna finestra «chi?», nel registro «Squadra».
  await page.locator('[data-scout-add="opp-attack"]').click();
  await expect(score(page)).toHaveText("0–1");
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('[data-scout-rally="1"]')).toContainText("Attacco");
  await expect(page.locator('[data-scout-rally="1"]')).toContainText("Squadra");

  // 2) Gli altri modi lo chiedono come prima: l'ace loro (con il suo numero) e il nostro attacco.
  await page.locator('[data-scout-add="opp-ace"]').click();
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-scout-pick="opp-5"]').click();
  await expect(score(page)).toHaveText("0–2");
  await page.locator('[data-scout-add="us-attack"]').click();
  await expect(sheet).toBeVisible();
  await sheet.locator("[data-scout-pick]", { hasText: "Giulia B." }).click();
  await expect(score(page)).toHaveText("1–2");

  // 3) Se si vuole dirlo lo stesso, si corregge lo scambio dal registro.
  await page.getByLabel("Correggi lo scambio 1", { exact: true }).click();
  await page.locator("#scout-edit-player").selectOption({ label: "n. 5" });
  await page.locator("[data-scout-edit-save]").click();
  await expect(page.locator('[data-scout-rally="1"]')).toContainText("n. 5");
  await expect(score(page)).toHaveText("1–2");

  // 4) «Annulla ultimo» toglie i punti come sempre; l'attacco loro si segna e si annulla senza finestre.
  await page.locator("[data-scout-undo]").click();
  await page.locator("[data-scout-undo]").click();
  await page.locator("[data-scout-undo]").click();
  await expect(score(page)).toHaveText("0–0");
  await page.locator('[data-scout-add="opp-attack"]').click();
  await expect(score(page)).toHaveText("0–1");
  await expect(sheet).toHaveCount(0);
  await page.locator("[data-scout-undo]").click();
  await expect(score(page)).toHaveText("0–0");

  // Tutto salvato prima di lasciare la pagina (altrimenti il suo avviso «modifiche non salvate» si prende la conferma dell'eliminazione).
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await deleteMatchById(page, matchId);
});

test("scout: chiusura dei set e fine partita", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Set "));

  // Al meglio dei 3: nel 1° set siamo 24-20, poi si segna il 25° punto dalla pagina.
  await page.goto(`/admin/scout/${matchId}`);
  const first = await putScout(
    page,
    matchId,
    scoutData([...rallies(24, "us"), ...rallies(20, "opp", 100)], { settings: { format: "bo3", setPoints: 25, lastSetPoints: 15, firstServer: "us" } }),
    null,
  );
  expect(first.status).toBe(200);
  await page.goto(`/admin/scout/${matchId}`);
  await expect(score(page)).toHaveText("24–20");
  await expect(page.locator("[data-scout-set-end]")).toHaveCount(0);

  await addPoint(page, "us-attack", null);
  await expect(score(page)).toHaveText("25–20");
  const panel = page.locator("[data-scout-set-end]");
  await expect(panel).toContainText("Il 1° set è finito 25–20");
  // Chi batte per primo nel 2° set: di norma si alternano, qui si sceglie «Noi».
  await expect(panel.getByRole("button", { name: "Loro" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Noi" }).click();
  await page.locator("[data-scout-close-set]").click();
  await expect(page.locator("[data-scout-set]")).toContainText("2° set");
  await expect(page.locator("[data-scout-sets-won]")).toHaveText("1–0");
  await expect(score(page)).toHaveText("0–0");

  // 2° set: avanti 24-5, un altro punto e la partita è decisa 2-0.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  const saved = await page.evaluate(async (id) => (await (await fetch(`/api/scout/${id}`)).json()) as { scout: { version: number; events: unknown[] } }, matchId);
  const baseVersion = saved.scout.version;
  const events = [...saved.scout.events, ...rallies(24, "us", 300), ...rallies(5, "opp", 400)];
  const second = await putScout(page, matchId, scoutData(events, { settings: { format: "bo3", setPoints: 25, lastSetPoints: 15, firstServer: "us" } }), baseVersion);
  expect(second.status).toBe(200);
  await page.reload();
  await expect(score(page)).toHaveText("24–5");
  await addPoint(page, "us-attack", null);
  await expect(page.locator("[data-scout-set-end]")).toContainText("la partita è decisa");
  await page.locator("[data-scout-close-set]").click();

  // Partita finita: si dice, si disabilitano i pulsanti, c'è il collegamento al tabellino.
  await expect(page.locator("[data-scout-over]")).toContainText("Partita finita 2–0 per noi");
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeDisabled();
  await expect(page.locator('[data-scout-add="opp-error"]')).toBeDisabled();

  // L'elenco la dà per conclusa; il tabellino ha i parziali e l'esito.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${matchId}"]`)).toContainText("Concluso 2–0");
  await page.goto(`/admin/scout/${matchId}/tabellino`);
  await expect(page.locator("[data-scout-result]")).toContainText("Risultato dello scout");
  await expect(page.locator("[data-scout-outcome]")).toHaveText("Vittoria");
  await expect(page.locator("[data-scout-result-us]")).toHaveText("2");
  await expect(page.locator("[data-scout-result-opp]")).toHaveText("0");
  await expect(page.locator("[data-scout-result]")).toContainText("25–20");
  await expect(page.locator("[data-scout-result]")).toContainText("25–5");

  // Il filtro per set cambia i numeri.
  await page.goto(`/admin/scout/${matchId}/tabellino?set=2`);
  await expect(page.getByText("30 scambi · 2° set")).toBeVisible();

  await deleteMatchById(page, matchId);
});

test("scout: chiusure a mano (partita e set), annulla che riapre, azzera tutto", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Mano "));
  const acceptDialogs = (dialog: { accept: () => Promise<void> }) => void dialog.accept();
  page.on("dialog", acceptDialogs);

  await page.goto(`/admin/scout/${matchId}`);
  expect((await putScout(page, matchId, scoutData(rallies(3, "us")), null)).status).toBe(200);
  await page.goto(`/admin/scout/${matchId}`);
  await expect(score(page)).toHaveText("3–0");

  // Chiusura della partita a mano: i pulsanti si fermano e c'è «Riapri».
  await page.getByRole("button", { name: "Chiudi la partita" }).click();
  await expect(page.locator("[data-scout-over]")).toContainText("Partita chiusa a mano");
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeDisabled();
  await page.getByRole("button", { name: "Riapri" }).click();
  await expect(page.locator('[data-scout-add="us-attack"]')).toBeEnabled();

  // Chiusura anticipata del set: serve una conferma e si sceglie chi batte nel successivo.
  await page.getByRole("button", { name: "Chiudi il set adesso" }).click();
  const panel = page.locator("[data-scout-set-end]");
  await expect(panel).toContainText("Chiudere il 1° set sul 3–0?");
  await panel.getByRole("button", { name: "Loro" }).click();
  await page.locator("[data-scout-close-set]").click();
  await expect(page.locator("[data-scout-set]")).toContainText("2° set");
  await expect(page.locator("[data-scout-sets-won]")).toHaveText("1–0");

  // «Annulla ultimo» toglie anche la chiusura del set.
  await page.locator("[data-scout-undo]").click();
  await expect(page.locator("[data-scout-set]")).toContainText("1° set");
  await expect(score(page)).toHaveText("3–0");

  // Azzera lo scout: dalla finestra «Squadre e regole»; si torna alla preparazione e sul server non resta niente.
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await page.locator("[data-scout-open-setup]").click();
  await page.locator("[data-scout-wipe]").click();
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  const afterWipe = await page.evaluate(async (id) => (await (await fetch(`/api/scout/${id}`)).json()) as { scout: unknown }, matchId);
  expect(afterWipe.scout).toBeNull();
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${matchId}"]`)).toContainText("Da segnare");

  page.off("dialog", acceptDialogs);
  await deleteMatchById(page, matchId);
});

test("scout: due dispositivi non si sovrascrivono in silenzio", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Conflitto "));

  // API: la prima volta si crea (versione 1), e dichiarare una base sbagliata dà 409 con la versione attuale.
  await page.goto("/admin/scout");
  const created = await putScout(page, matchId, scoutData(rallies(2, "us")), null);
  expect(created).toMatchObject({ status: 200, body: { version: 1 } });
  const again = await putScout(page, matchId, scoutData(rallies(3, "us")), null);
  expect(again.status).toBe(409);
  expect((again.body.current as { version: number }).version).toBe(1);
  const updated = await putScout(page, matchId, scoutData(rallies(3, "us")), 1);
  expect(updated).toMatchObject({ status: 200, body: { version: 2 } });
  const stale = await putScout(page, matchId, scoutData(rallies(4, "us")), 1);
  expect(stale.status).toBe(409);
  const invalid = await putScout(page, matchId, { ...scoutData([]), settings: { format: "bo9" } }, 2);
  expect(invalid.status).toBe(400);

  // Pagina: un altro dispositivo salva mentre si sta segnando → compare la scelta.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(score(page)).toHaveText("3–0");
  await putScout(page, matchId, scoutData(rallies(7, "opp")), 2); // l'«altro dispositivo» (versione 3)
  await addPoint(page, "us-attack", null);
  await expect(score(page)).toHaveText("4–0");
  const dialog = page.locator("[data-scout-conflict]");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toContainText("Su questo dispositivo");

  // «Usa quella salvata»: si perde il punto locale e si vede quello dell'altro dispositivo.
  await page.locator("[data-scout-conflict-server]").click();
  await expect(dialog).toHaveCount(0);
  await expect(score(page)).toHaveText("0–7");

  // Di nuovo: stavolta si tiene la propria versione, che sovrascrive.
  await addPoint(page, "us-attack", null);
  await expect(score(page)).toHaveText("1–7");
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
  await putScout(page, matchId, scoutData(rallies(9, "opp")), 4); // l'altro dispositivo salva ancora (la nostra versione è la 4)
  await addPoint(page, "us-attack", null);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-scout-conflict-mine]").click();
  await expect(dialog).toHaveCount(0);
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 15_000 });
  // Sul server c'è la versione di questo dispositivo: i 7 punti loro adottati, più i due punti nostri segnati qui.
  const final = await page.evaluate(async (id) => (await (await fetch(`/api/scout/${id}`)).json()) as { scout: { events: unknown[] } }, matchId);
  expect(final.scout.events).toHaveLength(9);
  await deleteMatchById(page, matchId);
});

test("scout: senza rete i punti restano nel telefono e partono da soli quando torna", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Rete "));
  // Chiudere la pagina con punti non salvati chiede conferma al browser: qui si accetta.
  const acceptDialogs = (dialog: { accept: () => Promise<void> }) => void dialog.accept();
  page.on("dialog", acceptDialogs);

  await page.goto(`/admin/scout/${matchId}`);
  await addPlayer(page, "Marta Neri", "11");
  await page.locator("[data-scout-start]").click();
  await addPoint(page, "us-attack", { text: "Marta N." });
  await expect(score(page)).toHaveText("1–0");
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");

  // Il salvataggio fallisce: lo stato dice «Senza rete», ma si può continuare.
  let blocked = true;
  await page.route(`**/api/scout/${matchId}`, (route) => {
    if (blocked && route.request().method() === "PUT") {
      return route.fulfill({ status: 503, contentType: "text/plain", body: "Connessione assente. Riprova." });
    }
    return route.continue();
  });
  await addPoint(page, "us-attack", { text: "Marta N." });
  await addPoint(page, "opp-attack", null);
  await expect(score(page)).toHaveText("2–1");
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "offline", { timeout: 15_000 });
  await expect(page.locator("[data-scout-sync-message]")).toContainText("restano su questo dispositivo");

  // Si chiude e si riapre la pagina, sempre senza rete: i due punti non salvati tornano dalla copia nel telefono.
  await page.reload();
  await expect(score(page)).toHaveText("2–1");

  // Torna la rete: il salvataggio riparte (ci pensa il pulsante «Riprova», o il tentativo automatico).
  blocked = false;
  const retry = page.getByRole("button", { name: "Riprova" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 20_000 });

  // Sul server c'è tutto.
  await page.unroute(`**/api/scout/${matchId}`);
  const saved = await page.evaluate(async (id) => (await (await fetch(`/api/scout/${id}`)).json()) as { scout: { events: unknown[] } }, matchId);
  expect(saved.scout.events).toHaveLength(3);

  page.off("dialog", acceptDialogs);
  await deleteMatchById(page, matchId);
});

test("scout: tornei e Minivolley restano fuori", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const tournamentId = await createMatch(page, uniqueName("Torneo scout "), { tournament: true });

  // Un torneo non compare nell'elenco e la sua pagina non esiste (pagina non trovata); l'API risponde 400.
  await page.goto("/admin/scout");
  await expect(page.locator(`[data-scout-match="${tournamentId}"]`)).toHaveCount(0);
  await page.goto(`/admin/scout/${tournamentId}`);
  await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
  await expect(page.locator("[data-scout-board]")).toHaveCount(0);
  const api = await putScout(page, tournamentId, scoutData([]), null);
  expect(api.status).toBe(400);

  // Con la squadra Minivolley la voce non c'è e la pagina rimanda alla dashboard.
  await switchTeam(page, "minivolley");
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Scout", exact: true })).toHaveCount(0);
  await page.goto("/admin/scout");
  await expect(page).toHaveURL(/\/admin\/?$/);

  await switchTeam(page, "u14u15");
  await deleteMatchById(page, tournamentId);
});

test("scout: un Admin senza il permesso non lo vede né lo raggiunge", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Permesso "));

  const username = uniqueName("scoutadm");
  const password = "Scout12345";
  await page.goto("/admin/staff");
  await page.getByLabel("Nome e cognome").fill("Admin Scout E2E");
  await page.getByLabel("Nome utente").fill(username);
  await page.getByLabel("Password temporanea").fill(password);
  await page.getByRole("button", { name: /crea account admin/i }).click();
  await expect(page.getByText("Account creato")).toBeVisible();

  // Un account nuovo parte con lo Scout; il Developer lo toglie dalla matrice dei permessi.
  await page.goto("/admin/centro-controllo");
  const permissions = page.locator("form", { hasText: `@${username}` }).first();
  const chip = permissions.locator("label", { hasText: "Scout" }).first();
  const checkbox = chip.locator('input[type="checkbox"]');
  await expect(checkbox).toBeChecked();
  await chip.click();
  await expect(checkbox).not.toBeChecked();
  await page.waitForTimeout(500);

  await logout(page);
  await login(page, username, password);
  await expect(page).toHaveURL(/\/cambia-password/);
  await page.getByLabel("Password attuale").fill(password);
  await page.getByLabel("Nuova password", { exact: true }).fill("Scout123456");
  await page.getByLabel("Conferma nuova password").fill("Scout123456");
  await page.getByRole("button", { name: /aggiorna password/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await dismissTourIfShown(page);

  await expect(page.getByRole("link", { name: "Scout", exact: true })).toHaveCount(0);
  await page.goto("/admin/scout");
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page).toHaveURL(/\/admin\/?$/);
  const denied = await page.request.get(`/api/scout/${matchId}`);
  expect(denied.status()).toBe(403);
  const deniedPdf = await page.request.get(`/api/scout/${matchId}/pdf`);
  expect(deniedPdf.status()).toBe(403);
  // Anche il manuale d'uso in PDF è riservato a chi ha il permesso.
  const deniedManual = await page.request.get("/api/scout/manuale");
  expect(deniedManual.status()).toBe(403);

  // Senza accesso (nessuna sessione) lo Scout non esiste: 401.
  await logout(page);
  const anonymous = await page.request.get(`/api/scout/${matchId}`);
  expect(anonymous.status()).toBe(401);
  expect((await page.request.get("/api/scout/manuale")).status()).toBe(401);

  await loginAsDev(page);
  await deleteMatchById(page, matchId);
});
