import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { deleteMatchById, localDate, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Scout: il salvataggio con la rete difettosa. Una risposta persa, una richiesta che non risponde o un conflitto non
 * devono mai far perdere punti (e tanto meno un set): le versioni si uniscono da sole, si chiede solo se due persone hanno
 * segnato cose diverse negli stessi momenti, e ogni versione sostituita resta nelle copie di sicurezza del dispositivo.
 */

// Come in scout.spec.ts: il service worker risponderebbe da sé alle richieste e `page.route` non le vedrebbe.
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
  // Chiudere o ricaricare la pagina con punti non salvati chiede conferma al browser, come ripristinare o azzerare: qui si accetta.
  page.on("dialog", (dialog) => void dialog.accept());
});

async function createMatch(page: Page, opponent: string): Promise<string> {
  await page.goto("/admin/partite/nuovo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Squadra avversaria").fill(opponent);
  await page.getByLabel("Luogo della partita").fill("Palestra salvataggio e2e");
  await page.getByLabel("Data e ora").fill(`${localDate()}T18:00`);
  await page.getByRole("button", { name: /salva partita/i }).click();
  await page.waitForURL(/\/admin\/partite$/, { timeout: 20_000 });
  const href = await page.locator('a[href^="/admin/partite/"]', { hasText: opponent }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const score = (page: Page) => page.locator("[data-scout-score]");
const sync = (page: Page) => page.locator("[data-scout-sync]");
const conflictDialog = (page: Page) => page.locator("[data-scout-conflict]");

/** Segna un punto con i pulsanti, senza dire chi. */
async function addPoint(page: Page, button: string) {
  await page.locator(`[data-scout-add="${button}"]`).click();
  const sheet = page.locator("[data-scout-sheet^='player']");
  await sheet.waitFor();
  await sheet.locator('[data-scout-pick="unknown"]').click();
}

/** Apre la pagina dello scout di una partita nuova e comincia, senza giocatrici. */
async function openAndStart(page: Page, matchId: string) {
  await page.goto(`/admin/scout/${matchId}`);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-scout-start]").click();
  await expect(score(page)).toHaveText("0–0");
}

/** Quanti eventi ci sono sul server. */
async function serverEvents(page: Page, matchId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const json = (await (await fetch(`/api/scout/${id}`, { cache: "no-store" })).json()) as { scout: { events: unknown[] } | null };
    return json.scout?.events.length ?? 0;
  }, matchId);
}

function rallies(count: number, side: "us" | "opp", startAt = 1, base = Date.now() - 3_600_000) {
  return Array.from({ length: count }, (_, i) => ({
    type: "rally" as const,
    id: `seed-${side}-${startAt + i}`,
    at: base + (startAt + i) * 30_000,
    actor: side,
    how: "attack" as const,
    player: null,
    victim: null,
  }));
}

function scoutData(events: unknown[]) {
  return { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" }, roster: { us: [], opp: [] }, events, finished: false };
}

async function putScout(page: Page, matchId: string, data: unknown, baseVersion: number | null) {
  return page.evaluate(
    async ({ matchId, data, baseVersion }) => {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, baseVersion }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    },
    { matchId, data, baseVersion },
  );
}

/** Elimina la partita di prova: prima si toglie l'accettazione automatica dei messaggi, che farebbe a gara con quella dell'aiuto. */
async function cleanup(page: Page, matchId: string) {
  page.removeAllListeners("dialog");
  await deleteMatchById(page, matchId).catch(() => {});
}

async function openSetup(page: Page) {
  await page.locator("[data-scout-open-setup]").click();
  await expect(page.locator('[data-scout-sheet="setup"]')).toBeVisible();
}

test("la risposta del server si perde: i punti segnati dopo non si perdono e non si chiede niente", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Risposta persa "));
  try {
    await openAndStart(page, matchId);
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("1–0");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");

    // Il 2° punto arriva al server, ma la risposta non torna indietro: il telefono crede di non aver salvato.
    let lose = false;
    let lost = false;
    let gate: Promise<void> = Promise.resolve();
    await page.route(`**/api/scout/${matchId}`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await gate;
      if (lose) {
        lose = false;
        lost = true;
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    });
    lose = true;
    await addPoint(page, "us-attack");
    await expect.poll(() => lost).toBe(true);
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "offline", { timeout: 15_000 });

    // Prima che riprovi, si segna ancora: adesso il telefono ha un punto in più di quelli che il server conosce, con una versione vecchia.
    let release: () => void = () => {};
    gate = new Promise<void>((resolve) => (release = resolve));
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("3–0");
    release();

    // Il salvataggio riparte da solo, senza la finestra «modificata altrove»: il server aveva già i primi due punti, il telefono ha tutti e tre.
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    await expect(conflictDialog(page)).toHaveCount(0);
    await expect(score(page)).toHaveText("3–0");
    expect(await serverEvents(page, matchId)).toBe(3);
    await page.unroute(`**/api/scout/${matchId}`);
  } finally {
    await cleanup(page, matchId);
  }
});

test("si riapre la pagina con la risposta persa e punti non salvati: si riparte dalla copia, senza chiedere", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Riapertura "));
  try {
    await openAndStart(page, matchId);
    await addPoint(page, "us-attack");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");

    let lose = false;
    let lost = false;
    let blocked = false;
    await page.route(`**/api/scout/${matchId}`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      if (lose) {
        lose = false;
        lost = true;
        await route.fetch();
        return route.abort("failed");
      }
      if (blocked) return route.fulfill({ status: 503, contentType: "text/plain", body: "Connessione assente. Riprova." });
      return route.continue();
    });
    lose = true;
    await addPoint(page, "us-attack");
    await expect.poll(() => lost).toBe(true);
    // Da qui la rete non c'è più: il 3° punto resta solo nel telefono.
    blocked = true;
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("3–0");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "offline", { timeout: 15_000 });

    // Si ricarica la pagina (la rete è ancora assente): il server ha 2 punti, la copia nel telefono 3. Niente da scegliere.
    await page.reload();
    await expect(score(page)).toHaveText("3–0");
    await expect(conflictDialog(page)).toHaveCount(0);

    // Torna la rete: i tre punti arrivano al server.
    blocked = false;
    const retry = page.locator("[data-scout-retry]").first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    expect(await serverEvents(page, matchId)).toBe(3);
    await page.unroute(`**/api/scout/${matchId}`);
  } finally {
    await cleanup(page, matchId);
  }
});

test("una richiesta che non risponde non blocca il salvataggio: si interrompe e si rifà da sola", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Appesa "));
  try {
    await openAndStart(page, matchId);
    await addPoint(page, "us-attack");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");

    // La prossima richiesta di salvataggio resta appesa per sempre (la rete è «ferma», non assente).
    let hang = true;
    await page.route(`**/api/scout/${matchId}`, async (route) => {
      if (route.request().method() === "PUT" && hang) {
        hang = false;
        return new Promise<void>(() => {});
      }
      return route.continue();
    });
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("2–0");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saving");

    // Dopo una ventina di secondi la richiesta si interrompe, lo stato dice che non è arrivato niente e riparte da solo.
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 60_000 });
    expect(await serverEvents(page, matchId)).toBe(2);
    await page.unroute(`**/api/scout/${matchId}`);
  } finally {
    await cleanup(page, matchId);
  }
});

test("quando il salvataggio non va compare l'avviso con i punti non salvati e «Scarica una copia»; il file si rimette", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Avviso "));
  try {
    await openAndStart(page, matchId);
    await addPoint(page, "us-attack");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");

    await page.route(`**/api/scout/${matchId}`, (route) =>
      route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "text/plain", body: "Connessione assente. Riprova." }) : route.continue(),
    );
    await addPoint(page, "us-attack");
    await addPoint(page, "opp-attack");
    await expect(score(page)).toHaveText("2–1");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "offline", { timeout: 15_000 });
    const banner = page.locator("[data-scout-sync-message]");
    await expect(banner).toContainText("restano su questo dispositivo");
    await expect(banner.locator("[data-scout-unsaved]")).toContainText("2 scambi non sono ancora sul server");

    // «Scarica una copia»: un file con i tre scambi, valido e con la partita.
    const [download] = await Promise.all([page.waitForEvent("download"), banner.locator("[data-scout-download-copy]").click()]);
    expect(download.suggestedFilename()).toMatch(/^scout-.*\.json$/);
    const path = (await download.path())!;
    const saved = JSON.parse(readFileSync(path, "utf8")) as { app: string; matchId: string; data: { events: unknown[] } };
    expect(saved).toMatchObject({ app: "volley-lignano-scout", matchId });
    expect(saved.data.events).toHaveLength(3);

    // La rete torna. Si azzera lo scout (resta una copia nel dispositivo) e si rimette il file: tornano i tre scambi.
    await page.unroute(`**/api/scout/${matchId}`);
    await page.locator("[data-scout-retry]").first().click();
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    await openSetup(page);
    await page.locator("[data-scout-wipe]").click();
    await expect(page.locator('[data-scout-sheet="setup"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    await expect(page.locator("[data-scout-backup='azzeramento']")).toHaveCount(1);
    await page.locator("[data-scout-import-input]").setInputFiles(path);
    // Con i punti rimessi la preparazione si chiude e si apre «Squadre e regole»: si conferma con «Fatto».
    await page.getByRole("button", { name: "Fatto" }).click();
    await expect(score(page)).toHaveText("2–1");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    expect(await serverEvents(page, matchId)).toBe(3);
  } finally {
    await cleanup(page, matchId);
  }
});

test("un conflitto vero chiede quale versione tenere, e quella scartata si ripristina dalle copie", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Conflitto copie "));
  try {
    // L'API crea lo scout (versione 1); la pagina lo apre con i due punti nostri.
    await page.goto("/admin/scout");
    const created = await putScout(page, matchId, scoutData(rallies(2, "us")), null);
    expect(created).toMatchObject({ status: 200, body: { version: 1 } });
    await page.goto(`/admin/scout/${matchId}`);
    await expect(score(page)).toHaveText("2–0");

    // Un altro dispositivo salva cose diverse negli stessi momenti (versione 2); intanto qui si segna.
    await putScout(page, matchId, scoutData(rallies(5, "opp")), 1);
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("3–0");
    await expect(conflictDialog(page)).toBeVisible({ timeout: 15_000 });
    await expect(conflictDialog(page)).toContainText("Copia di sicurezza");

    // «Usa quella salvata»: si vede quella dell'altro dispositivo, e la nostra non è persa.
    await page.locator("[data-scout-conflict-server]").click();
    await expect(conflictDialog(page)).toHaveCount(0);
    await expect(score(page)).toHaveText("0–5");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved");
    await openSetup(page);
    const kept = page.locator("[data-scout-backup='conflitto']");
    await expect(kept).toHaveCount(1);
    await expect(kept).toContainText("3 scambi");
    // Si ripristina: tornano i tre punti, e quella di adesso resta a sua volta tra le copie.
    await kept.locator("[data-scout-restore]").click();
    await page.getByRole("button", { name: "Fatto" }).click();
    await expect(score(page)).toHaveText("3–0");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    expect(await serverEvents(page, matchId)).toBe(3);
    await openSetup(page);
    await expect(page.locator("[data-scout-backup='ripristino']")).toContainText("5 scambi");
  } finally {
    await cleanup(page, matchId);
  }
});

test("a ogni set chiuso il dispositivo mette da parte una copia, e dopo un azzeramento il set si ritrova", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  const matchId = await createMatch(page, uniqueName("Copia set "));
  try {
    await openAndStart(page, matchId);
    await addPoint(page, "us-attack");
    await addPoint(page, "us-attack");
    await expect(score(page)).toHaveText("2–0");
    // Si chiude il 1° set e si comincia il 2°.
    await page.getByRole("button", { name: "Chiudi il set adesso" }).click();
    await page.locator("[data-scout-close-set]").click();
    await expect(page.locator("[data-scout-set-end]")).toHaveCount(0);
    await addPoint(page, "opp-attack");
    await expect(score(page)).toHaveText("0–1");
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });

    await openSetup(page);
    const copySet = page.locator("[data-scout-backup='set']");
    await expect(copySet).toHaveCount(1);
    await expect(copySet).toContainText("2 scambi");
    await expect(copySet).toContainText("set 1–0");

    // Per sbaglio si azzera tutto: sul sito non resta niente, ma sul dispositivo il 1° set c'è ancora.
    await page.locator("[data-scout-wipe]").click();
    await expect(page.getByRole("heading", { name: "Prima di cominciare" })).toBeVisible();
    expect(await serverEvents(page, matchId)).toBe(0);
    // Il 1° set (la copia a set chiuso) si ripristina.
    await page.locator("[data-scout-backup='set'] [data-scout-restore]").click();
    await page.getByRole("button", { name: "Fatto" }).click();
    await expect(score(page)).toHaveText("0–0");
    await expect(page.locator("[data-scout-level-label]")).toBeVisible();
    await expect(sync(page)).toHaveAttribute("data-scout-sync", "saved", { timeout: 30_000 });
    expect(await serverEvents(page, matchId)).toBe(3);
  } finally {
    await cleanup(page, matchId);
  }
});
