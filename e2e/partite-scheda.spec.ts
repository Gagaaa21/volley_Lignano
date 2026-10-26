import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * La scheda di una partita in ordine: i dettagli in breve con «Modifica» (che apre il modulo a parte, con l'eliminazione),
 * il risultato a partita giocata con il suo salvataggio e le convocazioni (le assenze hanno la loro sezione). E le notifiche mirate: il modulo mostra
 * in anteprima quella che partirà, secondo che cosa si cambia.
 */

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

async function createMatch(page: Page, opponent: string, date: string) {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByText("Trasferta", { exact: true }).click();
  await page.getByLabel("Luogo della partita").fill("Palazzetto di Codroipo");
  await page.getByLabel("Data e ora").fill(date);
  // Una partita nuova: l'anteprima dice chi gioca, quando e dove.
  const preview = page.locator("[data-match-notice-preview]");
  await expect(preview).toHaveAttribute("data-match-notice-preview", "on");
  await expect(page.locator("[data-match-notice-title]")).toHaveText("Nuova partita");
  await expect(page.locator("[data-match-notice-body]")).toContainText(`@ ${opponent}`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

test("scheda della partita: dettagli in breve, «Modifica» a parte con l'anteprima della notifica, e si torna alla scheda", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const opponent = uniqueName("Scheda ");
  const id = await createMatch(page, opponent, `${localDate(12)}T18:00`);

  await page.goto(`/admin/partite/${id}`);
  await page.waitForLoadState("networkidle");
  // In alto i dettagli in breve, poi le convocazioni; il modulo e l'eliminazione non sono qui; niente risultato (si gioca tra 12 giorni);
  // le assenze stanno nella loro sezione.
  const details = page.locator("[data-match-details]");
  await expect(details.locator('[data-match-detail="dove"]')).toContainText("Palazzetto di Codroipo");
  await expect(details.locator('[data-match-detail="ritrovo"]')).toContainText("Come la partita");
  await expect(details.locator('[data-match-detail="tipo"]')).toContainText("In trasferta · campionato");
  await expect(page.locator("[data-match-result]")).toHaveCount(0);
  await expect(page.getByLabel("Luogo della partita")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elimina", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-match-availability]")).toHaveCount(0);
  const order = await page.evaluate(() =>
    ["[data-match-details]", "[data-match-pdfs]"].map((sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1),
  );
  expect(order[0]).toBeGreaterThanOrEqual(0);
  expect(order[0]).toBeLessThan(order[1]);

  // «Modifica»: il modulo a parte. Senza cambiare niente, non partirebbe nessuna notifica.
  await details.locator("[data-match-edit-link]").click();
  await page.waitForURL(new RegExp(`/admin/partite/${id}/modifica$`));
  await page.waitForLoadState("networkidle");
  const preview = page.locator("[data-match-notice-preview]");
  await expect(preview).toHaveAttribute("data-match-notice-preview", "none");

  // Cambiando l'orario: «Cambio orario», con quello di prima.
  await page.getByLabel("Data e ora").fill(`${localDate(12)}T17:30`);
  await expect(preview).toHaveAttribute("data-match-notice-preview", "on");
  await expect(page.locator("[data-match-notice-title]")).toHaveText("Cambio orario");
  await expect(page.locator("[data-match-notice-body]")).toContainText("si gioca alle 17:30 (prima 18:00)");
  // E anche il ritrovo (con un tocco): il titolo li elenca tutti e due.
  await page.locator('[data-meeting-suggestion="16:30"]').click();
  await expect(page.locator("[data-match-notice-title]")).toHaveText("Cambiano orario e ritrovo");
  await expect(page.locator("[data-match-notice-body]")).toContainText("ritrovo alle 16:30");
  // Rimesso l'orario di prima resta solo il ritrovo.
  await page.getByLabel("Data e ora").fill(`${localDate(12)}T18:00`);
  await expect(page.locator("[data-match-notice-title]")).toHaveText("Ritrovo aggiornato");
  // Spento l'avviso, non parte niente.
  await page.locator("[data-match-notify] label").first().click();
  await expect(preview).toHaveAttribute("data-match-notice-preview", "off");
  await page.locator("[data-match-notify] label").first().click();
  await expect(preview).toHaveAttribute("data-match-notice-preview", "on");

  // Salvando si torna alla scheda, con il ritrovo nuovo.
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(new RegExp(`/admin/partite/${id}$`), { timeout: 20_000 });
  await expect(page.locator('[data-match-detail="ritrovo"]')).toContainText(/alle 16:30/i);

  // L'eliminazione sta in fondo alla pagina «Modifica».
  await deleteMatchById(page, id);
  await expect(page.locator('a[href^="/admin/partite/"]', { hasText: opponent })).toHaveCount(0);
});

test("risultato: a partita giocata ha il suo riquadro, si salva da solo e si corregge", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const opponent = uniqueName("Risultato ");
  const id = await createMatch(page, opponent, `${localDate(-3)}T18:00`);

  // La partita di prova si toglie anche se la prova si ferma a metà: una partita giocata senza risultato cambierebbe i conti del
  // confronto con il portale nelle prove dopo.
  try {
    await page.goto(`/admin/partite/${id}`);
    await page.waitForLoadState("networkidle");
    const card = page.locator("[data-match-result]");
    await expect(card).toHaveAttribute("data-match-result", "missing");
    // Il riquadro del risultato viene subito dopo i dettagli, prima delle convocazioni.
    const order = await page.evaluate(() =>
      ["[data-match-details]", "[data-match-result]", "[data-match-pdfs]"].map((sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1),
    );
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);

    // Un set lasciato a metà: l'errore resta nel riquadro con quello che si era scritto.
    await page.getByLabel("Punti Lignano, set 1").fill("25");
    await page.getByRole("button", { name: "Salva risultato" }).click();
    // Si aspetta il messaggio vero (non la scritta «Set 1» delle colonne): finché la risposta non arriva, il modulo si ripristinerebbe
    // dopo e cancellerebbe quello che si scrive nel frattempo.
    await expect(card).toContainText("Inserisci il punteggio di entrambe le squadre per il set 1.");
    await expect(page.getByLabel("Punti Lignano, set 1")).toHaveValue("25");

    // 3-1 con i parziali: il riquadro lo mostra in grande; l'elenco lo riporta.
    const sets = [
      [25, 20],
      [22, 25],
      [25, 18],
      [25, 21],
    ];
    for (const [i, [us, them]] of sets.entries()) {
      await page.getByLabel(`Punti Lignano, set ${i + 1}`).fill(String(us));
      await page.getByLabel(`Punti avversario, set ${i + 1}`).fill(String(them));
    }
    await page.getByRole("button", { name: "Salva risultato" }).click();
    await expect(card).toHaveAttribute("data-match-result", "saved", { timeout: 20_000 });
    await expect(card.locator("[data-match-result-summary]")).toContainText("3–1");
    await expect(card.locator("[data-match-result-summary]")).toContainText("Vinta");
    await expect(card.locator("[data-match-result-summary]")).toContainText("25-20");

    // «Correggi» riapre i campi già compilati: il secondo set era nostro, e allora la partita è finita 3-0.
    await card.locator("[data-match-result-edit]").click();
    await expect(page.getByLabel("Punti Lignano, set 2")).toHaveValue("22");
    await page.getByLabel("Punti Lignano, set 2").fill("25");
    await page.getByLabel("Punti avversario, set 2").fill("23");
    await page.getByLabel("Punti Lignano, set 4").fill("");
    await page.getByLabel("Punti avversario, set 4").fill("");
    await page.getByRole("button", { name: "Salva risultato" }).click();
    await expect(card.locator("[data-match-result-summary]")).toContainText("3–0", { timeout: 20_000 });

    await page.goto("/admin/partite");
    await expect(page.locator('a[href^="/admin/partite/"]', { hasText: opponent })).toContainText("3–0");
  } finally {
    await deleteMatchById(page, id).catch(() => {});
  }
});

test("convocazioni: l'avviso alle famiglie si sceglie nella finestra (acceso per le partite da giocare)", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const future = await createMatch(page, uniqueName("Convocate "), `${localDate(9)}T18:00`);
  const past = await createMatch(page, uniqueName("Convocate passate "), `${localDate(-9)}T18:00`);

  for (const [id, checked] of [
    [future, true],
    [past, false],
  ] as const) {
    await page.goto(`/admin/partite/${id}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Apri", exact: true }).click();
    const toggle = page.locator("[data-callups-notify] input");
    await expect(toggle).toBeVisible();
    if (checked) await expect(toggle).toBeChecked();
    else await expect(toggle).not.toBeChecked();
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  }

  await deleteMatchById(page, future);
  await deleteMatchById(page, past);
});
