import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, loginAsDev, localDateTime, switchTeam, uniqueName } from "./helpers";

/**
 * Pronostici: sempre aperti, anche una settimana prima, fino a 10 minuti dopo
 * l'inizio (prima, se il risultato è già stato inserito). Le partite di prova
 * partono 2 e 30 minuti fa (la prima è ancora aperta, la seconda chiusa) e tra
 * una settimana (già aperta). Col risultato, la tabella con i punti.
 */

async function createMatch(page: Page, opponent: string, date: string) {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra pronostici e2e");
  await page.getByLabel("Data e ora").fill(date);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
}

async function matchId(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite");
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

test("pronostici: aperti fino a 10 minuti dopo l'inizio, chiusi dopo e appena c'è il risultato", async ({ page }) => {
  test.setTimeout(180_000);
  // Poco dopo mezzanotte «30 minuti fa» sarebbe già ieri, e poco prima la chiusura cadrebbe domani: il test non avrebbe senso.
  const now = localDateTime();
  const minutesOfDay = Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16));
  test.skip(minutesOfDay < 60 || minutesOfDay > 23 * 60 + 40, "troppo vicino a mezzanotte per costruire una partita di oggi iniziata da poco");

  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const open = uniqueName("Aperta ");
  const closed = uniqueName("Chiusa ");
  const nextWeek = uniqueName("Settimana ");
  // Tutti gli orari dallo stesso istante: se il minuto cambia durante il test, l'orario atteso non slitta.
  const startedAgo2 = localDateTime(-2);
  const startedAgo30 = localDateTime(-30);
  const closesAt = localDateTime(8).slice(11, 16);
  await createMatch(page, open, startedAgo2);
  await createMatch(page, closed, startedAgo30);
  await createMatch(page, nextWeek, localDateTime(7 * 24 * 60));
  const openId = await matchId(page, open);
  const closedId = await matchId(page, closed);
  const nextWeekId = await matchId(page, nextWeek);

  // Tra una settimana: si pronostica già (prima si apriva solo il giorno della partita).
  await page.goto(`/admin/pronostici/${nextWeekId}`);
  await expect(page.getByRole("button", { name: "Salva pronostico" })).toBeVisible();
  await expect(page.locator("[data-who-predicted]")).toHaveCount(0);
  await expect(page.getByText("Ancora nessuno: sii il primo!")).toBeVisible();

  // Iniziata da 2 minuti: si può ancora pronosticare, e la pagina dice fino a quando.
  await page.goto(`/admin/pronostici/${openId}`);
  await expect(page.locator("[data-prediction-deadline]")).toContainText(`si chiude oggi alle ${closesAt}`);
  for (let set = 1; set <= 3; set++) {
    await page.getByLabel(`Punti Lignano, set ${set}`).fill("25");
    await page.getByLabel(`Punti avversario, set ${set}`).fill("20");
  }
  await page.getByRole("button", { name: "Salva pronostico" }).click();
  await page.waitForURL(/\/admin\/pronostici$/, { timeout: 20_000 });

  // Nell'elenco la partita è ancora «da pronosticare», con l'orario di chiusura e il mio pronostico in breve.
  const row = page.locator("div.divide-y > *", { hasText: open }).first();
  await expect(row.locator("[data-prediction-closing]")).toHaveText(`Si chiude oggi alle ${closesAt}`);
  await expect(row.locator('[data-my-prediction="yes"]')).toContainText("Il tuo:");
  await expect(row.locator("[data-predicted-sets]")).toContainText("3–0");
  await expect(row.locator("[data-predicted-sets]")).toContainText("25–20");
  await expect(row.getByRole("link", { name: "Modifica" })).toBeVisible();
  const weekRow = page.locator("div.divide-y > *", { hasText: nextWeek }).first();
  await expect(weekRow.locator('[data-my-prediction="no"]')).toHaveText("Non hai ancora pronosticato");
  await expect(weekRow.getByRole("link", { name: "Pronostica" })).toBeVisible();

  // Nella scheda: il pronostico salvato in alto e io tra chi ha già pronosticato.
  await page.goto(`/admin/pronostici/${openId}`);
  await expect(page.locator("[data-my-saved-prediction]")).toContainText("3–0");
  await expect(page.locator("[data-who-predicted]")).toContainText("tu");

  // Iniziata da 30 minuti (con la regola di prima sarebbe stata ancora aperta): chiusa, niente modulo.
  await page.goto(`/admin/pronostici/${closedId}`);
  await expect(page.getByRole("button", { name: "Salva pronostico" })).toHaveCount(0);
  await expect(page.getByText("Nessun pronostico è stato inviato per questa partita prima della chiusura.")).toBeVisible();

  // Col risultato inserito (dal riquadro «Risultato» della partita) si chiude subito, anche dentro i 10 minuti di tolleranza.
  await page.goto(`/admin/partite/${openId}`);
  for (let set = 1; set <= 3; set++) {
    await page.getByLabel(`Punti Lignano, set ${set}`).fill("25");
    await page.getByLabel(`Punti avversario, set ${set}`).fill("10");
  }
  await page.getByRole("button", { name: "Salva risultato" }).click();
  await expect(page.locator('[data-match-result="saved"]')).toBeVisible({ timeout: 20_000 });
  await page.goto(`/admin/pronostici/${openId}`);
  await expect(page.getByRole("button", { name: "Salva pronostico" })).toHaveCount(0);
  // La tabella: il risultato vero in testa, il mio pronostico in oro in ogni set (unico, quindi il più vicino), 3 punti.
  const table = page.locator("[data-prediction-table]");
  await expect(table.locator("thead")).toContainText("25–10");
  const myRow = table.locator("tbody tr").filter({ hasText: "tu" });
  await expect(myRow.locator('[data-prediction-cell="winner"]')).toHaveCount(3);
  await expect(myRow.locator("[data-prediction-points]")).toHaveText("3");
  // Nell'elenco la partita è tra i risultati e conta in classifica.
  await page.goto("/admin/pronostici");
  await expect(page.locator(`[data-prediction-result="${openId}"]`)).toContainText("Vinta 3–0");
  await expect(page.locator("[data-leaderboard]")).toBeVisible();

  // Pulizia: le partite di prova non devono restare nel server demo condiviso.
  await deleteMatchById(page, openId);
  await deleteMatchById(page, closedId);
  await deleteMatchById(page, nextWeekId);
});
