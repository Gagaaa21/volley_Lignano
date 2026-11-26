import { expect, test, type Locator, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Le convocazioni seguono la categoria della partita: in Under 15 prima le Under 15 e poi le Under 14 (convocabili); in Under 14
 * prima le Under 14 e in fondo le Under 15, oscurate e non convocabili («Seleziona tutte» le salta, e il server le rifiuta). Una
 * Under 15 già convocata prima che la partita diventasse Under 14 resta, con l'avviso, e si può togliere.
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

async function addAthletes(page: Page, names: string[], category: "U14" | "U15") {
  await page.goto("/admin/presenze/atlete/elenco");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByLabel("Nominativi").fill(names.join("\n"));
    await expect(page.locator("[data-bulk-preview]")).toContainText(new RegExp(`^${names.length} atlet[ae] lett[ae]`), { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await page.locator("#bulk-category").selectOption(category);
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

async function createMatch(page: Page, category: "Under 14" | "Under 15", opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByText(category, { exact: true }).click();
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra convocazioni e2e");
  await page.getByLabel("Data e ora").fill(`${localDate(6)}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function openDialog(page: Page, matchId: string): Promise<Locator> {
  await page.goto(`/admin/partite/${matchId}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Apri", exact: true }).click();
  const dialog = page.locator('[aria-label="Convocazioni e formazioni"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Le nostre atlete di prova nell'ordine in cui la finestra le mostra. */
async function shownOrder(dialog: Locator, tag: string): Promise<string[]> {
  const names = await dialog.locator("[data-call-up-row] p.truncate").allTextContents();
  return names.filter((name) => name.endsWith(tag));
}

const row = (dialog: Locator, name: string) => dialog.locator("[data-call-up-row]").filter({ hasText: name });
const toggle = (dialog: Locator, name: string) => row(dialog, name).getByRole("button", { name: "Convocata", exact: true });

async function save(dialog: Locator) {
  await dialog.getByRole("button", { name: "Salva convocazioni e formazioni" }).click();
}

test("convocazioni per categoria: prima la categoria della partita, in Under 14 le Under 15 oscurate e non convocabili", async ({ page }) => {
  test.setTimeout(360_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const tag = lettersTag();
  const [anna, dora] = ["Anna", "Dora"].map((first) => `${first} Quattordici ${tag}`);
  const [bea, carla] = ["Bea", "Carla"].map((first) => `${first} Quindici ${tag}`);
  await addAthletes(page, [anna, dora], "U14");
  await addAthletes(page, [bea, carla], "U15");
  const matches: string[] = [];
  try {
    const u15 = await createMatch(page, "Under 15", uniqueName("Categoria U15 "));
    matches.push(u15);
    const u14 = await createMatch(page, "Under 14", uniqueName("Categoria U14 "));
    matches.push(u14);

    // Under 15: prima le Under 15, poi le Under 14 (possono giocare), tutte convocabili.
    let dialog = await openDialog(page, u15);
    expect(await shownOrder(dialog, tag)).toEqual([bea, carla, anna, dora]);
    await expect(dialog.locator('[data-call-up-group="0"]')).toHaveText("Under 15");
    await expect(dialog.locator('[data-call-up-group="1"]')).toHaveText("Under 14 · giocano anche in Under 15");
    await expect(dialog.locator("[data-call-up-blocked]")).toHaveCount(0);
    for (const name of [bea, anna]) await toggle(dialog, name).click();
    await save(dialog);
    await expect(dialog.getByText("Salvato.")).toBeVisible({ timeout: 20_000 });

    // Under 14: prima le Under 14, in fondo le Under 15 oscurate con «Non convocabile».
    dialog = await openDialog(page, u14);
    expect(await shownOrder(dialog, tag)).toEqual([anna, dora, bea, carla]);
    await expect(dialog.locator('[data-call-up-group="3"]')).toHaveText("Under 15 · non giocano in Under 14");
    for (const name of [bea, carla]) {
      await expect(row(dialog, name)).toHaveAttribute("data-call-up-blocked", "true");
      await expect(toggle(dialog, name)).toBeDisabled();
      await expect(toggle(dialog, name)).toHaveText("Non convocabile");
    }
    // «Seleziona tutte» prende solo chi può giocare in Under 14.
    await dialog.getByRole("button", { name: "Seleziona tutte" }).click();
    for (const name of [anna, dora]) await expect(toggle(dialog, name)).toHaveAttribute("aria-pressed", "true");
    for (const name of [bea, carla]) await expect(toggle(dialog, name)).toHaveAttribute("aria-pressed", "false");
    // Anche forzando il modulo, il server rifiuta una Under 15 in una partita Under 14 e non salva niente.
    const beaId = (await row(dialog, bea).getAttribute("data-call-up-row"))!;
    await dialog.locator("form").evaluate((form, id) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "calledUpAthleteIds";
      input.value = id;
      form.appendChild(input);
    }, beaId);
    await save(dialog);
    await expect(dialog.getByText(`${bea}: non può giocare in Under 14. Togli la convocazione e salva di nuovo.`)).toBeVisible({ timeout: 20_000 });
    dialog = await openDialog(page, u14);
    for (const name of [anna, dora, bea, carla]) await expect(toggle(dialog, name)).toHaveAttribute("aria-pressed", "false");

    // La partita Under 15 diventa Under 14: Bea, già convocata, resta con l'avviso rosso e si può togliere.
    await page.goto(`/admin/partite/${u15}/modifica`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Under 14", { exact: true }).click();
    await page.getByRole("button", { name: /salva partita/i }).click();
    await page.waitForURL(new RegExp(`/admin/partite/${u15}$`), { timeout: 20_000 });
    dialog = await openDialog(page, u15);
    expect(await shownOrder(dialog, tag)).toEqual([anna, dora, bea, carla]);
    await expect(toggle(dialog, bea)).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(dialog, bea)).toBeEnabled();
    await expect(row(dialog, bea).locator("[data-call-up-blocked-warning]")).toHaveText(
      "Under 15: non gioca in Under 14, toglila dalle convocate",
    );
    await toggle(dialog, bea).click();
    await expect(toggle(dialog, bea)).toBeDisabled();
    await expect(toggle(dialog, bea)).toHaveText("Non convocabile");
    await save(dialog);
    await expect(dialog.getByText("Salvato.")).toBeVisible({ timeout: 20_000 });
  } finally {
    for (const id of matches) await deleteMatchById(page, id).catch(() => {});
    await deleteAthletes(page, [anna, dora, bea, carla]);
  }
});
