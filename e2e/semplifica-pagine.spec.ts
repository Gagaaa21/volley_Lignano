import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Meno passaggi, meno doppioni. La dashboard mette le azioni rapide in cima e la «prossima partita» con le scorciatoie per
 * convocazioni, assenze, trasferta e Scout; la scheda di una partita rimanda alle sue assenze; l'elenco Partite apre con «Nuova
 * partita»; la pagina Assenze non ripete le regole (ci sono già la scheda e il riepilogo); Certificati ha un riepilogo compatto; il
 * manuale dello Scout è un pulsante solo.
 */

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

async function chooseSegment(page: Page, name: string, within?: Locator) {
  const scope = within ?? page;
  await scope.locator("label").filter({ has: page.getByRole("radio", { name }) }).click();
  await expect(scope.getByRole("radio", { name })).toBeChecked();
}

/** Una partita fuori casa oggi a mezzanotte e un minuto: la prossima in calendario anche se un'altra prova ha lasciato una partita di oggi. */
async function createAwayMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await chooseSegment(page, "Trasferta");
  await page.getByLabel("Luogo della partita").fill("Palestra scorciatoie e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(0)}T00:01`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** `first` viene prima di `second` nella pagina? */
async function isBefore(first: Locator, second: Locator): Promise<boolean> {
  return first.evaluate((a, b) => Boolean(a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await second.elementHandle());
}

test("dashboard: azioni rapide in cima e la prossima partita con le scorciatoie; scheda partita con le Assenze", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const opponent = uniqueName("Scorciatoie ");
  const matchId = await createAwayMatch(page, opponent);
  try {
    await page.goto("/admin");
    // Le azioni rapide non stanno più in fondo: sono subito sotto il saluto, prima dei riquadri.
    const quick = page.locator("[data-dashboard-quick]");
    await expect(quick).toBeVisible();
    await expect(quick.getByRole("link", { name: "Nuova partita" })).toHaveAttribute("href", "/admin/partite/nuovo");
    await expect(quick.getByRole("link", { name: "Nuovo allenamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Azioni rapide" })).toHaveCount(0);
    expect(await isBefore(quick, page.locator('[data-tour="dashboard-stats"]'))).toBe(true);

    // La prossima partita: titolo, quando e dove, e un tocco per ogni cosa da fare.
    const next = page.locator("[data-dashboard-next-match]");
    await expect(next).toContainText(opponent);
    await expect(next).toContainText("Palestra scorciatoie e2e");
    await expect(next.locator("[data-next-match-callups]")).toHaveAttribute("href", `/admin/partite/${matchId}`);
    await expect(next.locator("[data-next-match-absences]")).toHaveAttribute("href", `/admin/assenze/partita/${matchId}`);
    await expect(next.locator("[data-next-match-trip]")).toHaveAttribute("href", `/admin/trasferte/${matchId}`);
    await expect(next.locator("[data-next-match-scout]")).toHaveAttribute("href", `/admin/scout/${matchId}`);
    expect(await isBefore(next, page.locator('[data-tour="dashboard-stats"]'))).toBe(true);
    // Con le presenze in pari non serve una scheda che lo ripete: il numero è già nel riquadro.
    await expect(page.getByText("Tutto registrato. Ottimo lavoro!")).toHaveCount(0);

    await next.locator("[data-next-match-absences]").click();
    await page.waitForURL(new RegExp(`/admin/assenze/partita/${matchId}$`));
    await expect(page.getByRole("heading", { name: new RegExp(opponent) })).toBeVisible();

    // E dalla scheda della partita si arriva alle sue assenze con un tocco, senza cercarle nella sezione Assenze.
    await page.goto(`/admin/partite/${matchId}`);
    const absences = page.locator("[data-match-absences-link]").first();
    await expect(absences).toHaveAttribute("href", `/admin/assenze/partita/${matchId}`);
    await expect(page.locator("[data-match-trip-link]").first()).toBeVisible();
    await absences.click();
    await page.waitForURL(new RegExp(`/admin/assenze/partita/${matchId}$`));
  } finally {
    await deleteMatchById(page, matchId);
  }
});

test("Partite: «Nuova partita» è il primo pulsante, prima delle esportazioni", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/partite");
  const newMatch = page.locator('[data-tour="section-partite-new"]').first();
  await expect(newMatch).toBeVisible();
  expect(await isBefore(newMatch, page.getByText("Esporta PDF").first())).toBe(true);
});

test("Assenze: le regole si cambiano dalla scheda «Regole» o dal riepilogo, senza una scheda che le ripete", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/assenze");
  await expect(page.locator("[data-reporting-summary]")).toContainText("Regole:");
  await expect(page.getByRole("link", { name: "Cambia le regole" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Regole", exact: true })).toHaveCount(0);
  // Il riepilogo in cima porta alle regole.
  await page.locator("[data-reporting-summary] a", { hasText: "Regole:" }).click();
  await page.waitForURL(/\/admin\/assenze\/regole$/);
});

test("Certificati: il riepilogo è compatto e tutto il resto sale", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/certificati");
  const summary = page.locator("[data-certificate-summary]");
  await expect(summary.getByRole("link")).toHaveCount(4);
  for (const label of ["Scaduti", "In scadenza entro un mese", "Senza data", "Validi"]) {
    await expect(summary).toContainText(label);
  }
  // Quattro numeri con la loro etichetta stanno in poca altezza (prima erano quattro riquadri grandi).
  const box = (await summary.boundingBox())!;
  expect(box.height).toBeLessThan(120);
});

test("Scout: il manuale è un pulsante solo", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/scout");
  await expect(page.locator("[data-scout-manual-link]")).toHaveCount(1);
});
