import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Ogni PDF del sito si può scaricare e condividere come file. «Condividi PDF» apre il foglio di condivisione del
 * telefono con il PDF già allegato (qui si fa finta di averlo); dal computer scarica lo stesso file. Il PDF che dà il
 * server ha il nome giusto (con la categoria per le partite) e il pulsante segue l'indirizzo che si vede a schermo.
 */

test.use({ serviceWorkers: "block" });

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

/** Il telefono sa mandare un file con il foglio di condivisione: qui se ne finge uno che ricorda cosa riceve. */
async function asPhone(page: Page) {
  await page.addInitScript(() => {
    window.__pdfShared = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => Boolean(data?.files?.length) });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        window.__pdfShared!.push({ name: file.name, type: file.type, size: file.size, title: data.title });
      },
    });
  });
}

const shareButton = (page: Page, id: string) => page.locator(`[data-share-pdf="${id}"]`);
const sharedFiles = (page: Page) => page.evaluate(() => window.__pdfShared ?? []);

/** Un solo tocco (il PDF si prepara da solo all'apertura della pagina) e il foglio di condivisione riceve il PDF. */
async function shareWithOneTap(page: Page, button: Locator, expected: { name: string | RegExp; title: RegExp }) {
  await expect(button).toHaveAttribute("data-share-ready", "true", { timeout: 30_000 });
  const before = (await sharedFiles(page)).length;
  await button.click();
  await expect.poll(async () => (await sharedFiles(page)).length).toBe(before + 1);
  const shared = (await sharedFiles(page))[before];
  expect(shared.type).toBe("application/pdf");
  expect(shared.size).toBeGreaterThan(1_000);
  expect(shared.name).toMatch(expected.name);
  expect(shared.title).toMatch(expected.title);
}

/** Il PDF non si prepara da solo: il primo tocco lo prepara, il secondo apre il foglio di condivisione. */
async function shareWithTwoTaps(page: Page, button: Locator, expected: { name: string | RegExp; title: RegExp }) {
  const before = (await sharedFiles(page)).length;
  await button.click();
  // «Pronto: tocca per condividere» (nei pulsanti con la sola icona il testo sta nel nome accessibile, quindi si guarda lo stato).
  await expect(button).toHaveAttribute("data-share-status", "ready", { timeout: 30_000 });
  expect((await sharedFiles(page)).length).toBe(before);
  await button.click();
  await expect.poll(async () => (await sharedFiles(page)).length).toBe(before + 1);
  const shared = (await sharedFiles(page))[before];
  expect(shared.type).toBe("application/pdf");
  expect(shared.size).toBeGreaterThan(1_000);
  expect(shared.name).toMatch(expected.name);
  expect(shared.title).toMatch(expected.title);
}

async function createMatch(page: Page, category: "Under 14" | "Under 15", opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByText(category, { exact: true }).click();
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra Condividi e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** Uno scout con qualche scambio, scritto direttamente (come fa il sito mentre si segna). */
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
  const data = {
    settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" },
    roster: { us: [], opp: [] },
    events,
    finished: false,
  };
  const status = await page.evaluate(
    async ({ matchId, data }) =>
      (await fetch(`/api/scout/${matchId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, baseVersion: null }) })).status,
    { matchId, data },
  );
  expect(status).toBe(200);
}

test("sito pubblico, dal computer: «Condividi» scarica lo stesso PDF del pulsante «Scarica», con il filtro scelto", async ({ page }) => {
  await page.goto("/");
  const share = shareButton(page, "calendario-partite");
  await expect(share).toBeVisible();
  await expect(share).toContainText("Condividi");
  await expect(share).toHaveAttribute("data-share-href", "/calendario-partite.pdf");
  const [download] = await Promise.all([page.waitForEvent("download"), share.click()]);
  expect(download.suggestedFilename()).toBe("calendario-partite-volley-lignano.pdf");
  expect(readFileSync((await download.path())!).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expect(share).toContainText("PDF scaricato");

  // Con una categoria scelta il PDF è quello di quella categoria.
  await page.goto("/?cat=U15");
  await expect(shareButton(page, "calendario-partite")).toHaveAttribute("data-share-href", "/calendario-partite.pdf?cat=U15");
  const [u15] = await Promise.all([page.waitForEvent("download"), shareButton(page, "calendario-partite").click()]);
  expect(u15.suggestedFilename()).toBe("calendario-partite-under-15-volley-lignano.pdf");
});

test("sito pubblico, dal telefono: «Condividi» apre il foglio di condivisione con il PDF delle partite", async ({ page }) => {
  test.setTimeout(90_000);
  await asPhone(page);
  let downloads = 0;
  page.on("download", () => (downloads += 1));
  await page.goto("/?cat=U14");
  await shareWithOneTap(page, shareButton(page, "calendario-partite"), {
    name: "calendario-partite-under-14-volley-lignano.pdf",
    title: /Calendario partite Under 14/,
  });
  expect(downloads).toBe(0);
});

test("area tecnici, dal telefono: partite, formazioni e scout hanno il loro «Condividi PDF»", async ({ page }) => {
  test.setTimeout(240_000);
  await asPhone(page);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Condividi ");
  const matchId = await createMatch(page, "Under 14", opponent);
  const date = localDate();
  try {
    await seedScout(page, matchId);

    // Elenco partite: il PDF dello staff, che segue il filtro di categoria.
    await page.goto("/admin/partite");
    await shareWithOneTap(page, shareButton(page, "partite-staff"), {
      name: "calendario-partite-staff-volley-lignano.pdf",
      title: /Calendario partite/,
    });
    await page.goto("/admin/partite?cat=U15");
    await expect(shareButton(page, "partite-staff")).toHaveAttribute("data-share-href", "/api/partite/pdf?cat=U15");

    // Formazioni di gara (dalla finestra Convocazioni e formazioni): il nome ha categoria, avversaria e data.
    await page.goto(`/admin/partite/${matchId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    await shareWithTwoTaps(page, shareButton(page, "formazioni"), {
      name: new RegExp(`^formazioni-u14-${opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}\\.pdf$`),
      title: /Formazioni/,
    });

    // Scout: nell'elenco (accanto a «PDF») e nel tabellino.
    await page.goto("/admin/scout");
    const rowShare = page.locator(`[data-scout-match="${matchId}"]`).locator('[data-share-pdf="tabellino"]');
    await expect(rowShare).toHaveAttribute("data-share-href", `/api/scout/${matchId}/pdf`);
    await shareWithTwoTaps(page, rowShare, {
      name: new RegExp(`^tabellino-u14-${opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}\\.pdf$`),
      title: /Tabellino/,
    });
    await page.goto(`/admin/scout/${matchId}/tabellino`);
    await shareWithOneTap(page, shareButton(page, "tabellino"), {
      name: new RegExp(`^tabellino-u14-.*${date}\\.pdf$`),
      title: /Tabellino/,
    });
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
  }
});

test("area tecnici, dal telefono: riepilogo presenze e riepilogo test fisici", async ({ page }) => {
  test.setTimeout(240_000);
  await asPhone(page);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Un'atleta con un test, perché l'elenco e la tabella non siano vuoti.
  const unique = uniqueName("Condividi ");
  const name = `${unique} Anna`;
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(name);
  await page.getByLabel(/Categoria/i).selectOption("U14");
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });

  // Riepilogo presenze (nell'elenco delle atlete).
  await expect(shareButton(page, "riepilogo-presenze")).toHaveAttribute("data-share-href", "/api/presenze/riepilogo/pdf");
  await shareWithTwoTaps(page, shareButton(page, "riepilogo-presenze"), {
    name: "riepilogo-presenze-u14u15.pdf",
    title: /Riepilogo presenze/,
  });

  await page.goto("/admin/test-fisici/nuovo");
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
  await page.getByLabel("Data della sessione").fill("2026-04-02");
  await page.getByLabel("Peso in kg").fill("50.5");
  await page.getByRole("button", { name: /salva test/i }).click();
  await page.waitForURL(/\/admin\/test-fisici\/atleta\/[^/]+$/, { timeout: 20_000 });

  // Test fisici: il pulsante segue i filtri che si vedono a schermo, come «Scarica PDF».
  await page.goto("/admin/test-fisici/riepilogo");
  const share = shareButton(page, "test-fisici");
  const pdfHref = await page.locator("[data-riepilogo-pdf]").getAttribute("href");
  await expect(share).toHaveAttribute("data-share-href", pdfHref!);
  await page.getByRole("button", { name: "Tutte le sessioni" }).click();
  await page.getByLabel("Cerca un'atleta").fill(unique);
  await expect(share).toHaveAttribute("data-share-href", /view=tutte/);
  await shareWithTwoTaps(page, share, { name: "test-fisici-tutte.pdf", title: /test fisici/i });
});
