import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, dismissTourIfShown, localDate, login, loginAsDev, logout, switchTeam, uniqueName } from "./helpers";

/**
 * Trasferte: la sezione «super riservata» per organizzare le partite fuori casa. Si prova con un browser vero: i mezzi con i
 * loro posti, chi viaggia con chi, la rubrica dei genitori con i numeri, il riepilogo in PDF e, soprattutto, che chi non ha il
 * permesso non veda né raggiunga niente (pagine, PDF). Alla fine lo spec toglie le atlete e la partita di prova.
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
 * Sceglie una voce di un controllo a pallini toccando la sua etichetta, come farebbe chi usa il sito: il pallino vero è nascosto, e un
 * clic forzato su di lui cade dove capita (con la pagina scorsa sotto la barra del menu, sulla voce «Trasferte» che porta all'elenco).
 */
async function chooseSegment(page: Page, name: string, within?: Locator) {
  const scope = within ?? page;
  await scope.locator("label").filter({ has: page.getByRole("radio", { name }) }).click();
  await expect(scope.getByRole("radio", { name })).toBeChecked();
}

/** Una partita fuori casa fra qualche giorno, con ritrovo. */
async function createAwayMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await chooseSegment(page, "Trasferta");
  await page.getByLabel("Luogo della partita").fill("Palestra trasferta e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(3)}T18:00`);
  await page.getByLabel("Ora ritrovo").fill("1630");
  await page.getByLabel("Luogo ritrovo").fill("Piazzale e2e");
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
  await dialog.getByRole("button", { name: "Salva convocazioni e formazioni" }).click();
  await expect(dialog.getByText("Salvato.")).toBeVisible({ timeout: 20_000 });
}

const stat = (page: Page, name: "called" | "placed" | "unplaced" | "free") => page.locator(`[data-trip-stat="${name}"] p`).first();
const vehicleCard = (page: Page, text: string) => page.locator("[data-vehicle]").filter({ hasText: text });
const unplacedRow = (page: Page, name: string) => page.locator("[data-unplaced]").filter({ hasText: name });
const newVehicleForm = (page: Page) => page.locator('form[data-vehicle-form="new"]');

/** Compila e invia il modulo «Aggiungi un mezzo». */
async function addVehicle(
  page: Page,
  fields: { kind?: string; owner?: string; driver: string; phone?: string; seats: string; time?: string; place?: string; notes?: string },
) {
  const form = newVehicleForm(page);
  if (fields.kind) await chooseSegment(page, fields.kind, form);
  await form.getByLabel("Di chi è il mezzo").fill(fields.owner ?? "");
  await form.getByLabel("Chi guida", { exact: true }).fill(fields.driver);
  await form.getByLabel("Numero di chi guida").fill(fields.phone ?? "");
  await form.getByLabel("Posti per le atlete").fill(fields.seats);
  await form.getByLabel("Partenza, ora").fill(fields.time ?? "");
  await form.getByLabel("Partenza, luogo").fill(fields.place ?? "");
  await form.getByLabel("Note sul mezzo").fill(fields.notes ?? "");
  await form.locator("[data-vehicle-submit]").click();
  // Il mezzo è arrivato (il modulo si rimonta vuoto): solo allora si può compilare il prossimo. La scheda compare subito, ma il modulo
  // si svuota quando risponde il server: finché ha ancora i vecchi valori, compilare il prossimo mezzo perderebbe quello che si scrive.
  await expect(vehicleCard(page, fields.driver.replace(/\s+/g, " "))).toBeVisible();
  await expect(form.getByLabel("Chi guida", { exact: true })).toHaveValue("");
}

/** Sceglie nel menù di una riga «Senza passaggio» il mezzo il cui testo contiene `vehicleText`. */
async function chooseVehicle(row: Locator, vehicleText: string) {
  const value = await row.locator("select option", { hasText: vehicleText }).first().getAttribute("value");
  expect(value, `nel menù non c'è il mezzo «${vehicleText}»`).toBeTruthy();
  await row.locator("select").selectOption(value!);
}

async function openTrip(page: Page, matchId: string) {
  await page.goto(`/admin/trasferte/${matchId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-trip-stat]").first()).toBeVisible();
}

/** Una partita fuori casa con tutte queste convocate: ne restituisce l'id. */
async function setupTrip(page: Page, names: string[], label: string): Promise<string> {
  const matchId = await createAwayMatch(page, uniqueName(label));
  await callUp(page, matchId, names);
  return matchId;
}

const seatsOf = (card: Locator, state: "taken" | "add" | "free") => card.locator(`[data-seat-state="${state}"]`);
/** Il salvataggio di quello che si è appena cambiato è arrivato al server (lo schermo si aggiorna prima, in anticipo). */
const settled = (page: Page) => expect(page.locator("[data-trip-board]")).toHaveAttribute("data-saving", "false");

test("una trasferta: mezzi con i loro posti, chi va con chi, le note e l'elenco che segue", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const names = ["Anna", "Bea", "Carla", "Dora"].map((first) => `${first} ${tag}`);
  await addAthletes(page, names);
  const opponent = uniqueName("Trasferta ");
  const matchId = await createAwayMatch(page, opponent);
  try {
    await callUp(page, matchId, names);

    // Nell'elenco la partita c'è, con il suo stato di partenza.
    await page.goto("/admin/trasferte");
    const row = page.locator(`[data-trip-row="${matchId}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator("[data-trip-status]")).toContainText("Nessun mezzo ancora · 4 convocate");
    await expect(row.locator("[data-trip-status]")).toContainText("ritrovo ore 16:30");
    await row.locator("[data-trip-open]").click();
    await page.waitForURL(new RegExp(`/admin/trasferte/${matchId}$`));
    await page.waitForLoadState("networkidle");

    // Tutto da fare: quattro convocate, nessun posto.
    await expect(page.locator("[data-trip-meeting]")).toContainText("Ritrovo ore 16:30 · Piazzale e2e");
    await expect(stat(page, "called")).toHaveText("4");
    await expect(stat(page, "placed")).toHaveText("0");
    await expect(stat(page, "unplaced")).toHaveText("4");
    await expect(stat(page, "free")).toHaveText("0");
    await expect(page.locator("[data-trip-no-vehicles]")).toBeVisible();
    await expect(unplacedRow(page, names[0])).toContainText("Aggiungi prima un mezzo.");

    // Un modulo incompleto dice cosa manca e non perde quello che si è scritto.
    const form = newVehicleForm(page);
    await form.getByLabel("Chi guida", { exact: true }).fill("Solo Nome");
    await form.getByLabel("Posti per le atlete").fill("0");
    await form.locator("[data-vehicle-submit]").click();
    await expect(form.locator("[data-vehicle-error]")).toContainText("Servono almeno 1 posto per le atlete.");
    await expect(form.getByLabel("Chi guida", { exact: true })).toHaveValue("Solo Nome");
    await form.getByLabel("Posti per le atlete").fill("2");
    await form.getByLabel("Numero di chi guida").fill("non è un numero");
    await form.locator("[data-vehicle-submit]").click();
    await expect(form.locator("[data-vehicle-error]")).toContainText("non sembra un numero di telefono");
    await form.getByLabel("Partenza, ora").fill("25:99");
    await form.getByLabel("Numero di chi guida").fill("333 1234567");
    await form.locator("[data-vehicle-submit]").click();
    await expect(form.locator("[data-vehicle-error]")).toContainText("L'ora di partenza non è valida");
    await form.getByLabel("Partenza, ora").fill("");

    // Due mezzi: un'auto da 2 posti (di una famiglia, nel modulo già compilato) e un pulmino da 3 con partenza.
    await form.getByLabel("Di chi è il mezzo").fill("Famiglia Rossi");
    await form.locator("[data-vehicle-submit]").click();
    await expect(vehicleCard(page, "Solo Nome")).toBeVisible();
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-title]")).toHaveText("Auto · Solo Nome");
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-owner]")).toHaveText("di Famiglia Rossi");
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-phone]")).toHaveAttribute("href", "tel:3331234567");
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-seats]")).toHaveText("0/2 posti");
    await expect(stat(page, "free")).toHaveText("2");
    // Dopo un mezzo aggiunto il modulo torna vuoto, pronto per il prossimo.
    await expect(newVehicleForm(page).getByLabel("Chi guida", { exact: true })).toHaveValue("");
    await addVehicle(page, { kind: "Pulmino", driver: "Anna Verdi", seats: "3", time: "1530", place: "Piazzale Stazione", notes: "Passa dalla scuola" });
    await expect(vehicleCard(page, "Anna Verdi")).toBeVisible();
    await expect(vehicleCard(page, "Anna Verdi").locator("[data-vehicle-title]")).toHaveText("Pulmino · Anna Verdi");
    await expect(vehicleCard(page, "Anna Verdi").locator("[data-vehicle-departure]")).toContainText("Partenza ore 15:30 · Piazzale Stazione");
    await expect(vehicleCard(page, "Anna Verdi")).toContainText("Passa dalla scuola");
    await expect(stat(page, "free")).toHaveText("5");

    // Chi va con chi: due sull'auto (che si riempie), due sul pulmino.
    await chooseVehicle(unplacedRow(page, names[0]), "Auto di Solo Nome");
    await unplacedRow(page, names[0]).locator("[data-assign]").click();
    await expect(unplacedRow(page, names[0])).toHaveCount(0);
    await chooseVehicle(unplacedRow(page, names[1]), "Auto di Solo Nome · 1 posto libero");
    await unplacedRow(page, names[1]).locator("[data-assign]").click();
    await expect(unplacedRow(page, names[1])).toHaveCount(0);
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-seats]")).toHaveText("2/2 posti");
    await expect(vehicleCard(page, "Solo Nome").locator("[data-passenger]")).toHaveCount(2);

    // Il mezzo pieno non si offre più: restano solo i posti del pulmino.
    const options = unplacedRow(page, names[2]).locator("select option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(1)).toContainText("Pulmino di Anna Verdi · 3 posti liberi");
    await chooseVehicle(unplacedRow(page, names[2]), "Pulmino di Anna Verdi");
    await unplacedRow(page, names[2]).locator("[data-assign]").click();
    await expect(unplacedRow(page, names[2])).toHaveCount(0);
    await chooseVehicle(unplacedRow(page, names[3]), "Pulmino di Anna Verdi · 2 posti liberi");
    await unplacedRow(page, names[3]).locator("[data-assign]").click();
    await expect(page.locator("[data-trip-all-placed]")).toBeVisible();
    await expect(stat(page, "placed")).toHaveText("4");
    await expect(stat(page, "unplaced")).toHaveText("0");
    await expect(stat(page, "free")).toHaveText("1");

    // Si toglie un'atleta dall'auto: torna senza passaggio e il posto si libera.
    await vehicleCard(page, "Solo Nome").locator(`[data-passenger]`).filter({ hasText: names[1] }).locator("[data-unassign]").click();
    await expect(unplacedRow(page, names[1])).toBeVisible();
    await expect(vehicleCard(page, "Solo Nome").locator("[data-vehicle-seats]")).toHaveText("1/2 posti");
    await expect(stat(page, "unplaced")).toHaveText("1");

    // Un mezzo non può avere meno posti di chi c'è già sopra; con i posti giusti il cambio vale e il riquadro si richiude.
    const pulmino = vehicleCard(page, "Anna Verdi");
    await pulmino.locator("[data-vehicle-edit-button]").click();
    const edit = pulmino.locator('form[data-vehicle-form="edit"]');
    await expect(edit.getByLabel("Chi guida", { exact: true })).toHaveValue("Anna Verdi");
    await edit.getByLabel("Posti per le atlete").fill("1");
    await edit.locator("[data-vehicle-submit]").click();
    await expect(edit.locator("[data-vehicle-error]")).toContainText("Su questo mezzo ci sono già 2 atlete");
    await expect(edit.getByLabel("Posti per le atlete")).toHaveValue("1");
    await edit.getByLabel("Posti per le atlete").fill("6");
    await edit.getByLabel("Chi guida", { exact: true }).fill("Anna Verdi Rossi");
    await edit.getByLabel("Di chi è il mezzo").fill("Società");
    await edit.locator("[data-vehicle-submit]").click();
    await expect(vehicleCard(page, "Anna Verdi Rossi").locator("[data-vehicle-seats]")).toHaveText("2/6 posti");
    await expect(vehicleCard(page, "Anna Verdi Rossi").locator("[data-vehicle-owner]")).toHaveText("di Società");
    await expect(vehicleCard(page, "Anna Verdi Rossi").locator('[data-panel="edit"]')).toHaveCount(0);

    // Togliere un mezzo lascia senza passaggio chi c'era sopra (con la conferma).
    page.once("dialog", (dialog) => dialog.accept());
    await vehicleCard(page, "Solo Nome").locator("[data-vehicle-delete]").click();
    await expect(vehicleCard(page, "Solo Nome")).toHaveCount(0);
    await expect(stat(page, "unplaced")).toHaveText("2");
    await expect(unplacedRow(page, names[0])).toBeVisible();

    // Le note riservate restano.
    await page.locator("#trip-notes").fill("Pranzo al sacco, rientro verso le 20");
    await page.locator("[data-trip-notes-save]").click();
    await page.waitForLoadState("networkidle");
    await openTrip(page, matchId);
    await expect(page.locator("#trip-notes")).toHaveValue("Pranzo al sacco, rientro verso le 20");

    // L'elenco segue: un mezzo, due convocate ancora senza passaggio.
    await page.goto("/admin/trasferte");
    await expect(page.locator(`[data-trip-row="${matchId}"] [data-trip-status]`)).toContainText("1 mezzo · 2 su 4 hanno un passaggio, ne mancano 2");

    // Un messaggio d'errore arrivato dall'indirizzo si vede (le azioni dei pulsanti non hanno altro posto per dirlo).
    await page.goto(`/admin/trasferte/${matchId}?errore=${encodeURIComponent("Il mezzo è pieno: non ci sono più posti.")}`);
    await expect(page.locator("[data-trip-error]")).toContainText("Il mezzo è pieno");
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, names);
  }
});

test("i mezzi si toccano: un posto libero mette un'atleta, uno occupato la toglie o la sposta, + e − cambiano i posti, il volante chi guida", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const tag = lettersTag();
  const names = ["Anna", "Bea", "Carla", "Dora"].map((first) => `${first} ${tag}`);
  await addAthletes(page, names);
  const matchId = await setupTrip(page, names, "Posti ");
  try {
    await openTrip(page, matchId);
    await addVehicle(page, { owner: "Famiglia Rossi", driver: "Mario Rossi", seats: "2" });
    await addVehicle(page, { kind: "Pulmino", owner: "Società", driver: "Luca Neri", seats: "3" });
    const auto = vehicleCard(page, "Mario Rossi");
    const van = vehicleCard(page, "Luca Neri");

    // Il mezzo visto dall'alto: chi guida, un «+» sul primo posto libero e la sagoma degli altri.
    await expect(auto.locator("[data-seat-driver]")).toContainText("Mario");
    await expect(seatsOf(auto, "add")).toHaveCount(1);
    await expect(seatsOf(auto, "free")).toHaveCount(1);
    await expect(seatsOf(van, "add")).toHaveCount(1);
    await expect(seatsOf(van, "free")).toHaveCount(2);
    await expect(auto.locator("[data-vehicle-owner]")).toHaveText("di Famiglia Rossi");
    await expect(van.locator("[data-vehicle-owner]")).toHaveText("di Società");

    // Tocco sul «+»: scelgo chi sale. Il riquadro resta per la seconda e si chiude a mezzo pieno.
    await seatsOf(auto, "add").click();
    const picks = auto.locator('[data-panel="add"] [data-pick-athlete]');
    await expect(picks).toHaveCount(4);
    await picks.filter({ hasText: names[0] }).click();
    await expect(seatsOf(auto, "taken")).toHaveCount(1);
    await expect(seatsOf(auto, "taken").first()).toContainText("Anna");
    await expect(picks).toHaveCount(3);
    await picks.filter({ hasText: names[1] }).click();
    await expect(seatsOf(auto, "taken")).toHaveCount(2);
    await expect(seatsOf(auto, "add")).toHaveCount(0);
    await expect(seatsOf(auto, "free")).toHaveCount(0);
    await expect(auto.locator('[data-panel="add"]')).toHaveCount(0);
    await expect(auto.locator("[data-vehicle-seats]")).toHaveText("2/2 posti");
    await expect(stat(page, "placed")).toHaveText("2");
    await expect(stat(page, "unplaced")).toHaveText("2");
    await expect(stat(page, "free")).toHaveText("3");

    // Tocco su un posto occupato: sposto Anna sul pulmino.
    await seatsOf(auto, "taken").filter({ hasText: "Anna" }).click();
    await expect(auto.locator('[data-panel="seat"]')).toContainText(names[0]);
    await auto.locator("[data-seat-move-to]").click();
    await expect(seatsOf(van, "taken")).toHaveCount(1);
    await expect(seatsOf(van, "taken").first()).toContainText("Anna");
    await expect(seatsOf(auto, "taken")).toHaveCount(1);
    await expect(auto.locator('[data-panel="seat"]')).toHaveCount(0);

    // E tolgo Bea dal suo mezzo: torna tra quelle senza passaggio.
    await seatsOf(auto, "taken").filter({ hasText: "Bea" }).click();
    await auto.locator("[data-seat-remove]").click();
    await expect(seatsOf(auto, "taken")).toHaveCount(0);
    await expect(unplacedRow(page, names[1])).toBeVisible();
    await expect(stat(page, "unplaced")).toHaveText("3");
    await expect(stat(page, "placed")).toHaveText("1");

    // + e −: i posti del pulmino (3 → 4 → 1); il − si ferma a chi c'è già sopra.
    await van.locator("[data-seats-plus]").click();
    await expect(van.locator("[data-vehicle-seats]")).toHaveText("1/4 posti");
    await expect(seatsOf(van, "free")).toHaveCount(2);
    await van.locator("[data-seats-minus]").click();
    await expect(van.locator("[data-vehicle-seats]")).toHaveText("1/3 posti");
    await van.locator("[data-seats-minus]").click();
    await expect(van.locator("[data-vehicle-seats]")).toHaveText("1/2 posti");
    await van.locator("[data-seats-minus]").click();
    await expect(van.locator("[data-vehicle-seats]")).toHaveText("1/1 posti");
    await expect(van.locator("[data-seats-minus]")).toBeDisabled();
    await expect(seatsOf(van, "add")).toHaveCount(0);
    await expect(stat(page, "free")).toHaveText("2");

    // Il volante: chi guida e di chi è si cambiano dal mezzo stesso, con il modulo già compilato.
    await auto.locator("[data-seat-driver]").click();
    const edit = auto.locator('form[data-vehicle-form="edit"]');
    await expect(edit.getByLabel("Chi guida", { exact: true })).toHaveValue("Mario Rossi");
    await expect(edit.getByLabel("Di chi è il mezzo")).toHaveValue("Famiglia Rossi");
    await edit.getByLabel("Di chi è il mezzo").fill("Famiglia Bianchi");
    await edit.getByLabel("Chi guida", { exact: true }).fill("Paolo Bianchi");
    await edit.locator("[data-vehicle-submit]").click();
    const changed = vehicleCard(page, "Paolo Bianchi");
    await expect(changed.locator("[data-vehicle-title]")).toHaveText("Auto · Paolo Bianchi");
    await expect(changed.locator("[data-vehicle-owner]")).toHaveText("di Famiglia Bianchi");
    await expect(changed.locator("[data-seat-driver]")).toContainText("Paolo");
    await expect(changed.locator('[data-panel="edit"]')).toHaveCount(0);
    // Se il mezzo è di chi guida, «di chi è» non si ripete.
    await changed.locator("[data-vehicle-edit-button]").click();
    await changed.locator('form[data-vehicle-form="edit"]').getByLabel("Di chi è il mezzo").fill("paolo  BIANCHI");
    await changed.locator('form[data-vehicle-form="edit"] [data-vehicle-submit]').click();
    await expect(changed.locator('[data-panel="edit"]')).toHaveCount(0);
    await expect(changed.locator("[data-vehicle-owner]")).toHaveCount(0);

    // Tutto è arrivato al server: riaprendo la pagina è com'era.
    await settled(page);
    await openTrip(page, matchId);
    await expect(vehicleCard(page, "Luca Neri").locator("[data-vehicle-seats]")).toHaveText("1/1 posti");
    await expect(seatsOf(vehicleCard(page, "Luca Neri"), "taken")).toContainText("Anna");
    await expect(vehicleCard(page, "Paolo Bianchi").locator("[data-seat-driver]")).toContainText("Paolo");
    await expect(unplacedRow(page, names[1])).toBeVisible();
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, names);
  }
});

test("le atlete si trascinano da un mezzo all'altro, i mezzi già usati si rimettono con un tocco, un cambio rifiutato dal server torna com'era", async ({ page, context }) => {
  test.setTimeout(420_000);
  // Il browser di prova non scorre la pagina a metà trascinamento (e se scorre il trascinamento salta): partenza e arrivo
  // devono vedersi insieme, quindi lo schermo è alto abbastanza da contenere i mezzi e l'elenco sotto.
  await page.setViewportSize({ width: 1280, height: 1900 });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const tag = lettersTag();
  const names = ["Elena", "Fede", "Giada", "Hilda"].map((first) => `${first} ${tag}`);
  // Chi guida ha un nome solo di questa prova: i mezzi «già usati» arrivano da tutte le altre trasferte, anche di prove precedenti.
  const mario = `Mario ${tag}`;
  const luca = `Luca ${tag}`;
  await addAthletes(page, names);
  const first = await setupTrip(page, names, "Trascina ");
  const second = await setupTrip(page, names, "Riuso ");
  const other = await context.newPage();
  try {
    await openTrip(page, first);
    await addVehicle(page, { owner: "Famiglia Rossi", driver: mario, phone: "333 1234567", seats: "2" });
    await addVehicle(page, { kind: "Pulmino", owner: "Società", driver: luca, seats: "3" });
    const auto = vehicleCard(page, mario);
    const van = vehicleCard(page, luca);

    // Dalle «senza passaggio» alla scheda di un mezzo; da un mezzo all'altro; dal mezzo di nuovo alle «senza passaggio».
    await unplacedRow(page, names[0]).locator("[data-unplaced-handle]").dragTo(auto);
    await expect(unplacedRow(page, names[0])).toHaveCount(0);
    await expect(seatsOf(auto, "taken").filter({ hasText: "Elena" })).toHaveCount(1);
    await seatsOf(auto, "taken").filter({ hasText: "Elena" }).dragTo(van);
    await expect(seatsOf(van, "taken").filter({ hasText: "Elena" })).toHaveCount(1);
    await expect(seatsOf(auto, "taken")).toHaveCount(0);
    await seatsOf(van, "taken").filter({ hasText: "Elena" }).dragTo(page.locator("[data-unplaced-zone]"));
    await expect(unplacedRow(page, names[0])).toBeVisible();
    await expect(seatsOf(van, "taken")).toHaveCount(0);

    // Un mezzo pieno non accetta altre atlete: si riempie l'auto (2 posti) e la terza non entra.
    await unplacedRow(page, names[1]).locator("[data-unplaced-handle]").dragTo(auto);
    await expect(seatsOf(auto, "taken")).toHaveCount(1);
    await unplacedRow(page, names[2]).locator("[data-unplaced-handle]").dragTo(auto);
    await expect(seatsOf(auto, "taken")).toHaveCount(2);
    await unplacedRow(page, names[3]).locator("[data-unplaced-handle]").dragTo(auto);
    await expect(seatsOf(auto, "taken")).toHaveCount(2);
    await expect(unplacedRow(page, names[3])).toBeVisible();
    await expect(stat(page, "placed")).toHaveText("2");

    // Le atlete dell'auto tornano libere per la prova dei mezzi già usati.
    await settled(page);

    // Nell'altra trasferta i mezzi di questa si rimettono con un tocco, con di chi sono, i posti e il numero.
    await openTrip(page, second);
    const suggestions = page.locator("[data-suggestions] [data-suggestion]").filter({ hasText: tag });
    await expect(suggestions).toHaveCount(2);
    await expect(suggestions.first()).toContainText(`Auto · ${mario} · di Famiglia Rossi · 2 posti`);
    await expect(suggestions.last()).toContainText(`Pulmino · ${luca} · di Società · 3 posti`);
    await page.locator(`[data-suggestion="${luca}"]`).click();
    const vanHere = vehicleCard(page, luca);
    await expect(vanHere).toBeVisible();
    await expect(vanHere.locator("[data-vehicle-owner]")).toHaveText("di Società");
    await expect(vanHere.locator("[data-vehicle-seats]")).toHaveText("0/3 posti");
    await expect(page.locator(`[data-suggestion="${luca}"]`)).toHaveCount(0);
    await page.locator(`[data-suggestion="${mario}"]`).click();
    const autoHere = vehicleCard(page, mario);
    await expect(autoHere.locator("[data-vehicle-phone]")).toHaveAttribute("href", "tel:3331234567");
    await expect(page.locator("[data-suggestions] [data-suggestion]").filter({ hasText: tag })).toHaveCount(0);
    await settled(page);

    // Due persone sulla stessa trasferta: la seconda ha davanti uno stato vecchio (l'auto ancora vuota).
    await openTrip(other, second);
    const autoOther = vehicleCard(other, mario);
    await expect(seatsOf(autoOther, "add")).toHaveCount(1);
    // La prima riempie l'auto...
    await seatsOf(autoHere, "add").click();
    await autoHere.locator('[data-panel="add"] [data-pick-athlete]').filter({ hasText: names[0] }).click();
    await autoHere.locator('[data-panel="add"] [data-pick-athlete]').filter({ hasText: names[1] }).click();
    await expect(seatsOf(autoHere, "taken")).toHaveCount(2);
    await settled(page);
    // ...la seconda ne mette una terza: il server dice di no, e sullo schermo torna com'era con il motivo.
    await seatsOf(autoOther, "add").click();
    await autoOther.locator('[data-panel="add"] [data-pick-athlete]').filter({ hasText: names[2] }).click();
    await expect(other.locator("[data-trip-board-error]")).toContainText("Il mezzo è pieno: non ci sono più posti.");
    await expect(seatsOf(autoOther, "taken")).toHaveCount(0);
    await expect(unplacedRow(other, names[2])).toBeVisible();
  } finally {
    await other.close().catch(() => {});
    await deleteMatchById(page, first).catch(() => {});
    await deleteMatchById(page, second).catch(() => {});
    await deleteAthletes(page, names);
  }
});

test("la rubrica dei genitori: numeri per atleta, controllati, con il link per chiamare, e in aiuto nella trasferta", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const names = ["Elena", "Fede"].map((first) => `${first} ${tag}`);
  await addAthletes(page, names);
  const matchId = await createAwayMatch(page, uniqueName("Rubrica "));
  try {
    await callUp(page, matchId, names);

    await page.goto("/admin/trasferte/rubrica");
    await page.waitForLoadState("networkidle");
    const athleteRow = (name: string) => page.locator("[data-rubrica-athlete]").filter({ hasText: name });
    const edit = (name: string) => athleteRow(name).locator("[data-rubrica-edit]");
    await expect(athleteRow(names[0])).toContainText("Nessun numero");
    // Quante atlete hanno già un numero (altre prove nello stesso database possono averne): dopo il salvataggio una in più.
    const withNumbers = async () => Number((await page.locator("[data-rubrica-count]").textContent())?.match(/^(\d+) su /)?.[1]);
    const before = await withNumbers();

    // Un numero senza nome, o un nome senza numero, o un numero che non lo è: si dice cosa correggere e non si salva niente.
    await edit(names[0]).locator("summary").click();
    const form = edit(names[0]).locator("form");
    await form.getByLabel("Numero 1").fill("333 111 2222");
    await form.locator("[data-contacts-submit]").click();
    await expect(form.locator("[data-contacts-error]")).toContainText("Riga 1: scrivi il nome di chi si deve chiamare.");
    await form.getByLabel("Nome 1").fill("Giulia Bianchi");
    await form.getByLabel("Numero 1").fill("333 abc");
    await form.locator("[data-contacts-submit]").click();
    await expect(form.locator("[data-contacts-error]")).toContainText("il numero di Giulia Bianchi non sembra un numero di telefono");

    // Due genitori: salvati, con il link che fa partire la chiamata.
    await form.getByLabel("Numero 1").fill("333 111 2222");
    await form.getByLabel("Chi è 1").fill("mamma");
    await form.getByLabel("Nome 2").fill("Paolo Bianchi");
    await form.getByLabel("Chi è 2").fill("papà");
    await form.getByLabel("Numero 2").fill("+39 340 7654321");
    await form.locator("[data-contacts-submit]").click();
    await expect(form.locator("[data-contacts-saved]")).toBeVisible();
    await expect(athleteRow(names[0]).locator("[data-contact-phone]")).toHaveCount(2);
    await expect(athleteRow(names[0]).locator("[data-contact-phone]").first()).toHaveAttribute("href", "tel:3331112222");
    await expect(athleteRow(names[0]).locator("[data-contact-phone]").last()).toHaveAttribute("href", "tel:+393407654321");
    await expect(athleteRow(names[0])).toContainText("mamma · Giulia Bianchi");
    await expect(athleteRow(names[0])).not.toContainText("Nessun numero");
    await expect(page.locator("[data-rubrica-count]")).toContainText(`${before + 1} su `);

    // Riaprendo la pagina i numeri sono lì.
    await page.goto("/admin/trasferte/rubrica");
    await expect(athleteRow(names[0]).locator("[data-contact-phone]")).toHaveCount(2);

    // Nella trasferta: i numeri accanto all'atleta, e chi guida senza numero scritto lo prende dalla rubrica (se è in rubrica una volta sola).
    await openTrip(page, matchId);
    await expect(unplacedRow(page, names[0]).locator("[data-contact-phone]")).toHaveCount(2);
    await expect(unplacedRow(page, names[1]).locator("[data-contact-phone]")).toHaveCount(0);
    await addVehicle(page, { driver: "paolo  BIANCHI", seats: "3" });
    await expect(vehicleCard(page, "paolo BIANCHI")).toBeVisible();
    await expect(vehicleCard(page, "paolo BIANCHI").locator("[data-vehicle-phone]")).toHaveAttribute("href", "tel:+393407654321");
    await chooseVehicle(unplacedRow(page, names[0]), "Auto di paolo BIANCHI");
    await unplacedRow(page, names[0]).locator("[data-assign]").click();
    await expect(vehicleCard(page, "paolo BIANCHI").locator("[data-passenger]").locator("[data-contact-phone]")).toHaveCount(2);

    // Il nome di chi guida si suggerisce dalla rubrica.
    await expect(page.locator('datalist[id$="-nomi"] option').first()).toHaveAttribute("value", "Giulia Bianchi");

    // Toglierli tutti cancella la rubrica dell'atleta.
    await page.goto("/admin/trasferte/rubrica");
    await edit(names[0]).locator("summary").click();
    const again = edit(names[0]).locator("form");
    for (const label of ["Nome 1", "Chi è 1", "Numero 1", "Nome 2", "Chi è 2", "Numero 2"]) await again.getByLabel(label).fill("");
    await again.locator("[data-contacts-submit]").click();
    await expect(athleteRow(names[0])).toContainText("Nessun numero");
    await expect(athleteRow(names[0]).locator("[data-contact-phone]")).toHaveCount(0);
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, names);
  }
});

test("il riepilogo PDF si scarica solo con il permesso, con o senza i numeri degli autisti, e non resta in cache", async ({ page }) => {
  test.setTimeout(200_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const names = [`Gina ${tag}`];
  await addAthletes(page, names);
  const matchId = await createAwayMatch(page, uniqueName("Riepilogo "));
  try {
    await callUp(page, matchId, names);
    await openTrip(page, matchId);
    await addVehicle(page, { driver: "Marco Pdf", phone: "338 5550000", seats: "3" });
    await expect(vehicleCard(page, "Marco Pdf")).toBeVisible();

    // I pulsanti seguono la casella: di norma niente numeri.
    const download = page.locator("[data-trip-pdf-download]");
    await expect(download).toHaveAttribute("href", `/api/trasferte/${matchId}/pdf`);
    await expect(page.locator('[data-share-pdf="trasferta"]')).toHaveAttribute("data-share-href", `/api/trasferte/${matchId}/pdf`);
    await page.locator("[data-trip-pdf-numbers]").check();
    await expect(download).toHaveAttribute("href", `/api/trasferte/${matchId}/pdf?numeri=autisti`);
    await expect(page.locator('[data-share-pdf="trasferta"]')).toHaveAttribute("data-share-href", `/api/trasferte/${matchId}/pdf?numeri=autisti`);

    for (const query of ["", "?numeri=autisti"]) {
      const response = await page.request.get(`/api/trasferte/${matchId}/pdf${query}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("application/pdf");
      expect(response.headers()["cache-control"]).toMatch(/no-store/);
      expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="trasferta-.*\.pdf"/);
      expect((await response.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    }
    // Una partita che non c'è.
    expect((await page.request.get("/api/trasferte/00000000-0000-4000-8000-000000000000/pdf")).status()).toBe(404);
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, names);
  }
});

test("sezione super riservata: un Admin non la vede né la raggiunge finché il Developer non gliela apre", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createAwayMatch(page, uniqueName("Riservata "));
  const username = uniqueName("trasf");
  const password = "Trasf123";
  const finalPassword = "Trasf1234";
  try {
    // Il Developer la vede.
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Trasferte", exact: true })).toBeVisible();
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-match-trip-link]")).toBeVisible();

    // Un nuovo Admin parte senza.
    await page.goto("/admin/staff");
    await page.getByLabel("Nome e cognome").fill("Admin Trasferte E2E");
    await page.getByLabel("Nome utente").fill(username);
    await page.getByLabel("Password temporanea").fill(password);
    await page.getByRole("button", { name: /crea account admin/i }).click();
    await expect(page.getByText("Account creato")).toBeVisible();
    await page.goto("/admin/centro-controllo");
    const permissionsRow = page.locator("form", { hasText: `@${username}` }).first();
    await expect(permissionsRow.locator("label", { hasText: "Trasferte" }).locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(permissionsRow.locator("label", { hasText: "Pronostici" }).locator('input[type="checkbox"]')).toBeChecked();

    await logout(page);
    await login(page, username, password);
    await expect(page).toHaveURL(/\/cambia-password/);
    await page.getByLabel("Password attuale").fill(password);
    await page.getByLabel("Nuova password", { exact: true }).fill(finalPassword);
    await page.getByLabel("Conferma nuova password").fill(finalPassword);
    await page.getByRole("button", { name: /aggiorna password/i }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);
    await dismissTourIfShown(page);

    // Niente voce di menu, niente pagine, niente PDF, niente collegamento dalla partita, niente nella guida.
    await expect(page.getByRole("link", { name: "Trasferte", exact: true })).toHaveCount(0);
    for (const path of ["/admin/trasferte", `/admin/trasferte/${matchId}`, "/admin/trasferte/rubrica"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/?$/);
    }
    const pdf = await page.request.get(`/api/trasferte/${matchId}/pdf`);
    expect(pdf.status()).toBe(403);
    expect(pdf.headers()["content-type"]).not.toContain("application/pdf");
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.getByRole("heading", { name: /@ Riservata/ }).or(page.getByText("Riservata").first())).toBeVisible();
    await expect(page.locator("[data-match-trip-link]")).toHaveCount(0);
    await page.goto("/admin/guida");
    expect(await page.textContent("body")).not.toContain("Numeri di telefono e rubrica dei genitori");

    // Il Developer gliela apre: ora la vede e la apre.
    await logout(page);
    await loginAsDev(page);
    await page.goto("/admin/centro-controllo");
    const row = page.locator("form", { hasText: `@${username}` }).first();
    await row.locator("label", { hasText: "Trasferte" }).click();
    await expect(row.locator("label", { hasText: "Trasferte" }).locator('input[type="checkbox"]')).toBeChecked();
    await page.waitForLoadState("networkidle");

    await logout(page);
    await login(page, username, finalPassword);
    await expect(page).toHaveURL(/\/admin(\?|$)/);
    await dismissTourIfShown(page);
    await expect(page.getByRole("link", { name: "Trasferte", exact: true })).toBeVisible();
    await page.goto(`/admin/trasferte/${matchId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/trasferte/${matchId}$`));
    await expect(page.locator("[data-trip-stat]").first()).toBeVisible();
    expect((await page.request.get(`/api/trasferte/${matchId}/pdf`)).status()).toBe(200);
    await page.goto(`/admin/partite/${matchId}`);
    await expect(page.locator("[data-match-trip-link]")).toBeVisible();
    await page.goto("/admin/guida");
    expect(await page.textContent("body")).toContain("Numeri di telefono e rubrica dei genitori");
  } finally {
    await logout(page).catch(() => {});
    await loginAsDev(page).catch(() => {});
    await deleteMatchById(page, matchId).catch(() => {});
  }
});
