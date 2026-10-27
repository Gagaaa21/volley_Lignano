import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Un solo pulsante per ogni documento del sito, non solo per i PDF: i CSV (partite, presenze, anagrafica, storico), il calendario
 * pubblico e quello di un singolo evento (.ics), la foto del certificato. Dal computer è un normale link o un download; da iPhone,
 * iPad e Android apre il file in un foglio dentro la pagina, con l'anteprima, «Condividi» (o «Scarica» se il telefono non sa
 * mandare quel tipo di file) e «Chiudi». Per i PDF vedi pdf-iphone.spec.ts e pdf-android.spec.ts, per la copia dello Scout
 * scout-salvataggio.spec.ts.
 */

test.use({ serviceWorkers: "block" });

type Shared = { name: string; type: string; size: number };
type SharedWindow = Window & { __fileShared?: Shared[] };

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

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

/**
 * Il telefono sa mandare dei file con il foglio di condivisione: qui se ne finge uno che ricorda cosa riceve. Con `calendars: false`
 * rifiuta i calendari .ics, come fa Chrome su Android (accetta solo certi tipi di file).
 */
async function withShare(page: Page, options: { calendars: boolean }) {
  await page.addInitScript((calendars) => {
    const w = window as SharedWindow;
    w.__fileShared = [];
    const accepts = (data?: ShareData) => Boolean(data?.files?.length) && (calendars || data!.files!.every((file) => file.type !== "text/calendar"));
    Object.defineProperty(navigator, "canShare", { configurable: true, value: accepts });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        w.__fileShared!.push({ name: file.name, type: file.type, size: file.size });
      },
    });
  }, options.calendars);
}

const shared = (page: Page) => page.evaluate(() => (window as SharedWindow).__fileShared ?? []);
const sheet = (page: Page) => page.locator("[data-file-sheet]");

/** Il pulsante, dopo che la pagina ha deciso se è un link (computer) o un pulsante (telefono). */
async function expectPhoneButton(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toHaveJSProperty("tagName", "BUTTON");
}

test.describe("dal computer", () => {
  test("i CSV scaricano il file e il calendario pubblico è un normale link", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");

    await page.goto("/admin/partite");
    const csv = page.locator("[data-matches-csv]");
    await expect(csv).toHaveJSProperty("tagName", "A");
    await expect(csv).toHaveAttribute("href", "/api/partite/csv");
    const [download] = await Promise.all([page.waitForEvent("download"), csv.click()]);
    expect(download.suggestedFilename()).toMatch(/^partite-.*\.csv$/);
    await expect(sheet(page)).toHaveCount(0);

    await page.goto("/admin/presenze/storico");
    await expect(page.locator("[data-history-csv]")).toHaveJSProperty("tagName", "A");

    await page.goto("/");
    const ics = page.locator("[data-public-ics]");
    await expect(ics).toHaveJSProperty("tagName", "A");
    await expect(ics).toHaveAttribute("href", "/calendario.ics");
  });
});

test.describe("dall'iPhone", () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("CSV: «Esporta CSV» apre il foglio con il testo e «Condividi» manda il file", async ({ page }) => {
    test.setTimeout(120_000);
    let downloads = 0;
    page.on("download", () => (downloads += 1));
    await withShare(page, { calendars: true });
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    await page.goto("/admin/partite");
    const url = page.url();

    // Un pulsante, non un link al file: con il sito sulla schermata Home non si tornerebbe più indietro.
    await expectPhoneButton(page, "[data-matches-csv]");
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);
    await page.locator("[data-matches-csv]").click();
    await expect(sheet(page)).toBeVisible();
    // Il CSV si legge subito, come testo.
    await expect(sheet(page).locator("[data-file-sheet-text]")).toContainText("Data,Ora,Categoria,Avversario");
    await sheet(page).locator("[data-file-sheet-share]").click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    const [file] = await shared(page);
    expect(file.name).toMatch(/^partite-.*\.csv$/);
    expect(file.type).toBe("text/csv");
    expect(file.size).toBeGreaterThan(30);
    await sheet(page).locator("[data-file-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
    expect(page.url()).toBe(url);
    expect(downloads).toBe(0);
  });

  test("CSV di presenze: storico e anagrafica sono pulsanti che aprono il foglio", async ({ page }) => {
    test.setTimeout(120_000);
    await withShare(page, { calendars: true });
    await loginAsDev(page);
    await switchTeam(page, "u14u15");

    await page.goto("/admin/presenze/storico");
    await expectPhoneButton(page, "[data-history-csv]");
    await page.locator("[data-history-csv]").click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page).locator("[data-file-sheet-share]").click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    expect((await shared(page))[0].name).toMatch(/^presenze-.*\.csv$/);
    await sheet(page).locator("[data-file-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);

    // L'esportazione dell'anagrafica compare quando c'è almeno un'atleta.
    const name = uniqueName("Csv ");
    await page.goto("/admin/presenze/atlete/nuova");
    await page.getByLabel("Nome e cognome").fill(name);
    await page.getByLabel(/Categoria/i).selectOption("U14");
    await page.getByRole("button", { name: /salva atleta/i }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
    try {
      await expectPhoneButton(page, "[data-athletes-csv]");
      await expectPhoneButton(page, "[data-summary-csv]");
      await page.locator("[data-summary-csv]").click();
      await expect(sheet(page).locator("[data-file-sheet-text]")).toBeVisible();
      await sheet(page).locator("[data-file-sheet-share]").click();
      await expect.poll(async () => (await shared(page)).length).toBe(2);
      expect((await shared(page))[1].name).toMatch(/^riepilogo-presenze-.*\.csv$/);
      await sheet(page).locator("[data-file-sheet-close]").click();
    } finally {
      page.once("dialog", (dialog) => void dialog.accept());
      await page.goto("/admin/presenze/atlete");
      const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
      if ((await edit.count()) > 0) {
        await edit.click();
        await page.getByRole("button", { name: "Elimina", exact: true }).click();
        await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
      }
    }
  });

  test("calendario pubblico: «Aggiungi al tuo calendario» apre il foglio e manda il file .ics", async ({ page }) => {
    test.setTimeout(90_000);
    await withShare(page, { calendars: true });
    await page.goto("/");
    await expectPhoneButton(page, "[data-public-ics]");
    await page.locator("[data-public-ics]").click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator("[data-file-sheet-text]")).toContainText("BEGIN:VCALENDAR");
    await sheet(page).locator("[data-file-sheet-share]").click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    const [file] = await shared(page);
    expect(file.name).toBe("volley-lignano.ics");
    expect(file.type).toBe("text/calendar");
    await sheet(page).locator("[data-file-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
  });

  test("calendario di un evento: «Aggiungi al calendario» apre il foglio sopra la finestra, e Esc chiude solo il foglio", async ({ page }) => {
    test.setTimeout(150_000);
    await withShare(page, { calendars: true });
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    const opponent = uniqueName("Calendario ");
    await page.goto("/admin/partite/nuovo");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Squadra avversaria").fill(opponent);
    await page.getByLabel("Luogo della partita").fill("Palestra file e2e");
    await page.getByLabel("Data e ora").fill(`${localDate(3)}T18:00`);
    await page.getByRole("button", { name: /salva partita/i }).click();
    await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
    const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
    const matchId = href!.split("/").pop()!;
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.locator("button", { hasText: opponent }).filter({ visible: true }).first().click();
      const dialog = page.getByRole("dialog", { name: "Dettagli evento" });
      await expect(dialog).toBeVisible();
      await dialog.locator("[data-event-calendar]").click();
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page).locator("[data-file-sheet-text]")).toContainText("BEGIN:VEVENT");
      await sheet(page).locator("[data-file-sheet-share]").click();
      await expect.poll(async () => (await shared(page)).length).toBe(1);
      const [file] = await shared(page);
      expect(file.name).toMatch(/\.ics$/);
      expect(file.type).toBe("text/calendar");
      // Esc chiude il foglio e lascia aperta la finestra dell'evento.
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Chiudi" }).click();
      await expect(dialog).toHaveCount(0);
    } finally {
      await deleteMatchById(page, matchId);
    }
  });

  test("foto del certificato: «Vedi la foto» apre la foto nel foglio, con «Condividi»", async ({ page }) => {
    test.setTimeout(150_000);
    await withShare(page, { calendars: true });
    await loginAsDev(page);
    const name = uniqueName("Foto ");
    await page.goto("/admin/presenze/atlete/nuova");
    await page.getByLabel("Nome e cognome").fill(name);
    await page.getByLabel(/Categoria/i).selectOption("U14");
    await page.getByRole("button", { name: /salva atleta/i }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
    try {
      await page.goto("/admin/certificati");
      const row = page.locator("[data-certificate-row]").filter({ hasText: name });
      await row.locator("[data-certificate-edit]").click();
      const editor = row.locator("[data-certificate-editor]");
      await editor.locator("[data-certificate-issued]").fill(localDate(-10));
      await expect(editor.locator("[data-certificate-preview]")).toHaveAttribute("data-certificate-preview", "valid");
      await editor.locator("[data-certificate-photo-input]").setInputFiles("src/assets/lignano-crest.png");
      await expect(editor.locator("[data-certificate-photo-chosen]")).toContainText("Foto pronta");
      await editor.locator("[data-certificate-save]").click();
      await expect(row.locator('[data-certificate-photo="yes"]')).toBeVisible({ timeout: 20_000 });

      // Un pulsante, non un link all'immagine: si vede nel foglio, con «Chiudi», senza lasciare il sito.
      const url = page.url();
      await expectPhoneButton(page, "[data-certificate-photo-link]");
      await row.locator("[data-certificate-photo-link]").click();
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page).locator("img[data-file-sheet-preview]")).toHaveAttribute("src", /^blob:/);
      await sheet(page).locator("[data-file-sheet-share]").click();
      await expect.poll(async () => (await shared(page)).length).toBe(1);
      const [file] = await shared(page);
      expect(file.name).toBe("certificato-medico.jpg");
      expect(file.type).toBe("image/jpeg");
      await sheet(page).locator("[data-file-sheet-close]").click();
      await expect(sheet(page)).toHaveCount(0);
      expect(page.url()).toBe(url);
    } finally {
      page.once("dialog", (dialog) => void dialog.accept());
      await page.goto("/admin/presenze/atlete");
      const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
      if ((await edit.count()) > 0) {
        await edit.click();
        await page.getByRole("button", { name: "Elimina", exact: true }).click();
        await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
      }
    }
  });

  test("se il telefono non sa mandare un calendario resta «Scarica»", async ({ page }) => {
    test.setTimeout(90_000);
    await withShare(page, { calendars: false });
    await page.goto("/");
    await expectPhoneButton(page, "[data-public-ics]");
    await page.locator("[data-public-ics]").click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator("[data-file-sheet-share]")).toHaveCount(0);
    await expect(sheet(page).locator("[data-file-sheet-download]")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), sheet(page).locator("[data-file-sheet-download]").click()]);
    expect(download.suggestedFilename()).toBe("volley-lignano.ics");
    await sheet(page).locator("[data-file-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
  });
});

test.describe("da Android", () => {
  test.use({ userAgent: ANDROID_UA, viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test("il calendario pubblico si apre nel foglio; Chrome non manda i .ics, quindi c'è «Scarica»", async ({ page }) => {
    test.setTimeout(90_000);
    await withShare(page, { calendars: false });
    await page.goto("/?cat=U15");
    await expectPhoneButton(page, "[data-public-ics]");
    await page.locator("[data-public-ics]").click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator("[data-file-sheet-text]")).toContainText("BEGIN:VCALENDAR");
    await expect(sheet(page).locator("[data-file-sheet-share]")).toHaveCount(0);
    const [download] = await Promise.all([page.waitForEvent("download"), sheet(page).locator("[data-file-sheet-download]").click()]);
    expect(download.suggestedFilename()).toBe("volley-lignano-u15.ics");
    await expect(sheet(page).locator("[data-file-sheet-message]")).toContainText("File scaricato");
    await sheet(page).locator("[data-file-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
  });
});
