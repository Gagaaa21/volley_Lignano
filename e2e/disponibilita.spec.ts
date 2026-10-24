import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Assenze alle partite. Lo staff crea il link di un'atleta; il genitore lo apre senza account e per ogni partita può dire solo «Non ci
 * sarà» (si salva subito; poi, se vuole, il perché e una nota, oppure «Annulla»), fino a 5 giorni prima della partita. Lo staff vede le
 * assenze nella scheda della partita, le segna e le toglie con un tocco, sempre, e le ritrova nelle convocazioni e nell'elenco partite.
 * Un link rigenerato rende inutile il vecchio; un codice inventato non mostra niente; il genitore non vede altre atlete.
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

/**
 * Una partita in casa fra `days` giorni (0 = oggi), all'ora indicata e, di norma, con ritrovo. Il genitore segnala un'assenza fino a
 * 5 giorni prima, alla stessa ora: fra 7 giorni è aperta, fra 5 alle 00:00 è appena chiusa, fra 5 alle 23:59 chiude stasera.
 */
async function createMatch(page: Page, opponent: string, days: number, time = "21:30"): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra assenze e2e");
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
/** «lunedì 19 ottobre, ore 18:00»: come la pagina del genitore scrive la scadenza. */
function deadlineText(date: string, time: string): string {
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00`));
  return `${day}, ore ${time}`;
}

// Il riquadro «Assenze», nella scheda della partita.
const board = (page: Page) => page.locator("[data-match-availability]");
const boardSettled = (page: Page) => expect(board(page)).toHaveAttribute("data-saving", "false");
const absentRow = (page: Page, name: string) => board(page).locator("[data-availability-row]").filter({ hasText: name });
const markButton = (page: Page, name: string) => board(page).locator("[data-absence-mark]").filter({ hasText: name });
const absentCount = (page: Page) => board(page).locator("[data-count-absent]");

/** Crea il link dell'atleta dalla pagina dello staff e restituisce il percorso da aprire come farebbe il genitore. */
async function createLink(page: Page, name: string): Promise<string> {
  await page.goto("/admin/presenze/atlete/link-genitori");
  const row = familyRow(page, name);
  if ((await row.locator("[data-family-create]").count()) > 0) await row.locator("[data-family-create]").click();
  await expect(row).toHaveAttribute("data-family-path", /^\/disponibilita\/[A-Za-z0-9_-]{32}$/);
  return (await row.getAttribute("data-family-path"))!;
}

test("il genitore dice solo «Non ci sarà» dal suo link; lo staff vede le assenze, le segna e le toglie con un tocco", async ({ page, browser }) => {
  test.setTimeout(480_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [anna, bea] = ["Anna", "Bea"].map((first) => `${first} ${tag}`);
  await addAthletes(page, [anna, bea]);
  const opponent = uniqueName("Assenza ");
  const matchId = await createMatch(page, opponent, 7);
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
    const whatsapp = familyRow(page, anna).locator("[data-family-whatsapp]").first();
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    await expect(whatsapp).toHaveAttribute("href", new RegExp(encodeURIComponent(annaPath)));
    // Il messaggio dice a cosa serve il link e fino a quando.
    await expect(whatsapp).toHaveAttribute("href", new RegExp(encodeURIComponent("se non può esserci a una partita (fino a 5 giorni prima)").replace(/[()]/g, "\\$&")));

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
    // Si chiede una cosa sola: un pulsante «Non ci sarà», niente «Ci sarà», nessun modulo da compilare.
    await expect(card).toHaveAttribute("data-availability-state", "none");
    await expect(card.locator("[data-absence-report]")).toHaveText("Non ci sarà");
    await expect(card.getByRole("button", { name: "Ci sarà", exact: true })).toHaveCount(0);
    await expect(card.locator("[data-availability-status]")).toHaveText("Se ci sarà non devi fare niente.");
    await expect(card.locator("[data-availability-details]")).toHaveCount(0);
    // Fino a quando: 5 giorni prima, alla stessa ora della partita.
    await expect(card.locator("[data-availability-deadline]")).toHaveText(`Puoi segnalarlo fino a ${deadlineText(localDate(2), "21:30")}.`);
    const html = await parent.content();
    expect(html).not.toContain(bea);
    expect(html).not.toContain(beaPath.split("/").pop()!);
    await expect(parent.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(parent.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    // Nessun avviso di installazione o di notifiche sopra i pulsanti.
    await expect(parent.getByText("Attiva le notifiche")).toHaveCount(0);

    // Lo staff, prima che qualcuno segnali: nessuna assenza, e tutte le atlete da segnare con un tocco.
    await page.goto(`/admin/partite/${matchId}`);
    await expect(board(page)).toBeVisible();
    await expect(absentCount(page)).toHaveAttribute("data-count-absent", "0");
    await expect(absentCount(page)).toHaveText("Nessuna assenza");
    await expect(board(page).locator('[data-availability-group="absent"]')).toHaveCount(0);
    await expect(markButton(page, anna)).toBeVisible();
    await expect(markButton(page, bea)).toBeVisible();

    // «Non ci sarà»: un tocco e si salva subito, poi (se vuole) il perché e una nota.
    await card.locator("[data-absence-report]").click();
    await expect(card).toHaveAttribute("data-availability-state", "absent");
    await expect(card.locator("[data-availability-status]")).toContainText("Segnalata da te");
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

    // Lo staff la vede subito: Anna non c'è, con motivo, nota e chi l'ha segnalata; Bea si può ancora segnare.
    await page.goto(`/admin/partite/${matchId}`);
    await expect(board(page)).toBeVisible();
    await expect(absentCount(page)).toHaveText("1 non c'è");
    const annaRow = absentRow(page, anna);
    await expect(board(page).locator('[data-availability-group="absent"]')).toContainText(anna);
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Malata o infortunata · mal di gola");
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Segnalata dal genitore");
    await expect(markButton(page, bea)).toBeVisible();

    // Il genitore ci ripensa: «Annulla» e Anna ci sarà; poi la segnala di nuovo, senza motivo.
    await saved.locator("[data-absence-clear]").click();
    await expect(saved).toHaveAttribute("data-availability-state", "none");
    await settled(parent);
    await parent.reload();
    await expect(matchCard(parent, opponent)).toHaveAttribute("data-availability-state", "none");
    await page.reload();
    await expect(absentCount(page)).toHaveAttribute("data-count-absent", "0");
    await expect(markButton(page, anna)).toBeVisible();
    await matchCard(parent, opponent).locator("[data-absence-report]").click();
    await settled(parent);
    await page.reload();
    await expect(absentCount(page)).toHaveText("1 non c'è");
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Nessun motivo indicato");

    // Lo staff aggiunge il motivo e la nota (per esempio dopo un messaggio in chat).
    await annaRow.locator("[data-availability-edit]").click();
    const editor = annaRow.locator("[data-availability-editor]");
    await editor.locator('[data-availability-reason="famiglia"]').click();
    await editor.locator("[data-availability-note]").fill("torna domenica");
    await editor.locator("[data-availability-save]").click();
    await expect(annaRow.locator("[data-availability-details]")).toContainText("Impegno di famiglia · torna domenica");
    await expect(annaRow.locator("[data-availability-editor]")).toHaveCount(0);
    await expect(annaRow.locator("[data-availability-by]")).toContainText("Segnalata dall'allenatore");
    await boardSettled(page);

    // Il genitore la trova già compilata (e la può ancora correggere).
    await parent.reload();
    const edited = matchCard(parent, opponent);
    await expect(edited.locator("[data-availability-status]")).toContainText("Segnata dall'allenatore");
    await expect(edited.locator('[data-availability-reason="famiglia"]')).toHaveAttribute("aria-pressed", "true");
    await expect(edited.locator("[data-availability-note]")).toHaveValue("torna domenica");
    await expect(edited.locator("[data-absence-clear]")).toBeVisible();

    // Bea non ha segnalato niente: l'allenatore la segna con un tocco e la famiglia lo vede; poi la toglie.
    await markButton(page, bea).click();
    await expect(absentRow(page, bea)).toHaveAttribute("data-availability-state", "absent");
    await expect(absentCount(page)).toHaveText("2 non ci sono");
    await boardSettled(page);
    await parent.goto(beaPath);
    const beaCard = matchCard(parent, opponent);
    await expect(beaCard).toHaveAttribute("data-availability-state", "absent");
    await expect(beaCard.locator("[data-availability-status]")).toContainText("Segnata dall'allenatore");
    await absentRow(page, bea).locator("[data-absence-clear]").click();
    await expect(absentRow(page, bea)).toHaveCount(0);
    await expect(markButton(page, bea)).toBeVisible();
    await boardSettled(page);
    await expect(absentCount(page)).toHaveText("1 non c'è");
    await parent.reload();
    await expect(matchCard(parent, opponent)).toHaveAttribute("data-availability-state", "none");

    // L'elenco partite dice quante non ci sono: una sola.
    await page.goto("/admin/partite");
    await expect(page.locator(`a[href="/admin/partite/${matchId}"] [data-match-absent]`)).toHaveText("1 non c'è");

    // Nelle convocazioni l'assenza si nota (in rosso se è convocata), ma non viene tolta da sola; chi ci sarà non ha avvisi.
    await callUp(page, matchId, [anna, bea]);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-called-up-absent]")).toHaveText("1 convocata non ci sarà");
    await expect(absentRow(page, anna)).toContainText("Convocata");
    await expect(absentRow(page, anna).locator("[data-availability-called-up]")).toBeVisible();
    await expect(markButton(page, bea)).toContainText("convocata");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    const dialogRow = (name: string) => dialog.locator("[data-call-up-row]").filter({ hasText: name });
    await expect(dialogRow(anna).locator("[data-answer-flag]")).toHaveAttribute("data-answer-status", "absent");
    await expect(dialogRow(anna).locator("[data-answer-flag]")).toHaveText("Non ci sarà · Impegno di famiglia · torna domenica · ma è convocata");
    await expect(dialogRow(bea)).toBeVisible();
    await expect(dialogRow(bea).locator("[data-answer-flag]")).toHaveCount(0);
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, [anna, bea]);
  }
});

test("le segnalazioni chiudono 5 giorni prima (lo staff segna sempre); rigenerare il link rende inutile il vecchio; un codice inventato non mostra niente", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [carla] = [`Carla ${tag}`];
  await addAthletes(page, [carla]);
  // Fra 5 giorni alle 23:59: chiude stasera alle 23:59, quindi è ancora aperta. Fra 5 giorni a mezzanotte: chiusa da stanotte.
  const lastDayOpponent = uniqueName("Ultimo giorno ");
  const lastDay = await createMatch(page, lastDayOpponent, 5, "23:59");
  const closedOpponent = uniqueName("Chiusa ");
  const closedMatch = await createMatch(page, closedOpponent, 5, "00:00");
  const soonOpponent = uniqueName("Fra due giorni ");
  const soon = await createMatch(page, soonOpponent, 2);
  const parentContext = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const parent = await parentContext.newPage();
  try {
    const oldPath = await createLink(page, carla);

    // Il link vale: l'atleta e le partite. Quella che chiude stasera si segnala ancora, e la pagina dice fino a quando.
    await parent.goto(oldPath);
    await expect(parent.locator("[data-family-athlete]")).toContainText(carla);
    const lastDayCard = matchCard(parent, lastDayOpponent);
    await expect(lastDayCard.locator("[data-absence-report]")).toBeVisible();
    await expect(lastDayCard.locator("[data-availability-deadline]")).toHaveText(`Puoi segnalarlo fino a ${deadlineText(localDate(0), "23:59")}.`);
    // Le altre due sono chiuse: si vedono, ma niente pulsante, e si dice di scrivere all'allenatore.
    for (const opponent of [closedOpponent, soonOpponent]) {
      const closedCard = matchCard(parent, opponent);
      await expect(closedCard).toBeVisible();
      await expect(closedCard.locator("[data-absence-report]")).toHaveCount(0);
      await expect(closedCard.locator("[data-availability-status]")).toHaveText("Nessuna assenza segnalata.");
      await expect(closedCard.locator("[data-availability-closed]")).toContainText("Segnalazioni chiuse (5 giorni prima della partita)");
      await expect(closedCard.locator("[data-availability-closed]")).toContainText("scrivi all'allenatore");
      await expect(closedCard.locator("[data-availability-deadline]")).toHaveCount(0);
    }

    // Lo staff, invece, segna un'assenza anche a segnalazioni chiuse; il genitore la legge ma non la cambia.
    await page.goto(`/admin/partite/${soon}`);
    await markButton(page, carla).click();
    const row = absentRow(page, carla);
    await expect(row).toHaveAttribute("data-availability-state", "absent");
    await boardSettled(page);
    await row.locator("[data-availability-edit]").click();
    await row.locator('[data-availability-reason="altro"]').click();
    await row.locator("[data-availability-note]").fill("ha avvisato");
    await row.locator("[data-availability-save]").click();
    await expect(row.locator("[data-availability-details]")).toContainText("Altro · ha avvisato");
    await boardSettled(page);
    await parent.reload();
    const closed = matchCard(parent, soonOpponent);
    await expect(closed).toHaveAttribute("data-availability-state", "absent");
    await expect(closed.locator("[data-availability-status]")).toContainText("Segnata dall'allenatore");
    await expect(closed.locator("[data-availability-details-readonly]")).toHaveText("Altro · ha avvisato");
    await expect(closed.locator("[data-availability-details]")).toHaveCount(0);
    await expect(closed.locator("[data-absence-clear]")).toHaveCount(0);
    await expect(closed.locator("[data-availability-closed]")).toBeVisible();

    // Rigenerato: il vecchio non funziona più e non dice niente di chi era; il nuovo sì (e le assenze restano).
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
    await expect(matchCard(parent, soonOpponent)).toHaveAttribute("data-availability-state", "absent");

    // Un codice inventato, di lunghezza giusta o sbagliata, non mostra niente.
    for (const fake of ["a".repeat(32), "A1-_".repeat(8), "corto", "x".repeat(80)]) {
      await parent.goto(`/disponibilita/${fake}`);
      await expect(parent.getByText("Questo link non funziona")).toBeVisible();
      await expect(parent.locator("[data-family-athlete]")).toHaveCount(0);
      await expect(parent.locator("[data-availability-match]")).toHaveCount(0);
    }
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, lastDay).catch(() => {});
    await deleteMatchById(page, closedMatch).catch(() => {});
    await deleteMatchById(page, soon).catch(() => {});
    await deleteAthletes(page, [carla]);
  }
});
