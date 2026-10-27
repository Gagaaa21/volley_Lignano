import { expect, test, type Page } from "@playwright/test";

/**
 * Un solo pulsante «PDF», su ogni dispositivo. Dal computer è un normale link: il PDF si apre in una scheda e il browser ha il suo
 * visualizzatore con «Scarica» e «Stampa» (anche se il browser sa condividere file, come Chrome su Windows: lì conta lo schermo, e
 * un computer si usa con il mouse). Da Android è un pulsante che apre il PDF in un foglio dentro la pagina con «Condividi» e
 * «Scarica». Su iPhone e iPad vedi pdf-iphone.spec.ts.
 */

test.use({ serviceWorkers: "block" });

type Shared = { name: string; type: string; size: number; title?: string };
declare global {
  interface Window {
    __pdfShared?: Shared[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

/** Il browser sa mandare un file con il foglio di condivisione: qui se ne finge uno che ricorda cosa riceve. */
async function withShare(page: Page) {
  await page.addInitScript(() => {
    window.__pdfShared = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => Boolean(data?.files?.length) });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        window.__pdfShared!.push({ name: file.name, type: file.type, size: file.size, title: data.title });
      },
    });
  });
}

test.describe("dal computer", () => {
  test("il PDF è un normale link, anche se il browser sa condividere file; niente secondo pulsante «Condividi»", async ({ page }) => {
    await withShare(page);
    await page.goto("/?cat=U14");
    const pdf = page.locator("[data-public-matches-pdf]");
    await expect(pdf).toHaveJSProperty("tagName", "A");
    await expect(pdf).toHaveAttribute("href", "/calendario-partite.pdf?cat=U14");
    await expect(pdf).toContainText("Scarica le partite (PDF)");
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /condividi/i })).toHaveCount(0);
    // Un clic scarica il file e la pagina resta dov'è.
    const [download] = await Promise.all([page.waitForEvent("download"), pdf.click()]);
    expect(download.suggestedFilename()).toBe("calendario-partite-under-14-volley-lignano.pdf");
    await expect(page.locator("[data-pdf-sheet]")).toHaveCount(0);
  });
});

test.describe("da Android", () => {
  test.use({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
  });

  test("un solo pulsante apre il foglio con «Condividi» e «Scarica»", async ({ page }) => {
    test.setTimeout(90_000);
    await withShare(page);
    await page.goto("/?cat=U14");
    const url = page.url();
    const pdf = page.locator("[data-public-matches-pdf]");
    await expect(pdf).toHaveJSProperty("tagName", "BUTTON");
    await expect(page.getByRole("button", { name: /condividi/i })).toHaveCount(0);

    await pdf.click();
    const sheet = page.locator("[data-pdf-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-pdf-sheet-preview]")).toHaveAttribute("src", /^blob:/);

    // «Condividi» manda il file con il foglio di condivisione.
    await sheet.locator("[data-pdf-sheet-share]").click();
    await expect.poll(async () => (await page.evaluate(() => window.__pdfShared))?.length).toBe(1);
    const [shared] = (await page.evaluate(() => window.__pdfShared))!;
    expect(shared.name).toBe("calendario-partite-under-14-volley-lignano.pdf");
    expect(shared.type).toBe("application/pdf");
    expect(shared.title).toMatch(/Calendario partite Under 14/);

    // «Scarica» lo salva sul telefono (su Android un download normale non toglie dalla pagina).
    const [download] = await Promise.all([page.waitForEvent("download"), sheet.locator("[data-pdf-sheet-download]").click()]);
    expect(download.suggestedFilename()).toBe("calendario-partite-under-14-volley-lignano.pdf");
    await expect(sheet.locator("[data-pdf-sheet-message]")).toContainText("PDF scaricato");

    await sheet.locator("[data-pdf-sheet-close]").click();
    await expect(sheet).toHaveCount(0);
    expect(page.url()).toBe(url);
  });
});
