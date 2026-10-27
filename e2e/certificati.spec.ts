import { expect, test, type Page } from "@playwright/test";
import { dismissTourIfShown, localDate, login, loginAsDev, logout, uniqueName } from "./helpers";

/**
 * Certificati medici. Il genitore, dal suo link personale, sceglie con il calendario il giorno della visita e fino a quando vale (la
 * scadenza si propone un anno dopo); il sito dice se è valido. Un mese prima della scadenza diventa rosso, per lo staff (in cima alla
 * sezione e in dashboard, con il messaggio pronto per avvisare il genitore) e per il genitore. Lo staff scrive, corregge e toglie le
 * date, e si vede chi le ha scritte. La sezione ha un permesso a sé, che un nuovo Admin non ha.
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

/** Lo stesso giorno, un anno dopo (come propone il sito; il 29 febbraio diventa il 28). */
function oneYearAfter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

/** Le due date nel modulo (lo stesso per genitore e staff), poi «Salva». */
async function fillDates(scope: ReturnType<Page["locator"]>, issued: string, until: string | null) {
  await scope.locator("[data-certificate-issued]").fill(issued);
  if (until !== null) await scope.locator("[data-certificate-until]").fill(until);
}

test("il genitore scrive le date dal suo link; valido, in scadenza da un mese prima (rosso) o scaduto; lo staff avvisa e corregge", async ({
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

    // All'inizio nessuna ha le date: «Da inserire», non valido.
    await page.goto("/admin/certificati");
    await expect(page.getByRole("heading", { name: "Certificati medici", level: 1 })).toBeVisible();
    for (const name of [anna, bea]) {
      await expect(group(page, "missing").locator("[data-certificate-row]").filter({ hasText: name })).toHaveAttribute("data-certificate-status", "missing");
      await expect(row(page, name).locator("[data-certificate-badge]")).toHaveText("Da inserire");
    }

    // Il genitore: il riquadro è in cima (prima delle partite), con il modulo già aperto. Scelta la visita, la scadenza si propone un anno dopo.
    await parent.goto(path);
    await expect(parent.locator("[data-family-athlete]")).toContainText(anna);
    const card = familyCard(parent);
    await expect(card).toHaveAttribute("data-family-certificate", "warning");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText("Da inserire");
    expect(await cardAfterAbsences(parent)).toBe(false);
    const issued = localDate(-10);
    await expect(async () => {
      await fillDates(card, issued, null);
      await expect(card.locator("[data-certificate-until]")).toHaveValue(oneYearAfter(issued), { timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await card.locator("[data-certificate-save]").click();
    await expect(card.locator("[data-family-certificate-saved]")).toHaveText("Grazie, date salvate.");
    await expect(card).toHaveAttribute("data-family-certificate", "success");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText("Valido");
    await expect(card).toContainText("date scritte da voi");

    // Lo staff lo vede valido, scritto dal genitore.
    await page.goto("/admin/certificati");
    await expect(group(page, "valid").locator("[data-certificate-row]").filter({ hasText: anna })).toBeVisible();
    await expect(row(page, anna).locator("[data-certificate-author]")).toContainText("date scritte dal genitore");
    // In regola: niente da mandare.
    await expect(row(page, anna).locator("[data-certificate-remind]")).toHaveCount(0);

    // Una scadenza troppo lontana non passa: lo dice e non salva.
    await parent.reload();
    await card.locator("[data-family-certificate-change]").click();
    await fillDates(card, localDate(-1), localDate(800));
    await card.locator("[data-certificate-save]").click();
    await expect(card).toContainText("Controlla la scadenza: un certificato vale di solito un anno dalla visita.");

    // Un certificato che scade fra 20 giorni: ancora valido, ma rosso.
    await fillDates(card, localDate(-340), localDate(20));
    await card.locator("[data-certificate-save]").click();
    await expect(card).toHaveAttribute("data-family-certificate", "danger");
    await expect(card.locator("[data-family-certificate-badge]")).toHaveText("Scade tra 20 giorni");
    await expect(card.locator("[data-family-certificate-detail]")).toContainText("va rinnovato");

    // Lo staff: in cima, in rosso, con il messaggio pronto (nome, scadenza e link al riquadro del certificato).
    await page.goto("/admin/certificati");
    const annaRow = group(page, "attention").locator("[data-certificate-row]").filter({ hasText: anna });
    await expect(annaRow).toHaveAttribute("data-certificate-status", "expiring");
    await expect(annaRow.locator("[data-certificate-badge]")).toHaveText("Scade tra 20 giorni");
    const href = await annaRow.locator("[data-certificate-remind]").first().getAttribute("href");
    const text = decodeURIComponent(href!.split("?text=")[1]);
    expect(text).toContain("Il certificato medico di Anna scade il");
    expect(text).toContain(`${path}#certificato`);
    expect(text).toContain("non serve mandare il certificato");
    // E lo dice la dashboard.
    await page.goto("/admin");
    await expect(page.locator("[data-dashboard-certificates]")).toContainText("1 in scadenza");

    // Lo staff scrive le date di Bea (senza link): già scaduto, «da Gaga»; il messaggio le chiede a voce.
    await page.goto("/admin/certificati");
    await row(page, bea).locator("[data-certificate-edit]").click();
    const editor = row(page, bea).locator("[data-certificate-editor]");
    await expect(async () => {
      await fillDates(editor, localDate(-400), localDate(-5));
      await expect(editor.locator("[data-certificate-until]")).toHaveValue(localDate(-5), { timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await editor.locator("[data-certificate-save]").click();
    const beaRow = group(page, "attention").locator("[data-certificate-row]").filter({ hasText: bea });
    await expect(beaRow).toHaveAttribute("data-certificate-status", "expired");
    await expect(beaRow.locator("[data-certificate-badge]")).toHaveText("Scaduto");
    await expect(beaRow.locator("[data-certificate-detail]")).toContainText("Non valido: scaduto il");
    await expect(beaRow.locator("[data-certificate-author]")).toContainText("date scritte da Gaga");
    await expect(beaRow.locator("[data-certificate-no-link]")).toBeVisible();
    // Prima chi è già scaduto, poi chi scade.
    const order = await group(page, "attention").locator("[data-certificate-row]").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
    expect(order.findIndex((t) => t.includes(bea))).toBeLessThan(order.findIndex((t) => t.includes(anna)));
    await page.goto("/admin");
    await expect(page.locator("[data-dashboard-certificates]")).toContainText("1 scaduto · 1 in scadenza");

    // Togliendo le date si torna a «Da inserire».
    await page.goto("/admin/certificati");
    await row(page, bea).locator("[data-certificate-edit]").click();
    page.once("dialog", (dialog) => dialog.accept());
    await row(page, bea).locator("[data-certificate-clear]").click();
    await expect(group(page, "missing").locator("[data-certificate-row]").filter({ hasText: bea })).toBeVisible();

    // Il genitore rinnova: si parte da zero, con le date del certificato nuovo; torna verde.
    await parent.reload();
    await expect(familyCard(parent).locator("[data-certificate-issued]")).toHaveValue("");
    await expect(async () => {
      await fillDates(familyCard(parent), localDate(-2), null);
      await expect(familyCard(parent).locator("[data-certificate-until]")).toHaveValue(oneYearAfter(localDate(-2)), { timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await familyCard(parent).locator("[data-certificate-save]").click();
    await expect(familyCard(parent)).toHaveAttribute("data-family-certificate", "success");
    await parent.reload();
    // In regola resta in cima, piccolo: salvando non si sposta.
    expect(await cardAfterAbsences(parent)).toBe(false);
    await expect(familyCard(parent).locator("[data-certificate-form]")).toHaveCount(0);
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
