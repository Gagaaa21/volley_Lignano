import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Presenza alle partite. Lo staff crea il link di un'atleta; il genitore lo apre senza account e per ogni partita tocca «Ci sarà»
 * o «Non ci sarà» (si salva subito, senza conferme); lo staff vede tutte le atlete in «Chi viene», cambia la risposta di ognuna con
 * un tocco e la ritrova nelle convocazioni e nell'elenco partite. Un link rigenerato rende inutile il vecchio; un codice inventato
 * non mostra niente; il genitore non vede altre atlete e non cambia una partita già cominciata, mentre lo staff sì.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

/** Lettere al posto delle cifre: un cognome che finisce con un numero verrebbe letto come numero di maglia. */
function lettersTag(): string {
  return Date.now()
    .toString(36)
    .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);
}

async function addAthletes(page: Page, names: string[]) {
  await page.goto("/admin/presenze/atlete/elenco");
  await page.waitForLoadState("networkidle");
  // La casella è controllata da React: se si scrive prima che la pagina sia pronta il testo sparisce. L'anteprima dice che è stato letto.
  await expect(async () => {
    await page.getByLabel("Nominativi").fill(names.join("\n"));
    await expect(page.locator("[data-bulk-preview]")).toContainText(new RegExp(`^${names.length} atlet[ae] lett[ae]`), { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText(new RegExp(`^${names.length} atlet[ae] aggiunt[ae]\\.`))).toBeVisible({ timeout: 20_000 });
}

async function deleteAthletes(page: Page, names: string[]) {
  for (const name of names) {
    await page.goto("/admin/presenze/atlete");
    const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
    if ((await edit.count()) === 0) continue;
    await edit.click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Elimina", exact: true }).click();
    // L'eliminazione è finita quando l'atleta non è più nell'elenco: cambiare pagina prima la interromperebbe e l'atleta resterebbe.
    await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
  }
}

/** Una partita in casa fra `days` giorni (0 = oggi), all'ora indicata e, di norma, con ritrovo. Il genitore la cambia finché non comincia. */
async function createMatch(page: Page, opponent: string, days: number, time = "21:30"): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra presenza e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(days)}T${time}`);
  if (time === "21:30") {
    await page.getByLabel("Ora ritrovo").fill("2045");
    await page.getByLabel("Luogo ritrovo").fill("Piazzale e2e");
  }
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function callUp(page: Page, matchId: string, names: string[]) {
  await page.goto(`/admin/partite/${matchId}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Apri", exact: true }).click();
  const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
  await expect(dialog).toBeVisible();
  for (const name of names) {
    await dialog.locator("div.rounded-xl", { has: page.getByText(name, { exact: true }) }).last().getByRole("button", { name: "Convocata", exact: true }).click();
  }
  // Con modifiche non salvate il PDF riporterebbe la versione di prima, e la finestra lo dice.
  await expect(dialog.locator("[data-unsaved-hint]")).toBeVisible();
  await dialog.getByRole("button", { name: "Salva convocazioni e formazioni" }).click();
  await expect(dialog.getByText("Salvato.")).toBeVisible({ timeout: 20_000 });
  await expect(dialog.locator("[data-unsaved-hint]")).toHaveCount(0);
}

const familyRow = (page: Page, name: string) => page.locator("[data-family-row]").filter({ hasText: name });

// La pagina del genitore.
const matchCard = (page: Page, opponent: string) => page.locator("[data-availability-match]").filter({ hasText: opponent });
/** Il salvataggio è arrivato al server (lo schermo si aggiorna prima, in anticipo). */
const settled = (page: Page) => expect(page.locator("[data-availability-board]")).toHaveAttribute("data-saving", "false");

// «Chi viene», nella scheda della partita.
const board = (page: Page) => page.locator("[data-match-availability]");
const boardSettled = (page: Page) => expect(board(page)).toHaveAttribute("data-saving", "false");
const boardRow = (page: Page, name: string) => board(page).locator("[data-availability-row]").filter({ hasText: name });
const group = (page: Page, status: "present" | "absent" | "none") => board(page).locator(`[data-availability-group="${status}"]`);
async function counts(page: Page) {
  const read = async (key: "present" | "absent" | "none") => Number(await board(page).locator(`[data-count-${key}]`).getAttribute(`data-count-${key}`));
  return { present: await read("present"), absent: await read("absent"), none: await read("none") };
}

/** Crea il link dell'atleta dalla pagina dello staff e restituisce il percorso da aprire come farebbe il genitore. */
async function createLink(page: Page, name: string): Promise<string> {
  await page.goto("/admin/presenze/atlete/link-genitori");
  const row = familyRow(page, name);
  if ((await row.locator("[data-family-create]").count()) > 0) await row.locator("[data-family-create]").click();
  await expect(row).toHaveAttribute("data-family-path", /^\/disponibilita\/[A-Za-z0-9_-]{32}$/);
  return (await row.getAttribute("data-family-path"))!;
}

test("il genitore risponde con due pulsanti dal suo link, lo staff vede «Chi viene» e cambia ogni risposta con un tocco", async ({ page, browser }) => {
  test.setTimeout(480_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [anna, bea] = ["Anna", "Bea"].map((first) => `${first} ${tag}`);
  await addAthletes(page, [anna, bea]);
  const opponent = uniqueName("Presenza ");
  const matchId = await createMatch(page, opponent, 4);
  // Il genitore non ha un account: un contesto del browser pulito, senza cookie né sessione.
  const parentContext = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const parent = await parentContext.newPage();
  try {
    // Lo staff vede le due atlete senza link e le crea.
    await page.goto("/admin/presenze/atlete");
    await expect(page.locator("[data-family-links-link]")).toBeVisible();
    await page.goto("/admin/presenze/atlete/link-genitori");
    await expect(familyRow(page, anna).locator("[data-family-create]")).toBeVisible();
    await expect(familyRow(page, bea).locator("[data-family-create]")).toBeVisible();
    const annaPath = await createLink(page, anna);
    const beaPath = await createLink(page, bea);
    expect(annaPath).not.toBe(beaPath);
    await expect(familyRow(page, anna).locator("[data-copy-family-link]")).toBeVisible();
    await expect(familyRow(page, anna).locator("[data-family-whatsapp]").first()).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    await expect(familyRow(page, anna).locator("[data-family-whatsapp]").first()).toHaveAttribute("href", new RegExp(encodeURIComponent(annaPath)));

    // Il genitore apre il link: vede solo la sua atleta e le partite, niente di altre atlete.
    const response = await parent.goto(annaPath);
    // Mai nei motori di ricerca, mai in cache, e l'indirizzo (che contiene il codice) non va ad altri siti.
    expect(response?.headers()["x-robots-tag"]).toMatch(/noindex/);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["cache-control"]).toMatch(/no-store|no-cache/);
    await expect(parent.locator("[data-family-athlete]")).toContainText(anna);
    const card = matchCard(parent, opponent);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Casa");
    await expect(card).toContainText("Ritrovo ore 20:45 · Piazzale e2e");
    // Due pulsanti e basta: nessuno premuto, nessun modulo da compilare.
    await expect(card).toHaveAttribute("data-availability-state", "none");
    await expect(card.locator("[data-availability-status]")).toHaveText("Non hai ancora risposto.");
    await expect(card.locator('[data-answer="present"]')).toHaveText("Ci sarà");
    await expect(card.locator('[data-answer="absent"]')).toHaveText("Non ci sarà");
    await expect(card.locator('[data-answer="present"]')).toHaveAttribute("aria-pressed", "false");
    await expect(card.locator('[data-answer="absent"]')).toHaveAttribute("aria-pressed", "false");
    await expect(card.locator("[data-availability-details]")).toHaveCount(0);
    const html = await parent.content();
    expect(html).not.toContain(bea);
    expect(html).not.toContain(beaPath.split("/").pop()!);
    await expect(parent.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(parent.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    // Nessun avviso di installazione o di notifiche sopra i pulsanti.
    await expect(parent.getByText("Attiva le notifiche")).toHaveCount(0);

    // Lo staff, prima che qualcuno risponda: tutte le atlete sono «senza risposta».
    await page.goto(`/admin/partite/${matchId}`);
    await expect(board(page)).toBeVisible();
    const start = await counts(page);
    expect(start.present).toBe(0);
    expect(start.absent).toBe(0);
    expect(start.none).toBeGreaterThanOrEqual(2);
    await expect(group(page, "none")).toContainText(anna);
    await expect(group(page, "none")).toContainText(bea);
    await expect(boardRow(page, anna).locator('[data-answer="none"]')).toHaveAttribute("aria-pressed", "true");

    // «Non ci sarà»: un tocco e si salva subito, poi (se vuole) il perché e una nota.
    await card.locator('[data-answer="absent"]').click();
    await expect(card).toHaveAttribute("data-availability-state", "absent");
    await expect(card.locator('[data-answer="absent"]')).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator('[data-answer="present"]')).toHaveAttribute("aria-pressed", "false");
    await expect(card.locator("[data-availability-status]")).toContainText("La tua risposta");
    await settled(parent);
    await card.locator('[data-availability-reason="malata"]').click();
    await expect(card.locator('[data-availability-reason="malata"]')).toHaveAttribute("aria-pressed", "true");
    await settled(parent);
    await card.locator("[data-availability-note]").fill("  mal   di gola ");
    await card.locator("[data-availability-note-save]").click();
    await settled(parent);
    await parent.reload();
    const saved = matchCard(parent, opponent);
    await expect(saved).toHaveAttribute("data-availability-state", "absent");
    await expect(saved.locator('[data-availability-reason="malata"]')).toHaveAttribute("aria-pressed", "true");
    await expect(saved.locator("[data-availability-note]")).toHaveValue("mal di gola");

    // Lo staff la vede subito in «Chi viene»: Anna tra chi non c'è, con motivo, nota e di chi è la risposta; Bea ancora senza risposta.
    await page.goto(`/admin/partite/${matchId}`);
    await expect(board(page)).toBeVisible();
    await expect.poll(() => counts(page)).toEqual({ present: 0, absent: 1, none: start.none - 1 });
    const annaRow = boardRow(page, anna);
    await expect(group(page, "absent")).toContainText(anna);
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Malata o infortunata · mal di gola");
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Risposta del genitore");
    await expect(boardRow(page, bea)).toHaveAttribute("data-availability-state", "none");

    // L'allenatore la cambia con un tocco («Ci sarà»): niente motivo né nota, e la risposta diventa sua.
    await annaRow.locator('[data-answer="present"]').click();
    await expect(annaRow).toHaveAttribute("data-availability-state", "present");
    await expect(group(page, "present")).toContainText(anna);
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Risposta dell'allenatore");
    await expect(annaRow.locator("[data-availability-details]")).toHaveCount(0);
    await boardSettled(page);
    await expect.poll(() => counts(page)).toEqual({ present: 1, absent: 0, none: start.none - 1 });

    // Il genitore vede il cambiamento, e di chi è.
    await parent.reload();
    const byStaff = matchCard(parent, opponent);
    await expect(byStaff).toHaveAttribute("data-availability-state", "present");
    await expect(byStaff.locator('[data-answer="present"]')).toHaveAttribute("aria-pressed", "true");
    await expect(byStaff.locator("[data-availability-status]")).toContainText("Risposta dell'allenatore");
    await expect(byStaff.locator("[data-availability-details]")).toHaveCount(0);

    // Il genitore cambia idea: vale l'ultima, e adesso è sua.
    await byStaff.locator('[data-answer="absent"]').click();
    await expect(byStaff).toHaveAttribute("data-availability-state", "absent");
    await settled(parent);
    await expect(byStaff.locator("[data-availability-status]")).toContainText("La tua risposta");
    await page.goto(`/admin/partite/${matchId}`);
    await expect(annaRow).toHaveAttribute("data-availability-state", "absent");
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Risposta del genitore");
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Nessun motivo indicato");

    // Lo staff aggiunge il motivo e la nota (senza rifare la risposta).
    await annaRow.locator("[data-availability-edit]").click();
    const editor = annaRow.locator("[data-availability-editor]");
    await editor.locator('[data-availability-reason="famiglia"]').click();
    await editor.locator("[data-availability-note]").fill("torna domenica");
    await editor.locator("[data-availability-save]").click();
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Impegno di famiglia · torna domenica");
    await expect(annaRow.locator("[data-availability-editor]")).toHaveCount(0);
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Risposta dell'allenatore");
    await boardSettled(page);

    // Il genitore la trova già compilata e la può correggere.
    await parent.reload();
    const edited = matchCard(parent, opponent);
    await expect(edited.locator("[data-availability-status]")).toContainText("Risposta dell'allenatore");
    await expect(edited.locator('[data-availability-reason="famiglia"]')).toHaveAttribute("aria-pressed", "true");
    await expect(edited.locator("[data-availability-note]")).toHaveValue("torna domenica");

    // Bea non ha risposto: l'allenatore scrive «Non ci sarà» al suo posto (per esempio dopo un messaggio in chat); la famiglia lo vede.
    const beaRow = boardRow(page, bea);
    await beaRow.locator('[data-answer="absent"]').click();
    await expect(beaRow).toHaveAttribute("data-availability-state", "absent");
    await boardSettled(page);
    await parent.goto(beaPath);
    const beaCard = matchCard(parent, opponent);
    await expect(beaCard).toHaveAttribute("data-availability-state", "absent");
    await expect(beaCard.locator('[data-answer="absent"]')).toHaveAttribute("aria-pressed", "true");
    await expect(beaCard.locator("[data-availability-status]")).toContainText("Risposta dell'allenatore");
    // L'allenatore la toglie: Bea torna senza risposta, anche per la famiglia.
    await beaRow.locator('[data-answer="none"]').click();
    await expect(beaRow).toHaveAttribute("data-availability-state", "none");
    await boardSettled(page);
    await expect.poll(() => counts(page)).toEqual({ present: 0, absent: 1, none: start.none - 1 });
    await parent.reload();
    await expect(matchCard(parent, opponent)).toHaveAttribute("data-availability-state", "none");
    await expect(matchCard(parent, opponent).locator("[data-availability-status]")).toHaveText("Non hai ancora risposto.");

    // L'elenco partite dice quante non ci sono: una sola.
    await page.goto("/admin/partite");
    await expect(page.locator(`a[href="/admin/partite/${matchId}"] [data-match-absent]`)).toHaveText("1 non c'è");

    // Nelle convocazioni ogni atleta ha la sua risposta, e una convocata che non c'è si nota (ma non viene tolta da sola).
    await callUp(page, matchId, [anna, bea]);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-called-up-absent]")).toHaveText("1 convocata ha risposto «Non ci sarà»");
    await expect(boardRow(page, anna)).toContainText("Convocata");
    await expect(boardRow(page, anna).locator("[data-availability-called-up]")).toBeVisible();
    await expect(boardRow(page, bea).locator("[data-availability-called-up]")).toHaveCount(0);
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    const dialogRow = (name: string) => dialog.locator("[data-call-up-row]").filter({ hasText: name });
    await expect(dialogRow(anna).locator("[data-answer-flag]")).toHaveAttribute("data-answer-status", "absent");
    await expect(dialogRow(anna).locator("[data-answer-flag]")).toContainText("Non ci sarà · Impegno di famiglia · torna domenica · ma è convocata");
    await expect(dialogRow(bea).locator("[data-answer-flag]")).toHaveAttribute("data-answer-status", "none");
    await expect(dialogRow(bea).locator("[data-answer-flag]")).toHaveText("Nessuna risposta");

    // Bea risponde «Ci sarà» dal suo link: nelle convocazioni compare con la sua risposta, e l'avviso resta uno solo.
    await parent.goto(beaPath);
    await matchCard(parent, opponent).locator('[data-answer="present"]').click();
    await settled(parent);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-called-up-absent]")).toHaveText("1 convocata ha risposto «Non ci sarà»");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    await expect(dialogRow(bea).locator("[data-answer-flag]")).toHaveAttribute("data-answer-status", "present");
    await expect(dialogRow(bea).locator("[data-answer-flag]")).toHaveText("Ci sarà");
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, [anna, bea]);
  }
});

test("rigenerare il link rende inutile il vecchio; un codice inventato non mostra niente; una partita già cominciata è chiusa per il genitore ma non per lo staff", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [carla] = [`Carla ${tag}`];
  await addAthletes(page, [carla]);
  const laterOpponent = uniqueName("Domani ");
  const later = await createMatch(page, laterOpponent, 3);
  // Oggi: una cominciata da un pezzo (mezzanotte), una che comincia a fine giornata. La seconda il genitore la cambia ancora.
  const startedOpponent = uniqueName("Iniziata ");
  const started = await createMatch(page, startedOpponent, 0, "00:00");
  const tonightOpponent = uniqueName("Stasera ");
  const tonight = await createMatch(page, tonightOpponent, 0, "23:59");
  const parentContext = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const parent = await parentContext.newPage();
  try {
    const oldPath = await createLink(page, carla);

    // Il link vale: l'atleta e le partite. Quella già cominciata è chiusa; quella di stasera e quella di un'altra volta si cambiano.
    await parent.goto(oldPath);
    await expect(parent.locator("[data-family-athlete]")).toContainText(carla);
    for (const open of [laterOpponent, tonightOpponent]) {
      await expect(matchCard(parent, open).locator('[data-answer="present"]')).toBeEnabled();
      await expect(matchCard(parent, open).locator('[data-answer="absent"]')).toBeEnabled();
    }
    const startedCard = matchCard(parent, startedOpponent);
    await expect(startedCard).toBeVisible();
    await expect(startedCard.locator('[data-answer="present"]')).toBeDisabled();
    await expect(startedCard.locator('[data-answer="absent"]')).toBeDisabled();
    await expect(startedCard.locator("[data-availability-closed]")).toContainText("La partita è già cominciata");

    // Lo staff, invece, scrive la risposta anche per una partita già cominciata; il genitore la legge ma non la cambia.
    await page.goto(`/admin/partite/${started}`);
    const row = boardRow(page, carla);
    await row.locator('[data-answer="absent"]').click();
    await expect(row).toHaveAttribute("data-availability-state", "absent");
    await boardSettled(page);
    await row.locator("[data-availability-edit]").click();
    await row.locator('[data-availability-reason="altro"]').click();
    await row.locator("[data-availability-note]").fill("ha avvisato");
    await row.locator("[data-availability-save]").click();
    await expect(row.locator("[data-availability-details]")).toContainText("Altro · ha avvisato");
    await boardSettled(page);
    await parent.reload();
    const closed = matchCard(parent, startedOpponent);
    await expect(closed).toHaveAttribute("data-availability-state", "absent");
    await expect(closed.locator("[data-availability-details-readonly]")).toContainText("Altro · ha avvisato");
    await expect(closed.locator("[data-availability-note-save]")).toHaveCount(0);
    await expect(closed.locator('[data-answer="present"]')).toBeDisabled();
    await expect(closed.locator('[data-answer="absent"]')).toBeDisabled();

    // Rigenerato: il vecchio non funziona più e non dice niente di chi era; il nuovo sì (e le risposte restano).
    await page.goto("/admin/presenze/atlete/link-genitori");
    page.once("dialog", (dialog) => dialog.accept());
    await familyRow(page, carla).locator("[data-family-rotate]").click();
    await expect(familyRow(page, carla)).toContainText("Link rigenerato");
    const newPath = (await familyRow(page, carla).getAttribute("data-family-path"))!;
    expect(newPath).not.toBe(oldPath);

    await parent.goto(oldPath);
    await expect(parent.getByText("Questo link non funziona")).toBeVisible();
    expect(await parent.content()).not.toContain(carla);
    await parent.goto(newPath);
    await expect(parent.locator("[data-family-athlete]")).toContainText(carla);
    await expect(matchCard(parent, startedOpponent)).toHaveAttribute("data-availability-state", "absent");

    // Un codice inventato, di lunghezza giusta o sbagliata, non mostra niente.
    for (const fake of ["a".repeat(32), "A1-_".repeat(8), "corto", "x".repeat(80)]) {
      await parent.goto(`/disponibilita/${fake}`);
      await expect(parent.getByText("Questo link non funziona")).toBeVisible();
      await expect(parent.locator("[data-family-athlete]")).toHaveCount(0);
      await expect(parent.locator("[data-availability-match]")).toHaveCount(0);
    }
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, later).catch(() => {});
    await deleteMatchById(page, started).catch(() => {});
    await deleteMatchById(page, tonight).catch(() => {});
    await deleteAthletes(page, [carla]);
  }
});
