import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, loginAsDev, localDateTime, switchTeam, uniqueName } from "./helpers";

/**
 * Pronostici: si aprono il giorno della partita e si chiudono 10 minuti dopo il
 * suo inizio (prima, se il risultato è già stato inserito). Le partite di
 * prova partono 2 e 30 minuti fa: la prima è ancora aperta, la seconda chiusa.
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
  // Tutti gli orari dallo stesso istante: se il minuto cambia durante il test, l'orario atteso non slitta.
  const startedAgo2 = localDateTime(-2);
  const startedAgo30 = localDateTime(-30);
  const closesAt = localDateTime(8).slice(11, 16);
  await createMatch(page, open, startedAgo2);
  await createMatch(page, closed, startedAgo30);
  const openId = await matchId(page, open);
  const closedId = await matchId(page, closed);

  // Iniziata da 2 minuti: si può ancora pronosticare, e la pagina dice fino a quando.
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

  // Pulizia: le partite di prova non devono restare nel server demo condiviso.
  await deleteMatchById(page, openId);
  await deleteMatchById(page, closedId);
});
