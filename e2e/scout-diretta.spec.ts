import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Punteggio live sul sito pubblico, acceso dallo Scout: si vede solo il
 * punteggio (squadre, punti, set, chi batte, e per la grafica i numeri di squadra), mai nomi o numeri delle
 * giocatrici, e si spegne dallo stesso pulsante. Come per il Live score,
 * la prova si fa anche da un visitatore senza accesso.
 */

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

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra diretta e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function addPlayer(page: Page, name: string, number: string) {
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").fill(name);
  await page.getByLabel("Numero di maglia della giocatrice da aggiungere a mano").fill(number);
  await page.getByLabel("Nome di una giocatrice da aggiungere a mano").press("Enter");
  await expect(page.locator(`[data-scout-athlete="${name}"]`)).toBeVisible();
}

/** Un punto con i pulsanti: lato e modo, poi la giocatrice (testo del numero) o un numero avversario. */
async function addPoint(page: Page, button: string, who: { text: string } | { opp: string }) {
  await page.locator(`[data-scout-add="${button}"]`).click();
  // Per l'avversaria non si chiede mai chi: il punto è già segnato.
  if (button.startsWith("opp-")) return;
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  if ("opp" in who) await sheet.locator(`[data-scout-pick="opp-${who.opp}"]`).click();
  else await sheet.locator("[data-scout-pick]", { hasText: who.text }).click();
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");
const liveToggle = (page: Page) => page.locator("[data-scout-live-toggle]");
const liveBadge = (page: Page) => page.locator("[data-scout-live-badge]");

type PublicLive = {
  team: string;
  category: string | null;
  home: { name: string; color: string; score: number; sets: number };
  away: { name: string; color: string; score: number; sets: number };
  serving: "home" | "away" | null;
  sets: { home: number; away: number }[];
  timeouts: { home: number; away: number };
  finished: boolean;
  notStarted?: true;
  setStats?: unknown;
  updatedAt: string;
} | null;

/** Il punteggio pubblico; con `?prima=1` (come la chiede la grafica della diretta video) anche la partita ancora a 0–0. */
async function publicLive(page: Page, query = ""): Promise<PublicLive> {
  const response = await page.request.get(`/api/livescore/pubblico${query}`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { live: PublicLive }).live;
}

test("Scout: il punteggio live si accende dalla preparazione, sul sito si vede solo il punteggio e si spegne", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Diretta ");
  const matchId = await createMatch(page, opponent);

  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  await addPlayer(page, "Segretissima Rossi", "9");
  await page.getByLabel("Numeri di maglia dell'avversaria").fill("14");
  await page.getByLabel("Numeri di maglia dell'avversaria").press("Enter");

  // Di partenza il punteggio live è spento; si accende con l'interruttore della preparazione.
  const toggle = page.locator("[data-scout-public-live]");
  await expect(toggle).not.toBeChecked();
  await expect(liveBadge(page)).toHaveCount(0);
  await page.getByText("Mostra il punteggio sul sito pubblico").click();
  await expect(toggle).toBeChecked();
  await expect(liveBadge(page)).toBeVisible();
  await expect(liveBadge(page)).toContainText("Live sul sito");
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
  await expect(sync(page)).toContainText("Salvato");

  // Finché non c'è un punto il sito non mostra niente: il riquadro compare dal primo punto segnato.
  expect(await publicLive(page)).toBeNull();
  // La grafica della diretta video invece riceve la partita già a 0–0: la barra c'è appena si accende il live.
  await expect.poll(async () => await publicLive(page, "?prima=1"), { timeout: 15_000 }).toMatchObject({
    notStarted: true,
    home: { score: 0 },
    away: { name: opponent, score: 0 },
    serving: null,
  });
  // …e anche lì non esce niente che riguardi le giocatrici.
  expect(JSON.stringify(await publicLive(page, "?prima=1"))).not.toContain("Segretissima");

  await addPoint(page, "us-attack", { text: "Segretissima R." });
  await addPoint(page, "opp-ace", { opp: "14" });
  await addPoint(page, "us-attack", { text: "Segretissima R." });
  await expect(score(page)).toHaveText("2–1");
  await expect(sync(page)).toContainText("Salvato");

  // Un visitatore senza accesso: la API dà il punteggio, i numeri di squadra e i dati della partita (per la grafica della
  // diretta video), mai nomi né dettagli degli scambi. Qui la formazione non si segue: niente cambi né formazione.
  // La copia pubblica si aggiorna a risposta già partita: si aspetta che arrivi.
  await expect.poll(async () => (await publicLive(page))?.home.score, { timeout: 15_000 }).toBe(2);
  const live = await publicLive(page);
  expect(live).not.toBeNull();
  expect(live!.team).toBe("u14u15");
  expect(live!.home.name).toBe("Volley Lignano");
  expect(live!.away.name).toBe(opponent);
  expect(live!.home.score).toBe(2);
  expect(live!.away.score).toBe(1);
  expect(live!.home.sets).toBe(0);
  expect(live!.finished).toBe(false);
  expect(live!.serving).toBe("home");
  expect(Object.keys(live!).sort()).toEqual(["away", "category", "finished", "home", "info", "matchStats", "serving", "setStats", "sets", "team", "timeouts", "updatedAt"]);
  expect(live!.setStats).toEqual({ home: expect.objectContaining({ attack: 2 }), away: expect.objectContaining({ ace: 1 }) });
  expect(live!.timeouts).toEqual({ home: 0, away: 0 });
  expect(Object.keys(live!.home).sort()).toEqual(["color", "name", "score", "sets"]);
  const raw = JSON.stringify(live);
  for (const secret of ["Segretissima", "Rossi", "rally", "roster", "events", "player"]) expect(raw).not.toContain(secret);

  const visitor = await browser.newContext();
  await visitor.addInitScript(() => {
    localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    localStorage.setItem("vl-public-tour-seen-minivolley", "1");
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  const site = await visitor.newPage();
  await site.goto("/");
  const banner = site.locator("[data-public-livescore]");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText("In diretta");
  await expect(banner).toContainText("Risultato non ufficiale");
  await expect(banner).toContainText("Volley Lignano");
  await expect(banner).toContainText(opponent);
  await expect(banner).not.toContainText("Segretissima");
  await expect(site.locator("[data-public-livescore-score]")).toContainText(`2, ${opponent} 1`);

  // Un altro punto arriva da solo, senza ricaricare la pagina.
  await addPoint(page, "opp-ace", { opp: "14" });
  await expect(site.locator("[data-public-livescore-score]")).toContainText(`${opponent} 2`, { timeout: 20_000 });

  // Time-out: dal tabellone dello Scout, due per squadra; sul sito compaiono come puntini pieni sotto il nome.
  const ourTimeout = page.locator('[data-scout-timeout="us"]');
  const theirTimeout = page.locator('[data-scout-timeout="opp"]');
  await expect(ourTimeout).toHaveAttribute("data-scout-timeouts-used", "0");
  await expect(site.locator("[data-public-timeouts]")).toHaveCount(2);
  await expect(site.locator("[data-public-timeouts]").nth(0)).toHaveAttribute("data-public-timeouts", "0");
  await ourTimeout.click();
  await theirTimeout.click();
  await theirTimeout.click();
  await expect(ourTimeout).toHaveAttribute("data-scout-timeouts-used", "1");
  await expect(theirTimeout).toHaveAttribute("data-scout-timeouts-used", "2");
  // Finiti i due, il pulsante si spegne: non se ne segna un terzo.
  await expect(theirTimeout).toBeDisabled();
  await expect(ourTimeout).toBeEnabled();
  await expect(page.locator("[data-scout-timeout-note]")).toHaveCount(3);
  await expect(page.getByText("Ultimo: time-out loro")).toBeVisible();
  await expect(sync(page)).toContainText("Salvato");
  await expect.poll(async () => (await publicLive(site))?.timeouts, { timeout: 15_000 }).toEqual({ home: 1, away: 2 });
  expect(Object.keys((await publicLive(site))!.timeouts).sort()).toEqual(["away", "home"]);
  await expect(site.locator("[data-public-timeouts]").nth(0)).toHaveAttribute("data-public-timeouts", "1", { timeout: 20_000 });
  await expect(site.locator("[data-public-timeouts]").nth(1)).toHaveAttribute("data-public-timeouts", "2", { timeout: 20_000 });
  await expect(banner).toContainText("Time-out");
  // Con «Annulla ultimo» si toglie l'ultimo time-out, e il sito lo segue.
  await page.locator("[data-scout-undo]").click();
  await expect(theirTimeout).toHaveAttribute("data-scout-timeouts-used", "1");
  await expect(theirTimeout).toBeEnabled();
  await expect(site.locator("[data-public-timeouts]").nth(1)).toHaveAttribute("data-public-timeouts", "1", { timeout: 20_000 });
  // Un time-out non cambia il punteggio.
  await expect(score(page)).toHaveText("2–2");

  // Il Minivolley non vede la diretta della U14/U15.
  await site.goto("/minivolley");
  await site.waitForLoadState("networkidle");
  await expect(site.locator("[data-public-livescore]")).toHaveCount(0);

  // Spento dal pulsante sotto i pannelli: sparisce subito dalla API e dal sito.
  await expect(liveToggle(page)).toContainText("Spegni il live sul sito");
  await liveToggle(page).click();
  await expect(liveBadge(page)).toHaveCount(0);
  await expect(liveToggle(page)).toContainText("Punteggio live sul sito");
  await expect(sync(page)).toContainText("Salvato");
  await expect.poll(async () => await publicLive(site), { timeout: 15_000 }).toBeNull();
  await site.goto("/");
  await site.waitForLoadState("networkidle");
  await expect(site.locator("[data-public-livescore]")).toHaveCount(0);

  // Riacceso dallo stesso pulsante: torna con il punteggio di prima.
  await liveToggle(page).click();
  await expect(liveBadge(page)).toBeVisible();
  await expect(sync(page)).toContainText("Salvato");
  await expect.poll(async () => (await publicLive(site))?.away.score, { timeout: 15_000 }).toBe(2);
  await visitor.close();

  await expect(sync(page)).toContainText("Salvato");
  await deleteMatchById(page, matchId);
  // Cancellata la partita, non resta niente da mostrare.
  expect(await publicLive(page)).toBeNull();
});

test("Scout: a partita finita il sito mostra «Partita finita» con i set, poi sparisce quando si spegne", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const opponent = uniqueName("Finita ");
  const matchId = await createMatch(page, opponent);

  // Una partita già avanzata (due set a testa nella forma 2 su 3, decisa al secondo) preparata via API: il test guarda la diretta, non il tocco dei pulsanti.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
  const base = Date.now() - 3_600_000;
  const attack = (id: string, actor: "us" | "opp", n: number) => ({ type: "rally", id, at: base + n * 30_000, actor, how: "attack", player: null, victim: null });
  const events: unknown[] = [];
  let n = 0;
  // 1° set 25-0, poi chiuso; 2° set 25-0, poi chiuso: la partita (2 set su 3) è decisa.
  for (let set = 1; set <= 2; set++) {
    for (let i = 0; i < 25; i++) events.push(attack(`s${set}-${i}`, "us", ++n));
    events.push({ type: "setEnd", id: `end-${set}`, at: base + ++n * 30_000, nextServer: "opp" });
  }
  const saved = await page.evaluate(
    async ({ matchId, events }) => {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            settings: { format: "bo3", setPoints: 25, lastSetPoints: 15, firstServer: "us", publicLive: true },
            roster: { us: [], opp: [] },
            events,
            finished: false,
          },
          baseVersion: null,
        }),
      });
      return response.status;
    },
    { matchId, events },
  );
  expect(saved).toBe(200);

  // La copia pubblica si aggiorna a risposta già partita: si aspetta che arrivi.
  await expect.poll(async () => (await publicLive(page))?.finished, { timeout: 15_000 }).toBe(true);
  const live = await publicLive(page);
  expect(live).not.toBeNull();
  expect(live!.finished).toBe(true);
  expect(live!.home.sets).toBe(2);
  expect(live!.away.sets).toBe(0);
  expect(live!.sets).toEqual([
    { home: 25, away: 0 },
    { home: 25, away: 0 },
  ]);
  expect(live!.serving).toBeNull();

  const visitor = await browser.newContext();
  await visitor.addInitScript(() => {
    localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  const site = await visitor.newPage();
  await site.goto("/");
  const banner = site.locator("[data-public-livescore]");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText("Partita finita");
  await expect(banner).toContainText("Risultato non ufficiale");
  await expect(site.locator("[data-public-livescore-score]")).toContainText(`${opponent} 0 set`);
  await visitor.close();

  // Spegnendo il live dalla pagina della partita, il sito smette di mostrarla.
  await page.goto(`/admin/scout/${matchId}`);
  await expect(liveToggle(page)).toContainText("Spegni il live sul sito");
  await liveToggle(page).click();
  await expect(sync(page)).toContainText("Salvato");
  await expect.poll(async () => await publicLive(page), { timeout: 15_000 }).toBeNull();

  await deleteMatchById(page, matchId);
});
