import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
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

  // --- 3. Partite: un riquadro in alto dice cosa c'è da sistemare e apre la pagina del portale. ---
  await page.goto("/admin/partite");
  const registered = page.getByRole("region", { name: "Partite registrate" });
  await expect(registered).toContainText("Farravolo");
  const alert = page.locator("[data-portal-alert]");
  await expect(alert).toContainText("1 risultato da confermare");
  await expect(alert).toContainText("2 da verificare");

  // La dashboard segnala le stesse cose, con un solo avviso.
  await page.goto("/admin");
  await expect(page.getByText(/Portale FIPAV, da sistemare: 1 risultato da confermare · 2 da verificare/)).toBeVisible();
  await page.getByText(/Portale FIPAV, da sistemare/).click();
  await page.waitForURL(/\/admin\/partite\/portale$/);

  // --- 4. Pagina del portale: ogni gara compare una volta sola, nel gruppo giusto. ---
  const results = page.locator('[data-portal-group="risultati"]');
  const toCheck = page.locator('[data-portal-group="verificare"]');
  const toAdd = page.locator('[data-portal-group="aggiungere"]');
  await expect(results.locator("li[data-portal-game]")).toHaveCount(1);
  await expect(toCheck.locator("li[data-portal-game]")).toHaveCount(2);
  await expect(toAdd.locator("li[data-portal-game]")).toHaveCount(1);

  // Gara 5: partita senza risultato → si conferma e si compilano i set.
  const game5 = results.locator('li[data-portal-game="5"]');
  await expect(game5).toContainText("Partita nel sito");
  await expect(game5).toContainText("25-16 · 25-15 · 25-10");
  await game5.getByRole("button", { name: "Conferma risultato" }).click();
  await expect(results).toHaveCount(0);

  // Gara 10: risultato diverso già scritto → resta il nostro, si segnala soltanto.
  const game10 = toCheck.locator('li[data-portal-game="10"]');
  await expect(game10).toHaveAttribute("data-portal-status", "conflict");
  await expect(game10).toContainText("Nel sito hai scritto un risultato diverso");
  await expect(game10).toContainText("3–0");
  await expect(game10).toContainText("3–1");
  await game10.getByRole("button", { name: "Tieni il mio" }).click();
  await expect(toCheck.locator('li[data-portal-game="10"]')).toHaveCount(0);

  // Ripristinata, la scelta esplicita «Usa quello ufficiale» sostituisce il risultato.
  await page.getByText(/Gare ignorate \(1\)/).click();
  await page.getByRole("button", { name: "Ripristina" }).click();
  const restored = toCheck.locator('li[data-portal-game="10"]');
  await expect(restored).toContainText("Nel sito hai scritto un risultato diverso");
  await restored.getByRole("button", { name: "Usa quello ufficiale" }).click();
  await expect(toCheck.locator('li[data-portal-game="10"]')).toHaveCount(0);

  // Gara 12: nel sito c'è Farravolo con un'altra data → «È la stessa partita?» → sì: collegata, con il risultato.
  const game12 = toCheck.locator('li[data-portal-game="12"]');
  await expect(game12).toHaveAttribute("data-portal-status", "maybe-same");
  await expect(game12).toContainText("Nel sito c'è vs Farravolo");
  await game12.getByRole("button", { name: "Sì: collega e salva il risultato" }).click();
  await expect(toCheck).toHaveCount(0);
  await expect(page.locator("[data-portal-all-good]")).toContainText("Niente da sistemare");

  await page.goto("/admin/partite");
  await expect(matchRow(page, "Pav Bressa")).toContainText("3–0");
  await expect(matchRow(page, "Itas Ceccarelli")).toContainText("3–1");
  await expect(matchRow(page, "Farravolo")).toContainText("3–1");
  // Le partite che mancano nel sito non sono un errore: niente avviso, solo l'informazione.
  await expect(page.locator("[data-portal-alert]")).toHaveCount(0);
  await expect(page.getByText("1 partita del calendario ufficiale non è ancora nel sito")).toBeVisible();
  await page.goto("/admin");
  await expect(page.locator('[data-tour="dashboard-stats"]')).toBeVisible();
  await expect(page.getByText(/Portale FIPAV, da sistemare/)).toHaveCount(0);

  // --- 4b. La gara 13 si aggiunge con un clic. ---
  await page.goto("/admin/partite/portale");
  const game13 = toAdd.locator('li[data-portal-game="13"]');
  await expect(game13).toContainText("vs ASD SANGIORGINA");
  await expect(game13).toContainText("in trasferta");
  await expect(game13.getByRole("checkbox")).toBeChecked();
  await toAdd.getByRole("button", { name: "Aggiungi 1 partita" }).click();
  await expect(page.locator("[data-portal-all-good]")).toContainText("Tutto in ordine");
  await expect(toAdd).toHaveCount(0);

  // Una partita del sito senza gara ufficiale: si segnala, e se è un'amichevole si toglie dal confronto.
  await createMatch(page, { opponent: "Squadra fantasma", date: "2026-11-20T18:00" });
  await expect(matchRow(page, "ASD SANGIORGINA")).toBeVisible();
  await page.goto("/admin/partite/portale");
  const orphan = toCheck.locator("li[data-portal-orphan]");
  await expect(orphan).toContainText("vs Squadra fantasma");
  await expect(orphan).toContainText("Nel calendario ufficiale della squadra non c'è una gara così");
  await orphan.getByRole("button", { name: "È un'amichevole" }).click();
  await expect(toCheck).toHaveCount(0);

  // «Aggiorna ora» appena dopo una lettura: non carica di nuovo il portale.
  await page.getByRole("button", { name: "Aggiorna ora" }).click();
  await expect(page.getByText("Già aggiornato da pochi istanti.")).toBeVisible();

  // --- 4c. Il portale rivede la gara 13 (altra avversaria e altra data): il sito lo segnala e
  // l'admin porta la partita a quello che dice il portale, avversaria compresa. ---
  gameMoved = true;
  await saveSource(page, portalUrl, OUR_TEAM);
  await expect(page.getByText(/Girone letto: 5 squadre, 10 gare/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/admin");
  await expect(page.getByText(/Portale FIPAV, da sistemare: 1 partita cambiata/)).toBeVisible();
  await page.goto("/admin/partite/portale");
  const changedGroup = page.locator('[data-portal-group="cambiate"]');
  const changed = changedGroup.locator('li[data-portal-game="13"]');
  await expect(changed).toContainText("Nel sito:");
  await expect(changed).toContainText("vs ASD SANGIORGINA");
  await expect(changed).toContainText("sab 10 ott · ore 20:30");
  await expect(changed).toContainText("Sul portale:");
  await expect(changed).toContainText("vs Pizza D'Oro-PAV BRESSA");
  await expect(changed).toContainText("dom 11 ott · ore 18:00");
  await expect(changed).toContainText("Cambiano l'avversaria, la data o l'ora e la palestra.");
  await changedGroup.getByRole("button", { name: "Aggiorna 1 partita" }).click();
  await expect(changedGroup).toHaveCount(0);
  await expect(page.locator("[data-portal-all-good]")).toContainText("Tutto in ordine");
  await page.goto("/admin/partite");
  const revised = page.locator('a[href^="/admin/partite/"]', { hasText: "Pizza D'Oro" });
  await expect(revised).toContainText("18:00");
  await expect(matchRow(page, "ASD SANGIORGINA")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText(/Portale FIPAV, da sistemare/)).toHaveCount(0);

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
