import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, loginAsDev, switchTeam, uniqueName, localDate } from "./helpers";

/**
 * Numero di maglia: si scrive una volta sola nell'anagrafica atlete (scheda,
 * «Aggiungi in elenco», casella nell'elenco) e lo ritrovano da soli lo Scout e
 * il Live score in modalità Partita. Ogni prova toglie le atlete che ha creato:
 * il tabellone del Live score cambia aspetto se nell'anagrafica ci sono numeri.
 */

// Come negli altri test dello Scout: il service worker risponderebbe da sé alle richieste.
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

/** Solo lettere: un numero in fondo al nome verrebbe letto come numero di maglia. */
function tag(): string {
  return Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
}

const jerseyInput = (page: Page, name: string) => page.locator(`[data-jersey-input="${name}"]`);

/** Incolla un elenco in «Aggiungi in elenco» e aspetta la conferma. */
async function bulkAdd(page: Page, text: string, expected: string | RegExp) {
  await page.goto("/admin/presenze/atlete/elenco");
  await page.getByLabel("Nominativi").fill(text);
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText(expected)).toBeVisible();
}

/** Scrive un numero nella casella dell'elenco e aspetta che il server lo abbia salvato. */
async function setJersey(page: Page, name: string, value: string) {
  const input = jerseyInput(page, name);
  await input.fill(value);
  const saved = page.waitForResponse((response) => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
  await input.press("Enter");
  await saved;
}

async function deleteAthletes(page: Page, names: string[]) {
  for (const name of names) {
    await page.goto("/admin/presenze/atlete");
    const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
    if ((await edit.count()) === 0) continue;
    await edit.click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Elimina", exact: true }).click();
    await page.waitForURL(/\/admin\/presenze\/atlete$/);
  }
}

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra maglie e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

test("numero di maglia: si scrive nella scheda, avvisa se è doppio e si cambia dall'elenco", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const first = `Maglia Uno ${tag()}`;
  const second = `Maglia Due ${tag()}`;

  // Nuova atleta con il numero: nella scheda ci sono solo cifre.
  await page.goto("/admin/presenze/atlete/nuova");
  const field = page.getByLabel("Numero di maglia (opzionale)");
  await expect(field).toBeVisible();
  await field.pressSequentially("7a9");
  await expect(field).toHaveValue("79");
  await page.getByLabel("Nome e cognome").fill(first);
  await field.fill("67");
  await expect(page.locator("[data-jersey-shared]")).toHaveCount(0);
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
  await expect(jerseyInput(page, first)).toHaveValue("67");

  // Un numero già preso: l'avviso nomina chi ce l'ha, ma non vieta di salvare.
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(second);
  await page.getByLabel("Numero di maglia (opzionale)").fill("67");
  await expect(page.locator("[data-jersey-shared]")).toContainText(first);
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
  await expect(jerseyInput(page, second)).toHaveValue("67");
  await expect(jerseyInput(page, second)).toHaveAttribute("title", new RegExp(`Lo ha anche .*${first}`));
  await expect(jerseyInput(page, first)).toHaveAttribute("title", new RegExp(`Lo ha anche .*${second}`));

  // Dall'elenco si cambia il numero: si salva da solo e il doppione sparisce.
  await setJersey(page, second, "68");
  await page.reload();
  await expect(jerseyInput(page, second)).toHaveValue("68");
  await expect(jerseyInput(page, second)).toHaveAttribute("title", "Numero di maglia");
  await expect(jerseyInput(page, first)).toHaveAttribute("title", "Numero di maglia");

  // Svuotando la casella il numero si toglie.
  await setJersey(page, second, "");
  await page.reload();
  await expect(jerseyInput(page, second)).toHaveValue("");
  await expect(jerseyInput(page, first)).toHaveValue("67");

  await deleteAthletes(page, [first, second]);
});

test("Aggiungi in elenco: il numero prima o dopo il nome, l'anteprima, e il numero si aggiorna", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const alfa = `Elenco Alfa ${tag()}`;
  const beta = `Elenco Beta ${tag()}`;
  const gamma = `Elenco Gamma ${tag()}`;

  await page.goto("/admin/presenze/atlete/elenco");
  await page.getByLabel("Nominativi").fill(`5 ${alfa}\n${beta} 12\n${gamma}`);
  // L'anteprima dice come sono state lette le righe, prima di salvare.
  const preview = page.locator("[data-bulk-preview]");
  await expect(preview).toContainText("3 atlete lette");
  await expect(preview).toContainText("2 con il numero di maglia");
  await expect(preview.getByRole("listitem").filter({ hasText: alfa })).toContainText("5");
  await expect(preview.getByRole("listitem").filter({ hasText: beta })).toContainText("12");
  await expect(preview.getByRole("listitem").filter({ hasText: gamma })).toContainText("–");
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText("3 atlete aggiunte")).toBeVisible();

  await page.goto("/admin/presenze/atlete");
  await expect(jerseyInput(page, alfa)).toHaveValue("5");
  await expect(jerseyInput(page, beta)).toHaveValue("12");
  await expect(jerseyInput(page, gamma)).toHaveValue("");

  // Incollando ancora la stessa atleta con un numero diverso, il numero si aggiorna; senza numero non cambia niente.
  await bulkAdd(page, `9 ${alfa}\n${gamma}`, /numero di maglia aggiornato per 1 atleta/);
  await expect(page.getByText("0 atlete aggiunte")).toBeVisible();
  await page.goto("/admin/presenze/atlete");
  await expect(jerseyInput(page, alfa)).toHaveValue("9");
  await expect(jerseyInput(page, beta)).toHaveValue("12");
  await expect(jerseyInput(page, gamma)).toHaveValue("");

  await deleteAthletes(page, [alfa, beta, gamma]);
});

test("lo Scout ripesca i numeri dall'anagrafica: già scritti, «Usa il N» e «Compila i numeri»", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const withNumber = `Scout Con ${tag()}`;
  const late1 = `Scout Tardi ${tag()}`;
  const late2 = `Scout Dopo ${tag()}`;
  await bulkAdd(page, `41 ${withNumber}\n${late1}\n${late2}`, "3 atlete aggiunte");
  const matchId = await createMatch(page, uniqueName("Maglie "));

  // Nella preparazione la giocatrice con il numero lo ha già; le altre due no.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  for (const name of [withNumber, late1, late2]) await page.getByLabel(`${name}: gioca questa partita`).click();
  await expect(page.getByLabel(`Numero di maglia di ${withNumber}`)).toHaveValue("41");
  await expect(page.getByLabel(`Numero di maglia di ${late1}`)).toHaveValue("");
  await expect(page.getByLabel(`Numero di maglia di ${late2}`)).toHaveValue("");
  await expect(page.locator("[data-scout-sync]")).toContainText("Salvato");

  // Nell'anagrafica si scrivono i numeri che mancavano.
  await page.goto("/admin/presenze/atlete");
  await setJersey(page, late1, "42");
  await setJersey(page, late2, "43");

  // Tornando allo Scout si propongono: uno per uno («Usa il 42») o tutti insieme.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByLabel(`${late1}: usa il numero 42 dell'anagrafica`)).toBeVisible();
  await expect(page.getByLabel(`${late2}: usa il numero 43 dell'anagrafica`)).toBeVisible();
  await expect(page.getByLabel(`${withNumber}: usa il numero 41 dell'anagrafica`)).toHaveCount(0);
  await page.getByLabel(`${late1}: usa il numero 42 dell'anagrafica`).click();
  await expect(page.getByLabel(`Numero di maglia di ${late1}`)).toHaveValue("42");
  await expect(page.locator("[data-scout-use-registry]")).toHaveCount(1);
  // Con una sola da compilare il pulsante «per tutte» non serve.
  await expect(page.locator("[data-scout-fill-registry]")).toHaveCount(0);
  await page.getByLabel(`${late2}: usa il numero 43 dell'anagrafica`).click();
  await expect(page.getByLabel(`Numero di maglia di ${late2}`)).toHaveValue("43");
  await expect(page.locator("[data-scout-use-registry]")).toHaveCount(0);
  await expect(page.locator("[data-scout-sync]")).toContainText("Salvato");

  await deleteMatchById(page, matchId);
  await deleteAthletes(page, [withNumber, late1, late2]);
});

test("Scout: «Compila i numeri dall'anagrafica» riempie tutte le giocatrici in una volta", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const one = `Compila Uno ${tag()}`;
  const two = `Compila Due ${tag()}`;
  await bulkAdd(page, `${one}\n${two}`, "2 atlete aggiunte");
  const matchId = await createMatch(page, uniqueName("Compila "));

  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await page.getByLabel(`${one}: gioca questa partita`).click();
  await page.getByLabel(`${two}: gioca questa partita`).click();
  await expect(page.locator("[data-scout-sync]")).toContainText("Salvato");

  await page.goto("/admin/presenze/atlete");
  await setJersey(page, one, "31");
  await setJersey(page, two, "32");

  await page.goto(`/admin/scout/${matchId}`);
  const fillAll = page.locator("[data-scout-fill-registry]");
  await expect(fillAll).toContainText("(2)");
  await fillAll.click();
  await expect(page.getByLabel(`Numero di maglia di ${one}`)).toHaveValue("31");
  await expect(page.getByLabel(`Numero di maglia di ${two}`)).toHaveValue("32");
  await expect(fillAll).toHaveCount(0);

  // Il numero cambiato solo per questa partita non tocca l'anagrafica.
  await page.getByLabel(`Numero di maglia di ${one}`).fill("77");
  await expect(page.locator("[data-scout-sync]")).toContainText("Salvato");
  await page.goto("/admin/presenze/atlete");
  await expect(jerseyInput(page, one)).toHaveValue("31");

  await deleteMatchById(page, matchId);
  await deleteAthletes(page, [one, two]);
});

test("Live score in Partita: i numeri delle nostre si scelgono dall'elenco delle atlete", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const name = `Live Lista ${tag()}`;
  await bulkAdd(page, `58 ${name}`, "1 atleta aggiunta");

  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  const reset = page.getByRole("button", { name: "Nuovo" });
  if (await reset.isVisible().catch(() => false)) await reset.click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();

  await page.getByRole("button", { name: "Partita", exact: true }).click();
  await page.getByRole("button", { name: "Con formazione" }).click();

  // Per la nostra squadra ogni posizione ha l'elenco «numero · nome»; per l'avversaria resta la casella dei numeri.
  const ours = page.locator('[data-court-side="left"] [data-livescore-registry-select]');
  const theirs = page.locator('[data-court-side="right"] [data-livescore-registry-select]');
  await expect(ours.first()).toBeVisible();
  await expect(theirs).toHaveCount(0);
  await expect(ours.first().locator("option", { hasText: /^58 · / })).toHaveCount(1);
  await ours.first().selectOption("58");
  await expect(ours.first()).toHaveValue("58");
  // «Altro…» permette di scrivere un numero che nell'anagrafica non c'è.
  await ours.nth(1).selectOption({ label: "Altro…" });
  const custom = page.locator('[data-court-side="left"] input[placeholder="Numero"]');
  await expect(custom).toBeVisible();
  await custom.fill("23");
  await expect(custom).toHaveValue("23");

  await page.getByRole("button", { name: "Nuovo" }).click().catch(() => {});
  await deleteAthletes(page, [name]);
});
