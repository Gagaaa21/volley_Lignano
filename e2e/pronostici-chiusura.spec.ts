import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, loginAsDev, localDateTime, switchTeam, uniqueName } from "./helpers";

/**
 * Pronostici: si aprono il giorno della partita e si chiudono un'ora dopo il
 * suo inizio (prima, se il risultato è già stato inserito). Le partite di
 * prova partono 30 e 90 minuti fa: la prima è ancora aperta, la seconda chiusa.
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

test("pronostici: aperti fino a un'ora dopo l'inizio, chiusi dopo e appena c'è il risultato", async ({ page }) => {
  test.setTimeout(180_000);
  // Poco dopo mezzanotte «30 minuti fa» sarebbe già ieri: il test non avrebbe senso.
  const hour = Number(localDateTime().slice(11, 13));
  test.skip(hour < 2, "troppo vicino a mezzanotte per costruire una partita di oggi iniziata da poco");

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
  // Tutti gli orari dallo stesso istante: se il minuto cambia durante il test, l'orario atteso non slitta.
  const startedAgo30 = localDateTime(-30);
  const startedAgo90 = localDateTime(-90);
  const closesAt = localDateTime(30).slice(11, 16);
  await createMatch(page, open, startedAgo30);
  await createMatch(page, closed, startedAgo90);
  const openId = await matchId(page, open);
  const closedId = await matchId(page, closed);

  // Iniziata da 30 minuti: si può ancora pronosticare, e la pagina dice fino a quando.
  await page.goto(`/admin/pronostici/${openId}`);
  await expect(page.locator("[data-prediction-deadline]")).toContainText(`alle ${closesAt}`);
  for (let set = 1; set <= 3; set++) {
    await page.getByLabel(`Punti Lignano, set ${set}`).fill("25");
    await page.getByLabel(`Punti avversario, set ${set}`).fill("20");
  }
  await page.getByRole("button", { name: "Salva pronostico" }).click();
  await page.waitForURL(/\/admin\/pronostici$/, { timeout: 20_000 });

  // Nell'elenco la partita è ancora «da pronosticare» e riporta l'orario di chiusura.
  const row = page.locator("div.divide-y > *", { hasText: open }).first();
  await expect(row).toContainText(`Aperto fino alle ${closesAt}`);
  await expect(row.getByRole("link", { name: "Modifica" })).toBeVisible();

  // Iniziata da 90 minuti: chiusa, niente modulo.
  await page.goto(`/admin/pronostici/${closedId}`);
  await expect(page.getByRole("button", { name: "Salva pronostico" })).toHaveCount(0);
  await expect(page.getByText("Nessun pronostico è stato inviato per questa partita prima della chiusura.")).toBeVisible();

  // Col risultato inserito si chiude subito, anche dentro l'ora di tolleranza.
  await page.goto(`/admin/partite/${openId}`);
  for (let set = 1; set <= 3; set++) {
    await page.getByLabel(`Punti Lignano, set ${set}`).fill("25");
    await page.getByLabel(`Punti avversario, set ${set}`).fill("10");
  }
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  await page.goto(`/admin/pronostici/${openId}`);
  await expect(page.getByRole("button", { name: "Salva pronostico" })).toHaveCount(0);

  // Pulizia: le partite di prova non devono restare nel server demo condiviso.
  await deleteMatchById(page, openId);
  await deleteMatchById(page, closedId);
});
