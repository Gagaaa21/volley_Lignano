import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * PDF da scaricare: il calendario partite dal sito pubblico (senza accesso) e,
 * per lo staff, le partite, il riepilogo presenze e il riepilogo test fisici.
 * Si controlla che siano veri PDF, con il nome file giusto e che le strade
 * riservate restino riservate.
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

function pdfHeader(body: Buffer): string {
  return body.subarray(0, 5).toString("latin1");
}

async function downloadBytes(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), body: readFileSync(path) };
}

async function createMatch(page: Page, opponent: string, date: string) {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra PDF e2e");
  await page.getByLabel("Data e ora").fill(date);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
}

test("sito pubblico: «Scarica le partite (PDF)» scarica un PDF, per tutte le categorie o per una sola", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const link = page.locator("[data-public-matches-pdf]");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/calendario-partite.pdf");

  const all = await downloadBytes(page, () => link.click());
  expect(all.name).toBe("calendario-partite-volley-lignano.pdf");
  expect(pdfHeader(all.body)).toBe("%PDF-");

  // Filtrando una categoria nel calendario, il PDF segue il filtro.
  await page.goto("/?cat=U15");
  await expect(page.locator("[data-public-matches-pdf]")).toHaveAttribute("href", "/calendario-partite.pdf?cat=U15");

  const one = await request.get("/calendario-partite.pdf?cat=U15");
  expect(one.status()).toBe(200);
  expect(one.headers()["content-type"]).toBe("application/pdf");
  expect(one.headers()["content-disposition"]).toContain("calendario-partite-under-15-volley-lignano.pdf");
  expect(pdfHeader(Buffer.from(await one.body()))).toBe("%PDF-");

  // Una categoria sconosciuta non rompe nulla: si ottiene il calendario completo.
  const odd = await request.get("/calendario-partite.pdf?cat=boh");
  expect(odd.status()).toBe(200);
  expect(odd.headers()["content-disposition"]).toContain("calendario-partite-volley-lignano.pdf");
});

test("area staff: PDF delle partite, del riepilogo presenze e dei test fisici; senza accesso non si scarica nulla", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Una partita e un'atleta con un test, perché i documenti non siano vuoti.
  const opponent = uniqueName("Squadra PDF ");
  await createMatch(page, opponent, "2026-11-21T18:00");

  // Partite: il pulsante scarica il PDF dello staff.
  await page.goto("/admin/partite");
  const matches = await downloadBytes(page, () => page.getByRole("link", { name: "Esporta PDF" }).click());
  expect(matches.name).toBe("calendario-partite-staff-volley-lignano.pdf");
  expect(pdfHeader(matches.body)).toBe("%PDF-");

  // Con il filtro di categoria, lo stesso.
  await page.goto("/admin/partite?cat=U15");
  await expect(page.getByRole("link", { name: "Esporta PDF" })).toHaveAttribute("href", "/api/partite/pdf?cat=U15");

  // Riepilogo presenze e test fisici (anche con filtri strani nell'indirizzo).
  for (const [url, filename] of [
    ["/api/presenze/riepilogo/pdf", "riepilogo-presenze-u14u15.pdf"],
    ["/api/test-fisici/riepilogo/pdf?view=tutte", "test-fisici-tutte.pdf"],
    ["/api/test-fisici/riepilogo/pdf?view=giorno&day=2026-10-08&q=ann&sort=peso&dir=asc", "test-fisici-2026-10-08.pdf"],
    ["/api/test-fisici/riepilogo/pdf?view=nonvalida&sort=hack&day=ieri", "test-fisici-ultimo.pdf"],
  ] as const) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toBe("application/pdf");
    expect(res.headers()["content-disposition"], url).toContain(filename);
    expect(pdfHeader(Buffer.from(await res.body())), url).toBe("%PDF-");
  }

  // Senza accesso le strade dello staff rimandano al login, mai un PDF.
  for (const url of ["/api/partite/pdf", "/api/presenze/riepilogo/pdf", "/api/test-fisici/riepilogo/pdf"]) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(307);
    expect(res.headers()["location"], url).toContain("/login");
  }

  // Pulizia: la partita di prova non deve restare nel server demo condiviso dalla suite.
  await page.goto("/admin/partite");
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  await deleteMatchById(page, href!.split("/").pop()!);
});

test("riepilogo test fisici: «Scarica PDF» porta i filtri che si vedono a schermo", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Un'atleta con un test, per avere la tabella.
  const unique = uniqueName("PdfTest ");
  const name = `${unique} Anna`;
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(name);
  await page.getByLabel(/Categoria/i).selectOption("U14");
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
  await page.goto("/admin/test-fisici/nuovo");
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
  await page.getByLabel("Data della sessione").fill("2026-04-02");
  await page.getByLabel("Peso in kg").fill("50.5");
  await page.getByRole("button", { name: /salva test/i }).click();
  await page.waitForURL(/\/admin\/test-fisici\/atleta\/[^/]+$/, { timeout: 20_000 });

  await page.goto("/admin/test-fisici/riepilogo");
  const pdf = page.locator("[data-riepilogo-pdf]");
  await expect(pdf).toBeVisible();
  await expect(pdf).toHaveAttribute("href", /view=ultimo/);

  await page.getByRole("button", { name: "Tutte le sessioni" }).click();
  await page.getByLabel("Cerca un'atleta").fill(unique);
  await expect(pdf).toHaveAttribute("href", /view=tutte/);
  await expect(pdf).toHaveAttribute("href", new RegExp(`q=${encodeURIComponent(unique).replace(/%20/g, "\\+")}`));

  const file = await downloadBytes(page, () => pdf.click());
  expect(file.name).toBe("test-fisici-tutte.pdf");
  expect(pdfHeader(file.body)).toBe("%PDF-");
});
