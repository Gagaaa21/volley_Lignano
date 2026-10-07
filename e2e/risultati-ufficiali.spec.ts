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
const FIXTURE_NOT_STARTED = readFileSync(
  join(__dirname, "fixtures", "federation", "u15-girone-a-non-iniziato.html"),
  "utf8",
);

/** PNG 1×1: i loghi delle squadre nel portale finto. */
const LOGO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let portal: Server;
let portalUrl: string;
let portalOrigin: string;
/** Il portale finto rivede la gara 13 quando diventa vero: da «ASD SANGIORGINA, sab 10/10 20:30» a
 * «Pizza D'Oro-PAV BRESSA, dom 11/10 18:00» (stesso numero di gara, altra avversaria: come la
 * federazione ha fatto con il calendario U14). */
let gameMoved = false;

function reviseGame13(html: string): string {
  return html.replace(/<tr>(?:(?!<tr>)[\s\S])*?10\/10\/26 20:30[\s\S]*?<\/tr>/, (row) =>
    row
      .replace("10/10/26 20:30", "11/10/26 18:00")
      // Squadra e società (nel tooltip della cella) cambiano insieme, come sul portale vero.
      .replace("S.D. PALLAVOLO SANGIORGINA", "PAV BRESSA A.S.D.")
      .replace("ASD SANGIORGINA", "Pizza D'Oro-PAV BRESSA"),
  );
}

test.beforeAll(async () => {
  portal = createServer((request, response) => {
    if (/^\/mngArea\/Societa\/img\/\d+\/Loghi\//.test(request.url ?? "")) {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(LOGO_PNG);
      return;
    }
    // Come il portale con certi indirizzi copiati dal browser: /risultati con PId=2 rimanda a
    // /risultati?PId=1 buttando via i filtri, e senza filtri (CId) la pagina è vuota.
    if (request.url?.startsWith("/risultati")) {
      const params = new URL(request.url, "http://localhost").searchParams;
      if (params.get("PId") === "2") {
        response.writeHead(302, { Location: "/risultati?PId=1" });
        response.end();
        return;
      }
      if (!params.has("CId")) {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<html><body><p>Risultati e classifiche</p></body></html>");
        return;
      }
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    const fixture = gameMoved ? reviseGame13(FIXTURE) : FIXTURE;
    response.end(request.url?.startsWith("/non-iniziato") ? FIXTURE_NOT_STARTED : fixture);
  });
  await new Promise<void>((resolve) => portal.listen(0, "127.0.0.1", resolve));
  portalOrigin = `http://127.0.0.1:${(portal.address() as AddressInfo).port}`;
  portalUrl = `${portalOrigin}/girone`;
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

  // --- 2b. Calendario ufficiale: mancano la gara 12 (Farravolo è già nel sito, ma con la data
  // lontana: dubbio, deselezionata) e la gara 13 (nuova, selezionata). ---
  await page.goto("/admin/partite");
  const calendar = page.getByRole("region", { name: "Calendario ufficiale" });
  await expect(calendar).toContainText("Mancano 2 partite");
  const dubious = calendar.locator('li[data-official-game="12"]');
  await expect(dubious).toHaveAttribute("data-official-kind", "maybe-duplicate");
  await expect(dubious).toContainText("Nel sito c'è già «Farravolo»");
  await expect(dubious.getByRole("checkbox")).not.toBeChecked();
  const fresh = calendar.locator('li[data-official-game="13"]');
  await expect(fresh).toHaveAttribute("data-official-kind", "new");
  await expect(fresh).toContainText("vs ASD SANGIORGINA");
  await expect(fresh).toContainText("in trasferta");
  await expect(fresh.getByRole("checkbox")).toBeChecked();
  await expect(calendar.getByRole("button", { name: "Aggiungi 1 partita" })).toBeVisible();

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

  // --- 4b. Abbinata la gara 12, nel calendario ufficiale resta solo la 13: si aggiunge con un clic. ---
  await expect(calendar).toContainText("Manca 1 partita");
  await calendar.getByRole("button", { name: "Aggiungi 1 partita" }).click();
  await expect(calendar.getByText("Aggiunta 1 partita al calendario.")).toBeVisible();
  await expect(calendar).toContainText("tutte le 4 partite del calendario ufficiale sono già nel sito");
  await expect(matchRow(page, "ASD SANGIORGINA")).toBeVisible();

  // «Aggiorna ora» appena dopo una lettura: non carica di nuovo il portale.
  await page.getByRole("button", { name: "Aggiorna ora" }).click();
  await expect(page.getByText("Già aggiornato da pochi istanti.")).toBeVisible();

  // --- 4c. Il portale rivede la gara 13 (altra avversaria e altra data): il sito lo segnala e
  // l'admin porta la partita a quello che dice il portale, avversaria compresa. ---
  gameMoved = true;
  await saveSource(page, portalUrl, OUR_TEAM);
  await expect(page.getByText(/Girone letto: 5 squadre, 10 gare/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/admin");
  await expect(page.getByText(/Una partita è cambiata sul portale della federazione/)).toBeVisible();
  await page.goto("/admin/partite");
  const changed = calendar.locator('li[data-official-game="13"]');
  await expect(changed).toContainText("Nel sito:");
  await expect(changed).toContainText("vs ASD SANGIORGINA");
  await expect(changed).toContainText("sab 10 ott · ore 20:30");
  await expect(changed).toContainText("Sul portale:");
  await expect(changed).toContainText("vs Pizza D'Oro-PAV BRESSA");
  await expect(changed).toContainText("dom 11 ott · ore 18:00");
  await expect(changed).toContainText("Cambia l'avversaria");
  await calendar.getByRole("button", { name: "Aggiorna 1 partita" }).click();
  await expect(calendar.getByText("Aggiornata 1 partita.").first()).toBeVisible();
  await expect(calendar.getByText("è cambiata sul portale")).toHaveCount(0);
  const revised = page.locator('a[href^="/admin/partite/"]', { hasText: "Pizza D'Oro" });
  await expect(revised).toContainText("18:00");
  await expect(matchRow(page, "ASD SANGIORGINA")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText(/è cambiata sul portale della federazione/)).toHaveCount(0);

  // --- 5. Classifica pubblica. ---
  await page.goto("/");
  const standings = page.getByRole("region", { name: "Classifica" });
  await expect(standings).toBeVisible();
  const ourRow = standings.locator('tr[aria-current="true"]');
  await expect(ourRow).toContainText(OUR_TEAM);
  await expect(ourRow.locator("td").first()).toHaveText("1");
  await expect(standings).toContainText("Fonte: FIPAV");
  await expect(standings).toContainText("Aggiornata il");

  // Loghi: la nostra squadra ha lo stemma del sito, le altre il logo del portale
  // (passato dal nostro sito), chi non ne ha mostra le iniziali.
  await expect(ourRow.locator("img")).toHaveAttribute("src", /lignano-crest/);
  const itasRow = standings.locator("tr", { hasText: "ITAS CECCARELLI GROUP" });
  const itasLogo = itasRow.locator("img");
  await expect(itasLogo).toHaveAttribute("src", /^\/api\/federation\/logo\?u=/);
  await expect.poll(() => itasLogo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const noLogoRow = standings.locator("tr", { hasText: "ASD SANGIORGINA" });
  await expect(noLogoRow.locator("img")).toHaveCount(0);
  await expect(noLogoRow).toContainText("S");

  // Il servizio dei loghi accetta solo i loghi della federazione.
  const logoPath = `${portalOrigin}/mngArea/Societa/img/1/Loghi/LogoS1.png`;
  const good = await page.request.get(`/api/federation/logo?u=${encodeURIComponent(logoPath)}`);
  expect(good.status()).toBe(200);
  expect(good.headers()["content-type"]).toBe("image/png");
  const other = await page.request.get(`/api/federation/logo?u=${encodeURIComponent(`${portalOrigin}/girone`)}`);
  expect(other.status()).toBe(400);
  const foreign = await page.request.get(
    `/api/federation/logo?u=${encodeURIComponent("https://example.com/mngArea/Societa/img/1/Loghi/LogoS1.png")}`,
  );
  expect(foreign.status()).toBe(400);

  // --- 5b. Campionato non ancora iniziato: riquadri con i loghi; il logo di
  // Factory Volley Faedis è scelto a mano (il portale non ne ha uno). ---
  await saveSource(page, `${portalOrigin}/non-iniziato`, "CDA VOLLEY LIGNANO");
  await expect(page.getByText(/Girone letto: 6 squadre, 30 gare/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/");
  const notStarted = page.getByRole("region", { name: "Classifica" });
  await expect(notStarted).toContainText("Il campionato inizia il 17 ottobre");
  await expect(notStarted.locator("li", { hasText: "FACTORY VOLLEY FAEDIS" }).locator("img")).toHaveAttribute(
    "src",
    /factory-volley-faedis/,
  );
  await expect(notStarted.locator("li", { hasText: "CDA VOLLEY LIGNANO" }).locator("img")).toHaveAttribute(
    "src",
    /lignano-crest/,
  );
  await expect(notStarted.locator("li", { hasText: "BLU TEAM" }).locator("img")).toHaveAttribute(
    "src",
    /^\/api\/federation\/logo\?u=/,
  );

  // --- 5c. Indirizzo che il portale rimanda a una pagina senza filtri: si legge lo stesso. ---
  await saveSource(page, `${portalOrigin}/risultati?ComitatoId=1&CId=7&PId=2`, OUR_TEAM);
  await expect(page.getByText(/Girone letto: 5 squadre, 10 gare/)).toBeVisible({ timeout: 30_000 });

  // --- 6. Senza girone la categoria sparisce, senza errori. ---
  await saveSource(page, "", OUR_TEAM);
  await expect(page.getByText(/girone non ancora pubblicato/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Classifica" })).toHaveCount(0);
});
