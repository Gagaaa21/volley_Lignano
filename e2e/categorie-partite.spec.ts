import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Under 14 e Under 15 non si confondono: ogni partita ha accanto l'etichetta piena «U14» (verde acqua) o «U15» (viola),
 * nel sito pubblico e nell'area tecnici; Scout e Pronostici si possono guardare una categoria alla volta; il calendario
 * del telefono (.ics) mette la categoria nel titolo e segue il filtro scelto sulla home.
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

async function createMatch(page: Page, category: "Under 14" | "Under 15", opponent: string, date: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByText(category, { exact: true }).click();
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra Categorie e2e");
  await page.getByLabel("Data e ora").fill(date);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** I blocchi VEVENT del calendario .ics pubblico (righe lunghe rimesse insieme), con o senza filtro di categoria. */
async function icsEvents(request: APIRequestContext, query = ""): Promise<string[]> {
  const response = await request.get(`/calendario.ics${query}`);
  expect(response.status()).toBe(200);
  const text = (await response.text()).replace(/\r?\n[ \t]/g, "");
  return text.split("BEGIN:VEVENT").slice(1);
}

test("ogni partita ha la sua etichetta U14 o U15: sito pubblico, area tecnici, Scout e Pronostici con il filtro, .ics", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Due partite nello stesso giorno, categorie diverse, nomi diversi. Il giorno è lontano e a caso: la cella del mese mostra
  // al massimo tre partite, e quelle lasciate in giro da altri test non devono nascondere queste.
  const day = localDate(40 + Math.floor(Math.random() * 300));
  const opp14 = uniqueName("Quattordici ");
  const opp15 = uniqueName("Quindici ");
  const created: string[] = [];
  try {
    created.push(await createMatch(page, "Under 14", opp14, `${day}T17:00`));
    created.push(await createMatch(page, "Under 15", opp15, `${day}T18:30`));
  } catch (error) {
    for (const id of created) await deleteMatchById(page, id).catch(() => {});
    throw error;
  }
  const [id14, id15] = created;

  try {
    const tag = (page: Page, category: "U14" | "U15") => page.locator(`[data-category-tag="${category}"]`);

    // ── Area tecnici: elenco partite, intestazione della partita ──
    await page.goto("/admin/partite");
    const row14 = page.locator('a[href^="/admin/partite/"]', { hasText: opp14 });
    const row15 = page.locator('a[href^="/admin/partite/"]', { hasText: opp15 });
    await expect(row14.locator('[data-category-tag="U14"]')).toHaveText("Under 14");
    await expect(row15.locator('[data-category-tag="U15"]')).toHaveText("Under 15");
    await expect(row14.locator('[data-category-tag="U15"]')).toHaveCount(0);

    await page.goto(`/admin/partite/${id14}`);
    await expect(tag(page, "U14").first()).toBeVisible();
    await expect(tag(page, "U15")).toHaveCount(0);

    // ── Scout: etichette e filtro (anche nella vista Stagione) ──
    await page.goto("/admin/scout");
    const scoutRow = (id: string) => page.locator(`[data-scout-match="${id}"]`);
    await expect(scoutRow(id14).locator('[data-category-tag="U14"]')).toBeVisible();
    await expect(scoutRow(id15).locator('[data-category-tag="U15"]')).toBeVisible();
    await page.getByRole("navigation", { name: "Filtra per categoria" }).getByRole("link", { name: "Under 14", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/scout\?cat=U14$/);
    await expect(scoutRow(id14)).toBeVisible();
    await expect(scoutRow(id15)).toHaveCount(0);
    // Il filtro resta passando a «Stagione», e «Partite» lo tiene.
    const views = page.getByRole("navigation", { name: "Vista" });
    const filter = page.getByRole("navigation", { name: "Filtra per categoria" });
    await views.getByRole("link", { name: "Stagione", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/scout\?vista=stagione&cat=U14$/);
    await expect(views.getByRole("link", { name: "Partite", exact: true })).toHaveAttribute("href", "/admin/scout?cat=U14");
    await expect(filter.getByRole("link", { name: "Tutte", exact: true })).toHaveAttribute("href", "/admin/scout?vista=stagione");
    await page.goto("/admin/scout?cat=U15");
    await expect(scoutRow(id15)).toBeVisible();
    await expect(scoutRow(id14)).toHaveCount(0);

    // ── Pronostici: etichette e filtro ──
    await page.goto("/admin/pronostici");
    const predictionRow = (opponent: string) => page.locator("div.flex.flex-col", { hasText: opponent }).filter({ has: page.getByRole("link", { name: /Dettagli|Pronostica|Modifica/ }) }).last();
    await expect(predictionRow(opp14).locator('[data-category-tag="U14"]')).toBeVisible();
    await expect(predictionRow(opp15).locator('[data-category-tag="U15"]')).toBeVisible();
    await page.goto("/admin/pronostici?cat=U15");
    await expect(page.getByText(opp15).first()).toBeVisible();
    await expect(page.getByText(opp14)).toHaveCount(0);
    await page.goto("/admin/pronostici?cat=U14");
    await expect(page.getByText(opp14).first()).toBeVisible();
    await expect(page.getByText(opp15)).toHaveCount(0);
    // Il dettaglio di un pronostico dice di che categoria è.
    await page.goto(`/admin/pronostici/${id15}`);
    await expect(tag(page, "U15").first()).toBeVisible();

    // ── Sito pubblico ──
    const month = day.slice(0, 7);
    await page.goto(`/?month=${month}`);
    await page.waitForLoadState("networkidle");
    // Nella griglia del mese (e nell'elenco): la pastiglia di ogni partita ha la sua sigla.
    const pill14 = page.locator("button", { hasText: opp14 }).filter({ has: page.locator('[data-category-tag="U14"]') }).filter({ visible: true });
    const pill15 = page.locator("button", { hasText: opp15 }).filter({ has: page.locator('[data-category-tag="U15"]') }).filter({ visible: true });
    await expect(pill14.first()).toBeVisible();
    await expect(pill15.first()).toBeVisible();
    await expect(page.locator("button", { hasText: opp14 }).filter({ has: page.locator('[data-category-tag="U15"]') })).toHaveCount(0);
    // La legenda del calendario usa le stesse etichette.
    await expect(page.locator("ul", { hasText: "Partita Under 14" }).locator('[data-category-tag="U14"]')).toBeVisible();
    await expect(page.locator("ul", { hasText: "Partita Under 15" }).locator('[data-category-tag="U15"]')).toBeVisible();

    // Il dettaglio di una partita ha l'etichetta in testa.
    await pill14.first().click();
    const dialog = page.getByRole("dialog", { name: "Dettagli evento" });
    await expect(dialog.locator('[data-category-tag="U14"]')).toBeVisible();
    await dialog.getByRole("button", { name: "Chiudi" }).click();

    // Con il filtro scelto si vede una categoria sola, e «Aggiungi al tuo calendario» la segue.
    await page.goto(`/?month=${month}&cat=U14`);
    await expect(page.getByText(opp14).first()).toBeVisible();
    await expect(page.getByText(opp15)).toHaveCount(0);
    await expect(page.locator("[data-public-ics]")).toHaveAttribute("href", "/calendario.ics?cat=U14");
    await page.goto(`/?month=${month}`);
    await expect(page.locator("[data-public-ics]")).toHaveAttribute("href", "/calendario.ics");

    // ── Calendario del telefono (.ics): la categoria è nel titolo e il filtro funziona ──
    const all = await icsEvents(request);
    expect(all.find((block) => block.includes(opp14))).toContain(`SUMMARY:U14 · vs ${opp14}`);
    expect(all.find((block) => block.includes(opp15))).toContain(`SUMMARY:U15 · vs ${opp15}`);
    const onlyU14 = await icsEvents(request, "?cat=U14");
    expect(onlyU14.some((block) => block.includes(opp14))).toBe(true);
    expect(onlyU14.some((block) => block.includes(opp15))).toBe(false);
    const onlyU15 = await icsEvents(request, "?cat=U15");
    expect(onlyU15.some((block) => block.includes(opp15))).toBe(true);
    expect(onlyU15.some((block) => block.includes(opp14))).toBe(false);
    // Un filtro che non esiste vale come «tutte».
    const odd = await icsEvents(request, "?cat=boh");
    expect(odd.some((block) => block.includes(opp14)) && odd.some((block) => block.includes(opp15))).toBe(true);
    const header = await request.get("/calendario.ics?cat=U15");
    expect(header.headers()["content-disposition"]).toContain("volley-lignano-u15.ics");

  } finally {
    // Anche se un controllo fallisce, le partite di prova non restano in giro a sporcare gli altri test.
    for (const id of [id14, id15]) await deleteMatchById(page, id).catch(() => {});
  }
});
