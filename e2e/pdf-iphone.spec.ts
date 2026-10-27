import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Su iPhone e iPad (con il sito sulla schermata Home) un link a un PDF lo apre dentro la stessa finestra dell'app, senza «indietro»
 * e senza un modo per salvarlo o mandarlo su WhatsApp: non si torna più al sito. Qui si finge un iPhone: i pulsanti «PDF» non
 * portano più al file ma aprono un foglio dentro la pagina (con «Chiudi» e «Condividi / Salva su File»), e se la condivisione non
 * parte (rifiutata, o non c'è) «Condividi PDF» apre lo stesso foglio invece di scaricare il file con un link. Mai nuove pagine né
 * download: la pagina di prima resta lì.
 */

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });

type Shared = { name: string; type: string; size: number; title?: string };
declare global {
  interface Window {
    __pdfShared?: Shared[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

type ShareMode = "works" | "refuses" | "none";

/** Il foglio di condivisione dell'iPhone: funziona (ricorda cosa riceve), rifiuta (come quando il tocco è scaduto) o non c'è. */
async function withShare(page: Page, mode: ShareMode) {
  await page.addInitScript((shareMode) => {
    window.__pdfShared = [];
    if (shareMode === "none") {
      Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      return;
    }
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => Boolean(data?.files?.length) });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        if (shareMode === "refuses") throw new DOMException("Il tocco è scaduto", "NotAllowedError");
        const file = data.files![0];
        window.__pdfShared!.push({ name: file.name, type: file.type, size: file.size, title: data.title });
      },
    });
  }, mode);
}

const sharedFiles = (page: Page) => page.evaluate(() => window.__pdfShared ?? []);
const sheet = (page: Page) => page.locator("[data-pdf-sheet]");

/** La pagina non si è mossa e non si è aperto altro: niente nuove schede, niente download. */
function watchLeaks(page: Page) {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  return {
    expectNone: () => {
      expect(downloads).toEqual([]);
      expect(page.context().pages()).toHaveLength(1);
    },
  };
}

/** Il foglio ha l'anteprima del PDF e si chiude, lasciando la pagina di prima com'era. */
async function expectSheetThenClose(page: Page, url: string) {
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("[data-pdf-sheet-preview]")).toHaveAttribute("src", /^blob:/);
  expect(page.url()).toBe(url);
  await sheet(page).locator("[data-pdf-sheet-close]").click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
}

test("sito pubblico, da iPhone: «PDF» non porta più al file, apre un foglio con «Condividi» e «Chiudi»", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "works");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();
  const pdf = page.locator("[data-public-matches-pdf]");

  // Su iPhone non è un link al file (altrimenti l'app resterebbe sul PDF): è un pulsante.
  await expect(pdf).toHaveJSProperty("tagName", "BUTTON");
  await expect(pdf).not.toHaveAttribute("href", /.*/);

  await pdf.click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("[data-pdf-sheet-preview]")).toHaveAttribute("src", /^blob:/);
  // «Condividi / Salva su File»: il foglio di condivisione riceve il PDF, già pronto (basta un tocco).
  await sheet(page).locator("[data-pdf-sheet-share]").click();
  await expect.poll(async () => (await sharedFiles(page)).length).toBe(1);
  const [shared] = await sharedFiles(page);
  expect(shared.type).toBe("application/pdf");
  expect(shared.name).toBe("calendario-partite-under-14-volley-lignano.pdf");
  expect(shared.size).toBeGreaterThan(1_000);

  // Si torna alla pagina di prima: «Chiudi», o il tasto Esc.
  await sheet(page).locator("[data-pdf-sheet-close]").click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(pdf).toBeVisible();
  await pdf.click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await sheet(page).waitFor({ state: "detached" });
  leaks.expectNone();
});

test("da iPhone, se la condivisione rifiuta: «Condividi PDF» apre il foglio dentro il sito, non scarica un file con un link", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "refuses");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();
  const share = page.locator('[data-share-pdf="calendario-partite"]');
  await expect(share).toHaveAttribute("data-share-ready", "true", { timeout: 30_000 });

  await share.click();
  await expectSheetThenClose(page, url);
  await expect(share).toHaveAttribute("data-share-status", "idle");

  // Dal foglio un altro tentativo rifiutato lo dice, senza uscire dalla pagina.
  await share.click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-pdf-sheet-share]").click();
  await expect(sheet(page).locator("[data-pdf-sheet-message]")).toContainText("Non riesco ad aprire la condivisione");
  await sheet(page).locator("[data-pdf-sheet-close]").click();
  leaks.expectNone();
});

test("da iPhone senza condivisione di file (sistema vecchio): «Condividi PDF» apre comunque il foglio, senza scaricare", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "none");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();

  await page.locator('[data-share-pdf="calendario-partite"]').click();
  await expectSheetThenClose(page, url);

  // E il pulsante «PDF» fa lo stesso: anteprima dentro il sito, senza il pulsante di condivisione che qui non può funzionare.
  await page.locator("[data-public-matches-pdf]").click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("[data-pdf-sheet-share]")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Torna al sito" }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  leaks.expectNone();
});

test("area tecnici, da iPhone: tabellino e convocazioni non portano più fuori dalla pagina", async ({ page }) => {
  test.setTimeout(240_000);
  await withShare(page, "works");
  const leaks = watchLeaks(page);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Iphone ");
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByText("Under 14", { exact: true }).click();
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra iPhone e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  const matchId = href!.split("/").pop()!;
  try {
    // Uno scout con qualche scambio (come lo scrive il sito mentre si segna): il tabellino ha il suo PDF.
    const base = Date.now() - 3_600_000;
    const events = Array.from({ length: 4 }, (_, i) => ({
      type: "rally",
      id: `seed-${i}`,
      at: base + i * 30_000,
      actor: i % 2 === 0 ? "us" : "opp",
      how: "attack",
      player: null,
      victim: null,
    }));
    const data = { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" }, roster: { us: [], opp: [] }, events, finished: false };
    const status = await page.evaluate(
      async ({ matchId, data }) =>
        (await fetch(`/api/scout/${matchId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, baseVersion: null }) })).status,
      { matchId, data },
    );
    expect(status).toBe(200);

    // Il tabellino: «Scarica PDF» era un link che portava sul file, senza ritorno.
    await page.goto(`/admin/scout/${matchId}/tabellino`);
    const tabellinoUrl = page.url();
    // (L'intestazione della pagina ripete i pulsanti per lo schermo stretto e per quello largo: conta quello che si vede.)
    const tabellinoPdf = page.locator("[data-scout-pdf]:visible");
    await expect(tabellinoPdf).toHaveJSProperty("tagName", "BUTTON");
    await tabellinoPdf.click();
    await expectSheetThenClose(page, tabellinoUrl);
    await expect(tabellinoPdf).toBeVisible();
    // E «Condividi PDF» è pronto e basta un tocco.
    const share = page.locator('[data-share-pdf="tabellino"]:visible');
    await expect(share).toHaveAttribute("data-share-ready", "true", { timeout: 30_000 });
    await share.click();
    await expect.poll(async () => (await sharedFiles(page)).length).toBe(1);

    // L'elenco dello Scout: il «PDF» accanto a ogni partita.
    await page.goto("/admin/scout");
    const listUrl = page.url();
    const row = page.locator(`[data-scout-match="${matchId}"]`);
    await expect(row.locator('a[href$="/pdf"]')).toHaveCount(0);
    await row.getByRole("button", { name: "Scarica il tabellino in PDF" }).click();
    await expectSheetThenClose(page, listUrl);

    // La partita: convocazioni e formazioni (anche dalla finestra «Convocazioni e formazioni»).
    await page.goto(`/admin/partite/${matchId}`);
    await page.waitForLoadState("networkidle");
    const matchUrl = page.url();
    await expect(page.locator('a[href$="/convocazioni/pdf"], a[href$="/formazioni/pdf"]')).toHaveCount(0);
    await page.locator("[data-convocations-pdf]").click();
    await expectSheetThenClose(page, matchUrl);
    await page.locator("[data-lineups-pdf]").click();
    await expectSheetThenClose(page, matchUrl);
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    await page.locator("[data-convocations-pdf-dialog]").click();
    await expect(sheet(page)).toBeVisible();
    // Sopra la finestra, che resta lì sotto: chiuso il foglio si ritrova com'era.
    await sheet(page).locator("[data-pdf-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('[aria-label="Convocazioni e formazioni"]')).toBeVisible();
    expect(page.url()).toBe(matchUrl);
    leaks.expectNone();
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});
