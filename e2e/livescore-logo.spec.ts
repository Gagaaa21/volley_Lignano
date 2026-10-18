import { expect, test, type Page } from "@playwright/test";

/**
 * Il banner «In diretta» del sito pubblico con il logo dell'avversaria: se la risposta del punteggio ne porta uno si vede,
 * se manca o non si carica restano le iniziali nel colore scelto dal coach. Il punteggio è simulato: non serve uno Scout.
 */

test.use({ serviceWorkers: "block" });

/** Un PNG di un pixel: il «logo» dell'avversaria nelle prove. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");

function liveScore(logo?: string | null) {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: 12, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 9, sets: 0, ...(logo === undefined ? {} : { logo }) },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: new Date().toISOString(),
  };
}

async function openHome(page: Page, live: ReturnType<typeof liveScore>) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
      localStorage.setItem("vl-public-tour-seen-minivolley", "1");
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: la prova funziona comunque.
    }
  });
  await page.route(/\/api\/livescore\/pubblico/, (route) => route.fulfill({ json: { live } }));
  await page.goto("/");
  await expect(page.locator("[data-public-livescore]")).toBeVisible({ timeout: 20_000 });
}

test("con il logo nella risposta il banner mostra il logo dell'avversaria al posto delle iniziali", async ({ page }) => {
  await page.route("**/prova-logo.png", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
  await openHome(page, liveScore("/prova-logo.png"));
  const banner = page.locator("[data-public-livescore]");
  await expect(banner.locator("[data-public-team-logo] img")).toHaveAttribute("src", "/prova-logo.png");
  await expect(banner.locator("[data-public-team-monogram]")).toHaveCount(0);
  await expect(banner).toContainText("Pol. Esempio");
});

test("senza logo, o se il logo non si carica, restano le iniziali", async ({ page }) => {
  await openHome(page, liveScore());
  const banner = page.locator("[data-public-livescore]");
  await expect(banner.locator("[data-public-team-monogram]")).toHaveCount(1);
  await expect(banner.locator("[data-public-team-logo]")).toHaveCount(0);

  const broken = await page.context().newPage();
  await broken.route("**/logo-rotto.png", (route) => route.fulfill({ status: 404, contentType: "image/png", body: "" }));
  await openHome(broken, liveScore("/logo-rotto.png"));
  await expect(broken.locator("[data-public-livescore] [data-public-team-monogram]")).toHaveCount(1, { timeout: 15_000 });
  await expect(broken.locator("[data-public-livescore] [data-public-team-logo]")).toHaveCount(0);
  await broken.close();
});
