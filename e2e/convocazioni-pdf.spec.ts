import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Le convocazioni in PDF: dalla pagina della partita (quelle salvate) e dalla finestra delle convocazioni (la selezione che si
 * vede, anche non ancora salvata), con il nome del file giusto, senza cache e solo con la sessione di chi ha il permesso.
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

/** Una partita in casa fra `days` giorni (0 = oggi: per il genitore è già chiusa), con ritrovo. */
async function createMatch(page: Page, opponent: string, days: number): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra disponibilità e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(days)}T21:30`);
  await page.getByLabel("Ora ritrovo").fill("2045");
  await page.getByLabel("Luogo ritrovo").fill("Piazzale e2e");
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}


const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

test("le convocazioni in PDF: dalla pagina e dalla finestra, con la selezione che si vede, e solo con la sessione giusta", async ({ page, playwright }) => {
  test.setTimeout(300_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const names = ["Anna", "Bea", "Carla"].map((first) => `${first} ${tag}`);
  await addAthletes(page, names);
  const opponent = uniqueName("Convocazioni ");
  const matchId = await createMatch(page, opponent, 5);
  try {
    await page.goto(`/admin/partite/${matchId}`);
    await page.waitForLoadState("networkidle");

    // Dalla pagina: le convocate salvate. Ancora nessuna: il foglio c'è lo stesso, di una pagina.
    const href = (await page.locator("[data-convocations-pdf]").getAttribute("href"))!;
    expect(href).toBe(`/api/partite/${matchId}/convocazioni/pdf`);
    const empty = await page.request.get(href);
    expect(empty.status()).toBe(200);
    expect(empty.headers()["content-type"]).toBe("application/pdf");
    expect(empty.headers()["content-disposition"]).toMatch(new RegExp(`^attachment; filename="convocazioni-u1[45]-${slug(opponent)}-${localDate(5)}\\.pdf"$`));
    expect(empty.headers()["cache-control"]).toMatch(/no-store/);
    const emptyBytes = await empty.body();
    expect((await PDFDocument.load(emptyBytes)).getPageCount()).toBe(1);

    // Dalla finestra: due atlete segnate convocate ma non ancora salvate, e il PDF le ha già.
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
    const link = dialog.locator("[data-convocations-pdf-dialog]");
    await expect(link).toHaveAttribute("href", `/api/partite/${matchId}/convocazioni/pdf?ids=`);
    for (const name of names.slice(0, 2)) {
      await dialog.locator("div.rounded-xl", { has: page.getByText(name, { exact: true }) }).last().getByRole("button", { name: "Convocata", exact: true }).click();
    }
    const selectedHref = (await link.getAttribute("href"))!;
    expect(new URL(selectedHref, "http://localhost").searchParams.get("ids")!.split(",")).toHaveLength(2);
    const selected = await page.request.get(selectedHref);
    expect(selected.status()).toBe(200);
    expect(selected.headers()["content-type"]).toBe("application/pdf");
    expect((await selected.body()).equals(emptyBytes)).toBe(false);
    // Le formazioni restano quelle salvate e la finestra lo dice.
    await expect(dialog.locator("[data-lineups-stale]")).toBeVisible();
    await expect(dialog.locator("[data-lineups-pdf-dialog]")).toHaveAttribute("href", `/api/partite/${matchId}/formazioni/pdf`);

    // Identificativi inventati o fuori forma: si ignorano, il foglio c'è lo stesso.
    const junk = await page.request.get(`/api/partite/${matchId}/convocazioni/pdf?ids=../x,%3Cscript%3E,${"y".repeat(80)}`);
    expect(junk.status()).toBe(200);
    expect(junk.headers()["content-type"]).toBe("application/pdf");

    // Senza sessione: 401, niente PDF e niente cache. Una partita che non c'è: 404.
    const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const denied = await anonymous.get(href);
    expect(denied.status()).toBe(401);
    expect(denied.headers()["content-type"]).toContain("application/json");
    expect(denied.headers()["cache-control"]).toMatch(/no-store/);
    await anonymous.dispose();
    expect((await page.request.get("/api/partite/non-esiste/convocazioni/pdf")).status()).toBe(404);
  } finally {
    await deleteMatchById(page, matchId).catch(() => {});
    await deleteAthletes(page, names);
  }
});
