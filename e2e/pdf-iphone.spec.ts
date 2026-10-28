import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * I PDF del sito da iPhone. Un solo pulsante «PDF» per ogni file, senza un secondo «Condividi»: si tocca, il PDF si apre in un foglio
 * dentro la pagina, con l'anteprima, «Condividi / Salva su File» (WhatsApp, e-mail…) e «Chiudi». Mai un link al file: con il sito
 * sulla schermata Home dell'iPhone un PDF aperto come pagina lascia senza «indietro» e senza modo di salvarlo o mandarlo, e non si
 * torna più al sito. Qui si finge un iPhone: la condivisione funziona, rifiuta (tocco scaduto) o non c'è (sistema vecchio), e in tutti
 * i casi la pagina di prima resta lì: nessuna nuova scheda, nessun download.
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
const sheet = (page: Page) => page.locator("[data-file-sheet]");

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
  await expect(sheet(page).locator("[data-file-sheet-preview]")).toHaveAttribute("src", /^blob:/);
  expect(page.url()).toBe(url);
  await sheet(page).locator("[data-file-sheet-close]").click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
}

/** Un solo pulsante: lo si tocca, si apre il foglio con il PDF, «Condividi» lo manda. Poi si chiude e si è dove si era. */
async function openAndShare(page: Page, trigger: Locator, expected: { name: string | RegExp; title: RegExp }) {
  const before = (await sharedFiles(page)).length;
  const url = page.url();
  await trigger.click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("[data-file-sheet-preview]")).toHaveAttribute("src", /^blob:/);
  await sheet(page).locator("[data-file-sheet-share]").click();
  await expect.poll(async () => (await sharedFiles(page)).length).toBe(before + 1);
  const shared = (await sharedFiles(page))[before];
  expect(shared.type).toBe("application/pdf");
  expect(shared.size).toBeGreaterThan(1_000);
  expect(shared.name).toMatch(expected.name);
  expect(shared.title).toMatch(expected.title);
  await sheet(page).locator("[data-file-sheet-close]").click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
}

async function createMatch(page: Page, category: "Under 14" | "Under 15", opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByText(category, { exact: true }).click();
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra iPhone e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** Uno scout con qualche scambio, scritto direttamente (come fa il sito mentre si segna): il tabellino ha il suo PDF. */
async function seedScout(page: Page, matchId: string) {
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
}

test("sito pubblico, da iPhone: un solo pulsante «PDF», che apre un foglio con «Condividi» e «Chiudi»", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "works");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();
  const pdf = page.locator("[data-public-matches-pdf]");

  // Su iPhone non è un link al file (altrimenti l'app resterebbe sul PDF): è un pulsante. E non ce n'è un secondo «Condividi».
  await expect(pdf).toHaveJSProperty("tagName", "BUTTON");
  await expect(pdf).not.toHaveAttribute("href", /.*/);
  await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);

  // Un tocco apre il PDF; da lì «Condividi / Salva su File» manda il file (già pronto, basta un tocco).
  await openAndShare(page, pdf, { name: "calendario-partite-under-14-volley-lignano.pdf", title: /Calendario partite Under 14/ });
  expect(page.url()).toBe(url);
  await expect(pdf).toBeVisible();

  // Si torna alla pagina di prima anche con il tasto Esc.
  await pdf.click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  leaks.expectNone();
});

test("da iPhone, se la condivisione rifiuta (tocco scaduto): lo dice nel foglio, senza uscire dalla pagina", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "refuses");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();
  // La pagina è pronta quando il link è diventato il pulsante che apre il foglio.
  await expect(page.locator("[data-public-matches-pdf]")).toHaveJSProperty("tagName", "BUTTON");

  await page.locator("[data-public-matches-pdf]").click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-file-sheet-share]").click();
  await expect(sheet(page).locator("[data-file-sheet-message]")).toContainText("Non riesco ad aprire la condivisione");
  // Il foglio resta aperto (c'è sempre «Chiudi» o «Torna al sito»), l'anteprima c'è ancora e la pagina non si è mossa.
  await expect(sheet(page).locator("[data-file-sheet-preview]")).toHaveAttribute("src", /^blob:/);
  await sheet(page).getByRole("button", { name: "Torna al sito" }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  leaks.expectNone();
});

test("da iPhone senza condivisione di file (sistema vecchio): il PDF si vede lo stesso nel foglio, senza scaricare né uscire", async ({ page }) => {
  test.setTimeout(90_000);
  await withShare(page, "none");
  const leaks = watchLeaks(page);
  await page.goto("/?cat=U14");
  const url = page.url();
  await expect(page.locator("[data-public-matches-pdf]")).toHaveJSProperty("tagName", "BUTTON");

  await page.locator("[data-public-matches-pdf]").click();
  await expectSheetThenClose(page, url);
  await page.locator("[data-public-matches-pdf]").click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("[data-file-sheet-share]")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Torna al sito" }).click();
  await expect(sheet(page)).toHaveCount(0);
  leaks.expectNone();
});

test("area tecnici, da iPhone: partite, convocazioni, formazioni e tabellino, un solo pulsante «PDF» e nessuna uscita dalla pagina", async ({ page }) => {
  test.setTimeout(300_000);
  await withShare(page, "works");
  const leaks = watchLeaks(page);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Iphone ");
  const matchId = await createMatch(page, "Under 14", opponent);
  const date = localDate();
  const slug = opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  try {
    await seedScout(page, matchId);

    // Elenco partite: il PDF dello staff, che segue il filtro di categoria.
    await page.goto("/admin/partite");
    const staffPdf = page.locator("[data-matches-pdf]");
    await expect(staffPdf).toHaveAttribute("data-file-href", "/api/partite/pdf");
    await openAndShare(page, staffPdf, { name: "calendario-partite-staff-volley-lignano.pdf", title: /Calendario partite/ });
    await page.goto("/admin/partite?cat=U15");
    await expect(page.locator("[data-matches-pdf]")).toHaveAttribute("data-file-href", "/api/partite/pdf?cat=U15");
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);

    // La partita: convocazioni e formazioni, ognuna con il suo solo pulsante.
    await page.goto(`/admin/partite/${matchId}`);
    await page.waitForLoadState("networkidle");
    const matchUrl = page.url();
    await expect(page.locator('a[href$="/convocazioni/pdf"], a[href$="/formazioni/pdf"]')).toHaveCount(0);
    await expect(page.locator('[data-match-pdfs] button')).toHaveCount(2);
    await openAndShare(page, page.locator("[data-convocations-pdf]"), {
      name: new RegExp(`^convocazioni-u14-${slug}-${date}\\.pdf$`),
      title: /Convocazioni/,
    });
    await openAndShare(page, page.locator("[data-lineups-pdf]"), {
      name: new RegExp(`^formazioni-u14-${slug}-${date}\\.pdf$`),
      title: /Formazioni/,
    });

    // La stessa cosa dalla finestra «Convocazioni e formazioni»: chiuso il foglio, la finestra è com'era.
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    await expect(dialog.locator("[data-convocations-pdf-dialog]")).toHaveAttribute("data-file-href", `/api/partite/${matchId}/convocazioni/pdf?ids=`);
    await openAndShare(page, dialog.locator("[data-convocations-pdf-dialog]"), {
      name: new RegExp(`^convocazioni-u14-${slug}-${date}\\.pdf$`),
      title: /Convocazioni/,
    });
    await expect(dialog).toBeVisible();
    await openAndShare(page, dialog.locator("[data-lineups-pdf-dialog]"), {
      name: new RegExp(`^formazioni-u14-${slug}-${date}\\.pdf$`),
      title: /Formazioni/,
    });
    await expect(dialog).toBeVisible();
    expect(page.url()).toBe(matchUrl);

    // Il tabellino: «PDF» era un link che portava sul file, senza ritorno.
    await page.goto(`/admin/scout/${matchId}/tabellino`);
    // (L'intestazione della pagina ripete i pulsanti per lo schermo stretto e per quello largo: conta quello che si vede.)
    const tabellinoPdf = page.locator("[data-scout-pdf]:visible");
    await expect(tabellinoPdf).toHaveJSProperty("tagName", "BUTTON");
    await openAndShare(page, tabellinoPdf, { name: new RegExp(`^tabellino-u14-.*${date}\\.pdf$`), title: /Tabellino/ });
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);

    // L'elenco dello Scout: il «PDF» accanto a ogni partita.
    await page.goto("/admin/scout");
    const row = page.locator(`[data-scout-match="${matchId}"]`);
    await expect(row.locator('a[href$="/pdf"]')).toHaveCount(0);
    await openAndShare(page, row.getByRole("button", { name: "Scarica il tabellino in PDF" }), {
      name: new RegExp(`^tabellino-u14-.*${date}\\.pdf$`),
      title: /Tabellino/,
    });
    leaks.expectNone();
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});

test("area tecnici, da iPhone: riepilogo presenze e riepilogo test fisici", async ({ page }) => {
  test.setTimeout(240_000);
  await withShare(page, "works");
  const leaks = watchLeaks(page);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Un'atleta con un test, perché l'elenco e la tabella non siano vuoti.
  const unique = uniqueName("Iphone ");
  const name = `${unique} Anna`;
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(name);
  await page.getByLabel(/Categoria/i).selectOption("U14");
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });

  // Riepilogo presenze (nell'elenco delle atlete).
  // Accanto c'è anche il CSV con lo stesso nome: il PDF si riconosce dal suo indirizzo.
  const presenze = page.locator('[data-file-href="/api/presenze/riepilogo/pdf"]');
  await expect(presenze).toHaveText("Presenze (PDF)");
  await openAndShare(page, presenze, { name: "riepilogo-presenze-u14u15.pdf", title: /Riepilogo presenze/ });

  await page.goto("/admin/test-fisici/nuovo");
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
  await page.getByLabel("Data della sessione").fill("2026-04-02");
  await page.getByLabel("Peso in kg").fill("50.5");
  await page.getByRole("button", { name: /salva test/i }).click();
  await page.waitForURL(/\/admin\/test-fisici\/atleta\/[^/]+$/, { timeout: 20_000 });

  // Test fisici: il pulsante segue i filtri che si vedono a schermo.
  await page.goto("/admin/test-fisici/riepilogo");
  const testFisici = page.locator("[data-riepilogo-pdf]");
  await page.getByRole("button", { name: "Tutte le sessioni" }).click();
  await page.getByLabel("Cerca un'atleta").fill(unique);
  await expect(testFisici).toHaveAttribute("data-file-href", /view=tutte/);
  await openAndShare(page, testFisici, { name: "test-fisici-tutte.pdf", title: /test fisici/i });
  leaks.expectNone();
});
