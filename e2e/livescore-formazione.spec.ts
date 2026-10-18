import { expect, test, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Live score, formazioni e cambi:
 * - un numero non può stare in due posizioni e la libero non è anche in campo: le caselle sbagliate diventano rosse,
 *   una scheda dice cosa correggere e la partita non parte (né si chiudono le formazioni) finché non è a posto;
 * - la libero compare in un posto solo, anche se una partita salvata ha un numero ripetuto;
 * - dall'elenco delle atlete un numero già in campo non si sceglie due volte;
 * - una titolare uscita rientra una volta sola, e solo al posto di chi l'ha sostituita, dovunque questa sia dopo le rotazioni.
 */

const LIGNANO = "Volley Lignano";
const OPPONENT = "Formazione Test";

const cell = (page: Page, side: "left" | "right", position: number) =>
  page.locator(`[data-court-side="${side}"] [data-court-position="${position}"]`);
const issues = (page: Page) => page.locator("[data-livescore-lineup-issues]");

/** Solo lettere: un numero in fondo al nome verrebbe letto come numero di maglia. */
function tag(): string {
  return Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
}

/** La pagina del Live score da zero, in Partita 6 contro 6 (con o senza libero), pronta a scrivere le formazioni. */
async function openSetup(page: Page, options: { libero: boolean }) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript((libero) => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    localStorage.setItem(
      "vl-livescore-format",
      JSON.stringify({ mode: "match", withLineup: true, playersPerSide: 6, useLibero: libero, rules: { format: "bo3", setPoints: 25, lastSetPoints: 15 } }),
    );
  }, options.libero);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
  await page.goto("/admin/livescore");
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Salta il tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
}

/** Scrive i numeri nelle sei posizioni (le nostre a sinistra, le avversarie a destra). */
async function typeLineups(page: Page, ours: string[], theirs: string[]) {
  await page.getByLabel(/Nome avversaria/).fill(OPPONENT);
  for (const [index, number] of ours.entries()) await cell(page, "left", index + 1).locator("input").fill(number);
  for (const [index, number] of theirs.entries()) await cell(page, "right", index + 1).locator("input").fill(number);
}

const THEIRS = ["21", "22", "23", "24", "25", "26"];

test("un numero scritto due volte, o la libero con il numero di chi è in campo: caselle rosse e «Inizia» bloccato", async ({ page }) => {
  test.setTimeout(120_000);
  await openSetup(page, { libero: true });
  await typeLineups(page, ["11", "12", "13", "14", "11", "16"], THEIRS); // l'11 è in posizione 1 e in posizione 5
  await page.locator("#a-setup-libero").fill("13"); // e la libero ha il numero della 13, in campo in posizione 3

  await expect(issues(page)).toContainText("Il numero 11 compare nelle posizioni 1 e 5");
  await expect(issues(page)).toContainText("Il numero 13 è quello della libero ed è anche in campo (posizione 3)");
  for (const position of [1, 5]) await expect(cell(page, "left", position).locator("input")).toHaveAttribute("aria-invalid", "true");
  await expect(cell(page, "left", 3).locator("input")).toHaveAttribute("aria-invalid", "true");
  await expect(cell(page, "left", 2).locator("input")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#a-setup-libero")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Inizia" })).toBeDisabled();
  await expect(page.locator("[data-livescore-start-blocked]")).toBeVisible();

  // Si corregge un errore alla volta: finché ne resta uno «Inizia» non si preme.
  await cell(page, "left", 5).locator("input").fill("15");
  await expect(issues(page)).not.toContainText("compare nelle posizioni");
  await expect(issues(page)).toContainText("è quello della libero");
  await expect(page.getByRole("button", { name: "Inizia" })).toBeDisabled();
  await page.locator("#a-setup-libero").fill("17");
  await expect(issues(page)).toHaveCount(0);
  await expect(page.locator("[data-livescore-start-blocked]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inizia" })).toBeEnabled();

  // Le due centrali sono due giocatrici diverse: quella già scelta in un menù non si ripete nell'altro.
  await page.locator("#a-setup-host1").selectOption("13");
  await expect(page.locator('#a-setup-host2 option[value="13"]')).toBeDisabled();
  await page.locator("#a-setup-host2").selectOption("16");
  await expect(page.locator('#a-setup-host1 option[value="16"]')).toBeDisabled();

  // Con la formazione in regola si parte: la libero (n. 17) è in campo al posto della 16, in posizione 6, una volta sola.
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
  await expect(issues(page)).toHaveCount(0);
  await expect(page.locator('[data-court-side="left"] [data-court-position]').filter({ hasText: "Libero" })).toHaveCount(1);
  await expect(cell(page, "left", 6)).toContainText("17");

  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
});

test("dall'elenco delle atlete, un numero già in campo (o della libero) non si può scegliere due volte", async ({ page }) => {
  test.setTimeout(180_000);
  await openSetup(page, { libero: true });
  const alfa = `Doppio Alfa ${tag()}`;
  const beta = `Doppio Beta ${tag()}`;
  await page.goto("/admin/presenze/atlete/elenco");
  await page.getByLabel("Nominativi").fill(`57 ${alfa}\n58 ${beta}`);
  await page.getByRole("button", { name: "Aggiungi elenco" }).click();
  await expect(page.getByText("2 atlete aggiunte")).toBeVisible();

  try {
    await page.goto("/admin/livescore");
    await page.waitForLoadState("networkidle");
    const ours = page.locator('[data-court-side="left"] [data-livescore-registry-select]');
    await expect(ours.first()).toBeVisible();
    await ours.nth(0).selectOption("57");
    // Nelle altre posizioni il 57 si vede ma non si prende; nella sua resta scelto; il 58 è libero.
    await expect(ours.nth(1).locator('option[value="57"]')).toBeDisabled();
    await expect(ours.nth(1).locator('option[value="57"]')).toContainText("già in campo");
    await expect(ours.nth(0).locator('option[value="57"]')).toBeEnabled();
    await expect(ours.nth(1).locator('option[value="58"]')).toBeEnabled();
    // La libero non può avere il numero di chi è in campo...
    await expect(page.locator('#a-setup-libero option[value="57"]')).toBeDisabled();
    // ...e, scelta la libero, quel numero non si offre più in campo.
    await page.locator("#a-setup-libero").selectOption("58");
    await expect(ours.nth(2).locator('option[value="58"]')).toBeDisabled();
    await expect(issues(page)).toHaveCount(0);
  } finally {
    await page.request.delete("/api/livescore");
    for (const name of [alfa, beta]) {
      await page.goto("/admin/presenze/atlete");
      const edit = page.getByRole("link", { name: `Modifica ${name}`, exact: true });
      // Si aspetta che l'elenco sia comparso: contare subito, a pagina ancora in arrivo, salta la pulizia e lascia l'atleta
      // nell'elenco, dove cambia le caselle del Live score di tutte le prove dopo (da campi liberi a menù).
      await edit.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      if ((await edit.count()) === 0) continue;
      await edit.click();
      await page.getByRole("button", { name: "Elimina", exact: true }).click(); // il dialogo di conferma lo accetta openSetup
      // L'eliminazione è finita quando l'atleta non è più nell'elenco (cambiare pagina prima la interromperebbe).
      await expect(page.getByRole("link", { name: `Modifica ${name}`, exact: true })).toHaveCount(0);
    }
  }
});

test("partita in corso con un numero ripetuto: avviso con «Correggi», «Fatto» bloccato, e la libero compare una volta sola", async ({ page }) => {
  test.setTimeout(150_000);
  await openSetup(page, { libero: true });
  await typeLineups(page, ["11", "12", "13", "14", "15", "16"], THEIRS);
  await page.locator("#a-setup-libero").fill("17");
  await page.locator("#a-setup-host1").selectOption("13");
  await page.locator("#a-setup-host2").selectOption("16");
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
  await expect(issues(page)).toHaveCount(0);
  // Un punto, così non c'è più la scheda dell'inizio set (con un suo «Fatto»).
  await page.getByRole("button", { name: `Punto ${LIGNANO}` }).click();

  // Si correggono le formazioni e per sbaglio il 16 finisce anche in posizione 5: avviso, e «Fatto» non si preme.
  await page.getByRole("button", { name: "Formazioni", exact: true }).click();
  await cell(page, "left", 5).locator("input").fill("16");
  await expect(issues(page)).toContainText("Il numero 16 compare nelle posizioni 5 e 6");
  await expect(cell(page, "left", 5).locator("input")).toHaveAttribute("aria-invalid", "true");
  await expect(cell(page, "left", 6).locator("input")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Fatto", exact: true })).toBeDisabled();
  await expect(page.locator("[data-livescore-fix-lineups]")).toHaveCount(0); // si sta già correggendo

  // Una partita salvata così (anche prima di questo controllo) si riapre con l'avviso: la libero non è in due posti.
  await expect
    .poll(async () => {
      const saved = (await (await page.request.get("/api/livescore")).json()) as { state: { teamA: { positions: string[] } } | null };
      return saved.state?.teamA.positions[4] ?? null;
    })
    .toBe("16");
  await page.reload();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();
  await expect(issues(page)).toContainText("Il numero 16 compare nelle posizioni 5 e 6");
  await expect(page.locator('[data-court-side="left"] [data-court-position]').filter({ hasText: "Libero" })).toHaveCount(1);
  await expect(cell(page, "left", 5)).toContainText("Libero");
  await expect(cell(page, "left", 6)).not.toContainText("Libero");

  // «Correggi» apre le formazioni; messa a posto la casella, l'avviso sparisce e «Fatto» si può premere.
  await page.locator("[data-livescore-fix-lineups]").click();
  await expect(page.getByRole("button", { name: "Fatto", exact: true })).toBeDisabled();
  await cell(page, "left", 5).locator("input").fill("15");
  await expect(issues(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fatto", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Fatto", exact: true }).click();
  await expect(page.getByRole("button", { name: "Formazioni", exact: true })).toBeVisible();

  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
});

test("cambi: la titolare uscita rientra al posto di chi l'ha sostituita, anche dopo una rotazione, e una volta sola", async ({ page }) => {
  test.setTimeout(150_000);
  await openSetup(page, { libero: false });
  await typeLineups(page, ["11", "12", "13", "14", "15", "16"], THEIRS);
  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.locator("[data-livescore-status]")).toBeVisible();

  const dialog = page.locator("[data-livescore-substitution]");
  const teamSubs = () => page.getByRole("button", { name: new RegExp(`^Sostituzione ${LIGNANO}: `) });

  // 1) Esce la 13 (posizione 3), entra la 19.
  await page.getByRole("button", { name: "Cambio", exact: true }).click();
  await dialog.getByRole("button", { name: /Pos\. 3/ }).click();
  await dialog.getByLabel("Entra").fill("19");
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cell(page, "left", 3)).toContainText("19");

  // 2) L'avversaria conquista la battuta e noi la riconquistiamo: ruotiamo e la 19 passa dalla posizione 3 alla 2.
  await page.getByRole("button", { name: `Punto ${OPPONENT}` }).click();
  await page.getByRole("button", { name: `Punto ${LIGNANO}` }).click();
  await expect(cell(page, "left", 2)).toContainText("19");

  // 3) La 13 rientra al posto della 19: basta scrivere il suo numero, «Esce» si sceglie da solo (posizione 2) e non c'è nessun avvertimento.
  await page.getByRole("button", { name: "Cambio", exact: true }).click();
  await dialog.getByLabel("Entra").fill("13");
  await expect(dialog.getByRole("button", { name: /Pos\. 2/ })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("[data-livescore-sub-reentry]")).toContainText("13 rientra al posto di 19 (posizione 2)");
  await expect(dialog.locator("[data-livescore-sub-warning]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cell(page, "left", 2)).toContainText("13");
  await expect(teamSubs().first()).toHaveAccessibleName(`Sostituzione ${LIGNANO}: 2 cambi in questo set`);

  // 4) Rientrata una volta, la 13 non esce più, e la 19 (una riserva già uscita) non torna.
  await page.getByRole("button", { name: "Cambio", exact: true }).click();
  await dialog.getByRole("button", { name: /Pos\. 2/ }).click();
  await dialog.getByLabel("Entra").fill("30");
  await expect(dialog.locator("[data-livescore-sub-warning]")).toContainText("non può uscire un'altra volta");
  await dialog.getByRole("button", { name: /Pos\. 4/ }).click();
  await dialog.getByLabel("Entra").fill("19");
  await expect(dialog.locator("[data-livescore-sub-warning]")).toContainText("una riserva non può rientrare");
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await expect(dialog).toHaveCount(0);

  // 5) Un'altra titolare (la 15, ora in posizione 4: la rotazione ha spostato tutte) esce e rientra per la sua sostituta,
  // senza altre rotazioni di mezzo: nessun avvertimento, e «Esce» è di nuovo la posizione 4.
  await page.getByRole("button", { name: "Cambio", exact: true }).click();
  await dialog.getByRole("button", { name: /Pos\. 4/ }).click();
  await dialog.getByLabel("Entra").fill("20");
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(cell(page, "left", 4)).toContainText("20");
  await page.getByRole("button", { name: "Cambio", exact: true }).click();
  await dialog.getByLabel("Entra").fill("15");
  await expect(dialog.getByRole("button", { name: /Pos\. 4/ })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("[data-livescore-sub-warning]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Conferma cambio" }).click();
  await expect(cell(page, "left", 4)).toContainText("15");
  await expect(teamSubs().first()).toHaveAccessibleName(`Sostituzione ${LIGNANO}: 4 cambi in questo set`);

  expect((await page.request.delete("/api/livescore")).ok()).toBe(true);
});
