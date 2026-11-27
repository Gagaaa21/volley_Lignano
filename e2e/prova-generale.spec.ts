import { expect, test, type Page } from "@playwright/test";
import { localDateTime, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * La prova generale della diretta, tutto insieme come in palestra: una partita di prova di oggi (senza avvisi alle famiglie), lo
 * Scout che segna, la grafica di Streamlabs aperta, il tabellone sul tablet senza accesso, la pulsantiera con il Monster block,
 * un time-out; alla fine la partita si toglie senza avvisi e grafica e tabellone si svuotano.
 */

test.use({ serviceWorkers: "block" });

type Event = Record<string, unknown>;

/** Salva lo scout come fa lo Scout (PUT con la versione di prima) e restituisce la versione nuova. */
async function saveScout(page: Page, matchId: string, events: Event[], baseVersion: number | null): Promise<number> {
  const result = await page.evaluate(
    async ({ matchId, events, baseVersion }) => {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { settings: { format: "bo3", setPoints: 25, lastSetPoints: 15, firstServer: "us", publicLive: true }, roster: { us: [], opp: [] }, events, finished: false },
          baseVersion,
        }),
      });
      return { status: response.status, body: (await response.json()) as { version?: number } };
    },
    { matchId, events, baseVersion },
  );
  expect(result.status).toBe(200);
  return result.body.version!;
}

test("prova generale: Scout → grafica e tabellone insieme, Monster block, time-out, poi la partita di prova si toglie senza avvisi", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // La partita di prova, oggi fra mezz'ora, senza avvisare nessuno.
  const opponent = uniqueName("Prova generale ");
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra prova generale");
  await page.getByLabel("Data e ora").fill(localDateTime(30));
  await page.locator("[data-match-notify] label").first().click();
  await expect(page.locator("[data-match-notify] input[name=notify]")).not.toBeChecked();
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const matchId = (await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href"))!.split("/").pop()!;

  // Il link del tabellone dallo Scout; il tablet lo apre senza accesso.
  await page.goto("/admin/scout");
  const link = (await page.locator("[data-tabellone-open]").getAttribute("href"))!;
  const tabletContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const tablet = await tabletContext.newPage();
  await tablet.goto(link);
  await expect(tablet.locator("[data-tabellone]")).toHaveAttribute("data-tabellone", "waiting");

  // La grafica come in Streamlabs.
  const obsContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: "block" });
  const obs = await obsContext.newPage();
  await obs.goto("/diretta/grafica");
  await expect(obs.locator("main")).toHaveAttribute("data-grafica", "idle");

  try {
    // Come nella prova vera: il primo punto e un time-out loro, toccati a meno di un secondo l'uno dall'altro, arrivano nello stesso
    // salvataggio. Il tabellone (che prima era a 0-0) fa partire il conto lo stesso, dall'ora del time-out.
    const base = Date.now() - 120_000;
    const events: Event[] = [];
    let n = 0;
    const rally = (actor: "us" | "opp") => events.push({ type: "rally", id: `r${n}`, at: base + ++n * 5_000, actor, how: "attack", player: null, victim: null });
    rally("us");
    events.push({ type: "timeout", id: "to-0", at: Date.now(), side: "opp" });
    await page.goto(`/admin/scout/${matchId}`);
    let version = await saveScout(page, matchId, events, null);
    // Prima del salvataggio il tabellone era «in attesa» (rilegge ogni 10 secondi): lo vede un po' dopo, e il conto tiene conto del
    // tempo già passato dal tocco nello Scout.
    const firstAlert = tablet.locator('[data-board-timeout-alert="away"]');
    await expect(firstAlert).toHaveText(/^Time-out \d+$/, { timeout: 12_000 });
    const left = Number((await firstAlert.textContent())!.replace(/\D/g, ""));
    expect(left).toBeGreaterThanOrEqual(15);
    expect(left).toBeLessThanOrEqual(30);
    await expect(tablet.locator('[data-board-points="home"]')).toHaveText("1");

    // Si riprende e lo Scout segna: 3-1. Il conto sparisce.
    for (const actor of ["opp", "us", "us"] as const) rally(actor);
    version = await saveScout(page, matchId, events, version);
    await expect(tablet.locator("[data-board-timeout-alert]")).toHaveCount(0, { timeout: 5_000 });

    await expect(tablet.locator('[data-board-points="home"]')).toHaveText("3", { timeout: 10_000 });
    await expect(tablet.locator('[data-board-points="away"]')).toHaveText("1");
    await expect(obs.locator("main")).toHaveAttribute("data-grafica", "live", { timeout: 10_000 });
    await expect(obs.locator('[data-grafica-score="home"]').first()).toContainText("3");

    // Un punto: tabellone e grafica lo mostrano entro pochi secondi.
    rally("opp");
    const sent = Date.now();
    version = await saveScout(page, matchId, events, version);
    await expect(tablet.locator('[data-board-points="away"]')).toHaveText("2", { timeout: 5_000 });
    const boardDelay = Date.now() - sent;
    await expect(obs.locator('[data-grafica-score="away"]').first()).toContainText("2", { timeout: 5_000 });
    expect(boardDelay).toBeLessThan(5_000);

    // Time-out loro: sul tabellone il pallino e il conto dei 30 secondi.
    events.push({ type: "timeout", id: "to-1", at: Date.now(), side: "opp" });
    version = await saveScout(page, matchId, events, version);
    await expect(tablet.locator('[data-board-timeout-alert="away"]')).toHaveText(/^Time-out (30|29|28|27|26)$/, { timeout: 5_000 });
    await expect(tablet.locator('[data-board-timeouts="away"]')).toHaveAttribute("data-used", "2");

    // La pulsantiera: Monster block, che compare nella grafica.
    await page.goto("/admin/scout/pulsantiera");
    await page.locator('[data-cue-button="monsterBlock"]').click();
    await expect(page.locator("[data-pulsantiera-message]")).toContainText("In onda: Monster block");
    await expect(obs.locator('[data-grafica-cue="monsterBlock"]')).toBeVisible({ timeout: 6_500 });

    // Si riprende: il conto del time-out sparisce, il punteggio va avanti.
    rally("us");
    await page.goto(`/admin/scout/${matchId}`);
    await saveScout(page, matchId, events, version);
    await expect(tablet.locator('[data-board-points="home"]')).toHaveText("4", { timeout: 5_000 });
    await expect(tablet.locator("[data-board-timeout-alert]")).toHaveCount(0);
  } finally {
    // Fine prova: si toglie la partita senza avvisare le famiglie.
    await page.goto(`/admin/partite/${matchId}/modifica`);
    await page.locator("[data-delete-notify] input[name=notify]").uncheck();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Elimina", exact: true }).click();
    await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  }
  // Grafica e tabellone si svuotano da soli.
  await expect(tablet.locator("[data-tabellone]")).toHaveAttribute("data-tabellone", "waiting", { timeout: 15_000 });
  await expect(obs.locator("main")).toHaveAttribute("data-grafica", "idle", { timeout: 15_000 });
  await tabletContext.close();
  await obsContext.close();
});
