import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Ora di ritrovo di una partita: si scrive, si cambia (anche con un tocco), si toglie, e arriva al calendario. Il
 * selettore nativo dell'ora su iPad non si può svuotare e non sempre si apre: il campo ora è un campo da scrivere,
 * con la X per toglierla. E un errore nel salvataggio non deve far perdere quel che si è scritto (né far tornare
 * l'orario vecchio, come se il cambio non avesse funzionato).
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

/** Il blocco della partita nel calendario .ics pubblico (righe lunghe rimesse insieme). */
async function icsEvent(request: APIRequestContext, opponent: string): Promise<string> {
  const response = await request.get("/calendario.ics");
  const text = (await response.text()).replace(/\r?\n[ \t]/g, "");
  return text.split("BEGIN:VEVENT").find((block) => block.includes(opponent)) ?? "";
}

async function matchId(page: Page, opponent: string): Promise<string> {
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** Il modulo della partita (le altre form della pagina, come il cambio squadra, non hanno novalidate). */
const matchForm = (page: Page) => page.locator("form[novalidate]");

/** Apre il modulo della partita e aspetta che la pagina sia pronta: quel che si scrive prima che React sia partito non gli arriva. */
async function openMatch(page: Page, id: string) {
  await page.goto(`/admin/partite/${id}/modifica`);
  await page.waitForLoadState("networkidle");
}

/** Salva: una partita nuova torna all'elenco, una modificata alla sua scheda. */
async function save(page: Page) {
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite(\/[^/?#]+)?$/, { timeout: 20_000 });
}

test("l'ora di ritrovo si scrive, si cambia con un tocco, si toglie, e il calendario la segue", async ({ page, request }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Cambio ora ");
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra Ritrovo e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(20)}T18:00`);

  // Scritta come capita, con le sole cifre della tastiera numerica: uscendo dal campo diventa 17:15.
  const meeting = page.getByLabel("Ora ritrovo");
  await expect(page.locator("[data-time-clear]")).toHaveCount(0);
  await meeting.fill("1715");
  await page.getByLabel("Luogo ritrovo").focus();
  await expect(meeting).toHaveValue("17:15");
  await save(page);
  const id = await matchId(page, opponent);
  await expect.poll(() => icsEvent(request, opponent)).toContain("Ritrovo alle 17:15");

  // Si cambia con un tocco: i suggerimenti contano dall'ora della partita (18:00).
  await openMatch(page, id);
  await expect(meeting).toHaveValue("17:15");
  await expect(page.locator("[data-meeting-suggestion]")).toHaveText(["1 ora · 17:00", "45 min · 17:15", "30 min · 17:30"]);
  await page.locator('[data-meeting-suggestion="17:30"]').click();
  await expect(meeting).toHaveValue("17:30");
  await save(page);
  await expect.poll(() => icsEvent(request, opponent)).toContain("Ritrovo alle 17:30");

  // Cambiando l'ora della partita, i suggerimenti la seguono.
  await openMatch(page, id);
  await page.getByLabel("Data e ora").fill(`${localDate(20)}T20:30`);
  await expect(page.locator("[data-meeting-suggestion]")).toHaveText(["1 ora · 19:30", "45 min · 19:45", "30 min · 20:00"]);

  // Scritta con il punto, come sulla tastiera del telefono.
  await meeting.fill("19.45");
  await page.getByLabel("Luogo ritrovo").focus();
  await expect(meeting).toHaveValue("19:45");
  await save(page);
  await expect.poll(() => icsEvent(request, opponent)).toContain("Ritrovo alle 19:45");

  // La X toglie l'ora: il campo si svuota, si salva, e del ritrovo non resta niente.
  await openMatch(page, id);
  await expect(meeting).toHaveValue("19:45");
  await page.locator("[data-time-clear]").click();
  await expect(meeting).toHaveValue("");
  await expect(page.locator("[data-time-clear]")).toHaveCount(0);
  await save(page);
  await expect.poll(async () => (await icsEvent(request, opponent)).includes("SUMMARY")).toBe(true);
  expect(await icsEvent(request, opponent)).not.toContain("Ritrovo alle");
  await openMatch(page, id);
  await expect(meeting).toHaveValue("");

  // Svuotarla a mano (cancellando il testo) vale lo stesso, e si può rimettere.
  await meeting.fill("1800");
  await meeting.fill("");
  await save(page);
  await openMatch(page, id);
  await expect(meeting).toHaveValue("");

  await deleteMatchById(page, id);
});

test("un errore nel modulo non svuota i campi: ora scritta male e luogo mancante si segnalano, il resto resta", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Errore ");
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Data e ora").fill(`${localDate(21)}T18:00`);
  const meeting = page.getByLabel("Ora ritrovo");

  // Un'ora che non esiste: la si segnala subito, vicino al campo.
  await meeting.fill("25:99");
  await page.getByLabel("Luogo ritrovo").focus();
  await expect(page.locator("#meetingTime-errore")).toContainText("scrivila così, 17:30");

  // Manca il luogo: il salvataggio si ferma con un messaggio e il modulo resta com'era stato scritto.
  await page.getByRole("button", { name: /salva partita/i }).click();
  await expect(matchForm(page)).toContainText("Inserisci il luogo della partita.");
  await expect(page.getByLabel("Squadra avversaria")).toHaveValue(opponent);
  await expect(page.getByLabel("Data e ora")).toHaveValue(`${localDate(21)}T18:00`);
  await expect(meeting).toHaveValue("25:99");

  // Messo il luogo, l'ora sbagliata la ferma il server, e di nuovo non si perde niente.
  await page.getByLabel("Luogo della partita").fill("Palestra Errore e2e");
  await page.getByRole("button", { name: /salva partita/i }).click();
  await expect(matchForm(page)).toContainText("L'ora di ritrovo non è valida: scrivila così, 17:30.");
  await expect(page.getByLabel("Luogo della partita")).toHaveValue("Palestra Errore e2e");
  await expect(page.getByLabel("Squadra avversaria")).toHaveValue(opponent);

  // Corretta l'ora, si salva.
  await meeting.fill("17:00");
  await save(page);
  const id = await matchId(page, opponent);
  await openMatch(page, id);
  await expect(page.getByLabel("Ora ritrovo")).toHaveValue("17:00");
  await deleteMatchById(page, id);
});

test("modificando una partita, un errore non riporta l'orario vecchio", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Modifica ");
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra Modifica e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(22)}T18:00`);
  await page.getByLabel("Ora ritrovo").fill("17:00");
  await save(page);
  const id = await matchId(page, opponent);

  await openMatch(page, id);
  // Si toglie il luogo per provocare l'errore e si cambia l'orario: dopo l'errore l'orario nuovo c'è ancora.
  await page.getByLabel("Luogo della partita").fill("");
  await page.getByLabel("Ora ritrovo").fill("16.30");
  await page.getByLabel("Data e ora").fill(`${localDate(22)}T19:15`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await expect(matchForm(page)).toContainText("Inserisci il luogo della partita.");
  await expect(page.getByLabel("Ora ritrovo")).toHaveValue("16:30");
  await expect(page.getByLabel("Data e ora")).toHaveValue(`${localDate(22)}T19:15`);

  await page.getByLabel("Luogo della partita").fill("Palestra Modifica e2e");
  await save(page);
  await openMatch(page, id);
  await expect(page.getByLabel("Ora ritrovo")).toHaveValue("16:30");
  await expect(page.getByLabel("Data e ora")).toHaveValue(`${localDate(22)}T19:15`);
  await deleteMatchById(page, id);
});
