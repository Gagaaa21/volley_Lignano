import { expect, test } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Il manuale dello Scout si può condividere: il link pubblico apre il PDF senza
 * accesso, e «Condividi» (nell'area riservata) manda proprio quel link, dal
 * foglio di condivisione del telefono o, sul computer, copiandolo.
 */

test.use({ serviceWorkers: "block" });

type Shared = { title?: string; text?: string; url?: string };
declare global {
  interface Window {
    __shared?: Shared[];
  }
}

test("manuale condivisibile: il link pubblico apre il PDF senza accesso e «Condividi» manda quello", async ({ page, request, context, baseURL }) => {
  test.setTimeout(120_000);

  // Senza nessun accesso: il PDF si apre nel browser e non finisce nei motori di ricerca.
  const response = await request.get("/manuale-scout.pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toMatch(/^inline; filename="[a-z0-9-]*manuale[a-z0-9-]*\.pdf"$/);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(200_000);
  // Quello per lo staff resta riservato.
  expect((await request.get("/api/scout/manuale")).status()).toBe(401);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
    // Il telefono ha il foglio di condivisione: qui se ne finge uno che si limita a ricordare cosa riceve.
    window.__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: Shared) => {
        window.__shared!.push(data);
      },
    });
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/scout");

  const share = page.locator("[data-scout-share-manual]");
  await expect(share).toBeVisible();
  await expect(share).toContainText("Condividi");
  await share.click();
  await expect.poll(async () => (await page.evaluate(() => window.__shared))?.length).toBe(1);
  const shared = (await page.evaluate(() => window.__shared))![0];
  expect(shared.url).toBe(`${baseURL}/manuale-scout.pdf`);
  expect(shared.title).toContain("Manuale");

  // Sul computer non c'è il foglio di condivisione: il link si copia, e il pulsante lo dice.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await share.click();
  await expect(share).toContainText("Link copiato");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/manuale-scout.pdf`);
  await expect(share).toContainText("Condividi", { timeout: 6_000 });
});
