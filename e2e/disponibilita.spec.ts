import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Link personali dei genitori: lo staff crea il link di un'atleta, il genitore lo apre senza account e segna che non c'è a una
 * partita, lo staff lo vede (partita, convocazioni, elenco). Un link rigenerato rende inutile il vecchio; un codice inventato
 * non mostra niente; il genitore non vede altre atlete né cambia una partita chiusa o una segnalazione dello staff.
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
  await page.getByLabel("Luogo della partita").fill("Palestra disponibilità e2e");
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
const matchCard = (page: Page, opponent: string) => page.locator("[data-availability-match]").filter({ hasText: opponent });
/** Il salvataggio è arrivato al server (lo schermo si aggiorna prima, in anticipo). */
const settled = (page: Page) => expect(page.locator("[data-availability-board]")).toHaveAttribute("data-saving", "false");

/** Crea il link dell'atleta dalla pagina dello staff e restituisce il percorso da aprire come farebbe il genitore. */
async function createLink(page: Page, name: string): Promise<string> {
  await page.goto("/admin/presenze/atlete/link-genitori");
  const row = familyRow(page, name);
  if ((await row.locator("[data-family-create]").count()) > 0) await row.locator("[data-family-create]").click();
  await expect(row).toHaveAttribute("data-family-path", /^\/disponibilita\/[A-Za-z0-9_-]{32}$/);
  return (await row.getAttribute("data-family-path"))!;
}

test("il link nominale: lo staff lo crea, il genitore segna che non c'è senza account, lo staff lo vede ovunque", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [anna, bea] = ["Anna", "Bea"].map((first) => `${first} ${tag}`);
  await addAthletes(page, [anna, bea]);
  const opponent = uniqueName("Disponibilita ");
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
    await expect(card).toHaveAttribute("data-availability-state", "available");
    const html = await parent.content();
    expect(html).not.toContain(bea);
    expect(html).not.toContain(beaPath.split("/").pop()!);
    await expect(parent.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(parent.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    // Nessun avviso di installazione o di notifiche sopra i pulsanti.
    await expect(parent.getByText("Attiva le notifiche")).toHaveCount(0);

    // «Non ci sarà» con il motivo e una nota.
    await card.locator("[data-availability-open]").click();
    await card.locator('[data-reason="malata"]').check({ force: true });
    await card.locator("[data-availability-note]").fill("  mal   di gola ");
    await card.locator("[data-availability-confirm]").click();
    await expect(card).toHaveAttribute("data-availability-state", "unavailable");
    await expect(card.locator("[data-availability-report]")).toContainText("Malata o infortunata · mal di gola");
    await settled(parent);
    await parent.reload();
    await expect(matchCard(parent, opponent).locator("[data-availability-report]")).toContainText("Malata o infortunata · mal di gola");

    // Lo staff lo vede nella partita, nell'elenco delle partite e nelle convocazioni.
    await page.goto(`/admin/partite/${matchId}`);
    const availability = page.locator("[data-match-availability]");
    await expect(availability.locator("[data-availability-count]")).toHaveText("1 non disponibile");
    const annaRow = availability.locator("[data-availability-row]").filter({ hasText: anna });
    await expect(annaRow).toContainText("Malata o infortunata · mal di gola");
    await expect(annaRow).toContainText("Ultima modifica del genitore");
    await expect(availability.locator("[data-availability-row]").filter({ hasText: bea })).toHaveCount(0);

    // Lo staff modifica motivo e nota (senza toglierla e rimetterla), e dopo l'ultima modifica è sua.
    await annaRow.locator("[data-availability-edit]").click();
    const staffEdit = annaRow.locator("[data-availability-edit-form]");
    await expect(staffEdit.getByLabel("Motivo")).toHaveValue("malata");
    await expect(staffEdit.getByLabel("Nota (facoltativa)")).toHaveValue("mal di gola");
    await staffEdit.getByLabel("Motivo").selectOption("famiglia");
    await staffEdit.getByLabel("Nota (facoltativa)").fill("torna domenica");
    await staffEdit.locator("[data-availability-save]").click();
    await expect(annaRow).toContainText("Impegno di famiglia · torna domenica");
    await expect(annaRow).toContainText("Ultima modifica dello staff");
    await expect(annaRow.locator("[data-availability-edit-form]")).toHaveCount(0);

    // Il genitore vede la modifica dell'allenatore e può cambiarla a sua volta (motivo e nota), senza toglierla.
    await parent.reload();
    const reported = matchCard(parent, opponent);
    await expect(reported.locator("[data-availability-report]")).toContainText("Impegno di famiglia · torna domenica");
    await expect(reported.locator("[data-availability-report]")).toContainText("Inserita dall'allenatore: puoi cambiarla tu.");
    await reported.locator("[data-availability-edit]").click();
    await expect(reported.locator('[data-reason="famiglia"]')).toBeChecked();
    await expect(reported.locator("[data-availability-note]")).toHaveValue("torna domenica");
    await reported.locator('[data-reason="malata"]').check({ force: true });
    await reported.locator("[data-availability-note]").fill("mal di gola");
    await reported.locator("[data-availability-confirm]").click();
    await expect(reported.locator("[data-availability-report]")).toContainText("Malata o infortunata · mal di gola");
    await settled(parent);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(annaRow).toContainText("Malata o infortunata · mal di gola");
    await expect(annaRow).toContainText("Ultima modifica del genitore");
    await page.goto("/admin/partite");
    await expect(page.locator(`a[href="/admin/partite/${matchId}"] [data-match-unavailable]`)).toHaveText("1 non disponibile");

    await callUp(page, matchId, [anna, bea]);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-called-up-unavailable]")).toHaveText("1 convocata è segnalata non disponibile");
    await expect(availability.locator("[data-availability-row]").filter({ hasText: anna })).toContainText("Convocata");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    const flag = dialog.locator("[data-unavailable-flag]");
    await expect(flag).toHaveCount(1);
    await expect(flag).toContainText("Non disponibile, ma è convocata: Malata o infortunata · mal di gola · segnalato dal genitore");
    await expect(dialog.locator("div.rounded-xl", { has: page.getByText(bea, { exact: true }) }).last()).not.toContainText("Non disponibile");

    // Il genitore cambia idea: torna disponibile, e lo staff non vede più niente.
    await matchCard(parent, opponent).locator("[data-availability-clear]").click();
    await expect(matchCard(parent, opponent)).toHaveAttribute("data-availability-state", "available");
    await settled(parent);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-match-availability] [data-availability-count]")).toHaveText("Nessuna segnalazione");
    await expect(page.locator("[data-called-up-unavailable]")).toHaveCount(0);

    // Lo staff segna Bea (per esempio dopo un messaggio in chat): la famiglia la vede e può cambiarla o toglierla.
    const add = page.locator("[data-availability-add]");
    await add.getByLabel("Atleta").selectOption({ label: bea });
    await add.getByLabel("Motivo").selectOption("famiglia");
    await add.getByLabel("Nota (facoltativa)").fill("ha avvisato in chat");
    await add.locator("[data-availability-submit]").click();
    const beaRow = page.locator("[data-availability-row]").filter({ hasText: bea });
    await expect(beaRow).toContainText("Impegno di famiglia · ha avvisato in chat");
    await expect(beaRow).toContainText("Ultima modifica dello staff");
    await parent.goto(beaPath);
    const beaCard = matchCard(parent, opponent);
    await expect(beaCard.locator("[data-availability-report]")).toContainText("Inserita dall'allenatore");
    await expect(beaCard.locator("[data-availability-edit]")).toBeVisible();
    await expect(beaCard.locator("[data-availability-clear]")).toBeVisible();
    await expect(beaCard.locator("[data-availability-open]")).toHaveCount(0);
    // Il genitore la toglie: Bea torna disponibile anche se l'aveva segnata l'allenatore.
    await beaCard.locator("[data-availability-clear]").click();
    await expect(beaCard).toHaveAttribute("data-availability-state", "available");
    await settled(parent);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-availability-row]")).toHaveCount(0);

    // E lo staff può segnarla di nuovo e poi toglierla.
    const again = page.locator("[data-availability-add]");
    await again.getByLabel("Atleta").selectOption({ label: bea });
    await again.locator("[data-availability-submit]").click();
    const beaAgain = page.locator("[data-availability-row]").filter({ hasText: bea });
    await expect(beaAgain).toContainText("Nessun motivo indicato");
    await beaAgain.locator("[data-availability-clear]").click();
    await expect(page.locator("[data-availability-row]")).toHaveCount(0);
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, [anna, bea]);
  }
});

test("rigenerare il link rende inutile il vecchio; un codice inventato non mostra niente; una partita già cominciata è chiusa, una di stasera no", async ({ page, browser }) => {
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
    await expect(matchCard(parent, laterOpponent).locator("[data-availability-open]")).toBeVisible();
    await expect(matchCard(parent, tonightOpponent).locator("[data-availability-open]")).toBeVisible();
    const startedCard = matchCard(parent, startedOpponent);
    await expect(startedCard).toBeVisible();
    await expect(startedCard.locator("[data-availability-open]")).toHaveCount(0);
    await expect(startedCard.locator("[data-availability-closed]")).toContainText("La partita è già cominciata");

    // Rigenerato: il vecchio non funziona più e non dice niente di chi era; il nuovo sì.
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
