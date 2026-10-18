import { expect, test } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * La scheda «Diretta video» dello Scout: lo staff incolla i link delle dirette YouTube, i genitori li trovano su /diretta
 * (tramite /api/diretta) e «Svuota» li toglie. YouTube è simulato: non serve la rete.
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
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><body style='margin:0;background:#1d3557'></body>" }),
  );
});

type Api = { cameras: { name: string; id: string }[]; delaySeconds: number };
const api = async (page: import("@playwright/test").Page) => (await (await page.request.get("/api/diretta")).json()) as Api;

test("lo staff incolla i link, i genitori li trovano e «Svuota» li toglie", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/scout");

  const card = page.locator("[data-diretta-card]");
  await expect(card).toBeVisible();
  const status = card.locator("[data-diretta-status]");
  await expect(status).toHaveAttribute("data-diretta-status", "vuota");
  expect((await api(page)).cameras).toEqual([]);

  await card.locator("summary").click();

  // Due indirizzi da copiare: la pagina dei genitori e la grafica da mettere in Streamlabs Desktop / OBS (dal computer).
  await expect(card.locator("[data-diretta-computer]")).toContainText("Streamlabs");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await card.locator("[data-diretta-copy]").click();
  await expect(card.locator("[data-diretta-copy]")).toContainText("Copiato");
  expect(new URL(await clipboard()).pathname).toBe("/diretta");
  await card.locator("[data-diretta-copy-graphic]").click();
  await expect(card.locator("[data-diretta-copy-graphic]")).toContainText("Copiato");
  expect(new URL(await clipboard()).pathname).toBe("/diretta/grafica");

  await page.locator("#diretta-name-0").fill("Campo");
  await page.locator("#diretta-link-0").fill("https://www.youtube.com/live/AAAAAAAAAAA?feature=share");
  await page.locator("#diretta-name-1").fill("Dietro");
  await page.locator("#diretta-link-1").fill("https://youtu.be/BBBBBBBBBBB");
  await page.locator("#diretta-delay").fill("12");
  await card.locator("[data-diretta-save]").click();
  await expect(card.locator("[data-diretta-ok]")).toContainText("2 camere");
  await expect(status).toHaveAttribute("data-diretta-status", "attiva");
  await expect(status).toContainText("2 camere");

  // Quello che vedono i genitori.
  expect(await api(page)).toEqual({
    cameras: [
      { name: "Campo", id: "AAAAAAAAAAA" },
      { name: "Dietro", id: "BBBBBBBBBBB" },
    ],
    delaySeconds: 12,
  });
  await page.goto("/diretta");
  await expect(page.locator("[data-diretta-player]")).toHaveAttribute("data-diretta-player", "AAAAAAAAAAA");
  await expect(page.locator('[data-diretta-camera="Dietro"]')).toBeVisible();
  await expect(page.locator("[data-diretta-delay]")).toHaveText("12 s");

  // Un link che non è di YouTube si rifiuta, dicendo quale camera, e non cambia niente.
  await page.goto("/admin/scout");
  await expect(card.locator("[data-diretta-status]")).toHaveAttribute("data-diretta-status", "attiva");
  await expect(page.locator("#diretta-link-0")).toHaveValue("https://youtu.be/AAAAAAAAAAA");
  await page.locator("#diretta-link-1").fill("https://vimeo.com/123");
  await card.locator("[data-diretta-save]").click();
  await expect(card.locator("[data-diretta-error]")).toContainText("camera 2");
  expect((await api(page)).cameras).toHaveLength(2);
  // Un ritardo impossibile, lo stesso.
  await page.locator("#diretta-link-1").fill("https://youtu.be/BBBBBBBBBBB");
  await page.locator("#diretta-delay").evaluate((input: HTMLInputElement) => input.removeAttribute("max"));
  await page.locator("#diretta-delay").fill("99");
  await card.locator("[data-diretta-save]").click();
  await expect(card.locator("[data-diretta-error]")).toContainText("0 a 60");

  // A fine partita: «Svuota». I genitori tornano a «La diretta non è ancora iniziata».
  await card.locator("[data-diretta-clear]").click();
  await expect(card.locator("[data-diretta-ok]")).toContainText("svuotata");
  await expect(card.locator("[data-diretta-status]")).toHaveAttribute("data-diretta-status", "vuota");
  expect((await api(page)).cameras).toEqual([]);
  await page.goto("/diretta");
  await expect(page.locator("[data-diretta-idle]")).toBeVisible();
});
