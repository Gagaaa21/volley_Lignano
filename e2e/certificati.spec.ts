import { expect, test, type Page } from "@playwright/test";
import { dismissTourIfShown, localDate, login, loginAsDev, logout, uniqueName } from "./helpers";

/**
 * Certificati medici. Il genitore, dal suo link personale, sceglie con il calendario il giorno della visita; la scadenza la calcola il
 * sito, un anno dopo, e dice se è valido. Un mese prima della scadenza diventa rosso, per lo staff (in cima alla sezione e in
 * dashboard, con il messaggio pronto per avvisare il genitore) e per il genitore. Lo staff scrive, corregge e toglie la data, e si
 * vede chi l'ha scritta. La sezione ha un permesso a sé, che un nuovo Admin non ha.
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

/** Lo stesso giorno, un anno dopo (come calcola il sito; il 29 febbraio diventa il 28). */
function oneYearAfter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** «17 ottobre 2027», come il sito scrive la scadenza. */
function longDay(date: string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00`));
}

/** Giorni da oggi a `date` (negativo se è passato), nel calendario. */
function daysFromToday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const now = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

async function addAthletes(page: Page, names: string[]) {
  await page.goto("/admin/presenze/atlete/elenco");
  await page.waitForLoadState("networkidle");
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
    await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
  }
}

async function createLink(page: Page, name: string): Promise<string> {
  await page.goto("/admin/assenze/link");
  const row = page.locator("[data-family-row]").filter({ hasText: name });
  if ((await row.locator("[data-family-create]").count()) > 0) await row.locator("[data-family-create]").click();
  await expect(row).toHaveAttribute("data-family-path", /^\/disponibilita\/[A-Za-z0-9_-]{32}$/);
  return (await row.getAttribute("data-family-path"))!;
}

/** Una foto vera da caricare (lo stemma): il telefono la rimpicciolisce e la manda come JPEG. */
const PHOTO = "src/assets/lignano-crest.png";

const row = (page: Page, name: string) => page.locator("[data-certificate-row]").filter({ hasText: name });
const group = (page: Page, key: "attention" | "missing" | "valid") => page.locator(`[data-certificate-group="${key}"]`);
const familyCard = (page: Page) => page.locator("[data-family-certificate]");
/** Il riquadro del certificato sta dopo le assenze alle partite (true) o prima (false). */
const cardAfterAbsences = (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector("[data-family-certificate]");
    const absences = document.querySelector("[data-family-absences]");
    return card && absences ? Boolean(absences.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  });

/** Il giorno della visita nel modulo (lo stesso per genitore e staff): accanto compare subito la scadenza, un anno dopo. */
async function chooseVisit(scope: ReturnType<Page["locator"]>, issued: string) {
  await expect(async () => {
    await scope.locator("[data-certificate-issued]").fill(issued);
    await expect(scope.locator("[data-certificate-until]")).toHaveText(longDay(oneYearAfter(issued)), { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

test("il genitore sceglie il giorno della visita dal suo link e la scadenza viene da sé; in rosso un mese prima; lo staff avvisa e corregge", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  const tag = lettersTag();
  const anna = `Anna Certificato ${tag}`;
  const bea = `Bea Certificato ${tag}`;
  await addAthletes(page, [anna, bea]);
  const parent = await browser.newPage();
  try {
    const path = await createLink(page, anna);

    // All'inizio nessuna ha la data: «Da inserire», non valido.
    await page.goto("/admin/certificati");
    await expect(page.getByRole("heading", { name: "Certificati medici", level: 1 })).toBeVisible();
    for (const name of [anna, bea]) {
      await expect(group(page, "missing").locator("[data-certificate-row]").filter({ hasText: name })).toHaveAttribute("data-certificate-status", "missing");
      await expect(row(page, name).locator("[data-certificate-badge]")).toHaveText("Da inserire");
    }

    // Il genitore: il riquadro è in cima, prima delle partite, con il calendario già aperto. Scelta la visita, la scadenza è un anno dopo.
    await parent.goto(path);
    await expect(parent.locator("[data-family-athlete]")).toContainText(anna);
    const card = familyCard(parent);
    await expect(card).toHaveAttribute("data-family-certificate", "warning");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText("Da inserire");
    expect(await cardAfterAbsences(parent)).toBe(false);
    // Un solo campo da scegliere: la scadenza non si scrive.
    await expect(card.locator('input[type="date"]')).toHaveCount(1);
    await chooseVisit(card, localDate(-10));
    await expect(card.locator("[data-certificate-preview]")).toHaveAttribute("data-certificate-preview", "valid");
    // E la foto del certificato: si vede l'anteprima, già rimpicciolita, prima di salvare.
    await card.locator("[data-certificate-photo-input]").setInputFiles(PHOTO);
    await expect(card.locator("[data-certificate-photo-chosen]")).toContainText("Foto pronta");
    await card.locator("[data-certificate-save]").click();
    await expect(card.locator("[data-family-certificate-saved]")).toContainText("Grazie, salvato");
    await expect(card.locator('[data-family-certificate-photo="yes"]')).toContainText("Foto del certificato caricata");
    await expect(card).toHaveAttribute("data-family-certificate", "success");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText("Valido");
    await expect(card.locator("[data-family-certificate-detail]")).toHaveText(`Valido fino al ${longDay(oneYearAfter(localDate(-10)))}.`);
    await expect(card.locator('[data-validity-bar="valid"]')).toBeVisible();
    await expect(card).toContainText("Data scritta da voi");

    // Lo staff lo vede valido, scritto dal genitore, con la barra della validità.
    await page.goto("/admin/certificati");
    await expect(group(page, "valid").locator("[data-certificate-row]").filter({ hasText: anna })).toBeVisible();
    await expect(row(page, anna).locator("[data-certificate-author]")).toContainText("Data scritta dal genitore");
    await expect(row(page, anna).locator('[data-validity-bar="valid"]')).toBeVisible();
    // In regola e con la foto: niente da mandare.
    await expect(row(page, anna).locator("[data-certificate-remind]")).toHaveCount(0);
    // La foto la vede lo staff, e solo lui: dal server arriva un JPEG che non resta in nessuna cache.
    await expect(row(page, anna).locator('[data-certificate-photo="yes"]')).toContainText("Foto caricata dal genitore");
    const photoUrl = (await row(page, anna).locator("[data-certificate-photo-link]").getAttribute("href"))!;
    expect(photoUrl).toMatch(/^\/api\/certificati\/[^/]+\/foto$/);
    const photo = await page.request.get(photoUrl);
    expect(photo.status()).toBe(200);
    expect(photo.headers()["content-type"]).toBe("image/jpeg");
    expect(photo.headers()["cache-control"]).toContain("no-store");
    expect(Array.from((await photo.body()).subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(photoUrl)).status()).toBe(401);
    await anonymous.close();

    // Una visita di più di due anni fa è quasi sicuramente l'anno sbagliato: lo dice e non salva.
    await parent.reload();
    await card.locator("[data-family-certificate-change]").click();
    await chooseVisit(card, localDate(-800));
    await card.locator("[data-certificate-save]").click();
    await expect(card).toContainText("Controlla l'anno: la visita risulta di più di due anni fa.");

    // Una visita di 345 giorni fa: scade fra una ventina di giorni, ancora valido ma rosso (già nell'anteprima).
    const visit = localDate(-345);
    const left = daysFromToday(oneYearAfter(visit));
    await chooseVisit(card, visit);
    await expect(card.locator("[data-certificate-preview]")).toHaveAttribute("data-certificate-preview", "expiring");
    await card.locator("[data-certificate-save]").click();
    await expect(card).toHaveAttribute("data-family-certificate", "danger");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText(`Scade tra ${left} giorni`);
    await expect(card.locator("[data-family-certificate-detail]")).toContainText("va rinnovato");
    await expect(card.locator('[data-validity-bar="expiring"]')).toBeVisible();
    // Visita nuova senza foto nuova: la foto di prima era del certificato vecchio, e va via.
    await expect(card.locator('[data-family-certificate-photo="no"]')).toContainText("Manca la foto del certificato");
    expect((await page.request.get(photoUrl)).status()).toBe(404);

    // Lo staff: in cima, in rosso, con il messaggio pronto (nome, scadenza e link al riquadro del certificato).
    await page.goto("/admin/certificati");
    const annaRow = group(page, "attention").locator("[data-certificate-row]").filter({ hasText: anna });
    await expect(annaRow).toHaveAttribute("data-certificate-status", "expiring");
    await expect(annaRow.locator("[data-certificate-badge]")).toHaveText(`Scade tra ${left} giorni`);
    await expect(annaRow.locator('[data-validity-bar="expiring"]')).toBeVisible();
    const href = await annaRow.locator("[data-certificate-remind]").first().getAttribute("href");
    const text = decodeURIComponent(href!.split("?text=")[1]);
    expect(text).toContain(`Il certificato medico di Anna scade il ${longDay(oneYearAfter(visit))}`);
    expect(text).toContain(`${path}#certificato`);
    expect(text).toContain("caricate una foto del certificato");
    // E lo dice la dashboard.
    await page.goto("/admin");
    await expect(page.locator("[data-dashboard-certificates]")).toContainText("1 in scadenza");

    // Lo staff scrive la visita di Bea (senza link): già scaduto, «da Gaga»; il messaggio chiede la data a voce.
    await page.goto("/admin/certificati");
    await row(page, bea).locator("[data-certificate-edit]").click();
    const editor = row(page, bea).locator("[data-certificate-editor]");
    await chooseVisit(editor, localDate(-400));
    await expect(editor.locator("[data-certificate-preview]")).toHaveAttribute("data-certificate-preview", "expired");
    await editor.locator("[data-certificate-save]").click();
    const beaRow = group(page, "attention").locator("[data-certificate-row]").filter({ hasText: bea });
    await expect(beaRow).toHaveAttribute("data-certificate-status", "expired");
    await expect(beaRow.locator("[data-certificate-badge]")).toHaveText("Scaduto");
    await expect(beaRow.locator("[data-certificate-detail]")).toContainText("Non valido: scaduto il");
    await expect(beaRow.locator("[data-certificate-author]")).toContainText("Data scritta da Gaga");
    await expect(beaRow.locator("[data-certificate-no-link]")).toBeVisible();
    // Prima chi è già scaduto, poi chi scade.
    const order = await group(page, "attention").locator("[data-certificate-row]").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
    expect(order.findIndex((t) => t.includes(bea))).toBeLessThan(order.findIndex((t) => t.includes(anna)));
    await page.goto("/admin");
    await expect(page.locator("[data-dashboard-certificates]")).toContainText("1 scaduto · 1 in scadenza");

    // Togliendo la data si torna a «Da inserire».
    await page.goto("/admin/certificati");
    await row(page, bea).locator("[data-certificate-edit]").click();
    page.once("dialog", (dialog) => dialog.accept());
    await row(page, bea).locator("[data-certificate-clear]").click();
    await expect(group(page, "missing").locator("[data-certificate-row]").filter({ hasText: bea })).toBeVisible();

    // Il genitore rinnova: si parte da zero, con il giorno della visita nuova e la sua foto; torna verde e resta in cima.
    await parent.reload();
    await expect(familyCard(parent).locator("[data-certificate-issued]")).toHaveValue("");
    await chooseVisit(familyCard(parent), localDate(-2));
    await familyCard(parent).locator("[data-certificate-photo-input]").setInputFiles(PHOTO);
    await expect(familyCard(parent).locator("[data-certificate-photo-chosen]")).toBeVisible();
    await familyCard(parent).locator("[data-certificate-save]").click();
    await expect(familyCard(parent)).toHaveAttribute("data-family-certificate", "success");
    await parent.reload();
    expect(await cardAfterAbsences(parent)).toBe(false);
    await expect(familyCard(parent).locator("[data-certificate-form]")).toHaveCount(0);
    await expect(familyCard(parent).locator('[data-family-certificate-photo="yes"]')).toBeVisible();

    // Lo staff toglie la sola foto: la data resta, e il messaggio pronto chiede solo la foto.
    await page.goto("/admin/certificati");
    await row(page, anna).locator("[data-certificate-edit]").click();
    page.once("dialog", (dialog) => dialog.accept());
    await row(page, anna).locator("[data-certificate-photo-remove]").click();
    await expect(row(page, anna).locator('[data-certificate-photo="no"]')).toHaveText("Senza foto");
    await expect(row(page, anna)).toHaveAttribute("data-certificate-status", "valid");
    await expect(row(page, anna).locator("[data-certificate-remind]")).toContainText("Chiedi la foto");
    expect((await page.request.get(photoUrl)).status()).toBe(404);
  } finally {
    await parent.close();
    await deleteAthletes(page, [anna, bea]);
  }
  // Eliminate le atlete, i loro certificati non restano: la dashboard non avvisa più.
  await page.goto("/admin");
  await expect(page.locator("[data-dashboard-certificates]")).toHaveCount(0);
});

test("la sezione ha un permesso a sé: un nuovo Admin non la vede finché il Developer non gliela dà", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  const username = uniqueName("cert");
  const password = "Cert1234";
  const finalPassword = "Cert12345";
  await expect(page.getByRole("link", { name: "Certificati", exact: true })).toBeVisible();

  await page.goto("/admin/staff");
  await page.getByLabel("Nome e cognome").fill("Admin Certificati E2E");
  await page.getByLabel("Nome utente").fill(username);
  await page.getByLabel("Password temporanea").fill(password);
  await page.getByRole("button", { name: /crea account admin/i }).click();
  await expect(page.getByText("Account creato")).toBeVisible();
  await page.goto("/admin/centro-controllo");
  const permissions = page.locator("form", { hasText: `@${username}` }).first();
  await expect(permissions.locator("label", { hasText: "Certificati medici" }).locator('input[type="checkbox"]')).not.toBeChecked();

  await logout(page);
  await login(page, username, password);
  await expect(page).toHaveURL(/\/cambia-password/);
  await page.getByLabel("Password attuale").fill(password);
  await page.getByLabel("Nuova password", { exact: true }).fill(finalPassword);
  await page.getByLabel("Conferma nuova password").fill(finalPassword);
  await page.getByRole("button", { name: /aggiorna password/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await dismissTourIfShown(page);
  await expect(page.getByRole("link", { name: "Certificati", exact: true })).toHaveCount(0);
  await page.goto("/admin/certificati");
  await expect(page).toHaveURL(/\/admin\/?$/);
  // Nemmeno le foto dei certificati: il permesso si controlla prima di cercare l'atleta.
  expect((await page.request.get("/api/certificati/qualsiasi/foto")).status()).toBe(403);

  await logout(page);
  await loginAsDev(page);
  await page.goto("/admin/centro-controllo");
  const row = page.locator("form", { hasText: `@${username}` }).first();
  await row.locator("label", { hasText: "Certificati medici" }).click();
  await expect(row.locator("label", { hasText: "Certificati medici" }).locator('input[type="checkbox"]')).toBeChecked();
  await page.waitForLoadState("networkidle");

  await logout(page);
  await login(page, username, finalPassword);
  await dismissTourIfShown(page);
  await expect(page.getByRole("link", { name: "Certificati", exact: true })).toBeVisible();
  await page.goto("/admin/certificati");
  await expect(page).toHaveURL(/\/admin\/certificati$/);
  await expect(page.getByRole("heading", { name: "Certificati medici", level: 1 })).toBeVisible();
  await logout(page);
});
