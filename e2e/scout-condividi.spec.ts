import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Il manuale dello Scout si esporta come file PDF: dal computer si scarica (dal
 * link «Manuale d'uso» e da «Condividi PDF»); dal telefono «Condividi PDF» apre
 * il foglio di condivisione con il PDF già allegato, senza nessun link pubblico.
 */

test.use({ serviceWorkers: "block" });

type Shared = { name: string; type: string; size: number; title?: string; text?: string };
declare global {
  interface Window {
    __shared?: Shared[];
  }
}

const FILE_NAME = "volley-lignano-scout-manuale-d-uso.pdf";

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

const shareButton = (page: Page) => page.locator("[data-scout-share-manual]");

test("manuale: dal computer si scarica come file PDF, dal link e da «Condividi PDF»", async ({ page, request }) => {
  test.setTimeout(120_000);
  await openHub(page);

  // Il link «Manuale d'uso (PDF)» scarica il file.
  const [linkDownload] = await Promise.all([page.waitForEvent("download"), page.locator("[data-scout-manual-link]").first().click()]);
  expect(linkDownload.suggestedFilename()).toBe(FILE_NAME);
  const linkBytes = readFileSync((await linkDownload.path())!);
  expect(linkBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(linkBytes.length).toBeGreaterThan(200_000);

  // «Condividi PDF», senza foglio di condivisione, scarica lo stesso file e lo dice.
  await expect(shareButton(page)).toContainText("Condividi PDF");
  const [shareDownload] = await Promise.all([page.waitForEvent("download"), shareButton(page).click()]);
  expect(shareDownload.suggestedFilename()).toBe(FILE_NAME);
  const shareBytes = readFileSync((await shareDownload.path())!);
  expect(shareBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(shareBytes.length).toBe(linkBytes.length);
  await expect(shareButton(page)).toContainText("PDF scaricato");
  await expect(shareButton(page)).toContainText("Condividi PDF", { timeout: 8_000 });

  // Niente link pubblico: il manuale è solo per chi ha l'accesso.
  expect((await request.get("/api/scout/manuale")).status()).toBe(401);
  expect((await request.get("/manuale-scout.pdf")).status()).toBe(404);
});

test("manuale: dal telefono «Condividi PDF» apre il foglio di condivisione con il file allegato", async ({ page }) => {
  test.setTimeout(120_000);
  let downloads = 0;
  page.on("download", () => (downloads += 1));
  await openHub(page, { phone: true });

  // Il file si prepara da solo appena si apre la pagina; poi un solo tocco basta.
  await expect(shareButton(page)).toHaveAttribute("data-share-ready", "true", { timeout: 20_000 });
  await shareButton(page).click();
  await expect.poll(async () => (await page.evaluate(() => window.__shared))?.length).toBe(1);
  const [shared] = (await page.evaluate(() => window.__shared))!;
  expect(shared.name).toBe(FILE_NAME);
  expect(shared.type).toBe("application/pdf");
  expect(shared.size).toBeGreaterThan(200_000);
  expect(shared.title).toContain("Manuale");
  expect(downloads).toBe(0);
  await expect(shareButton(page)).toContainText("Condividi PDF");
});

test("manuale: se la rete è lenta il pulsante prepara il PDF e al tocco dopo apre il foglio di condivisione", async ({ page }) => {
  test.setTimeout(120_000);
  // La prima richiesta del PDF (quella che parte da sola) viene tenuta ferma qualche secondo.
  let first = true;
  await page.route("**/api/scout/manuale", async (route) => {
    if (first) {
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
    await route.continue();
  });
  await openHub(page, { phone: true });

  await expect(shareButton(page)).toBeVisible();
  await shareButton(page).click();
  await expect(shareButton(page)).toContainText("Preparo il PDF");
  await expect(shareButton(page)).toContainText("Pronto: tocca per condividere", { timeout: 20_000 });
  expect(await page.evaluate(() => window.__shared?.length)).toBe(0);
  await shareButton(page).click();
  await expect.poll(async () => (await page.evaluate(() => window.__shared))?.length).toBe(1);
  await expect(shareButton(page)).toContainText("Condividi PDF");
});
