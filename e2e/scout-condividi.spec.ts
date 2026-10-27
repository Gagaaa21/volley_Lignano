import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Il manuale dello Scout è un file PDF con un solo pulsante: dal computer «Manuale d'uso (PDF)» lo scarica; dal telefono lo apre in un
 * foglio dentro la pagina, da cui «Condividi» lo manda come file (WhatsApp, e-mail…) con il foglio di condivisione del telefono. Nessun
 * secondo pulsante «Condividi PDF» e nessun link pubblico.
 */

test.use({ serviceWorkers: "block" });

type Shared = { name: string; type: string; size: number; title?: string; text?: string };
declare global {
  interface Window {
    __shared?: Shared[];
  }
}

const FILE_NAME = "volley-lignano-scout-manuale-d-uso.pdf";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

async function openHub(page: Page, options: { phone?: boolean } = {}) {
  await page.addInitScript((phone) => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-scout-welcome-dismissed", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
    if (phone) {
      // Il telefono sa mandare un file con il foglio di condivisione: qui se ne finge uno che ricorda cosa riceve.
      window.__shared = [];
      Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => Boolean(data?.files?.length) });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files![0];
          window.__shared!.push({ name: file.name, type: file.type, size: file.size, title: data.title, text: data.text });
        },
      });
    }
  }, Boolean(options.phone));
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/scout");
}

const manualButton = (page: Page) => page.locator("[data-scout-manual-link]").first();
const sheet = (page: Page) => page.locator("[data-pdf-sheet]");

test("manuale: dal computer un solo pulsante scarica il file PDF", async ({ page, request }) => {
  test.setTimeout(120_000);
  await openHub(page);

  // Il pulsante «Manuale d'uso (PDF)» scarica il file; non ce n'è un secondo «Condividi».
  await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent("download"), manualButton(page).click()]);
  expect(download.suggestedFilename()).toBe(FILE_NAME);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(200_000);

  // Niente link pubblico: il manuale è solo per chi ha l'accesso.
  expect((await request.get("/api/scout/manuale")).status()).toBe(401);
  expect((await request.get("/manuale-scout.pdf")).status()).toBe(404);
});

test.describe("dal telefono", () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("manuale: «Manuale d'uso (PDF)» apre il foglio e «Condividi» manda il file allegato", async ({ page }) => {
    test.setTimeout(120_000);
    let downloads = 0;
    page.on("download", () => (downloads += 1));
    await openHub(page, { phone: true });
    const url = page.url();

    // Un pulsante, non un link al file: con il sito sulla schermata Home dell'iPhone non si tornerebbe più indietro.
    await expect(manualButton(page)).toHaveJSProperty("tagName", "BUTTON");
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);
    await manualButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator("[data-pdf-sheet-preview]")).toHaveAttribute("src", /^blob:/);
    await sheet(page).locator("[data-pdf-sheet-share]").click();
    await expect.poll(async () => (await page.evaluate(() => window.__shared))?.length).toBe(1);
    const [shared] = (await page.evaluate(() => window.__shared))!;
    expect(shared.name).toBe(FILE_NAME);
    expect(shared.type).toBe("application/pdf");
    expect(shared.size).toBeGreaterThan(200_000);
    expect(shared.title).toContain("Manuale");
    await sheet(page).locator("[data-pdf-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
    expect(page.url()).toBe(url);
    expect(downloads).toBe(0);
  });

  test("manuale: se la rete è lenta il pulsante mostra che prepara il PDF e poi si apre il foglio", async ({ page }) => {
    test.setTimeout(120_000);
    // La richiesta del PDF viene tenuta ferma qualche secondo, perché si veda che il pulsante sta lavorando.
    await page.route("**/api/scout/manuale", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await route.continue();
    });
    await openHub(page, { phone: true });

    await manualButton(page).click();
    await expect(manualButton(page)).toHaveAttribute("aria-busy", "true");
    await expect(manualButton(page)).toBeDisabled();
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(manualButton(page)).toHaveAttribute("aria-busy", "false");
    await sheet(page).locator("[data-pdf-sheet-close]").click();
    await expect(sheet(page)).toHaveCount(0);
  });
});
