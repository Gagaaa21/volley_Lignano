import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * La sezione Assenze per lo staff con il permesso Partite (/admin/assenze, voce a sé nel menu): partita per partita chiudere adesso,
 * riaprire, scegliere la scadenza, lasciare un messaggio ai genitori o non chiedere niente; le regole per tutte le partite (giorni,
 * ora fissa, pausa, avviso); le ultime segnalazioni e il promemoria per il gruppo. Il genitore vede tutto dal suo link, e le sue
 * azioni rispettano le stesse regole anche da una pagina rimasta aperta. Alla fine le regole tornano quelle di serie.
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

async function addAthlete(page: Page, name: string) {
  await page.goto("/admin/presenze/atlete/elenco");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByLabel("Nominativi").fill(name);
    await expect(page.locator("[data-bulk-preview]")).toContainText(/^1 atleta letta/, { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText(/^1 atleta aggiunta\./)).toBeVisible({ timeout: 20_000 });
}

async function deleteAthlete(page: Page, name: string) {
  await page.goto("/admin/presenze/atlete");
  const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
  if ((await edit.count()) === 0) return;
  await edit.click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
}

async function createMatch(page: Page, opponent: string, days: number, time = "21:30"): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra gestione assenze e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(days)}T${time}`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function createLink(page: Page, name: string): Promise<string> {
  await page.goto("/admin/assenze/link");
  const row = page.locator("[data-family-row]").filter({ hasText: name });
  if ((await row.locator("[data-family-create]").count()) > 0) await row.locator("[data-family-create]").click();
  await expect(row).toHaveAttribute("data-family-path", /^\/disponibilita\/[A-Za-z0-9_-]{32}$/);
  return (await row.getAttribute("data-family-path"))!;
}

// La sezione Assenze: le partite e le regole.
const PAGE = "/admin/assenze";
const RULES = "/admin/assenze/regole";
const card = (page: Page, matchId: string) => page.locator(`[data-reporting-match="${matchId}"]`);
const controls = (page: Page, matchId: string) => card(page, matchId).locator("[data-reporting]");
const expectState = (page: Page, matchId: string, state: string) => expect(controls(page, matchId)).toHaveAttribute("data-reporting-state", state, { timeout: 20_000 });

// La pagina del genitore.
const familyCard = (page: Page, opponent: string) => page.locator("[data-availability-match]").filter({ hasText: opponent });
/** «lunedì 19 ottobre, ore 18:00»: come la pagina del genitore scrive la scadenza. */
function deadlineText(date: string, time: string): string {
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00`));
  return `${day}, ore ${time}`;
}

/** Le regole di serie: 5 giorni prima, all'ora della partita, niente pausa né avviso. */
async function restoreDefaultRules(page: Page) {
  await page.goto(RULES);
  const form = page.locator("[data-reporting-rules]");
  await form.locator("[data-rules-days]").fill("5");
  await form.getByText("Ora della partita", { exact: true }).click();
  const paused = form.locator("[data-rules-paused]");
  if (await paused.isChecked()) await form.getByText("Sospendi le segnalazioni per tutte le partite").click();
  await form.locator("[data-rules-notice]").fill("");
  await form.locator("[data-rules-save]").click();
  await expect(form.locator("[data-rules-saved]")).toBeVisible({ timeout: 20_000 });
}

test("partita per partita: chiudi adesso, riapri, scadenza scelta, messaggio e «non chiedere»; il genitore lo vede e non può aggirarlo", async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const dora = `Dora ${lettersTag()}`;
  await addAthlete(page, dora);
  const farOpponent = uniqueName("Lontana ");
  const far = await createMatch(page, farOpponent, 10);
  const nearOpponent = uniqueName("Vicina ");
  const near = await createMatch(page, nearOpponent, 3);
  const parentContext = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const parent = await parentContext.newPage();
  try {
    const path = await createLink(page, dora);

    // Una sezione a sé: i vecchi indirizzi portano qui, e nella scheda della partita delle assenze non c'è niente.
    await page.goto("/admin/partite/assenze");
    await page.waitForURL(/\/admin\/assenze$/);
    await page.goto("/admin/presenze/atlete/link-genitori");
    await page.waitForURL(/\/admin\/assenze\/link$/);
    await page.goto(`/admin/partite/${far}`);
    await expect(page.locator("[data-match-availability], [data-match-reporting], [data-reporting]")).toHaveCount(0);

    // Con le regole di serie: fra 10 giorni aperta, fra 3 già chiusa (5 giorni prima). La pagina lo dice, partita per partita.
    await page.goto(PAGE);
    await expectState(page, far, "open");
    await expect(controls(page, far).locator("[data-reporting-status]")).toContainText("Aperte fino a");
    await expect(controls(page, far)).toContainText("Scadenza automatica: 5 giorni prima, alla stessa ora della partita");
    await expectState(page, near, "closed");

    // «Chiudi adesso»: chiusa a mano, con chi e quando.
    await controls(page, far).locator("[data-reporting-close]").click();
    await expectState(page, far, "closed");
    await expect(controls(page, far).locator("[data-reporting-status]")).toContainText("Chiuse a mano");
    await expect(controls(page, far).locator("[data-reporting-changed]")).toContainText("Cambiata da");
    await parent.goto(path);
    const farCard = familyCard(parent, farOpponent);
    await expect(farCard.locator("[data-absence-report]")).toHaveCount(0);
    await expect(farCard.locator("[data-availability-closed]")).toHaveText("Segnalazioni chiuse da Gaga: per avvisare, scrivi all'allenatore.");

    // «Riapri fino all'inizio» su quella vicina: il genitore può segnalare fino all'ora della partita, e segnala.
    await controls(page, near).locator("[data-reporting-reopen]").click();
    await expectState(page, near, "open");
    await parent.reload();
    const nearCard = familyCard(parent, nearOpponent);
    await expect(nearCard.locator("[data-availability-deadline]")).toHaveText(`Puoi segnalarlo fino a ${deadlineText(localDate(3), "21:30")}.`);
    await nearCard.locator("[data-absence-report]").click();
    await expect(nearCard).toHaveAttribute("data-availability-state", "absent");
    await expect(parent.locator("[data-availability-board]")).toHaveAttribute("data-saving", "false");
    await parent.reload();
    await expect(familyCard(parent, nearOpponent)).toHaveAttribute("data-availability-state", "absent");

    // Lo staff la ritrova: nella partita e tra le ultime segnalazioni.
    await page.goto(PAGE);
    await expect(card(page, near).locator("[data-reporting-absent]")).toContainText(dora);
    await expect(card(page, near).locator("[data-reporting-absent-count]")).toContainText("1 non c'è");
    await expect(page.locator("[data-reporting-recent-row]").filter({ hasText: dora }).first()).toContainText("dal genitore");

    // Un messaggio ai genitori sotto la partita lontana.
    await controls(page, far).locator("[data-reporting-message-toggle]").click();
    await controls(page, far).locator("[data-reporting-message-input]").fill("  Partenza in pullman   alle 14:30 ");
    await controls(page, far).locator("[data-reporting-message-save]").click();
    await expect(controls(page, far).locator("[data-reporting-message]")).toContainText("Partenza in pullman alle 14:30", { timeout: 20_000 });

    // Una scadenza scelta a mano: fra 8 giorni alle 20:00. Oltre l'inizio della partita non si può.
    await controls(page, far).locator("[data-reporting-deadline-toggle]").click();
    await controls(page, far).locator("[data-reporting-deadline-input]").fill(`${localDate(11)}T20:00`);
    await controls(page, far).locator("[data-reporting-deadline-save]").click();
    await expect(controls(page, far).locator("[data-reporting-error]")).toContainText("non può essere dopo l'inizio della partita");
    await controls(page, far).locator("[data-reporting-deadline-input]").fill(`${localDate(8)}T20:00`);
    await controls(page, far).locator("[data-reporting-deadline-save]").click();
    await expectState(page, far, "open");
    await expect(controls(page, far)).toContainText("Scadenza scelta a mano");
    await parent.reload();
    const reopened = familyCard(parent, farOpponent);
    await expect(reopened.locator("[data-availability-message]")).toContainText("Da Gaga: Partenza in pullman alle 14:30");
    await expect(reopened.locator("[data-availability-deadline]")).toHaveText(`Puoi segnalarlo fino a ${deadlineText(localDate(8), "20:00")}.`);

    // La pagina del genitore resta aperta mentre lo staff chiude: il tocco arriva al server, che rifiuta e lo dice.
    await page.goto(PAGE);
    await controls(page, far).locator("[data-reporting-close]").click();
    await expectState(page, far, "closed");
    await reopened.locator("[data-absence-report]").click();
    await expect(reopened.locator("[data-availability-error]")).toContainText("chiuse da Gaga");
    await expect(reopened).toHaveAttribute("data-availability-state", "none");

    // Gli stessi comandi nella pagina della partita, dentro la sezione: da lì si torna alla scadenza automatica.
    await page.goto(`/admin/assenze/partita/${far}`);
    const onMatch = page.locator("[data-match-reporting] [data-reporting]");
    await expect(onMatch).toHaveAttribute("data-reporting-state", "closed");
    await onMatch.locator("[data-reporting-auto]").click();
    await expect(onMatch).toHaveAttribute("data-reporting-state", "open", { timeout: 20_000 });
    await expect(onMatch).toContainText("Scadenza automatica");

    // «Non chiedere ai genitori»: dal link la partita sparisce.
    await page.goto(PAGE);
    await controls(page, far).locator("[data-reporting-ask]").uncheck();
    await expectState(page, far, "hidden");
    await expect(controls(page, far).locator("[data-reporting-status]")).toHaveText("Non chieste ai genitori");
    await parent.reload();
    await expect(familyCard(parent, farOpponent)).toHaveCount(0);
    await expect(familyCard(parent, nearOpponent)).toBeVisible();
    await page.goto(PAGE);
    await controls(page, far).locator("[data-reporting-ask]").check();
    await expectState(page, far, "open");
  } finally {
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, far).catch(() => {});
    await deleteMatchById(page, near).catch(() => {});
    await deleteAthlete(page, dora);
  }
});

test("regole per tutte le partite: giorni e ora fissa, pausa e avviso ai genitori; promemoria per il gruppo", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const elsa = `Elsa ${lettersTag()}`;
  await addAthlete(page, elsa);
  const soonOpponent = uniqueName("Fra quattro ");
  const soon = await createMatch(page, soonOpponent, 4, "18:00");
  const laterOpponent = uniqueName("Fra dodici ");
  const later = await createMatch(page, laterOpponent, 12, "17:00");
  const parentContext = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const parent = await parentContext.newPage();
  try {
    const path = await createLink(page, elsa);
    await page.goto(PAGE);
    await expectState(page, soon, "closed");

    // 2 giorni prima alle 21:00 (dalla parte «Regole»): quella fra 4 giorni si riapre da sola, fino a dopodomani alle 21.
    await page.locator('[data-tour="section-assenze-tabs"]').getByRole("link", { name: "Regole" }).click();
    await page.waitForURL(/\/admin\/assenze\/regole$/);
    const form = page.locator("[data-reporting-rules]");
    await form.locator("[data-rules-days]").fill("2");
    await form.getByText("Ora fissa", { exact: true }).click();
    await form.locator("[data-rules-time]").fill("21:00");
    await form.locator("[data-rules-save]").click();
    await expect(form.locator("[data-rules-saved]")).toBeVisible({ timeout: 20_000 });
    await expect(form.locator("[data-rules-changed]")).toContainText("Cambiate da");
    await page.goto(PAGE);
    await expectState(page, soon, "open");
    await expect(page.locator("[data-reporting-summary]")).toContainText("Regole: 2 giorni prima, alle 21:00");
    await parent.goto(path);
    await expect(familyCard(parent, soonOpponent).locator("[data-availability-deadline]")).toHaveText(
      `Puoi segnalarlo fino a ${deadlineText(localDate(2), "21:00")}.`,
    );

    // Il promemoria per il gruppo: le partite aperte con la scadenza, senza nomi né link.
    const reminder = page.locator("[data-reporting-reminder-text]");
    await expect(reminder).toContainText(soonOpponent);
    await expect(reminder).toContainText(laterOpponent);
    await expect(reminder).toContainText("entro");
    await expect(reminder).not.toContainText(elsa);
    await expect(reminder).not.toContainText("disponibilita/");

    // Il messaggio con il link per il genitore dice i giorni delle regole di adesso.
    await page.goto("/admin/assenze/link");
    await expect(page.locator("[data-family-row]").filter({ hasText: elsa }).locator("[data-family-whatsapp]").first()).toHaveAttribute(
      "href",
      new RegExp(encodeURIComponent("(fino a 2 giorni prima)").replace(/[()]/g, "\\$&")),
    );

    // Pausa per tutte e un avviso: il genitore vede le partite, l'avviso e nessun pulsante.
    await page.goto(RULES);
    await form.getByText("Sospendi le segnalazioni per tutte le partite").click();
    await form.locator("[data-rules-notice]").fill("Per il torneo di Natale scrivete all'allenatore.");
    await form.locator("[data-rules-save]").click();
    await expect(form.locator("[data-rules-saved]")).toBeVisible({ timeout: 20_000 });
    await page.goto(PAGE);
    await expectState(page, soon, "paused");
    await expect(page.locator("[data-reporting-summary]")).toContainText("Segnalazioni sospese per tutte");
    await expect(page.locator("[data-reporting-reminder-text]")).toHaveCount(0);
    await parent.reload();
    await expect(parent.locator("[data-family-paused]")).toBeVisible();
    await expect(parent.locator("[data-family-notice]")).toContainText("Da Gaga: Per il torneo di Natale scrivete all'allenatore.");
    await expect(parent.locator("[data-absence-report]")).toHaveCount(0);
    await expect(familyCard(parent, laterOpponent).locator("[data-availability-closed]")).toContainText("Segnalazioni sospese");

    // Più di 14 giorni non si possono scrivere: il modulo non parte (il server comunque li rifiuterebbe, vedi le prove unitarie).
    await page.goto(RULES);
    await form.locator("[data-rules-days]").fill("30");
    await form.locator("[data-rules-save]").click();
    await expect.poll(() => form.locator("[data-rules-days]").evaluate((input) => (input as HTMLInputElement).validity.rangeOverflow)).toBe(true);
    await page.goto(PAGE);
    await expect(page.locator("[data-reporting-summary]")).toContainText("Segnalazioni sospese per tutte");
  } finally {
    await restoreDefaultRules(page).catch(() => {});
    await parentContext.close().catch(() => {});
    await deleteMatchById(page, soon).catch(() => {});
    await deleteMatchById(page, later).catch(() => {});
    await deleteAthlete(page, elsa);
  }
});
