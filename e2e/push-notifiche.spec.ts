import { expect, test, type Page } from "@playwright/test";
import { addRow, counts, fakeSubscriptions, installFakePush, registerWorkers, removeRows } from "./fakePush";
import { dismissTourIfShown, loginAsDev, uniqueName } from "./helpers";

/**
 * La pagina «Notifiche di questo dispositivo» (/notifiche, e /minivolley/notifiche dall'app di Minivolley): si attivano e si
 * disattivano le squadre una per una, un'iscrizione registrata con la squadra sbagliata si vede e si rimette a posto, e un
 * tasto toglie tutto da quel dispositivo. Browser vero, service worker veri e un finto servizio push (vedi fakePush.ts); le
 * iscrizioni del sito si leggono dai conteggi del Centro di controllo. Alla fine lo spec toglie le iscrizioni di prova.
 */

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

const section = (page: Page, team: "u14u15" | "minivolley") => page.locator(`[data-notify-team="${team}"]`);

async function openSettings(page: Page, path = "/notifiche") {
  await page.goto(path);
  await dismissTourIfShown(page);
  // Finché legge lo stato dal browser le sezioni sono «loading».
  await expect(page.locator('[data-notify-team][data-notify-state="loading"]')).toHaveCount(0);
}

test("si attivano e si disattivano le squadre una per una: sul sito e nel dispositivo ognuna per conto suo", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsDev(page);
  const before = await counts(page);
  await page.addInitScript(installFakePush, {});

  await openSettings(page);
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "inactive");
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "inactive");

  // U14/U15: si attiva solo quella.
  await page.locator('[data-notify-enable="u14u15"]').click();
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "active");
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "inactive");
  await expect(page.locator('[data-notify-message="ok"]')).toContainText("Under 14 e Under 15 attivate");
  expect(Object.keys(await fakeSubscriptions(page))).toEqual(["/"]);

  // Minivolley: si aggiunge, sul suo worker, senza toccare l'altra.
  await page.locator('[data-notify-enable="minivolley"]').click();
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "active");
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "active");
  const both = await fakeSubscriptions(page);
  expect(Object.keys(both).sort()).toEqual(["/", "/minivolley"]);
  expect(await counts(page)).toEqual({ u14u15: before.u14u15 + 1, minivolley: before.minivolley + 1 });

  // L'elenco del Centro di controllo le mostra una per una, ognuna con la sua squadra.
  await page.locator("[data-notify-rows] summary").click();
  await expect(page.locator('[data-notify-row="minivolley"]').filter({ hasText: both["/minivolley"].slice(-6) })).toHaveCount(1);
  await expect(page.locator('[data-notify-row="u14u15"]').filter({ hasText: both["/"].slice(-6) })).toHaveCount(1);

  // Si toglie Minivolley: sparisce dal dispositivo e dal sito, e U14/U15 resta.
  await openSettings(page);
  await page.locator('[data-notify-disable="minivolley"]').click();
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "inactive");
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "active");
  expect(Object.keys(await fakeSubscriptions(page))).toEqual(["/"]);
  expect(await counts(page)).toEqual({ u14u15: before.u14u15 + 1, minivolley: before.minivolley });

  await removeRows(page, [both["/"]]);
});

test("un'iscrizione registrata con la squadra sbagliata si vede, e «Rimetti a posto» la rifà giusta", async ({ page }) => {
  test.setTimeout(180_000);
  const wrong = `https://push.example/${uniqueName("sbagliata-")}`;
  await loginAsDev(page);
  const base = await counts(page);
  // Come prima dell'aggiornamento: l'iscrizione del dispositivo (sul worker di «/») è registrata come Minivolley.
  await addRow(page, wrong, "minivolley");
  await page.addInitScript(installFakePush, { "/": wrong });
  await page.addInitScript(() => {
    try {
      // La sistemazione automatica ha già fatto il suo corso: qui si prova la strada a mano.
      localStorage.setItem("vl-pwa-push-v2", "1");
      localStorage.setItem("vl-pwa-push-teams", '["u14u15"]');
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });

  await openSettings(page);
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "active");
  await expect(section(page, "u14u15").locator("[data-notify-problem]")).toContainText("registrata come Minivolley");

  await section(page, "u14u15").locator('[data-notify-repair="u14u15"]').click();
  await expect(page.locator('[data-notify-message="ok"]')).toContainText("rimesse a posto");
  await expect(section(page, "u14u15").locator("[data-notify-problem]")).toHaveCount(0);

  // Un'iscrizione nuova, registrata come U14/U15; quella sbagliata non c'è più.
  const fake = await fakeSubscriptions(page);
  expect(fake["/"]).not.toBe(wrong);
  expect(await counts(page)).toEqual({ u14u15: base.u14u15 + 1, minivolley: base.minivolley });

  await removeRows(page, [wrong, fake["/"]]);
});

test("«Togli tutte le notifiche da qui» le toglie tutte e due dal dispositivo e dal sito", async ({ page }) => {
  test.setTimeout(180_000);
  const u14 = `https://push.example/${uniqueName("u14-")}`;
  const s3 = `https://push.example/${uniqueName("s3-")}`;
  await loginAsDev(page);
  const base = await counts(page);
  await addRow(page, u14, "u14u15");
  await addRow(page, s3, "minivolley");
  await registerWorkers(page, ["/", "/minivolley"]);
  await page.addInitScript(installFakePush, { "/": u14, "/minivolley": s3 });

  await openSettings(page);
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "active");
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "active");

  await page.locator("[data-notify-reset]").click();
  await expect(page.locator('[data-notify-message="ok"]')).toContainText("tolte da questo dispositivo");
  await expect(section(page, "u14u15")).toHaveAttribute("data-notify-state", "inactive");
  await expect(section(page, "minivolley")).toHaveAttribute("data-notify-state", "inactive");
  expect(await fakeSubscriptions(page)).toEqual({});
  expect(await counts(page)).toEqual(base);

  // Riaprendo il sito non torna niente: da qui si attiva solo ciò che si sceglie.
  await page.goto("/");
  await dismissTourIfShown(page);
  await page.waitForTimeout(1500);
  expect(await fakeSubscriptions(page)).toEqual({});
});

test("dal fondo del sito pubblico si arriva alla pagina; dall'app di Minivolley la sua squadra è la prima", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    try {
      // L'invito ad attivare le notifiche, in basso, coprirebbe il collegamento: qui è come se l'avessero già chiuso.
      localStorage.setItem("vl-pwa-notify-invited-at:u14u15", String(Date.now()));
      localStorage.setItem("vl-pwa-notify-invited-at:minivolley", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
  await page.goto("/");
  // Il tour guidato copre la pagina e, finché è aperto, intercetta i click.
  await dismissTourIfShown(page);
  await page.locator("[data-footer-notifiche]").click();
  await page.waitForURL(/\/notifiche$/);
  await expect(page.getByRole("heading", { name: "Notifiche di questo dispositivo" })).toBeVisible();
  await expect(page.locator("[data-notify-team]").first()).toHaveAttribute("data-notify-team", "u14u15");

  await page.goto("/minivolley/notifiche");
  await expect(page.locator("[data-notify-team]").first()).toHaveAttribute("data-notify-team", "minivolley");
});
