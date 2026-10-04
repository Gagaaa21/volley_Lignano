import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Risultati ufficiali dalla federazione, percorso completo di un admin.
 * Il portale vero non si tocca: un piccolo server locale serve la pagina di
 * prova di un girone con partite già giocate (e2e/fixtures/federation) e il
 * sito la legge come se fosse il portale (gli indirizzi locali sono accettati
 * solo fuori produzione, vedi src/lib/federation/url.ts).
 *
 * Squadra del test: «ROJALKENNEDY EMPORIO ADV», che nella pagina di prova ha
 * giocato tre gare:
 * - gara 5, in casa con Pizza D'Oro-PAV BRESSA: 3-0 (19/09/26)
 * - gara 10, in trasferta a ITAS CECCARELLI GROUP: 3-1 per noi (26/09/26)
 * - gara 12, in casa con FARRAVOLO: 3-1 (03/10/26)
 */

const OUR_TEAM = "ROJALKENNEDY EMPORIO ADV";
const FIXTURE = readFileSync(join(__dirname, "fixtures", "federation", "girone-con-partite-giocate.html"), "utf8");

let portal: Server;
let portalUrl: string;

test.beforeAll(async () => {
  portal = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(FIXTURE);
  });
  await new Promise<void>((resolve) => portal.listen(0, "127.0.0.1", resolve));
  portalUrl = `http://127.0.0.1:${(portal.address() as AddressInfo).port}/girone`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => portal.close(() => resolve()));
});

test.beforeEach(async ({ page }) => {
  // Niente banner PWA fissi in basso a coprire i pulsanti.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      // Il tour di benvenuto del sito pubblico non deve coprire la classifica.
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

async function saveSource(page: Page, url: string, aliases: string) {
  await page.goto("/admin/centro-controllo");
  await page.locator("#url-U15").fill(url);
  await page.locator("#aliases-U15").fill(aliases);
  await page
    .locator("form", { has: page.locator("#url-U15") })
    .getByRole("button", { name: /salva e leggi ora/i })
    .click();
}

async function createMatch(page: Page, fields: { opponent: string; away?: boolean; date: string }) {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(fields.opponent);
  if (fields.away) await page.getByRole("radio", { name: "Trasferta" }).check({ force: true });
  await page.getByLabel("Luogo della partita").fill("Palestra e2e");
  await page.getByLabel("Data e ora").fill(fields.date);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
}

/** Gara ufficiale ancora da decidere (non quelle ignorate, che stanno sotto «Gare ignorate»). */
function proposal(section: Locator, game: string) {
  return section.locator(`li[data-official-game="${game}"][data-official-state="proposal"]`);
}

/** Riga della partita nell'elenco, per il nome dell'avversaria. */
function matchRow(page: Page, opponent: string) {
  return page.locator('a[href^="/admin/partite/"]', { hasText: opponent });
}

test("proposte dalla federazione: conferma, differenza con il risultato scritto a mano, abbinamento, classifica", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // --- 1. Il Developer imposta il girone: viene letto subito. ---
  await saveSource(page, portalUrl, OUR_TEAM);
  await expect(page.getByText(/Girone letto: 5 squadre, 10 gare/)).toBeVisible({ timeout: 30_000 });

  // Un indirizzo che non è della federazione viene rifiutato.
  await page.locator("#url-U14").fill("https://example.com/risultati-classifiche.aspx");
  await page
    .locator("form", { has: page.locator("#url-U14") })
    .getByRole("button", { name: /salva e leggi ora/i })
    .click();
  await expect(page.getByText(/Indirizzo non valido/)).toBeVisible();

  // --- 2. Le partite nel sito. ---
  await createMatch(page, { opponent: "Pav Bressa", date: "2026-09-19T20:30" });
  await createMatch(page, { opponent: "Itas Ceccarelli", away: true, date: "2026-09-26T18:00" });
  await createMatch(page, { opponent: "Farravolo", date: "2026-10-12T20:30" });

  // Per la gara 10 scriviamo a mano un risultato diverso da quello ufficiale (3-0 invece di 3-1).
  await matchRow(page, "Itas Ceccarelli").click();
  await page.waitForURL(/\/admin\/partite\/[^/]+$/);
  for (let set = 1; set <= 3; set++) {
    await page.getByLabel(`Punti Lignano, set ${set}`).fill("25");
    await page.getByLabel(`Punti avversario, set ${set}`).fill("10");
  }
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  await expect(matchRow(page, "Itas Ceccarelli")).toContainText("3–0");

  // --- 3. La dashboard segnala le tre gare da guardare. ---
  await page.goto("/admin");
  await expect(page.getByText(/Ci sono 3 risultati ufficiali della federazione da confermare/)).toBeVisible();

  // --- 4. Partite: le proposte. ---
  await page.goto("/admin/partite");
  const section = page.getByRole("region", { name: "Risultati ufficiali" });
  await expect(section.locator('li[data-official-state="proposal"]')).toHaveCount(3);

  // Gara 5: partita senza risultato → si conferma e si compilano i set.
  const game5 = proposal(section, "5");
  await expect(game5).toContainText("Partita nel sito");
  await expect(game5).toContainText("25-16 · 25-15 · 25-10");
  await game5.getByRole("button", { name: "Conferma risultato" }).click();
  await expect(proposal(section, "5")).toHaveCount(0);
  await expect(matchRow(page, "Pav Bressa")).toContainText("3–0");

  // Gara 10: risultato diverso già scritto → resta il nostro, si segnala soltanto.
  const game10 = proposal(section, "10");
  await expect(game10).toContainText("Nel sito hai scritto un risultato diverso: resta il tuo");
  await expect(game10).toContainText("3–0");
  await expect(game10).toContainText("3–1");
  await game10.getByRole("button", { name: "Tieni il mio" }).click();
  await expect(proposal(section, "10")).toHaveCount(0);
  await expect(matchRow(page, "Itas Ceccarelli")).toContainText("3–0");

  // Ripristinata, la scelta esplicita «Usa quello ufficiale» sostituisce il risultato.
  await page.getByText(/Gare ignorate \(1\)/).click();
  await page.getByRole("button", { name: "Ripristina" }).click();
  const restored = proposal(section, "10");
  await expect(restored).toContainText("Nel sito hai scritto un risultato diverso");
  await restored.getByRole("button", { name: "Usa quello ufficiale" }).click();
  await expect(proposal(section, "10")).toHaveCount(0);
  await expect(matchRow(page, "Itas Ceccarelli")).toContainText("3–1");

  // Gara 12: nessuna partita abbinata da sola (data lontana) → si sceglie a mano.
  const game12 = proposal(section, "12");
  await expect(game12).toContainText("Nessuna partita del sito abbinata");
  const choices = game12.getByRole("combobox");
  const options = await choices.locator("option").allTextContents();
  const farravolo = options.find((text) => text.includes("Farravolo"));
  expect(farravolo, "la partita con Farravolo è tra quelle proposte").toBeTruthy();
  await choices.selectOption({ label: farravolo! });
  await game12.getByRole("button", { name: "Abbina e conferma" }).click();
  await expect(matchRow(page, "Farravolo")).toContainText("3–1");
  await expect(page.getByText("Nessun risultato ufficiale da confermare.")).toBeVisible();

  // «Aggiorna ora» appena dopo una lettura: non carica di nuovo il portale.
  await page.getByRole("button", { name: "Aggiorna ora" }).click();
  await expect(page.getByText("Già aggiornato da pochi istanti.")).toBeVisible();

  // --- 5. Classifica pubblica. ---
  await page.goto("/");
  const standings = page.getByRole("region", { name: "Classifica" });
  await expect(standings).toBeVisible();
  const ourRow = standings.locator('tr[aria-current="true"]');
  await expect(ourRow).toContainText(OUR_TEAM);
  await expect(ourRow.locator("td").first()).toHaveText("1");
  await expect(standings).toContainText("Fonte: FIPAV");
  await expect(standings).toContainText("Aggiornata il");

  // --- 6. Senza girone la categoria sparisce, senza errori. ---
  await saveSource(page, "", OUR_TEAM);
  await expect(page.getByText(/girone non ancora pubblicato/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Classifica" })).toHaveCount(0);
});
